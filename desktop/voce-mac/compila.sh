#!/usr/bin/env bash
# Compila lode-voce (Parakeet v3 via FluidAudio) e lo copia in desktop/bin. Serve un Mac con Apple Silicon e gli strumenti
# di Apple (xcode-select --install oppure Xcode).
# I Command Line Tools 16.4 hanno due difetti che rompono il package manager di Swift; qui si aggirano senza toccare il sistema:
#  1. PackageDescription.private.swiftinterface vecchio (febbraio 2024) che non corrisponde alla libreria → si usa una copia
#     dei file del package manager senza le interfacce private (SWIFTPM_CUSTOM_LIBS_DIR);
#  2. module.modulemap di SwiftBridging doppio (usr/include/swift e SDK) → lo si nasconde con una sovrapposizione (vfsoverlay).
set -euo pipefail
cd "$(dirname "$0")"
DEV="$(xcode-select -p)"; PM="$DEV/usr/lib/swift/pm"; [ -d "$PM" ] || PM="$DEV/Toolchains/XcodeDefault.xctoolchain/usr/lib/swift/pm"
rm -rf .pm && mkdir -p .pm && cp -R "$PM/." .pm/ && find .pm -name '*.private.swiftinterface' -delete
: > .pm/vuoto.modulemap
printf '{"version":0,"case-sensitive":"false","roots":[{"type":"file","name":"%s/usr/include/swift/module.modulemap","external-contents":"%s/.pm/vuoto.modulemap"}]}\n' "$DEV" "$PWD" > .pm/sovrapponi.yaml
O="$PWD/.pm/sovrapponi.yaml"
SWIFTPM_CUSTOM_LIBS_DIR="$PWD/.pm" swift build -c release -Xmanifest -vfsoverlay -Xmanifest "$O" -Xswiftc -vfsoverlay -Xswiftc "$O" -Xcc -ivfsoverlay -Xcc "$O"
mkdir -p ../bin && cp .build/release/lode-voce ../bin/lode-voce
echo "pronto: desktop/bin/lode-voce"
