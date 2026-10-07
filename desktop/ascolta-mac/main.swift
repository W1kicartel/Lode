// lode-ascolta: l'audio che esce dal Mac, per la «Lezione dal computer» (js/computer.js, desktop/ascolta.mjs).
// Usa il process tap di CoreAudio (macOS 14.2+): chiede solo il permesso dell'audio di sistema (NSAudioCaptureUsageDescription),
// non quello dello schermo. Sullo stdout escono campioni Float32 little-endian, mono, a 16 kHz (come il microfono di Lode);
// sullo stderr una riga «PRONTO» quando parte, o «ERRORE <cosa> <codice>». Niente va su disco. Si ferma quando lo stdin si
// chiude (Lode esce o smette di ascoltare) o con SIGTERM; il tap e il dispositivo aggregato si tolgono sempre.
// Compilare: bash compila.sh (swiftc, nessuna dipendenza).
import CoreAudio
import AudioToolbox
import Foundation

func errore(_ cosa: String, _ codice: OSStatus) -> Never {
  FileHandle.standardError.write("ERRORE \(cosa) \(codice)\n".data(using: .utf8)!)
  exit(1)
}
func leggi<T>(_ oggetto: AudioObjectID, _ selettore: AudioObjectPropertySelector, _ valore: inout T) -> OSStatus {
  var indirizzo = AudioObjectPropertyAddress(mSelector: selettore, mScope: kAudioObjectPropertyScopeGlobal, mElement: kAudioObjectPropertyElementMain)
  var dim = UInt32(MemoryLayout<T>.size)
  return AudioObjectGetPropertyData(oggetto, &indirizzo, 0, nil, &dim, &valore)
}

guard #available(macOS 14.2, *) else { errore("macos", -1) }

// 1. il tap: tutto l'audio del sistema, in stereo, senza silenziarlo (lo studente continua a sentire la lezione)
let descrizione = CATapDescription(stereoGlobalTapButExcludeProcesses: [])
descrizione.uuid = UUID()
descrizione.muteBehavior = .unmuted
descrizione.isPrivate = true
descrizione.name = "Lode"
var tap = AudioObjectID(kAudioObjectUnknown)
var st = AudioHardwareCreateProcessTap(descrizione, &tap)
if st != noErr { errore("tap", st) }

// 2. il dispositivo aggregato che legge dal tap (privato: non compare nelle impostazioni audio)
var uscita = AudioObjectID(kAudioObjectUnknown)
st = leggi(AudioObjectID(kAudioObjectSystemObject), kAudioHardwarePropertyDefaultSystemOutputDevice, &uscita)
if st != noErr { errore("uscita", st) }
var uidUscita: CFString = "" as CFString
st = leggi(uscita, kAudioDevicePropertyDeviceUID, &uidUscita)
if st != noErr { errore("uid", st) }
let aggregato: [String: Any] = [
  kAudioAggregateDeviceNameKey: "Lode ascolta",
  kAudioAggregateDeviceUIDKey: UUID().uuidString,
  kAudioAggregateDeviceMainSubDeviceKey: uidUscita as String,
  kAudioAggregateDeviceIsPrivateKey: true,
  kAudioAggregateDeviceIsStackedKey: false,
  kAudioAggregateDeviceTapAutoStartKey: true,
  kAudioAggregateDeviceSubDeviceListKey: [[kAudioSubDeviceUIDKey: uidUscita as String]],
  kAudioAggregateDeviceTapListKey: [[kAudioSubTapDriftCompensationKey: true, kAudioSubTapUIDKey: descrizione.uuid.uuidString]],
]
var dispositivo = AudioObjectID(kAudioObjectUnknown)
st = AudioHardwareCreateAggregateDevice(aggregato as CFDictionary, &dispositivo)
if st != noErr { AudioHardwareDestroyProcessTap(tap); errore("aggregato", st) }

// il formato del tap (di solito Float32 a 48 kHz, 2 canali, interleaved)
var formato = AudioStreamBasicDescription()
st = leggi(tap, kAudioTapPropertyFormat, &formato)
if st != noErr { errore("formato", st) }
let canali = max(1, Int(formato.mChannelsPerFrame)), passo = formato.mSampleRate / 16000.0
let interleaved = (formato.mFormatFlags & kAudioFormatFlagIsNonInterleaved) == 0

// 3. ogni blocco: canali → mono, poi a 16 kHz (media dei campioni di ogni passo: un filtro passa-basso semplice), su stdout
let stdout = FileHandle.standardOutput
var resto = 0.0, accumulo: Float = 0, contati = 0
let coda = DispatchQueue(label: "lode.ascolta")
var proc: AudioDeviceIOProcID?
st = AudioDeviceCreateIOProcIDWithBlock(&proc, dispositivo, coda) { _, ingresso, _, _, _ in
  let lista = UnsafeMutableAudioBufferListPointer(UnsafeMutablePointer(mutating: ingresso))
  guard let primo = lista.first, let dati = primo.mData else { return }
  let fotogrammi = interleaved ? Int(primo.mDataByteSize) / (MemoryLayout<Float>.size * canali) : Int(primo.mDataByteSize) / MemoryLayout<Float>.size
  var fuori = [Float](); fuori.reserveCapacity(fotogrammi / 2 + 1)
  for i in 0..<fotogrammi {
    var m: Float = 0
    if interleaved { let p = dati.assumingMemoryBound(to: Float.self); for c in 0..<canali { m += p[i * canali + c] } }
    else { for c in 0..<min(canali, lista.count) { if let d = lista[c].mData { m += d.assumingMemoryBound(to: Float.self)[i] } } }
    accumulo += m / Float(canali); contati += 1; resto += 1
    if resto >= passo { fuori.append(accumulo / Float(contati)); accumulo = 0; contati = 0; resto -= passo }
  }
  if !fuori.isEmpty { fuori.withUnsafeBufferPointer { b in stdout.write(Data(buffer: b)) } }
}
if st != noErr { errore("ioproc", st) }

func chiudi() {
  if let p = proc { AudioDeviceStop(dispositivo, p); AudioDeviceDestroyIOProcID(dispositivo, p) }
  AudioHardwareDestroyAggregateDevice(dispositivo)
  AudioHardwareDestroyProcessTap(tap)
}
st = AudioDeviceStart(dispositivo, proc)
if st != noErr { chiudi(); errore("avvio", st) }
FileHandle.standardError.write("PRONTO \(Int(formato.mSampleRate)) \(canali)\n".data(using: .utf8)!)

// si ferma con SIGTERM/SIGINT o quando lo stdin si chiude (Lode è uscito)
signal(SIGPIPE, SIG_IGN)
for s in [SIGTERM, SIGINT] {
  signal(s, SIG_IGN)
  let fonte = DispatchSource.makeSignalSource(signal: s, queue: .main)
  fonte.setEventHandler { chiudi(); exit(0) }
  fonte.resume()
  _ = Unmanaged.passRetained(fonte)
}
DispatchQueue.global().async {
  while true { let d = FileHandle.standardInput.availableData; if d.isEmpty { break } }
  DispatchQueue.main.async { chiudi(); exit(0) }
}
dispatchMain()
