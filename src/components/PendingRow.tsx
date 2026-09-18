"use client";

import { FiFilm, FiMusic, FiSettings, FiTrash2 } from "react-icons/fi";
import {
  type Defaults,
  type PendingItem,
  effectiveKind,
  isCustomized,
  itemLabel,
} from "@/lib/pending";
import { formatDuration } from "@/lib/format";

interface Props {
  item: PendingItem;
  defaults: Defaults;
  onOpen: (key: string) => void;
  onRemove: (key: string) => void;
}

/**
 * Uma linha da lista de espera.
 *
 * O corpo inteiro é um `<button>` — alvo grande, um só nome acessível e
 * teclado de graça. Remover fica num botão irmão, nunca aninhado: botão dentro
 * de botão é HTML inválido e quebra o foco.
 */
export function PendingRow({ item, defaults, onOpen, onRemove }: Props) {
  const label = itemLabel(item, defaults);
  const KindIcon = effectiveKind(item, defaults) === "audio" ? FiMusic : FiFilm;
  const customized = isCustomized(item);

  return (
    <li className="pending">
      <button
        type="button"
        className="pending__main"
        onClick={() => onOpen(item.key)}
        aria-label={`Ajustar ${item.info.title}. Agora: ${label}`}
      >
        <span className="pending__thumb">
          {item.info.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.info.thumbnail} alt="" loading="lazy" decoding="async" />
          ) : (
            <KindIcon aria-hidden="true" />
          )}
        </span>

        <span className="pending__text">
          <span className="pending__title">{item.info.title}</span>
          <span className="pending__tags">
            <span className="tag">
              <KindIcon aria-hidden="true" />
              {label}
            </span>
            <span className={`pending__badge${customized ? " pending__badge--custom" : ""}`}>
              {customized ? "ajustado" : "padrão"}
            </span>
            {item.info.matchedFrom && (
              <span className="pending__badge pending__badge--match">
                via {item.info.matchedFrom.source}
              </span>
            )}
            <span className="mono">{formatDuration(item.info.duration)}</span>
          </span>
        </span>

        <span className="pending__gear" aria-hidden="true">
          <FiSettings />
        </span>
      </button>

      <button
        type="button"
        className="btn btn--quiet btn--sm btn--icon"
        onClick={() => onRemove(item.key)}
        aria-label={`Tirar ${item.info.title} da lista`}
      >
        <FiTrash2 aria-hidden="true" />
      </button>
    </li>
  );
}
