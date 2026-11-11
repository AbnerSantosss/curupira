/**
 * Lista de espera: vídeos já analisados que ainda não viraram job.
 *
 * Estado exclusivamente do cliente — nada aqui atravessa a fronteira HTTP. Um
 * item só vira `Job` no servidor quando o usuário manda baixar, individualmente
 * ou em lote.
 *
 * Regra central: cada item herda o padrão da lista até ser ajustado no modal.
 * Ajustou, o item passa a mandar em si mesmo e "Baixar todos" respeita a
 * escolha — trocar o padrão depois não desfaz o ajuste de ninguém.
 */

import type { MediaInfo, MediaKind } from "./types";

/** Precisa espelhar a allowlist do servidor em `api/jobs/route.ts`. */
export const ALLOWED_HEIGHTS = [2160, 1440, 1080, 720, 480, 360];

/**
 * `undefined` significa "não ajustado, herda o padrão". `null` em `height`
 * é uma escolha explícita: melhor disponível. Os dois são estados distintos,
 * por isso a distinção entre ausência e nulo importa neste módulo.
 */
export interface PendingOverride {
  kind?: MediaKind;
  height?: number | null;
}

export interface PendingItem {
  /** Chave local e estável, só para o React e para os handlers. */
  key: string;
  info: MediaInfo;
  override: PendingOverride;
}

export interface Defaults {
  kind: MediaKind;
  /** `null` = melhor disponível. */
  height: number | null;
}

export function effectiveKind(item: PendingItem, defaults: Defaults): MediaKind {
  // Fonte só de áudio ignora o padrão "vídeo": senão o job sai rotulado MP4.
  if (item.info.audioOnly) return "audio";
  return item.override.kind ?? defaults.kind;
}

/** Áudio não tem resolução: o servidor recebe `null` e extrai a melhor trilha. */
export function effectiveHeight(item: PendingItem, defaults: Defaults): number | null {
  if (effectiveKind(item, defaults) === "audio") return null;
  return "height" in item.override ? (item.override.height ?? null) : defaults.height;
}

export function isCustomized(item: PendingItem): boolean {
  return item.override.kind !== undefined || "height" in item.override;
}

/** Rótulo curto do que vai ser baixado — o mesmo texto usado no botão e na linha. */
export function formatLabel(kind: MediaKind, height: number | null): string {
  if (kind === "audio") return "MP3";
  return height ? `MP4 ${height}p` : "MP4";
}

export function itemLabel(item: PendingItem, defaults: Defaults): string {
  return formatLabel(effectiveKind(item, defaults), effectiveHeight(item, defaults));
}

/**
 * Resoluções que a UI oferece para um vídeo: a interseção entre o que o
 * servidor aceita e o que a fonte declara. Vazia quando a fonte não expõe
 * lista — aí só resta "melhor disponível".
 */
export function qualityOptions(info: MediaInfo): number[] {
  return ALLOWED_HEIGHTS.filter((height) => info.heights.includes(height));
}
