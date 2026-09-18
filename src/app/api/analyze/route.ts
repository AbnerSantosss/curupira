import { NextResponse } from "next/server";
import {
  buildSearchQuery,
  catalogUnsupportedKind,
  isCatalogUrl,
  readCatalogTrack,
} from "@/lib/catalog";
import { validateUrl } from "@/lib/url";
import { YtDlpError, analyze, searchOne } from "@/lib/ytdlp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Lê os metadados do link e devolve os formatos disponíveis. Não baixa nada. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requisição malformada." }, { status: 400 });
  }

  const { url } = (body ?? {}) as { url?: unknown };

  try {
    const safeUrl = validateUrl(url);

    const unsupported = catalogUnsupportedKind(safeUrl);
    if (unsupported) {
      throw new YtDlpError(
        `Esse link é ${unsupported}, e por enquanto eu só sei buscar faixa por faixa. Abra a música no Spotify e copie o link dela.`,
      );
    }

    // Link de catálogo (Spotify): o arquivo não vem de lá. Lê o metadado e
    // procura a mesma faixa numa fonte baixável. Ver `lib/catalog.ts`.
    if (isCatalogUrl(safeUrl)) {
      let track;
      try {
        track = await readCatalogTrack(safeUrl);
      } catch (err) {
        console.warn("[analyze:catálogo]", err);
        throw new YtDlpError(
          "Não consegui ler os dados dessa faixa. Confira se o link abre no navegador.",
        );
      }

      const query = buildSearchQuery(track);
      const info = await searchOne(query);

      return NextResponse.json({
        ...info,
        // A capa do catálogo costuma ser melhor que a miniatura do vídeo.
        thumbnail: track.thumbnail ?? info.thumbnail,
        matchedFrom: {
          source: track.source,
          title: track.title,
          artist: track.artists[0] ?? null,
          query,
        },
      });
    }

    const info = await analyze(safeUrl);
    return NextResponse.json(info);
  } catch (err) {
    if (err instanceof YtDlpError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("[analyze]", err);
    return NextResponse.json(
      { error: "Algo deu errado por aqui. Tente de novo em instantes." },
      { status: 500 },
    );
  }
}
