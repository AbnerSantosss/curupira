import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera `.next/standalone` com um server.js mínimo e só as dependências que o
  // servidor de fato carrega — é o que a imagem Docker copia, sem node_modules.
  output: "standalone",
  // Não anuncia o framework nas respostas.
  poweredByHeader: false,
  turbopack: {
    // Existe um package-lock.json na pasta do usuário; sem fixar a raiz, o
    // Turbopack infere aquele diretório como workspace e avisa a cada build.
    root: path.resolve(process.cwd()),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Noindex total (auditoria de SEO, A-02): vale para qualquer tipo de
          // resposta, inclusive o 307 do proxy, o robots.txt e as imagens.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // As miniaturas vêm de CDNs de terceiros; essa política não as quebra.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // CSP mínima, sem nonce: não depende de script inline. HSTS e CSP
          // completa ficam no proxy reverso (TLS termina lá).
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
          },
        ],
      },
      {
        // Imagens da marca e manifest: um dia de cache, em vez de revalidar a cada visita.
        source: "/((?!_next/static|_next/image|api/).*\\.(?:png|ico|webmanifest)$)",
        headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
      },
    ];
  },
};

export default nextConfig;
