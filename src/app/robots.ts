import type { MetadataRoute } from "next";

// Estratégia: noindex total. O grupo "*" NÃO bloqueia "/" de propósito: se bloquear,
// o rastreador nunca lê o noindex. "/api/" só devolve JSON/401, não há o que indexar.
// Sem "sitemap": não há URL a oferecer. O segundo grupo bloqueia só os bots de
// TREINO de IA (os de busca ficam no grupo "*", sob noindex e portão de senha).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: "/api/" },
      {
        userAgent: ["GPTBot", "ClaudeBot", "Google-Extended", "CCBot"],
        disallow: "/",
      },
    ],
  };
}
