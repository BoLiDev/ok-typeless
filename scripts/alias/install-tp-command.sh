#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TP_SCRIPT_PATH="${SCRIPT_DIR}/tp-start.sh"
ZSHRC_PATH="${ZDOTDIR:-$HOME}/.zshrc"

MARKER_BEGIN="# >>> ok-typeless tp command >>>"
MARKER_END="# <<< ok-typeless tp command <<<"
LEGACY_MARKER_BEGIN="# >>> ok-typeless TP command >>>"
LEGACY_MARKER_END="# <<< ok-typeless TP command <<<"
ALIAS_LINE="alias tp='bash \"${TP_SCRIPT_PATH}\"'"

if [[ ! -f "${ZSHRC_PATH}" ]]; then
  touch "${ZSHRC_PATH}"
fi

# Remove existing managed block (both legacy TP and new tp) before appending.
TEMP_FILE="$(mktemp)"
awk \
  -v begin="${MARKER_BEGIN}" \
  -v end="${MARKER_END}" \
  -v legacy_begin="${LEGACY_MARKER_BEGIN}" \
  -v legacy_end="${LEGACY_MARKER_END}" \
  '
  $0 == begin || $0 == legacy_begin { in_block = 1; next }
  $0 == end || $0 == legacy_end { in_block = 0; next }
  in_block == 0 { print }
  ' \
  "${ZSHRC_PATH}" > "${TEMP_FILE}"
mv "${TEMP_FILE}" "${ZSHRC_PATH}"

{
  echo ""
  echo "${MARKER_BEGIN}"
  echo "${ALIAS_LINE}"
  echo "${MARKER_END}"
} >> "${ZSHRC_PATH}"

echo "Installed tp command to ${ZSHRC_PATH}."
echo "Run 'source ${ZSHRC_PATH}' or open a new terminal to use tp."
