import { NextResponse } from "next/server";
import { downloadsDir, getVersion, hasFfmpeg } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Diagnóstico das dependências externas — usado pelo rodapé e para depurar setup. */
export async function GET() {
  const [ytdlp, ffmpeg] = await Promise.all([
    getVersion().catch(() => null),
    hasFfmpeg(),
  ]);

  return NextResponse.json({
    ytdlp,
    ffmpeg,
    outputDir: downloadsDir(),
    ok: Boolean(ytdlp),
  });
}
