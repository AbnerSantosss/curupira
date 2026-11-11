import { spawn, execFile, execFileSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";
import type { MediaInfo, MediaKind } from "./types";

const execFileAsync = promisify(execFile);

/** Erro cuja `message` já está em pt-BR e pode ir direto para a tela. */
export class YtDlpError extends Error {
  readonly friendly = true;
  constructor(message: string) {
    super(message);
    this.name = "YtDlpError";
  }
}

/* -------------------------------------------------------------------------- */
/* Resolução do binário                                                       */
/* -------------------------------------------------------------------------- */

type Runner = { command: string; baseArgs: string[] };

/**
 * Ambiente dos processos filhos.
 *
 * Sem isto, no Windows o yt-dlp escreve no stdout usando a codepage do console
 * (cp1252) enquanto o Node decodifica como UTF-8: todo caractere acentuado em
 * título ou caminho de arquivo vira mojibake. Vale tanto para o `yt-dlp.exe`
 * quanto para `python -m yt_dlp`, pois ambos passam pelo interpretador.
 */
function childEnv(): NodeJS.ProcessEnv {
  return { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUTF8: "1" };
}

let cachedRunner: Runner | null = null;

/**
 * Descobre como invocar o yt-dlp nesta máquina, em ordem de preferência:
 * variável de ambiente, executável no PATH, módulo do Python.
 * O resultado é memoizado porque a sondagem custa um processo por candidato.
 */
export async function resolveRunner(): Promise<Runner> {
  if (cachedRunner) return cachedRunner;

  const candidates: Runner[] = [];
  if (process.env.YTDLP_PATH) {
    candidates.push({ command: process.env.YTDLP_PATH, baseArgs: [] });
  }
  candidates.push(
    { command: "yt-dlp", baseArgs: [] },
    { command: "python", baseArgs: ["-m", "yt_dlp"] },
    { command: "python3", baseArgs: ["-m", "yt_dlp"] },
  );

  for (const candidate of candidates) {
    try {
      await execFileAsync(candidate.command, [...candidate.baseArgs, "--version"], {
        timeout: 20_000,
        windowsHide: true,
      });
      cachedRunner = candidate;
      return candidate;
    } catch {
      // Candidato indisponível — segue para o próximo.
    }
  }

  throw new YtDlpError(
    "O yt-dlp não foi encontrado nesta máquina. Instale com `pip install yt-dlp` e reinicie o servidor.",
  );
}

export async function getVersion(): Promise<string> {
  const { command, baseArgs } = await resolveRunner();
  const { stdout } = await execFileAsync(command, [...baseArgs, "--version"], {
    timeout: 20_000,
    windowsHide: true,
  });
  return stdout.trim();
}

/** O ffmpeg é opcional para baixar, mas obrigatório para mesclar vídeo e gerar MP3. */
export async function hasFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 20_000, windowsHide: true });
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Pasta de destino                                                           */
/* -------------------------------------------------------------------------- */

export function downloadsDir(): string {
  // DATAJACK_OUTPUT_DIR é o nome antigo do produto: aceito para não quebrar
  // um `.env.local` que já exista por aí.
  return (
    process.env.CURUPIRA_OUTPUT_DIR ??
    process.env.DATAJACK_OUTPUT_DIR ??
    path.join(process.cwd(), "downloads")
  );
}

