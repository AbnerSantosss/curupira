import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "CURUPIRA — baixe vídeos e músicas";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Gerada no build (estática). Cores do DESIGN.md: bg #08080C, accent #00F0FF, ink #E8E8F0.
export default async function OpengraphImage() {
  const logo = await readFile(join(process.cwd(), "public", "logo.png"));
  const src = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 56,
          background: "#08080C",
          color: "#E8E8F0",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} width={280} height={280} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -2, color: "#00F0FF" }}>
            CURUPIRA
          </div>
          <div style={{ fontSize: 44, color: "#E8E8F0" }}>Baixe vídeos e músicas</div>
          <div style={{ fontSize: 30, color: "#A5A5BF" }}>Um produto Abner Software</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
