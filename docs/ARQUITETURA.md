# CURUPIRA — por dentro

Referência técnica. O [README](../README.md) é a vitrine; este arquivo é o manual de quem vai
mexer no código.

## Requisitos (fora do Docker)

| Dependência | Versão | Para quê |
|---|---|---|
| Node.js | 20.9+ | rodar o Next.js 16 |
| Python | 3.9+ | rodar o yt-dlp |
| yt-dlp | recente | baixar a mídia |
| ffmpeg | qualquer | juntar vídeo+áudio em alta resolução e gerar MP3 |
| Deno | 2+ | runtime de JS que o yt-dlp exige para decifrar o YouTube |

```bash
pip install --upgrade "yt-dlp[default]"
# ffmpeg: https://ffmpeg.org/download.html (ou `winget install Gyan.FFmpeg` no Windows)
```

O app detecta as dependências sozinho e mostra o estado no cabeçalho. Sem ffmpeg ele
**continua funcionando**, só perde MP3 e resoluções que exigem mesclagem.

```bash
npm install
npm run dev      # http://localhost:3000
npm run build && npm start   # produção
```

No Windows, `launcher/CURUPIRA.cmd` instala, compila, sobe o servidor e abre o navegador.

## Variáveis de ambiente

| Variável | Padrão | Efeito |
|---|---|---|
| `CURUPIRA_OUTPUT_DIR` | `./downloads` (Docker: `/data/downloads`) | onde os arquivos são gravados |
| `YTDLP_PATH` | descoberto | caminho do yt-dlp se não estiver no PATH |
| `CURUPIRA_ACCESS_KEY` | — | liga o portão de senha |
| `CURUPIRA_RETENTION_HOURS` | — (Docker: `6`) | apaga arquivos baixados depois de N horas |
| `CURUPIRA_UPDATE_YTDLP` | `1` | (Docker) atualiza o yt-dlp a cada subida do container |
| `CURUPIRA_PORT` | `3055` | (compose) porta do host, presa ao `127.0.0.1` |

## Arquitetura

Camadas estritas — a UI não conhece `child_process`, e o domínio não conhece HTTP.

```
src/
├─ proxy.ts                 portão de senha (só com CURUPIRA_ACCESS_KEY)
├─ instrumentation.ts       liga a faxina da pasta de downloads na subida
├─ app/
│  ├─ page.tsx              Server Component: cabeçalho, hero, rodapé
│  ├─ entrar/               tela de senha (formulário nativo, funciona sem JS)
│  ├─ layout.tsx            fontes, metadata, viewport
│  ├─ globals.css           design tokens (ver DESIGN.md)
│  └─ api/
│     ├─ entrar/            POST  → confere a senha, grava o cookie de sessão
│     ├─ analyze/           POST  → metadados do link, sem baixar
│     ├─ health/            GET   → versão do yt-dlp, presença do ffmpeg
│     └─ jobs/
│        ├─ route.ts        GET lista · POST enfileira
│        ├─ stream/         GET   → SSE do estado da fila
│        └─ [id]/
│           ├─ route.ts     DELETE cancela/remove · POST tenta de novo
│           └─ file/        GET   → entrega o arquivo pronto
├─ components/              Client Components (lista de espera, modal, fila, fundo 3D)
└─ lib/
   ├─ types.ts              contratos servidor ↔ cliente
   ├─ access.ts             sessão assinada (HMAC), comparação em tempo constante
   ├─ retention.ts          faxina de jobs e arquivos velhos (opt-in)
   ├─ pending.ts            lista de espera: herança de padrão, rótulos (só cliente)
   ├─ catalog.ts            fontes de catálogo (Spotify): metadado -> termo de busca
   ├─ ytdlp.ts              adaptador do binário: argumentos, parsing, erros
   ├─ runner.ts             fila, concorrência, watchdog, ciclo de vida do job
   ├─ jobs.ts               store em memória
   ├─ url.ts                validação da URL (SSRF, esquema, tamanho)
   └─ format.ts             bytes, duração, velocidade para leitura humana
```

**Progresso em tempo real** usa SSE (`/api/jobs/stream`), não WebSocket: o fluxo é
unidirecional e o `EventSource` reconecta sozinho. O stream só emite quando o store muda,
então fila parada não gera tráfego.

**Concorrência**: 3 downloads simultâneos (`MAX_CONCURRENT` em `lib/runner.ts`). O resto
espera em `queued` e é puxado quando abre vaga.

**Catálogo não é fonte.** O Spotify protege o áudio com DRM e o yt-dlp se recusa a tocar nele
por design — estar logado no navegador não muda isso, porque o login dá acesso ao player e não
ao arquivo. Um link do Spotify entra por outro caminho (`lib/catalog.ts`): o servidor lê faixa
e artista da página pública de embed, monta um termo e procura a mesma música numa fonte que o
app sabe baixar. O Spotify vira índice, nunca origem, e **nada aqui chega perto da proteção**.
A correspondência escolhida aparece na tela — miniatura, título e o termo procurado — antes de
qualquer download, porque adivinhar por conta própria e baixar calado seria pior que falhar.
O termo é montado pelo servidor e entra como argumento; `ytsearch1:` é o único caminho que não
passa por `validateUrl`, então ele nunca pode vir cru do cliente.

