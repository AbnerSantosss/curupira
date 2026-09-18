import { YtDlpError } from "./ytdlp";

/**
 * Validação da URL fornecida pelo usuário.
 *
 * O backend entrega essa string para um binário externo que fará requisições
 * de rede, então ela é entrada não confiável em dois sentidos: precisa ser uma
 * URL de verdade e não pode apontar para a rede interna da máquina (SSRF).
 * A execução em si nunca passa por shell — o yt-dlp é chamado com lista de
 * argumentos —, o que elimina a superfície de injeção de comando.
 */

/** Faixas privadas, loopback e o endpoint de metadados de nuvem. */
const BLOCKED_V4 = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\./,
];

function isBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return true;
  }
  // IPv6 loopback e link-local.
  if (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd")) {
    return true;
  }
  // IPv4 mapeado em IPv6 (::ffff:127.0.0.1).
  const mapped = host.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  const v4 = mapped ? mapped[1] : host;

  return BLOCKED_V4.some((pattern) => pattern.test(v4));
}

/**
 * Normaliza e valida a URL. Lança `YtDlpError` com mensagem pronta para a tela.
 */
export function validateUrl(input: unknown): string {
  if (typeof input !== "string" || input.trim() === "") {
    throw new YtDlpError("Cole um link para começar.");
  }

  const raw = input.trim();

  if (raw.length > 2048) {
    throw new YtDlpError("Esse link é longo demais para ser válido.");
  }

  // Sem esquema explícito assumimos https — é o erro de digitação mais comum.
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new YtDlpError(
      "Não reconheci esse link. Cole o endereço completo do vídeo, começando com https://",
    );
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new YtDlpError("Só consigo baixar de endereços http:// ou https://");
  }

  if (!parsed.hostname.includes(".") && !parsed.hostname.includes(":")) {
    throw new YtDlpError(
      "Não reconheci esse link. Cole o endereço completo do vídeo, começando com https://",
    );
  }

  if (isBlockedHost(parsed.hostname)) {
    throw new YtDlpError("Esse endereço aponta para a rede local e não pode ser baixado.");
  }

  return parsed.toString();
}