export async function ensureDownloadsDir(): Promise<string> {
  const dir = downloadsDir();
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/* -------------------------------------------------------------------------- */
/* Tradução de erros                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Converte a saída crua do yt-dlp em uma frase acionável em pt-BR.
 * A ordem importa: os padrões mais específicos vêm primeiro.
 */
export function translateError(raw: string): string {
  const text = raw.toLowerCase();

  const rules: Array<[RegExp, string]> = [
    [
      /is not a valid url|unsupported url|is not a valid/i,
      "Não reconheci esse link. Cole o endereço completo do vídeo, começando com https://",
    ],
    [
      /no video formats found|requested format is not available/i,
      "Esse vídeo não tem nenhum formato que eu consiga baixar. Tente outra qualidade.",
    ],
    [
      /private video|this video is private/i,
      "Esse vídeo é privado. Só dá para baixar vídeos públicos.",
    ],
    [
      /sign in to confirm your age|age.?restricted|inappropriate for some users/i,
      "Esse vídeo tem restrição de idade e exige login — não consigo baixar.",
    ],
    [
      /sign in to confirm you.?re not a bot|confirm you are not a bot/i,
      // No YouTube isto não passa sozinho: o bloqueio é do IP do servidor (de
      // datacenter), não da pessoa. Prometer "tente daqui a pouco" engana.
      "O YouTube está bloqueando downloads feitos a partir deste servidor. Links de outros sites continuam funcionando.",
    ],
    [
      // Vimeo: vários vídeos só tocam para quem está logado no site.
      /only works when logged.?in|logged-in|login required|requires authentication/i,
      "Esse vídeo só abre para quem está logado no site de origem. Não consigo baixar sem conta.",
    ],
    [
      // Falta a biblioteca de "impersonation" (curl_cffi) no servidor.
      /impersonat/i,
      "Esse site exige um recurso que o servidor ainda não tem. Avise quem cuida do CURUPIRA.",
    ],
    [
      /video unavailable|has been removed|no longer available|account associated with this video has been terminated/i,
      "Esse vídeo não está mais disponível — pode ter sido removido ou ficado privado. Confira o link no navegador.",
    ],
    [
      /members-only|join this channel|paid content|requires purchase/i,
      "Esse conteúdo é exclusivo para assinantes do canal.",
    ],
    [
      /geo.?restricted|not available in your country|blocked it in your country/i,
      "Esse vídeo está bloqueado na sua região.",
    ],
    [
      /unable to download webpage|urlopen error|getaddrinfo|temporary failure in name resolution|connection reset|timed out/i,
      "Não consegui alcançar o site. Verifique sua conexão e tente de novo.",
    ],
    [
      /ffmpeg (is )?not (installed|found)|ffprobe.*not found/i,
      "O ffmpeg não está instalado — ele é necessário para juntar áudio e vídeo e para gerar MP3.",
    ],
    [
      /unsupported url|no suitable extractor/i,
      "Ainda não consigo baixar desse site. Funciona com YouTube, Vimeo, TikTok e mais de mil outros.",
    ],
    [
      /http error 429|too many requests/i,
      "O site limitou os acessos temporariamente. Espere alguns minutos e tente de novo.",
    ],
    [
      /http error 404/i,
      "Esse link não existe mais (erro 404). Confira o endereço.",
    ],
    [
      // O Vimeo devolve isto quando o vídeo exige conta: o yt-dlp tenta um
      // token de OAuth e leva 401. A frase crua ("Failed to fetch macos OAuth
      // token") não diz nada para quem só quer baixar um vídeo.
      /oauth token|http error 401|401: unauthorized|\bunauthorized\b/i,
      "O site recusou o acesso sem login (erro 401). Esse vídeo provavelmente exige conta ou deixou de ser público.",
    ],
    [
      // O yt-dlp se recusa a tocar em site com DRM, por design. Dizer isso é
      // melhor do que "não consegui": não adianta o usuário tentar de novo.
      /\[drm\]|known to use drm|drm protection/i,
      "Esse site protege o conteúdo com DRM e não dá para baixar de lá. Se for música, cole o link da faixa e eu procuro em outra fonte.",
    ],
    [
      /http error 403|forbidden/i,
      "O site bloqueou o acesso a esse vídeo (erro 403). Pode ser restrição da fonte ou link expirado.",
    ],
    [
      /http error 5\d\d|internal server error|bad gateway|service unavailable/i,
      "O site está com problema no servidor agora. Tente de novo daqui a pouco.",
    ],
    [
      /permission denied|access is denied|eacces/i,
      "Sem permissão para gravar na pasta de downloads.",
    ],
    [
      /no space left|enospc|not enough space/i,
      "Sem espaço em disco para concluir o download.",
    ],
  ];

  for (const [pattern, message] of rules) {
    if (pattern.test(text)) return message;
  }

  // Sem regra específica, a linha crua do yt-dlp NÃO vai para a tela: ela vem
  // em inglês e em jargão de terminal, o oposto do que o DESIGN.md pede. Ela
  // vai para o log do servidor, que é onde alguém pode agir sobre ela — e é o
  // sinal de que falta uma regra aqui em cima.
  const errorLine = raw
    .split(/\r?\n/)
    .reverse()
    .find((line) => /^\s*ERROR:/i.test(line));

  if (errorLine) {
    const cleaned = errorLine.replace(/^\s*ERROR:\s*/i, "").replace(/^\[[^\]]+]\s*/, "").trim();
    if (cleaned) console.warn("[ytdlp:erro-sem-tradução]", cleaned);
  }

  return "Não consegui baixar desse link. Confira se o vídeo abre no navegador e tente de novo.";
}