**Duas filas, não uma.** A *lista de espera* (`lib/pending.ts`) é estado só do cliente: vídeos
analisados que ainda não viraram job. Nada atravessa a fronteira HTTP até o usuário mandar
baixar. A *fila de downloads* é o store do servidor. Um item da lista de espera herda o
formato/qualidade padrão até ser ajustado no seu modal; ajustado, ele manda em si mesmo e
"Baixar todos" respeita a escolha — trocar o padrão depois não desfaz o ajuste de ninguém.
O lote usa `Promise.allSettled`: um link expirado volta para a lista sem derrubar os outros.

---

## Decisões que valem conhecer antes de mexer

Cada uma resolve um bug real encontrado em teste, não é preferência de estilo.

- **`PYTHONIOENCODING=utf-8` no processo filho.** No Windows o yt-dlp escreve no stdout com
  a codepage do console (cp1252) e o Node decodifica como UTF-8. Sem isso, todo título ou
  caminho acentuado vira mojibake — e o app quebra ao servir arquivos de uma pasta com acento.
- **Truncamento no template (`%(title).120B`), não `--trim-filenames`.** A flag limita o
  **caminho inteiro**; numa pasta de projeto longa ela devora o nome do vídeo.
- **Bytes acumulados entre faixas.** Um MP4 em alta resolução baixa vídeo e áudio em
  sequência e o yt-dlp zera a contagem a cada faixa. O runner soma os trechos, senão a UI
  exibiria o tamanho da última faixa como se fosse o arquivo todo.
- **Percentual limitado a 99% até o processo terminar.** Pode ainda vir outra faixa ou uma
  conversão; mostrar 100% antes do arquivo existir seria mentir.
- **"Tentar de novo" recomeça do zero (`--no-continue`).** O YouTube responde 403 a
  requisições Range feitas com URL assinada nova sobre um `.part` antigo. Retomar é mais
  barato, mas só recomeçar é confiável.
- **Cancelamento mata a árvore, não o processo.** O yt-dlp gera o ffmpeg como processo filho;
  matar só o pai deixaria a conversão órfã consumindo CPU. No Windows é `taskkill /T`; no
  Linux o yt-dlp nasce `detached` (líder de um grupo próprio) e o cancelamento manda o sinal
  para o grupo inteiro (`process.kill(-pid)`). No container, o `tini` como PID 1 recolhe o
  que sobrar.
- **Redirecionamento do proxy com URL absoluta.** O `proxy.ts` do Next 16 responde 500
  ("Invalid URL") a um `Location` relativo. A URL é montada sobre a própria requisição e o
  Next a devolve relativa ao navegador quando o host é o mesmo — atrás do túnel, o endereço
  interno do container não vaza.
- **Faxina por `ctime`, não só `mtime`.** O yt-dlp pode carimbar o arquivo com a data de
  publicação do vídeo como `mtime`; um vídeo de 2009 pareceria velho no instante em que termina de baixar.
- **Altura fixa na miniatura do modal, não `aspect-ratio`.** Num item de grid que não é
  `stretch`, o Chromium não transfere a razão de aspecto para a contribuição intrínseca da
  linha: a faixa nascia com 1,6px e a miniatura era pintada por cima do título. Medido no
  navegador, não deduzido.
- **O campo de partículas deriva, não gira.** Corpo que gira deixa canto de tela vazio em
  proporção estreita. O volume é dimensionado pelo frustum da câmera e as partículas fazem
  wrap nas bordas, então a cobertura é constante em qualquer tela.

## Segurança

- A URL do usuário **nunca** passa por shell: o yt-dlp é invocado com lista de argumentos.
- Validação rejeita esquemas fora de http/https e bloqueia loopback, faixas privadas e
  `169.254.169.254` (SSRF).
- Formato e qualidade vêm de uma allowlist fechada no servidor — o cliente não injeta flags.
- A entrega de arquivo confirma que o caminho resolvido continua sob a pasta de downloads.
- **Portão de senha** (`CURUPIRA_ACCESS_KEY`): o cookie leva só vencimento e assinatura
  HMAC — nunca a senha —, é `HttpOnly`, `SameSite=Lax` e `Secure` quando o pedido chega por
  HTTPS. Senha e assinatura são comparadas em tempo constante. Oito erros seguidos no mesmo
  IP (lido de `cf-connecting-ip` atrás da Cloudflare) bloqueiam por 15 minutos. O destino
  pós-login só aceita caminho interno (`//site` e `/\site` são recusados).
- A fila é uma só para quem entra: o portão existe justamente porque, num servidor, todo
  visitante veria e usaria a mesma fila.

## Servidor (Docker)

A imagem (`Dockerfile`) empacota o build `standalone` do Next com yt-dlp (num venv próprio,
atualizável pelo usuário `node`), ffmpeg, Deno e tini. Roda sem root.

```bash
CURUPIRA_ACCESS_KEY=uma-frase-longa docker compose up -d --build
```

O `docker-compose.yml` publica a porta **só no `127.0.0.1` do host** — quem fala com a
internet é o túnel (Cloudflare Tunnel, Caddy, Nginx). Para atualizar o yt-dlp, basta
reiniciar o container.

## Design

O contrato visual está em [`DESIGN.md`](../DESIGN.md) — tokens, componentes, do's & don'ts e
comportamento responsivo. **Leia antes de escrever UI.** Os tokens têm correspondência 1:1
com as custom properties de `src/app/globals.css`.
