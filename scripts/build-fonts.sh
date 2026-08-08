#!/usr/bin/env bash
#
# Rebuilds the subset FiraGO web fonts in `public/fonts`.
#
# You should not need to run this — the .woff2 files are committed, because a
# build that reaches out to GitHub is a build that breaks when GitHub does. This
# exists so the files are reproducible rather than mystery binaries: run it to
# add a weight, widen the character set, or move to a new FiraGO release.
#
# Requires python3. Everything else is installed into a throwaway venv.
#
#   ./scripts/build-fonts.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

# FiraGO ships no .woff2 upstream, only .ttf/.otf, so the conversion is on us.
UPSTREAM="https://raw.githubusercontent.com/bBoxType/FiraGO/master/Fonts/FiraGO_TTF_1001/Roman"

# Weights that layout.tsx actually declares. Adding one here is half the job —
# it needs a matching `src` entry there too, or nothing will load it.
WEIGHTS=(Regular Medium SemiBold Bold)

# Latin + Georgian Mkhedruli (U+10A0-10FF), plus the punctuation and symbols a
# UI reaches for. Deliberately no Mtavruli (U+1C90-1CBF): FiraGO has no glyphs
# for it, so listing the range would just be a lie in the manifest.
UNICODES="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC"
UNICODES="$UNICODES,U+0300-0301,U+2000-206F,U+2074,U+20AC,U+2116,U+2122"
UNICODES="$UNICODES,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD,U+10A0-10FF"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

echo "Setting up fonttools…"
python3 -m venv "$WORK/venv"
"$WORK/venv/bin/pip" install --quiet fonttools brotli

mkdir -p public/fonts

for weight in "${WEIGHTS[@]}"; do
  echo "Building $weight…"
  curl -sfL -o "$WORK/FiraGO-$weight.ttf" "$UPSTREAM/FiraGO-$weight.ttf"

  # --layout-features='*' keeps kerning and the Georgian shaping features; the
  # default set drops them and the text goes subtly loose.
  "$WORK/venv/bin/pyftsubset" "$WORK/FiraGO-$weight.ttf" \
    --unicodes="$UNICODES" \
    --layout-features='*' \
    --flavor=woff2 \
    --output-file="public/fonts/FiraGO-$weight.woff2"
done

curl -sfL -o public/fonts/OFL.txt "https://raw.githubusercontent.com/bBoxType/FiraGO/master/OFL.txt"

echo
ls -lh public/fonts/
