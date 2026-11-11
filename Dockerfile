# CURUPIRA — imagem de produção
# Node (Next.js standalone) + yt-dlp + ffmpeg + Deno (runtime de JS que o
# yt-dlp exige para decifrar o YouTube).

# ---- 1. dependências --------------------------------------------------------
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---- 2. build ---------------------------------------------------------------
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 3. runtime -------------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

# yt-dlp num venv próprio, e não no Python do sistema: assim ele pode ser
# atualizado na subida do container pelo usuário `node`, sem root.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3 python3-venv ca-certificates tini \
 && rm -rf /var/lib/apt/lists/* \
 && python3 -m venv /opt/yt-dlp \
 && /opt/yt-dlp/bin/pip install --no-cache-dir --upgrade "yt-dlp[default,curl-cffi]" \
 && chown -R node:node /opt/yt-dlp

COPY --from=denoland/deno:bin /deno /usr/local/bin/deno

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    PATH=/opt/yt-dlp/bin:$PATH \
    CURUPIRA_OUTPUT_DIR=/data/downloads \
    CURUPIRA_RETENTION_HOURS=6

WORKDIR /app
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY docker/entrypoint.sh /usr/local/bin/curupira-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/curupira-entrypoint \
 && chmod 755 /usr/local/bin/curupira-entrypoint \
 && mkdir -p /data/downloads \
 && chown -R node:node /data

USER node
EXPOSE 3000
VOLUME ["/data/downloads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/entrar',{redirect:'manual'}).then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"

# tini como PID 1: repassa sinais e recolhe processos órfãos do ffmpeg.
ENTRYPOINT ["/usr/bin/tini", "--", "curupira-entrypoint"]
CMD ["node", "server.js"]
