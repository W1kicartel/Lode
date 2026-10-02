// swift-tools-version:6.0
// lode-voce: il riconoscimento vocale di Lode su Mac. Parakeet TDT v3 (NVIDIA) sul Neural Engine, via FluidAudio
// (FluidInference, Apache 2.0: lo stesso motore dell'app FluidVoice). Offline, gratis, italiano compreso.
// FluidAudio è fermo alla versione compilata e provata (exact, e Package.resolved nel repository con lo stesso commit):
// lode-voce finisce nel .dmg e ascolta il microfono, quindi una versione nuova entra solo con un commit da leggere.
// Per aggiornarla: cambia la versione qui, poi `bash compila.sh --aggiorna` (riscrive Package.resolved), prova la voce e fai
// il commit di tutti e due i file. Senza --aggiorna compila.sh, come rilascio.yml, usa solo Package.resolved.
import PackageDescription
let package = Package(
  name: "lode-voce",
  platforms: [.macOS(.v14)],
  dependencies: [.package(url: "https://github.com/FluidInference/FluidAudio.git", exact: "0.17.5")],
  targets: [.executableTarget(name: "lode-voce", dependencies: [.product(name: "FluidAudio", package: "FluidAudio")])]
)
