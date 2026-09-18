import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Inter para a interface, mono para números e URLs. Duas famílias, teto do
// brief de UX — fonte display futurista fica reservada ao logotipo, em CSS.
const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono-stack",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CURUPIRA — Baixe vídeos e músicas",
  description:
    "Cole um link e baixe o vídeo em MP4 ou só o áudio em MP3. Um produto Abner Software.",
  applicationName: "CURUPIRA",
  authors: [{ name: "Abner Software" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Sem `maximumScale`: travar o zoom quebra a acessibilidade em telas pequenas.
  // `cover` faz o fundo sangrar até a borda no aparelho com notch; em troca, o
  // conteúdo passa a ser responsável pela própria safe area — ver `.shell` no
  // globals.css, onde os `env(safe-area-inset-*)` entram. As duas coisas andam
  // juntas: uma sem a outra come conteúdo no recorte da tela.
  viewportFit: "cover",
  // Com o teclado virtual, o layout encolhe em vez de ficar por baixo dele.
  interactiveWidget: "resizes-content",
  themeColor: "#08080c",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${mono.variable}`}>
      {/* Extensões de navegador escrevem atributos no <body> antes do React
          hidratar (ColorZilla põe `cz-shortcut-listen`, Grammarly põe os seus),
          e o servidor não tem como prever isso. `suppressHydrationWarning` vale
          só para os atributos DESTE elemento, um nível de profundidade — não
          esconde divergência real de conteúdo dentro da página. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
