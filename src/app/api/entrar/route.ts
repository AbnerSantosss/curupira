import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_S,
  accessKey,
  isValidKey,
  issueSession,
  safeReturnPath,
} from "@/lib/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Tentativas erradas toleradas por IP dentro da janela, antes do bloqueio. */
const MAX_FAILURES = 8;
const WINDOW_MS = 15 * 60_000;

const failures = new Map<string, { count: number; since: number }>();

/**
 * Atrás do túnel da Cloudflare todo pedido chega do mesmo IP interno; o IP do
 * visitante vem no cabeçalho que a própria Cloudflare escreve.
 */
function clientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

function isLocked(ip: string, now: number): boolean {
  const entry = failures.get(ip);
  if (!entry) return false;
  if (now - entry.since > WINDOW_MS) {
    failures.delete(ip);
    return false;
  }
  return entry.count >= MAX_FAILURES;
}

function registerFailure(ip: string, now: number) {
  const entry = failures.get(ip);
  if (!entry || now - entry.since > WINDOW_MS) failures.set(ip, { count: 1, since: now });
  else entry.count += 1;
}

/** 303: depois de um POST de formulário, o navegador segue com GET. */
function seeOther(location: string, cookie?: string): Response {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  if (cookie) headers.append("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

/** Formulário nativo da tela /entrar — funciona mesmo sem JavaScript. */
export async function POST(request: Request) {
  const key = accessKey();
  if (!key) return seeOther("/");

  const form = await request.formData().catch(() => null);
  const attempt = String(form?.get("chave") ?? "");
  const back = safeReturnPath(form?.get("volta"));
  const backParam = back === "/" ? "" : `&volta=${encodeURIComponent(back)}`;

  const now = Date.now();
  const ip = clientIp(request);

  if (isLocked(ip, now)) return seeOther(`/entrar?erro=bloqueado${backParam}`);

  if (!isValidKey(attempt, key)) {
    registerFailure(ip, now);
    return seeOther(`/entrar?erro=senha${backParam}`);
  }

  failures.delete(ip);

  // `Secure` só quando o pedido veio por HTTPS: rodando em http://localhost o
  // cookie seguro seria descartado e o login nunca pegaria.
  const https =
    request.headers.get("x-forwarded-proto") === "https" || new URL(request.url).protocol === "https:";
  const cookie = [
    `${SESSION_COOKIE}=${issueSession(key, now)}`,
    "Path=/",
    `Max-Age=${SESSION_MAX_AGE_S}`,
    "HttpOnly",
    "SameSite=Lax",
    https ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");

  return seeOther(back, cookie);
}
