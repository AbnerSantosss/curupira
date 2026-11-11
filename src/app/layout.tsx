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

// URL pública do app (ex.: https://curupira.203-0-113-10.sslip.io), lida em tempo de
// execução no servidor. Use "||" e não "??": a variável chega vazia do compose.
// Valor ausente ou inválido cai no endereço local, para o build nunca quebrar.
function siteUrl(): URL {
  try {
    return new URL(process.env.CURUPIRA_PUBLIC_URL || "http://localhost:3055");
  } catch {
    return new URL("http://localhost:3055");
  }
}

const TITLE = "CURUPIRA — Baixe vídeos e músicas";
const DESCRIPTION =
  "Cole o link de um vídeo ou música e baixe em MP4 ou MP3, sem assinatura. Grátis, direto no navegador, sem instalar nada. Um produto Abner Software.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "CURUPIRA",
  authors: [{ name: "Abner Software" }],
  // Noindex total (auditoria de SEO). Sem canonical e sem sitemap de propósito.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "CURUPIRA",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  formatDetection: { telephone: false, email: false, address: false },
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
  // O app é escuro: barras de rolagem e controles nativos já nascem escuros.
  colorScheme: "dark",
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
