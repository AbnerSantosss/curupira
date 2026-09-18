import fs from "node:fs/promises";
import path from "node:path";
import { getFilePath, listJobs, removeJob } from "./jobs";
import { downloadsDir } from "./ytdlp";
import type { Job } from "./types";

/**
 * Faxina da pasta de downloads para quando o CURUPIRA roda num servidor.
 *
 * Na máquina do usuário essa pasta é a biblioteca dele e nada pode sumir de
 * lá. Num servidor ela é só área de passagem até o navegador salvar o arquivo,
 * e sem faxina o disco enche. Por isso a faxina é opt-in: só liga com
 * `CURUPIRA_RETENTION_HOURS`.
 */

const SWEEP_EVERY_MS = 10 * 60_000;
const TERMINAL: Job["status"][] = ["done", "error", "canceled"];

export function retentionMs(): number | null {
  const hours = Number.parseFloat(process.env.CURUPIRA_RETENTION_HOURS ?? "");
  return Number.isFinite(hours) && hours > 0 ? hours * 3_600_000 : null;
}

export async function sweep(now = Date.now()): Promise<void> {
  const ttl = retentionMs();
  if (!ttl) return;

  // 1. Jobs encerrados e velhos saem da fila — o arquivo deles cai no passo 2.
  for (const job of listJobs()) {
    if (TERMINAL.includes(job.status) && now - job.createdAt > ttl) removeJob(job.id);
  }

  // 2. Arquivo que ainda pertence a um job da fila fica, qualquer que seja a idade.
  const kept = new Set(
    listJobs()
      .map((job) => getFilePath(job.id))
      .filter((file): file is string => Boolean(file))
      .map((file) => path.resolve(file)),
  );

  const dir = downloadsDir();
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return;
  }

  for (const name of names) {
    const file = path.resolve(dir, name);
    if (kept.has(file)) continue;
    try {
      const stat = await fs.stat(file);
      if (!stat.isFile()) continue;
      // `ctime`, e não `mtime`: o yt-dlp pode carimbar o mtime com a data de
      // publicação do vídeo, anos atrás, e a faxina apagaria uma faixa no meio
      // da mesclagem. O ctime muda a cada escrita e a cada carimbo.
      if (now - Math.max(stat.ctimeMs, stat.mtimeMs) > ttl) await fs.unlink(file);
    } catch {
      // Sumiu entre o readdir e o stat, ou está em uso — fica para a próxima volta.
    }
  }
}

/** Idempotente: chamado uma vez na subida do servidor (`instrumentation.ts`). */
export function startRetention(): void {
  if (!retentionMs()) return;
  const flag = globalThis as unknown as { __curupiraRetention?: boolean };
  if (flag.__curupiraRetention) return;
  flag.__curupiraRetention = true;

  const run = () => sweep().catch((err) => console.error("[retention]", err));
  void run();
  setInterval(run, SWEEP_EVERY_MS).unref();
}
