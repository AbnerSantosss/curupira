import { NextResponse } from "next/server";
import { listJobs } from "@/lib/jobs";
import { enqueue } from "@/lib/runner";
import { validateUrl } from "@/lib/url";
import { YtDlpError } from "@/lib/ytdlp";
import type { MediaKind } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Alturas oferecidas na UI. Fechar a lista impede que o cliente injete qualquer valor. */
const ALLOWED_HEIGHTS = [2160, 1440, 1080, 720, 480, 360];

export async function GET() {
  return NextResponse.json({ jobs: listJobs() });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição malformada." }, { status: 400 });
  }

  const { url, kind, height, title, thumbnail } = (body ?? {}) as {
    url?: unknown;
    kind?: unknown;
    height?: unknown;
    title?: unknown;
    thumbnail?: unknown;
  };

  try {
    const safeUrl = validateUrl(url);

    if (kind !== "video" && kind !== "audio") {
      return NextResponse.json({ error: "Escolha entre vídeo (MP4) ou áudio (MP3)." }, { status: 400 });
    }

    let safeHeight: number | null = null;
    if (kind === "video" && height !== null && height !== undefined) {
      const n = Number(height);
      if (!ALLOWED_HEIGHTS.includes(n)) {
        return NextResponse.json({ error: "Essa qualidade não está disponível." }, { status: 400 });
      }
      safeHeight = n;
    }

    const job = enqueue({
      url: safeUrl,
      kind: kind as MediaKind,
      height: safeHeight,
      title: typeof title === "string" && title.trim() ? title.trim().slice(0, 300) : safeUrl,
      thumbnail: typeof thumbnail === "string" && thumbnail.startsWith("http") ? thumbnail : null,
    });

    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    if (err instanceof YtDlpError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[jobs:create]", err);
    return NextResponse.json(
      { error: "Não consegui colocar o download na fila. Tente de novo." },
      { status: 500 },
    );
  }
}
