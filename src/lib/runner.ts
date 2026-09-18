import readline from "node:readline";
import path from "node:path";
import {
  attachProcess,
  cancelJob,
  createJob,
  getJob,
  isFresh,
  listJobs,
  setFilePath,
  setFresh,
  updateJob,
} from "./jobs";
import {
  FILE_TAG,
  PROGRESS_TAG,
  ensureDownloadsDir,
  parseProgressNumber,
  spawnDownload,
  translateError,
} from "./ytdlp";
import type { Job, MediaKind } from "./types";

/** Downloads simultâneos. Acima disso a banda é dividida e todos ficam lentos. */
const MAX_CONCURRENT = 3;

/** Sem um único byte novo nesse intervalo o job é considerado travado. */
const STALL_TIMEOUT_MS = 180_000;

let active = 0;

export interface EnqueueInput {
  url: string;
  kind: MediaKind;
  height: number | null;
  title: string;
  thumbnail: string | null;
}

export function enqueue(input: EnqueueInput): Job {
  const job: Job = {
    id: crypto.randomUUID(),
    url: input.url,
    title: input.title,
    thumbnail: input.thumbnail,
    kind: input.kind,
    height: input.height,
    status: "queued",
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    eta: 0,
    error: null,
    fileName: null,
    createdAt: Date.now(),
  };

  createJob(job);
  // Não aguardamos: a resposta HTTP volta imediatamente e o progresso chega
  // pelo stream de eventos.
  void pump();
  return job;
}

/** Puxa jobs da fila enquanto houver vaga — sistema de pull, nada é empurrado. */
async function pump(): Promise<void> {
  while (active < MAX_CONCURRENT) {
    const next = listJobs()
      .filter((j) => j.status === "queued")
      .sort((a, b) => a.createdAt - b.createdAt)[0];
    if (!next) return;

    active += 1;
    // Marca antes do await para que a próxima volta do laço não pegue o mesmo job.
    updateJob(next.id, { status: "downloading" });
    void run(next.id).finally(() => {
      active -= 1;
      void pump();
    });
  }
}

async function run(jobId: string): Promise<void> {
  const job = getJob(jobId);
  if (!job || job.status === "canceled") return;

  let outputDir: string;
  try {
    outputDir = await ensureDownloadsDir();
  } catch {
    updateJob(jobId, {
      status: "error",
      error: "Não consegui criar a pasta de downloads. Verifique as permissões.",
    });
    return;
  }

  let proc;
  try {
    proc = await spawnDownload({
      url: job.url,
      kind: job.kind,
      height: job.height,
      outputDir,
      fresh: isFresh(jobId),
    });
    setFresh(jobId, false);
  } catch (err) {
    updateJob(jobId, {
      status: "error",
      error: err instanceof Error ? err.message : "Não consegui iniciar o download.",
    });
    return;
  }

  attachProcess(jobId, proc);

  const stderrChunks: string[] = [];
  let lastActivity = Date.now();

  // Um MP4 em alta resolução baixa a faixa de vídeo e a de áudio em sequência,
  // e o yt-dlp reinicia a contagem a cada uma. Sem acumular, a UI mostraria
  // apenas o tamanho da última faixa como se fosse o arquivo inteiro.
  let streamOffset = 0;
  let lastDownloaded = 0;
  let lastTotal = 0;

  // Watchdog: falha por temporização é o modo que mais escapa — um processo vivo
  // e mudo ficaria preso ocupando uma vaga da fila para sempre.
  const watchdog = setInterval(() => {
    if (Date.now() - lastActivity > STALL_TIMEOUT_MS) {
      clearInterval(watchdog);
      cancelJob(jobId);
      updateJob(jobId, {
        status: "error",
        error: "O download travou sem receber dados. Tente de novo.",
      });
    }
  }, 15_000);

  proc.stdout!.setEncoding("utf-8");
  proc.stderr?.setEncoding("utf-8");
  const stdout = readline.createInterface({ input: proc.stdout!, crlfDelay: Infinity });

  stdout.on("line", (line) => {
    lastActivity = Date.now();
    const current = getJob(jobId);
    if (!current || current.status === "canceled") return;

    if (line.startsWith(`${PROGRESS_TAG}|`)) {
      const [, downloaded, total, speed, eta] = line.split("|");
      const streamDownloaded = parseProgressNumber(downloaded);
      const streamTotal = parseProgressNumber(total);

      // Contagem reiniciou: a faixa anterior terminou e outra começou.
      if (streamDownloaded < lastDownloaded) {
        streamOffset += lastTotal || lastDownloaded;
      }
      lastDownloaded = streamDownloaded;
      lastTotal = streamTotal;

      const downloadedBytes = streamOffset + streamDownloaded;
      const totalBytes = streamOffset + streamTotal;
      // Teto de 99%: não sabemos se ainda vem outra faixa ou uma conversão, e
      // exibir 100% antes do arquivo existir seria mentir para o usuário.
      const percent =
        totalBytes > 0 ? Math.min(99, (downloadedBytes / totalBytes) * 100) : 0;

      updateJob(jobId, {
        status: "downloading",
        percent,
        downloadedBytes,
        totalBytes,
        speed: parseProgressNumber(speed),
        eta: parseProgressNumber(eta),
      });
      return;
    }

    if (line.startsWith(`${FILE_TAG}|`)) {
      const filePath = line.slice(FILE_TAG.length + 1).trim();
      if (filePath) {
        setFilePath(jobId, filePath);
        updateJob(jobId, { fileName: path.basename(filePath) });
      }
      return;
    }

    // Pós-processamento: a barra de download já chegou a 100%, mas o arquivo
    // ainda não existe. Sem esse estado a UI mentiria dizendo "pronto".
    if (/^\[(ExtractAudio|Merger|VideoConvertor|FixupM3u8|Fixup)\]/.test(line)) {
      updateJob(jobId, { status: "converting", percent: 100, speed: 0, eta: 0 });
    }
  });

  proc.stderr?.on("data", (chunk: Buffer) => {
    lastActivity = Date.now();
    const text = chunk.toString();
    stderrChunks.push(text);
    // Limita o histórico: um erro repetitivo poderia crescer sem fim na memória.
    if (stderrChunks.length > 200) stderrChunks.splice(0, 100);
  });

  await new Promise<void>((resolve) => {
    proc.on("error", (err) => {
      stderrChunks.push(err.message);
      resolve();
    });
    proc.on("close", () => resolve());
  });

  clearInterval(watchdog);
  stdout.close();

  const final = getJob(jobId);
  if (!final || final.status === "canceled") return;

  const stderr = stderrChunks.join("");
  const exitCode = proc.exitCode;

  if (exitCode === 0) {
    updateJob(jobId, {
      status: "done",
      percent: 100,
      speed: 0,
      eta: 0,
      error: null,
    });
  } else {
    updateJob(jobId, {
      status: "error",
      speed: 0,
      eta: 0,
      error: translateError(stderr),
    });
  }
}

/**
 * Recoloca na fila um job que falhou ou foi cancelado.
 *
 * A nova tentativa **descarta** o `.part` da anterior (`--no-continue`). Retomar
 * seria mais barato, mas o YouTube responde 403 a requisições Range feitas com
 * uma URL assinada nova sobre um arquivo parcial antigo.
 */
export function retry(jobId: string): boolean {
  const job = getJob(jobId);
  if (!job) return false;
  if (job.status !== "error" && job.status !== "canceled") return false;

  setFresh(jobId, true);
  updateJob(jobId, {
    status: "queued",
    error: null,
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    speed: 0,
    eta: 0,
  });
  void pump();
  return true;
}