/* -------------------------------------------------------------------------- */
/* Análise (metadados)                                                        */
/* -------------------------------------------------------------------------- */

interface RawFormat {
  height?: number | null;
  vcodec?: string | null;
  format_note?: string | null;
}

interface RawInfo {
  id?: string;
  title?: string;
  uploader?: string | null;
  channel?: string | null;
  duration?: number | null;
  thumbnail?: string | null;
  extractor_key?: string | null;
  is_live?: boolean;
  live_status?: string | null;
  webpage_url?: string | null;
  formats?: RawFormat[];
  entries?: RawInfo[];
  _type?: string;
}

const ANALYZE_TIMEOUT_MS = 90_000;

/** Lê os metadados do link sem baixar nada. */
export async function analyze(url: string): Promise<MediaInfo> {
  const { command, baseArgs } = await resolveRunner();

  const args = [
    ...baseArgs,
    "--dump-single-json",
    "--no-playlist",
    "--no-warnings",
    "--no-colors",
    "--socket-timeout",
    "20",
    "--retries",
    "2",
    url,
  ];

  let stdout: string;
  try {
    const result = await execFileAsync(command, args, {
      timeout: ANALYZE_TIMEOUT_MS,
      windowsHide: true,
      env: childEnv(),
      encoding: "utf-8",
      // Metadados de playlists longas estouram o buffer padrão de 1 MB.
      maxBuffer: 64 * 1024 * 1024,
    });
    stdout = result.stdout;
  } catch (err) {
    const e = err as { stderr?: string; killed?: boolean; message?: string };
    if (e.killed) {
      throw new YtDlpError("A análise demorou demais e foi interrompida. Tente de novo.");
    }
    throw new YtDlpError(translateError(e.stderr || e.message || ""));
  }

  let info: RawInfo;
  try {
    info = JSON.parse(stdout) as RawInfo;
  } catch {
    throw new YtDlpError("Recebi uma resposta que não consegui interpretar. Tente de novo.");
  }

  // Alguns extratores devolvem uma playlist mesmo com --no-playlist.
  if (info._type === "playlist" && info.entries?.length) {
    info = info.entries[0];
  }

  const heights = [
    ...new Set(
      (info.formats ?? [])
        .filter((f) => f.vcodec && f.vcodec !== "none" && typeof f.height === "number")
        .map((f) => f.height as number),
    ),
  ].sort((a, b) => b - a);

  // Fonte só de áudio (SoundCloud, Bandcamp…): todo formato declarado tem
  // `vcodec: none`. Pedir "vídeo" aí entrega um .m4a com rótulo de MP4.
  const formats = info.formats ?? [];
  const audioOnly = formats.length > 0 && formats.every((f) => !f.vcodec || f.vcodec === "none");

  return {
    id: info.id ?? "desconhecido",
    title: info.title ?? "Sem título",
    uploader: info.uploader ?? info.channel ?? null,
    duration: typeof info.duration === "number" ? info.duration : null,
    thumbnail: info.thumbnail ?? null,
    extractor: info.extractor_key ?? null,
    isLive: Boolean(info.is_live) || info.live_status === "is_live",
    webpageUrl: info.webpage_url ?? url,
    heights,
    audioOnly,
  };
}

/**
 * Procura uma faixa e devolve os metadados do melhor resultado.
 *
 * Serve às fontes de catálogo (ver `lib/catalog.ts`): o link do usuário
 * identifica a música, esta função acha onde ela pode ser baixada de verdade.
 *
 * O termo é montado pelo servidor a partir do metadado do catálogo e entra
 * como **um argumento**, nunca em shell — o prefixo `ytsearch1:` é do yt-dlp,
 * não uma URL, então este é o único caminho que não passa por `validateUrl`.
 * Por isso o termo nunca pode vir cru do cliente.
 */
export async function searchOne(query: string): Promise<MediaInfo> {
  const term = query.trim().slice(0, 200);
  if (!term) {
    throw new YtDlpError("Não consegui montar uma busca a partir desse link.");
  }

  const info = await analyze(`ytsearch1:${term}`);

  // Busca sem resultado devolve uma playlist vazia, que o `analyze` entrega
  // como um objeto sem id de vídeo.
  if (!info.webpageUrl.startsWith("http")) {
    throw new YtDlpError("Não achei essa música em nenhuma fonte que eu consiga baixar.");
  }

  return info;
}

