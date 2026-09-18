import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Portão de acesso opcional.
 *
 * Na máquina do usuário o CURUPIRA é ferramenta de uma pessoa só e não pede
 * senha. Publicado num servidor, sem portão, qualquer um que achasse o endereço
 * gastaria a banda e o disco da máquina — e veria a fila, que é uma só para
 * todos. Definir `CURUPIRA_ACCESS_KEY` liga o portão; sem ela, nada muda.
 */

export const SESSION_COOKIE = "curupira_sessao";

/** 30 dias: é uma ferramenta pessoal, pedir a senha toda semana só irrita. */
export const SESSION_MAX_AGE_S = 60 * 60 * 24 * 30;

export function accessKey(): string | null {
  const key = process.env.CURUPIRA_ACCESS_KEY?.trim();
  return key ? key : null;
}

function sign(key: string, payload: string): string {
  return createHmac("sha256", key).update(`curupira-sessao-v1|${payload}`).digest("base64url");
}

/** Compara em tempo constante, inclusive quando os tamanhos diferem. */
function safeEqual(a: string, b: string): boolean {
  const digest = (s: string) => createHmac("sha256", "curupira-cmp").update(s).digest();
  return timingSafeEqual(digest(a), digest(b));
}

/**
 * O cookie leva o vencimento e a assinatura dele — nunca a senha. Trocar a
 * senha invalida todas as sessões de uma vez, porque a assinatura muda junto.
 */
export function issueSession(key: string, now = Date.now()): string {
  const expires = String(now + SESSION_MAX_AGE_S * 1000);
  return `${expires}.${sign(key, expires)}`;
}

export function isValidSession(value: string | undefined, key: string, now = Date.now()): boolean {
  if (!value) return false;
  const [expires, signature] = value.split(".");
  if (!expires || !signature) return false;
  if (!(Number(expires) > now)) return false;
  return safeEqual(signature, sign(key, expires));
}

export function isValidKey(attempt: string, key: string): boolean {
  return safeEqual(attempt, key);
}

/**
 * Destino depois do login. Só caminho interno: `//outro.site` e `/\outro.site`
 * são lidos pelo navegador como endereço externo (redirecionamento aberto).
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return value.slice(0, 512);
}
