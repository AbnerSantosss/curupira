import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera `.next/standalone` com um server.js mínimo e só as dependências que o
  // servidor de fato carrega — é o que a imagem Docker copia, sem node_modules.
  output: "standalone",
  turbopack: {
    // Existe um package-lock.json na pasta do usuário; sem fixar a raiz, o
    // Turbopack infere aquele diretório como workspace e avisa a cada build.
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
