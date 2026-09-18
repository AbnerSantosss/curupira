/** Formatação para leitura humana. Compartilhada por todos os componentes. */

const UNITS = ["B", "KB", "MB", "GB", "TB"];

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  // Abaixo de 10 uma casa decimal informa; acima disso vira ruído.
  const decimals = exponent === 0 ? 0 : value < 10 ? 1 : 0;
  return `${value.toFixed(decimals).replace(".", ",")} ${UNITS[exponent]}`;
}

export function formatSpeed(bytesPerSecond: number): string {
  if (!Number.isFinite(bytesPerSecond) || bytesPerSecond <= 0) return "—";
  return `${formatBytes(bytesPerSecond)}/s`;
}

/** Duração em segundos para `m:ss` ou `h:mm:ss`. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return "—";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Tempo restante em linguagem corrente, não em relógio. */
export function formatEta(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  if (seconds < 60) return `~${Math.round(seconds)}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `~${hours}h${String(minutes % 60).padStart(2, "0")}`;
}

export function formatPercent(percent: number): string {
  if (!Number.isFinite(percent)) return "0%";
  return `${percent.toFixed(percent >= 10 ? 0 : 1).replace(".", ",")}%`;
}
