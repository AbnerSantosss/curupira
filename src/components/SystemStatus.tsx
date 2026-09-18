"use client";

import { useEffect, useState } from "react";

interface Health {
  ytdlp: string | null;
  ffmpeg: boolean;
  outputDir: string;
  ok: boolean;
}

/**
 * Estado das dependências externas.
 *
 * Só aparece quando há algo a fazer. Com tudo em ordem o componente não
 * renderiza nada: versão de binário e nome de ferramenta não dizem nada a
 * quem só quer baixar um vídeo — ruído no cabeçalho, não informação.
 */
export function SystemStatus() {
  const [health, setHealth] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then(setHealth)
      .catch(() => setFailed(true));
  }, []);

  if (failed) {
    return (
      <p className="masthead__status">
        <span className="dot dot--bad" aria-hidden="true" />
        Servidor fora do ar
      </p>
    );
  }

  // Enquanto a checagem corre não há nada a comunicar: o app já está usável.
  if (!health) return null;

  if (!health.ytdlp) {
    return (
      <p className="masthead__status">
        <span className="dot dot--bad" aria-hidden="true" />
        Motor de download não instalado — os downloads vão falhar
      </p>
    );
  }

  // Sem ffmpeg dá para baixar, mas não para gerar MP3 nem juntar as trilhas
  // de vídeo e áudio em alta resolução: é degradação, não falha.
  if (!health.ffmpeg) {
    return (
      <p className="masthead__status">
        <span className="dot dot--warn" aria-hidden="true" />
        Conversor ausente — MP3 e alta resolução indisponíveis
      </p>
    );
  }

  // Tudo em ordem: silêncio.
  return null;
}
