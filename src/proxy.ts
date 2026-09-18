import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, accessKey, isValidSession } from "@/lib/access";

/**
 * Barra quem não entrou com a senha — só quando `CURUPIRA_ACCESS_KEY` existe.
 *
 * O proxy do Next recusa `Location` relativo (erro 500 "Invalid URL"). A URL vai
 * absoluta, montada sobre a própria requisição, e o Next a devolve relativa ao
 * navegador quando o host é o mesmo — atrás do túnel, o endereço interno não
 * vaza.
 */
export function proxy(request: NextRequest) {
  const key = accessKey();
  if (!key) return;

  if (isValidSession(request.cookies.get(SESSION_COOKIE)?.value, key)) return;

  const { pathname, search } = request.nextUrl;

  // A API responde JSON: o cliente mostra `error` na tela, e um redirect para
  // HTML quebraria o `response.json()` dele.
  if (pathname.startsWith("/api/")) {
    return Response.json(
      { error: "Sua sessão expirou. Recarregue a página e entre de novo." },
      { status: 401 },
    );
  }

  const target =
    pathname === "/" ? "/entrar" : `/entrar?volta=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(new URL(target, request.url), 307);
}

export const config = {
  // Fica de fora o que a própria tela de entrada precisa para existir: ela
  // mesma, a rota que recebe a senha, os assets do build e as imagens da marca.
  matcher: ["/((?!entrar|api/entrar|_next/static|_next/image|icon\\.png|logo\\.png).*)"],
};
