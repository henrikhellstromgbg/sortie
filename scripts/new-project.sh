#!/usr/bin/env bash
# Usage: ./scripts/new-project.sh <project-name>
# Copies base-ds into ~/sites/<project-name> and sets up the theme file.
set -euo pipefail

NAME="${1:?Usage: new-project.sh <project-name>}"
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/sites/$NAME"

if [ -e "$DEST" ]; then
  echo "Error: $DEST already exists." >&2
  exit 1
fi

mkdir -p "$DEST"
rsync -a --exclude node_modules --exclude .git --exclude tools/scales-output.txt "$SRC/" "$DEST/"
cp "$DEST/tokens/theme.example.css" "$DEST/tokens/theme.css"
sed -i '' "s/\"name\": \"base-ds\"/\"name\": \"$NAME\"/" "$DEST/package.json" 2>/dev/null || \
  sed -i "s/\"name\": \"base-ds\"/\"name\": \"$NAME\"/" "$DEST/package.json"

echo "Created $DEST"
echo "Next steps:"
echo "  1. cd $DEST && npm install"
echo "  2. Edit tokens/theme.css with the project's brand colors (OKLCH)"
echo "  3. npm run contrast-check"
echo "  4. npm run build"
