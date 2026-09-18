import Image from "next/image";
import { Downloader } from "@/components/Downloader";
import { PlatformStrip } from "@/components/PlatformIcon";
import { SystemStatus } from "@/components/SystemStatus";

export default function Home() {
  return (
    <main className="shell">
      <header className="masthead">
        <div className="brand">
          {/* `priority`: é a primeira coisa visível da página, não pode entrar
              com atraso. `alt` vazio porque o nome do produto vem escrito ao
              lado — anunciar as duas coisas seria repetição no leitor de tela. */}
          <Image
            className="brand__mark"
            src="/logo.png"
            alt=""
            width={512}
            height={512}
            priority
          />
          <span>
            <span className="brand__name">Curupira</span>
            <span className="brand__parent">Abner Software</span>
          </span>
        </div>
        <SystemStatus />
      </header>

      <div className="hero">
        <h1 className="hero__title">
          Baixe vídeos e músicas <em>sem assinatura</em>.
        </h1>
        <p className="hero__sub">
          Cole o link, escolha se quer o vídeo em MP4 ou só o áudio em MP3, e pronto.
        </p>
      </div>

      {/* A vitrine entra como filho para cair logo abaixo do campo de link, sem
          que o Downloader (client) precise importar o catálogo de plataformas. */}
      <Downloader>
        <PlatformStrip />
      </Downloader>

      <footer className="footer">
        <span>CURUPIRA · um produto Abner Software</span>
        <span>Baixe apenas conteúdo que você tem direito de baixar.</span>
      </footer>
    </main>
  );
}
