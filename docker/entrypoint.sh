#!/bin/sh
set -e

# O YouTube muda o site com frequência e um yt-dlp de poucas semanas já começa
# a falhar. Atualizar na subida faz de "reiniciar o container" o remédio. Sem
# rede ou sem PyPI, segue com a versão que veio na imagem.
if [ "${CURUPIRA_UPDATE_YTDLP:-1}" = "1" ]; then
  timeout 120 pip install --quiet --no-cache-dir --disable-pip-version-check --upgrade "yt-dlp[default,curl-cffi]" \
    || echo "[curupira] nao consegui atualizar o yt-dlp; seguindo com a versao da imagem"
fi

echo "[curupira] yt-dlp $(yt-dlp --version 2>/dev/null || echo '?') · deno $(deno --version 2>/dev/null | head -n1 | cut -d' ' -f2)"
exec "$@"
