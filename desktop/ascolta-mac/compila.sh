#!/usr/bin/env bash
# Compila lode-ascolta (l'audio del Mac per la «Lezione dal computer») e lo copia in desktop/bin. Serve macOS con gli
# strumenti di Apple (xcode-select --install) e un SDK di macOS 14.2 o più recente. Un file solo, nessuna dipendenza.
# I Command Line Tools 16.4 hanno il module.modulemap di SwiftBridging doppio (usr/include/swift e SDK): come in
# voce-mac/compila.sh lo si nasconde con una sovrapposizione (vfsoverlay), senza toccare il sistema.
set -euo pipefail
cd "$(dirname "$0")"
DEV="$(xcode-select -p)"
mkdir -p ../bin .build && : > .build/vuoto.modulemap
printf '{"version":0,"case-sensitive":"false","roots":[{"type":"file","name":"%s/usr/include/swift/module.modulemap","external-contents":"%s/.build/vuoto.modulemap"}]}\n' "$DEV" "$PWD" > .build/sovrapponi.yaml
O="$PWD/.build/sovrapponi.yaml"
for a in arm64 x86_64; do swiftc -O -target "$a-apple-macos14.2" -vfsoverlay "$O" -Xcc -ivfsoverlay -Xcc "$O" -o ".build/lode-ascolta-$a" main.swift -framework CoreAudio -framework AudioToolbox; done
lipo -create -output ../bin/lode-ascolta .build/lode-ascolta-arm64 .build/lode-ascolta-x86_64
echo "pronto: desktop/bin/lode-ascolta"
