/**
 * Fontes de *catálogo*: sites que identificam uma faixa mas nunca entregam o
 * arquivo.
 *
 * O Spotify é o caso: o áudio é protegido por DRM e o yt-dlp se recusa a tocar
 * nele por design. Estar logado no navegador não muda nada — o login dá acesso
 * ao player, não ao arquivo, e o stream chega cifrado.
 *
 * O que dá para fazer sem chegar perto da proteção é usar o link como
 * **metadado**: ler faixa e artista da página pública de embed e procurar a
 * mesma música numa fonte que o app já sabe baixar. O Spotify vira índice, não
 * origem. Quem escolhe o resultado continua sendo o usuário: a correspondência
 * é mostrada na tela antes de qualquer download.
 */

export interface CatalogTrack {
  /** Nome da faixa, como o catálogo escreve. */
  title: string;
  /** Artistas na ordem em que aparecem. Pode vir vazio em faixa obscura. */
  artists: string[];
  /** Nome do serviço, para dizer ao usuário de onde veio. */
  source: string;
  /** Capa, quando a página expõe. */
  thumbnail: string | null;
}

/** O `intl-pt` (e irmãos) aparece quando o link é copiado do app em outro idioma. */
const SPOTIFY_TRACK = /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?track\/([A-Za-z0-9]{16,32})/i;

/** Um User-Agent de navegador: sem ele a página de embed volta sem o payload. */
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 12_000;

/** Outras páginas do Spotify: identificam um conjunto, não uma faixa única. */
const SPOTIFY_OTHER =
  /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z-]+\/)?(album|playlist|artist|episode|show)\//i;

/** `true` quando o link é de catálogo e precisa passar por correspondência. */
export function isCatalogUrl(url: string): boolean {
  return SPOTIFY_TRACK.test(url);
}

/**
 * Página de catálogo que existe mas não é uma faixa única.
 *
 * Devolve o nome do tipo para a mensagem poder ser específica — dizer
 * "não consegui" sem explicar que álbum ainda não é suportado só faz o usuário
 * tentar de novo com o mesmo link.
 */
export function catalogUnsupportedKind(url: string): string | null {
  const match = SPOTIFY_OTHER.exec(url);
  if (!match) return null;

  const kinds: Record<string, string> = {
    album: "um álbum",
    playlist: "uma playlist",
    artist: "um artista",
    episode: "um episódio de podcast",
    show: "um podcast",
  };
  return kinds[match[1].toLowerCase()] ?? "uma página";
}

/**
 * Lê faixa e artistas da página pública de embed do Spotify.
 *
 * Sem chave de API e sem login: a página de embed carrega um JSON com os dados
 * que o próprio player mostra. Nada aqui toca no áudio.
 */
export async function readCatalogTrack(url: string): Promise<CatalogTrack> {
  const match = SPOTIFY_TRACK.exec(url);
  if (!match) throw new Error("URL de catálogo não reconhecida.");

  // A URL é remontada a partir do ID extraído, que é alfanumérico: o que o
  // usuário digitou nunca vira alvo de requisição diretamente.
  const id = match[1];
  const embedUrl = `https://open.spotify.com/embed/track/${id}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let html: string;
  try {
    const response = await fetch(embedUrl, {
      headers: { "User-Agent": UA, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) {
      throw new Error(`embed respondeu ${response.status}`);
    }
    html = await response.text();
  } finally {
    clearTimeout(timer);
  }

  const title = firstMatch(html, /"(?:name|title)"\s*:\s*"((?:[^"\\]|\\.){1,300})"/);
  if (!title) {
    throw new Error("não achei o nome da faixa no payload do embed");
  }

  // `[\s\S]` em vez da flag `s`: o alvo do TypeScript do projeto é anterior a
  // es2018, e mudar o alvo por causa de uma regex seria o rabo abanando o cão.
  const artistsBlock = firstMatch(html, /"artists"\s*:\s*\[([\s\S]{0,2000}?)]/);
  const artists = artistsBlock
    ? [...artistsBlock.matchAll(/"name"\s*:\s*"((?:[^"\\]|\\.){1,120})"/g)].map((m) =>
        decodeJsonString(m[1]),
      )
    : [];

  return {
    title: decodeJsonString(title),
    artists,
    source: "Spotify",
    thumbnail: findCover(html),
  };
}

/**
 * Capa do álbum, na maior resolução que o payload oferecer.
 *
 * O bloco vem como `"image":[{"url":…,"maxHeight":300},…]` com várias medidas.
 * O host não é fixo (já apareceu `i.scdn.co` e `image-cdn-*.spotifycdn.com`),
 * então quem delimita a busca é a estrutura, não o domínio.
 */
function findCover(html: string): string | null {
  const block = firstMatch(html, /"image"\s*:\s*\[([\s\S]{0,1200}?)]/);
  if (!block) return null;

  const candidates = [
    ...block.matchAll(/"url"\s*:\s*"(https:[^"]{10,300}?)"[^}]*?"maxHeight"\s*:\s*(\d{2,5})/g),
  ].map((m) => ({ url: decodeJsonString(m[1]), height: Number(m[2]) }));

  if (!candidates.length) {
    const single = firstMatch(block, /"url"\s*:\s*"(https:[^"]{10,300}?)"/);
    return single ? decodeJsonString(single) : null;
  }

  candidates.sort((a, b) => b.height - a.height);
  return candidates[0].url;
}

/**
 * Monta o termo de busca.
 *
 * Só o primeiro artista entra: faixa com seis participações vira uma consulta
 * longa demais e a correspondência piora em vez de melhorar. O nome da faixa
 * do Spotify já traz o remix no próprio título ("Ecstasy - Morten Granau
 * Remix"), que é justamente o que distingue uma versão da outra.
 */
export function buildSearchQuery(track: CatalogTrack): string {
  const artist = track.artists[0] ?? "";
  return `${artist} ${track.title}`.trim().replace(/\s+/g, " ").slice(0, 200);
}

function firstMatch(text: string, pattern: RegExp): string | null {
  const m = pattern.exec(text);
  return m ? m[1] : null;
}

/** O payload é JSON dentro de HTML: escapes precisam voltar ao normal. */
function decodeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`) as string;
  } catch {
    return value;
  }
}