/* -------------------------------------------------------------------------- */
/* Download                                                                   */
/* -------------------------------------------------------------------------- */

/** Marcadores no stdout que separam progresso e caminho final do ruído do yt-dlp. */
export const PROGRESS_TAG = "DJPROG";
export const FILE_TAG = "DJFILE";

export interface DownloadOptions {
  url: string;
  kind: MediaKind;
  height: number | null;
  outputDir: string;
  /**
   * Ignora arquivos `.part` de uma tentativa anterior.
   *
   * Retomar é mais barato, mas o YouTube responde 403 a requisições Range
   * feitas com uma URL assinada nova sobre um `.part` antigo — então uma nova
   * tentativa só é confiável recomeçando do zero.
   */
  fresh?: boolean;
}

export function buildDownloadArgs(opts: DownloadOptions): string[] {
  const { url, kind, height, outputDir, fresh } = opts;

  const args = [
    "--no-playlist",
    "--newline",
    "--no-colors",
    "--no-warnings",
    "--progress",
    "--no-simulate",
    "--retries",
    "5",
    "--fragment-retries",
    "5",
    "--concurrent-fragments",
    "4",
    "--socket-timeout",
    "20",
    // O truncamento vai no próprio campo (`.120B` = 120 bytes), e não em
    // `--trim-filenames`, que limita o CAMINHO inteiro: numa pasta de projeto
    // longa isso comeria o nome do vídeo quase todo.
    "-o",
    path.join(outputDir, "%(title).120B [%(id)s].%(ext)s"),
    // Campos numéricos crus: a formatação para humanos é feita na UI.
    "--progress-template",
    `download:${PROGRESS_TAG}|%(progress.downloaded_bytes)s|%(progress.total_bytes,progress.total_bytes_estimate)s|%(progress.speed)s|%(progress.eta)s`,
    // `after_move` garante que o caminho impresso é o definitivo, já pós-conversão.
    "--print",
    `after_move:${FILE_TAG}|%(filepath)s`,
  ];

  if (fresh) args.push("--no-continue", "--force-overwrites");

  if (kind === "audio") {
    args.push(
      "-f",
      "ba/b",
      "--extract-audio",
      "--audio-format",
      "mp3",
      "--audio-quality",
      "0",
    );
  } else {
    // `-S res:<altura>` escolhe a maior resolução que não ultrapassa o teto,
    // preferindo mp4/m4a para que a mesclagem seja apenas remux, sem recodificar.
    const sort = height ? `res:${height},ext:mp4:m4a` : "ext:mp4:m4a";
    args.push("-f", "bv*+ba/b", "-S", sort, "--merge-output-format", "mp4");
  }

  args.push(url);
  return args;
}

/** Sobe o processo do yt-dlp já com os argumentos montados. */
export async function spawnDownload(opts: DownloadOptions) {
  const { command, baseArgs } = await resolveRunner();
  const args = [...baseArgs, ...buildDownloadArgs(opts)];
  // Fora do Windows, `detached` põe o yt-dlp num grupo de processos próprio —
  // é o que deixa o `killTree` encerrar o ffmpeg junto (ver abaixo).
  return spawn(command, args, {
    windowsHide: true,
    env: childEnv(),
    detached: process.platform !== "win32",
  });
}

/**
 * Encerra o processo do yt-dlp e tudo que ele gerou.
 *
 * Mora aqui, e não na camada da fila, porque lidar com processos externos é
 * responsabilidade deste módulo — ele é a única fronteira com `child_process`.
 *
 * O yt-dlp sobe o ffmpeg como processo filho, e matar só o pai deixaria a
 * conversão órfã consumindo CPU. No Windows isso é o `taskkill /T` na árvore;
 * no Linux (o servidor), o sinal vai para o grupo inteiro (`-pid`), que existe
 * porque o `spawnDownload` sobe o processo com `detached`.
 */
export function killTree(proc: ChildProcess): void {
  if (proc.killed) return;

  if (process.platform === "win32" && proc.pid) {
    try {
      execFileSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      return;
    } catch {
      // O processo pode ter encerrado sozinho entre a checagem e o kill.
    }
  } else if (proc.pid) {
    try {
      process.kill(-proc.pid, "SIGTERM");
      return;
    } catch {
      // Grupo já encerrado — cai no kill simples, que é inofensivo.
    }
  }

  proc.kill("SIGTERM");
}

/** Converte um campo do progress-template em número (`NA` vira 0). */
export function parseProgressNumber(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}
