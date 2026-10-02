// lode-voce: l'orecchio di Lode sul Mac. Parakeet TDT v3 (NVIDIA, 25 lingue europee, italiano compreso) sul Neural
// Engine, con FluidAudio (FluidInference, Apache 2.0, lo stesso motore dell'app FluidVoice). Tutto offline.
//
// Parla con l'app desktop (desktop/voce.mjs) a righe JSON:
//   all'avvio:   {"evento":"progresso","p":0.42}…  poi  {"evento":"pronto","sec":1.8}
//   richiesta:   {"id":"7","file":"/tmp/…f32"}       (audio mono 16 kHz, Float32 little-endian, poi cancellato)
//   risposta:    {"id":"7","testo":"…","sec":0.21}  oppure  {"id":"7","errore":"…"}
// Prova a mano: lode-voce --prova lezione.wav
import AVFoundation
import FluidAudio
import Foundation

@inline(__always) func scrivi(_ x: [String: Any]) {
  if let d = try? JSONSerialization.data(withJSONObject: x), let s = String(data: d, encoding: .utf8) {
    FileHandle.standardOutput.write((s + "\n").data(using: .utf8)!)
  }
}

let argomenti = CommandLine.arguments
let cartella: URL? = argomenti.firstIndex(of: "--modelli").map { URL(fileURLWithPath: argomenti[$0 + 1], isDirectory: true) }

@main
struct LodeVoce {
  static func main() async {
    let t0 = Date()
    do {
      let modelli = try await AsrModels.downloadAndLoad(to: cartella, version: .v3) { p in
        scrivi(["evento": "progresso", "p": p.fractionCompleted])
      }
      let asr = AsrManager(config: .default)
      try await asr.loadModels(modelli)
      // un giro a vuoto: la prima trascrizione vera non paga la compilazione del modello
      var s0 = try TdtDecoderState(decoderLayers: 2)
      _ = try? await asr.transcribe([Float](repeating: 0, count: 16000), decoderState: &s0, language: .italian)
      scrivi(["evento": "pronto", "sec": Date().timeIntervalSince(t0)])

      if let i = argomenti.firstIndex(of: "--prova") {
        var st = try TdtDecoderState(decoderLayers: 2)
        let t = Date()
        let r = try await asr.transcribe(URL(fileURLWithPath: argomenti[i + 1]), decoderState: &st, language: .italian)
        scrivi(["testo": r.text, "sec": Date().timeIntervalSince(t), "durata": r.duration])
        return
      }

      while let riga = readLine() {
        guard let d = riga.data(using: .utf8), let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any],
          let id = j["id"] as? String, let file = j["file"] as? String
        else { continue }
        let t = Date()
        do {
          let dati = try Data(contentsOf: URL(fileURLWithPath: file))
          try? FileManager.default.removeItem(atPath: file)
          let campioni = dati.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
          if campioni.count < 8000 { scrivi(["id": id, "testo": "", "sec": 0]); continue }
          var st = try TdtDecoderState(decoderLayers: 2)
          let r = try await asr.transcribe(campioni, decoderState: &st, language: .italian)
          scrivi(["id": id, "testo": r.text, "sec": Date().timeIntervalSince(t)])
        } catch {
          scrivi(["id": id, "errore": error.localizedDescription])
        }
      }
    } catch {
      scrivi(["evento": "errore", "errore": error.localizedDescription])
      exit(1)
    }
  }
}
