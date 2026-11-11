/**
 * Contratos compartilhados entre servidor e cliente.
 * Mantidos num único módulo para que a fronteira API <-> UI seja explícita.
 */

export type MediaKind = "video" | "audio";

/** Etapas do ciclo de vida de um job, na ordem em que acontecem. */
export type JobStatus =
  | "queued"
  | "downloading"
  | "converting"
  | "done"
  | "error"
  | "canceled";

export interface FormatOption {
  /** Altura em pixels (1080, 720...). `null` para a trilha de áudio. */
  height: number | null;
  label: string;
}

/**
 * Origem de catálogo: o usuário colou um link que identifica a faixa mas não
 * entrega o arquivo (Spotify), e o servidor encontrou uma correspondência
 * numa fonte baixável. Presente só nesse caso — link normal não tem.
 */
export interface MatchedFrom {
  /** Nome do serviço de catálogo, ex. "Spotify". */
  source: string;
  /** Como a faixa se chama no catálogo. */
  title: string;
  /** Artista principal, quando o catálogo informa. */
  artist: string | null;
  /** O termo que foi de fato procurado — o usuário tem direito de conferir. */
  query: string;
}

export interface MediaInfo {
  id: string;
  title: string;
  uploader: string | null;
  /** Duração em segundos. `null` para transmissões ao vivo. */
  duration: number | null;
  thumbnail: string | null;
  extractor: string | null;
  isLive: boolean;
  webpageUrl: string;
  /** Alturas disponíveis, da maior para a menor. */
  heights: number[];
  /** A fonte só tem áudio: não existe opção de vídeo. */
  audioOnly?: boolean;
  /** Preenchido só quando o link de origem era de catálogo. */
  matchedFrom?: MatchedFrom;
}

export interface Job {
  id: string;
  url: string;
  title: string;
  thumbnail: string | null;
  kind: MediaKind;
  /** Teto de resolução pedido. `null` = melhor disponível ou áudio. */
  height: number | null;
  status: JobStatus;
  /** 0–100. */
  percent: number;
  downloadedBytes: number;
  totalBytes: number;
  /** Bytes por segundo. */
  speed: number;
  /** Segundos restantes estimados. */
  eta: number;
  /** Mensagem em pt-BR pronta para exibição. Só preenchida em `error`. */
  error: string | null;
  /** Nome do arquivo final, disponível a partir de `done`. */
  fileName: string | null;
  createdAt: number;
}

/** Projeção enviada ao cliente — o caminho absoluto do arquivo nunca sai do servidor. */
export type JobView = Job;
