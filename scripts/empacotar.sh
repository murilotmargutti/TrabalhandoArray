#!/usr/bin/env bash
# Empacota e instala o app na TV via Developer Mode.
#
# Precisa do CLI da LG uma única vez:
#   npm install -g @webos-tools/cli
#
# E da TV registrada uma única vez (IP da TV, Developer Mode ligado e aberto):
#   ares-setup-device --add tv --info "host=192.168.0.XX" --info "port=9922" --info "username=prisoner"
#   ares-novacom --device tv --getkey
#
# Uso:
#   ./scripts/empacotar.sh            # só gera o .ipk
#   ./scripts/empacotar.sh tv         # gera, instala e abre na TV chamada "tv"

set -euo pipefail

RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="$RAIZ/app"
SAIDA="$RAIZ/dist"
DISPOSITIVO="${1:-}"

if ! command -v ares-package >/dev/null 2>&1; then
  echo "ares-package não encontrado. Instale com: npm install -g @webos-tools/cli" >&2
  exit 1
fi

ID="$(python3 -c "import json,sys; print(json.load(open('$APP/appinfo.json'))['id'])")"

# Os ícones são gerados, não versionados como binário editado à mão.
python3 "$RAIZ/scripts/gerar-icones.py" >/dev/null

mkdir -p "$SAIDA"
rm -f "$SAIDA"/*.ipk
ares-package "$APP" --outdir "$SAIDA"

IPK="$(ls -1 "$SAIDA"/*.ipk | head -n1)"
echo "gerado: $IPK"

if [ -z "$DISPOSITIVO" ]; then
  echo "Para instalar:  ./scripts/empacotar.sh <nome-do-dispositivo>"
  exit 0
fi

ares-install --device "$DISPOSITIVO" "$IPK"
ares-launch --device "$DISPOSITIVO" "$ID"
echo "aberto na TV: $ID"
echo
echo "Para ver o console e medir de dentro do app:"
echo "  ares-inspect --device $DISPOSITIVO --app $ID"
