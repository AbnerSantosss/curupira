import type { Metadata } from "next";
import Image from "next/image";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FiAlertTriangle, FiLock } from "react-icons/fi";
import { PasswordInput } from "@/components/PasswordInput";
import { SESSION_COOKIE, accessKey, isValidSession, safeReturnPath } from "@/lib/access";

export const metadata: Metadata = {
  title: "Entrar — CURUPIRA",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  senha: "Senha incorreta. Confira e tente de novo.",
  bloqueado: "Muitas tentativas erradas seguidas. Espere 15 minutos e tente de novo.",
};

export default async function Entrar({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string; volta?: string }>;
}) {
  const { erro, volta } = await searchParams;
  const back = safeReturnPath(volta);

  // Sem portão ligado, ou já com sessão válida, esta tela não tem o que fazer.
  const key = accessKey();
  if (!key) redirect("/");
  const jar = await cookies();
  if (isValidSession(jar.get(SESSION_COOKIE)?.value, key)) redirect(back);

  const message = erro ? ERRORS[erro] : undefined;

  return (
    <main className="shell">
      <header className="masthead">
        <div className="brand">
          <Image
            className="brand__mark"
            src="/logo.png"
            alt=""
            width={512}
            height={512}
            sizes="48px"
            priority
          />
          <span>
            <span className="brand__name">Curupira</span>
            <span className="brand__parent">Abner Software</span>
          </span>
        </div>
      </header>

      <div className="hero">
        <h1 className="hero__title">
          Acesso <em>particular</em>.
        </h1>
        <p className="hero__sub">Este CURUPIRA tem dono. Digite a senha para continuar.</p>
      </div>

      <section className="panel panel--accent gate" aria-labelledby="gate-heading">
        <h2 id="gate-heading" className="visually-hidden">
          Entrar
        </h2>
        <form method="post" action="/api/entrar">
          <input type="hidden" name="volta" value={back} />
          <div className="field">
            <label className="field__label" htmlFor="chave">
              Senha
            </label>
            <div className="field__row">
              <PasswordInput
                id="chave"
                name="chave"
                invalid={Boolean(message)}
                describedBy={message ? "gate-error" : undefined}
              />
              <button type="submit" className="btn btn--primary btn--block">
                <FiLock aria-hidden />
                Entrar
              </button>
            </div>
            {message && (
              <p id="gate-error" className="field__error" role="alert">
                <FiAlertTriangle aria-hidden />
                {message}
              </p>
            )}
          </div>
        </form>
      </section>

      <footer className="footer">
        <span>CURUPIRA · um produto Abner Software</span>
      </footer>
    </main>
  );
}
