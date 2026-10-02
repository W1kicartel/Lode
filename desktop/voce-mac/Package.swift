// swift-tools-version:6.0
// lode-voce: il riconoscimento vocale di Lode su Mac. Parakeet TDT v3 (NVIDIA) sul Neural Engine, via FluidAudio
// (FluidInference, Apache 2.0: lo stesso motore dell'app FluidVoice). Offline, gratis, italiano compreso.
import PackageDescription
let package = Package(
  name: "lode-voce",
  platforms: [.macOS(.v14)],
  dependencies: [.package(url: "https://github.com/FluidInference/FluidAudio.git", from: "0.12.4")],
  targets: [.executableTarget(name: "lode-voce", dependencies: [.product(name: "FluidAudio", package: "FluidAudio")])]
)
