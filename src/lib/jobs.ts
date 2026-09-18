import type { ChildProcess } from "node:child_process";
import { killTree } from "./ytdlp";
import type { Job, JobView } from "./types";

/**
 * Store em memória da fila de downloads.
 *
 * Vive em `globalThis` porque o hot reload do Next recarrega o módulo a cada
 * edição — sem isso a fila seria zerada durante o desenvolvimento.
 */

interface JobRecord {
  job: Job;
  /** Caminho absoluto do arquivo final. Nunca serializado para o cliente. */
  filePath: string | null;
  proc: ChildProcess | null;
  /** Quando verdadeiro, a próxima execução ignora o `.part` e recomeça do zero. */
  fresh: boolean;
}

interface Store {
  jobs: Map<string, JobRecord>;
  /** Incrementado a cada mutação — deixa o SSE emitir só quando algo muda. */
  version: number;
}

const globalRef = globalThis as unknown as { __curupiraStore?: Store };

const store: Store =
  globalRef.__curupiraStore ??
  (globalRef.__curupiraStore = { jobs: new Map(), version: 0 });

function touch() {
  store.version += 1;
}

export function createJob(job: Job): Job {
  store.jobs.set(job.id, { job, filePath: null, proc: null, fresh: false });
  touch();
  return job;
}

export function setFresh(id: string, fresh: boolean) {
  const record = store.jobs.get(id);
  if (record) record.fresh = fresh;
}

export function isFresh(id: string): boolean {
  return store.jobs.get(id)?.fresh ?? false;
}

export function getJob(id: string): Job | undefined {
  return store.jobs.get(id)?.job;
}

export function getFilePath(id: string): string | null {
  return store.jobs.get(id)?.filePath ?? null;
}

export function setFilePath(id: string, filePath: string) {
  const record = store.jobs.get(id);
  if (!record) return;
  record.filePath = filePath;
  touch();
}

export function attachProcess(id: string, proc: ChildProcess) {
  const record = store.jobs.get(id);
  if (!record) return;
  record.proc = proc;
  touch();
}

export function updateJob(id: string, patch: Partial<Job>) {
  const record = store.jobs.get(id);
  if (!record) return;
  // Um job encerrado não volta atrás: eventos atrasados do processo filho
  // chegam depois do cancelamento e sobrescreveriam o estado final.
  const terminal: Job["status"][] = ["done", "error", "canceled"];
  if (terminal.includes(record.job.status) && patch.status === undefined) return;
  record.job = { ...record.job, ...patch };
  touch();
}

/** Mata o processo do yt-dlp e marca o job como cancelado. */
export function cancelJob(id: string): boolean {
  const record = store.jobs.get(id);
  if (!record) return false;
  const { job, proc } = record;
  if (job.status === "done" || job.status === "canceled") return false;

  if (proc) killTree(proc);

  record.job = { ...job, status: "canceled", error: null };
  touch();
  return true;
}

/** Remove o job da fila (sem apagar o arquivo já baixado do disco). */
export function removeJob(id: string): boolean {
  const record = store.jobs.get(id);
  if (!record) return false;
  if (record.proc && !record.proc.killed) cancelJob(id);
  store.jobs.delete(id);
  touch();
  return true;
}

/** Fila do mais recente para o mais antigo. */
export function listJobs(): JobView[] {
  return [...store.jobs.values()]
    .map((r) => r.job)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function getVersion(): number {
  return store.version;
}
