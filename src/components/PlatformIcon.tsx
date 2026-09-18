import type { IconType } from "react-icons";
import { FiGlobe } from "react-icons/fi";
import {
  SiBandcamp,
  SiBilibili,
  SiCrunchyroll,
  SiDailymotion,
  SiFacebook,
  SiInstagram,
  SiKick,
  SiMixcloud,
  SiNiconico,
  SiOdysee,
  SiPinterest,
  SiReddit,
  SiRumble,
  SiSoundcloud,
  SiSpotify,
  SiThreads,
  SiTiktok,
  SiTumblr,
  SiTwitch,
  SiVimeo,
  SiVk,
  SiX,
  SiYoutube,
} from "react-icons/si";

export interface Platform {
  name: string;
  Icon: IconType;
  /** Cor oficial da marca, usada só no ícone — nunca em texto. */
  color: string;
}

/**
 * De onde veio o vídeo, a partir do domínio.
 *
 * A chave é casada como sufixo do hostname, então `music.youtube.com` e
 * `www.youtube.com` caem ambos em `youtube.com`. A ordem importa: entradas
 * mais específicas precisam vir antes das genéricas.
 */
const REGISTRY: Array<[string[], Platform]> = [
  [["youtube.com", "youtu.be", "youtube-nocookie.com"], { name: "YouTube", Icon: SiYoutube, color: "#FF0033" }],
  [["tiktok.com"], { name: "TikTok", Icon: SiTiktok, color: "#25F4EE" }],
  [["instagram.com"], { name: "Instagram", Icon: SiInstagram, color: "#E1306C" }],
  [["facebook.com", "fb.watch"], { name: "Facebook", Icon: SiFacebook, color: "#1877F2" }],
  [["twitter.com", "x.com"], { name: "X", Icon: SiX, color: "#E8E8F0" }],
  [["threads.net", "threads.com"], { name: "Threads", Icon: SiThreads, color: "#E8E8F0" }],
  [["vimeo.com"], { name: "Vimeo", Icon: SiVimeo, color: "#1AB7EA" }],
  [["twitch.tv"], { name: "Twitch", Icon: SiTwitch, color: "#9146FF" }],
  [["kick.com"], { name: "Kick", Icon: SiKick, color: "#53FC18" }],
  [["soundcloud.com"], { name: "SoundCloud", Icon: SiSoundcloud, color: "#FF5500" }],
  [["bandcamp.com"], { name: "Bandcamp", Icon: SiBandcamp, color: "#629AA9" }],
  [["mixcloud.com"], { name: "Mixcloud", Icon: SiMixcloud, color: "#5000FF" }],
  [["spotify.com"], { name: "Spotify", Icon: SiSpotify, color: "#1DB954" }],
  [["reddit.com", "redd.it"], { name: "Reddit", Icon: SiReddit, color: "#FF4500" }],
  [["dailymotion.com", "dai.ly"], { name: "Dailymotion", Icon: SiDailymotion, color: "#0066DC" }],
  [["bilibili.com"], { name: "Bilibili", Icon: SiBilibili, color: "#00A1D6" }],
  [["nicovideo.jp"], { name: "Niconico", Icon: SiNiconico, color: "#E8E8F0" }],
  [["crunchyroll.com"], { name: "Crunchyroll", Icon: SiCrunchyroll, color: "#F47521" }],
  [["odysee.com"], { name: "Odysee", Icon: SiOdysee, color: "#EF1970" }],
  [["rumble.com"], { name: "Rumble", Icon: SiRumble, color: "#85C742" }],
  [["pinterest.com", "pin.it"], { name: "Pinterest", Icon: SiPinterest, color: "#E60023" }],
  [["tumblr.com"], { name: "Tumblr", Icon: SiTumblr, color: "#00CF35" }],
  [["vk.com"], { name: "VK", Icon: SiVk, color: "#0077FF" }],
];

const UNKNOWN: Platform = { name: "Link", Icon: FiGlobe, color: "#A5A5BF" };

/** As plataformas reconhecidas, na ordem do registro — para exibição em vitrine. */
export const PLATFORMS: Platform[] = REGISTRY.map(([, platform]) => platform);

/** Identifica a plataforma pela URL. Nunca lança — link inválido vira "Link". */
export function detectPlatform(url: string): Platform {
  let hostname: string;
  try {
    hostname = new URL(/^[a-z]+:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return UNKNOWN;
  }

  for (const [domains, platform] of REGISTRY) {
    if (domains.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
      return platform;
    }
  }
  return UNKNOWN;
}

/**
 * Vitrine das plataformas suportadas.
 *
 * Os logos são decoração: quem usa leitor de tela recebe uma frase única em vez
 * de 23 itens de lista soletrados um a um. O `title` cobre quem vê o ícone mas
 * não reconhece a marca.
 */
export function PlatformStrip() {
  return (
    <div className="platforms">
      <p className="visually-hidden">
        Funciona com {PLATFORMS.map((p) => p.name).join(", ")} e mais de mil outros sites.
      </p>
      <ul className="platforms__row" aria-hidden="true">
        {PLATFORMS.map(({ name, Icon, color }) => (
          <li key={name} className="platforms__item" style={{ color }} title={name}>
            <Icon />
          </li>
        ))}
      </ul>
      <p className="platforms__note" aria-hidden="true">
        e mais de mil outros sites
      </p>
    </div>
  );
}

/**
 * Selo da origem do vídeo. O nome vem sempre escrito ao lado do ícone —
 * logo sozinho não é legível para leitor de tela nem para quem não reconhece a marca.
 */
export function PlatformBadge({ url, className }: { url: string; className?: string }) {
  const { name, Icon, color } = detectPlatform(url);
  return (
    <span className={className ? `source ${className}` : "source"}>
      <span className="source__icon" style={{ color }} aria-hidden="true">
        <Icon />
      </span>
      {name}
    </span>
  );
}
