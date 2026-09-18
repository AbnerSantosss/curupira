import { NextResponse } from "next/server";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { getFilePath, getJob } from "@/lib/jobs";
import { downloadsDir } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_BY_EXT: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".opus": "audio/opus",
};

/** Entrega o arquivo baixado ao navegador. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const job = getJob(id);
  if (!job) {
    return NextResponse.json({ error: "Esse download não está mais na fila." }, { status: 404 });
  }
  if (job.status !== "done") {
    return NextResponse.json({ error: "Esse arquivo ainda não está pronto." }, { status: 409 });
  }

  const filePath = getFilePath(id);
  if (!filePath) {
    return NextResponse.json({ error: "Não encontrei o arquivo no disco." }, { status: 404 });
  }

  // O caminho vem do yt-dlp, não do cliente, mas confirmamos que ele permanece
  // sob a pasta de downloads antes de abrir qualquer coisa.
  const root = path.resolve(downloadsDir());
  const resolved = path.resolve(filePath);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    return NextResponse.json({ error: "Caminho de arquivo não permitido." }, { status: 403 });
  }

  let stat;
  try {
    stat = await fsp.stat(resolved);
  } catch {
    return NextResponse.json(
      { error: "O arquivo foi movido ou apagado da pasta de downloads." },
      { status: 404 },
    );
  }

  const fileName = path.basename(resolved);
  const ext = path.extname(resolved).toLowerCase();
  const nodeStream = fs.createReadStream(resolved);
  const webStream = Readable.toWeb(nodeStream) as WebReadableStream<Uint8Array>;

  return new Response(webStream as unknown as ReadableStream, {
    headers: {
      "Content-Type": MIME_BY_EXT[ext] ?? "application/octet-stream",
      "Content-Length": String(stat.size),
      // `filename*` preserva acentos e emojis em títulos de vídeo.
      "Content-Disposition": `attachment; filename="${fileName.replace(/[^\x20-\x7e]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
