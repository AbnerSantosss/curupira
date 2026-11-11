"use client";

import { useEffect, useRef } from "react";
import { FiDownload, FiFilm, FiMusic, FiShuffle, FiTrash2, FiX } from "react-icons/fi";
import {
  type Defaults,
  type PendingItem,
  effectiveHeight,
  effectiveKind,
  formatLabel,
  isCustomized,
  qualityOptions,
} from "@/lib/pending";
import { formatDuration } from "@/lib/format";
import { PlatformBadge } from "./PlatformIcon";

interface Props {
  item: PendingItem | null;
  defaults: Defaults;
  onChange: (key: string, override: PendingItem["override"]) => void;
  onDownload: (key: string) => void;
  onRemove: (key: string) => void;
  onClose: () => void;
}

/**
 * Ajuste individual de um item da lista.
 *
 * `<dialog>` nativo em vez de div com overlay: foco preso, Esc, `inert` no
 * resto da página e semântica de diálogo modal vêm do navegador, sem depender
 * de biblioteca nem de listener nosso para acessibilidade básica.
 */
export function PendingModal({ item, defaults, onChange, onDownload, onRemove, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (item && !dialog.open) {
      dialog.showModal();
      // Sem alvo explícito o foco cai no corpo rolável (um DIV) no celular.
      // O botão Fechar é o primeiro controle e funciona sem Esc.
      dialog.querySelector<HTMLElement>(".modal__close")?.focus();
    }
    if (!item && dialog.open) dialog.close();
  }, [item]);

  if (!item) return <dialog ref={dialogRef} className="modal" onClose={onClose} />;

  const kind = effectiveKind(item, defaults);
  const height = effectiveHeight(item, defaults);
  const options = qualityOptions(item.info);
  const customized = isCustomized(item);

  // "Herdando o padrão" é um estado que o usuário precisa enxergar: sem isso
  // ele não sabe se mexer no topo ainda afeta este item.
  const usingDefaultKind = item.override.kind === undefined;
  const usingDefaultHeight = !("height" in item.override);

  return (
    <dialog
      ref={dialogRef}
      className="modal"
      onClose={onClose}
      aria-labelledby="modal-title"
      // No toque não existe Esc, e o `::backdrop` nativo não fecha sozinho.
      // O alvo só é o próprio dialog quando o clique cai fora do conteúdo.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="modal__body">
        <button type="button" className="modal__close" onClick={onClose} aria-label="Fechar">
          <FiX aria-hidden="true" />
        </button>

        <div className="modal__thumb">
          {item.info.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.info.thumbnail} alt="" decoding="async" />
          )}
        </div>

        <h2 id="modal-title" className="modal__title">
          {item.info.title}
        </h2>

        {item.info.matchedFrom && (
          <p className="match">
            <FiShuffle aria-hidden="true" />
            <span>
              O {item.info.matchedFrom.source} não entrega o arquivo, então procurei{" "}
              <strong>{item.info.matchedFrom.query}</strong> e cheguei neste vídeo. Confira antes
              de baixar.
            </span>
          </p>
        )}

        <div className="preview__meta">
          <PlatformBadge url={item.info.webpageUrl} />
          {item.info.uploader && <span>{item.info.uploader}</span>}
          <span className="mono">{formatDuration(item.info.duration)}</span>
          {item.info.isLive && <span>Transmissão ao vivo</span>}
        </div>

        <fieldset className="chooser__group">
          <legend className="chooser__legend">Formato</legend>
          <div className="segmented">
            <label className="segmented__option">
              <input
                type="radio"
                name="modal-kind"
                checked={kind === "video"}
                disabled={item.info.audioOnly}
                onChange={() => onChange(item.key, { ...item.override, kind: "video" })}
              />
              <FiFilm aria-hidden="true" />
              Vídeo MP4
            </label>
            <label className="segmented__option">
              <input
                type="radio"
                name="modal-kind"
                checked={kind === "audio"}
                onChange={() => onChange(item.key, { ...item.override, kind: "audio" })}
              />
              <FiMusic aria-hidden="true" />
              Áudio MP3
            </label>
          </div>
          {item.info.audioOnly ? (
            <p className="chooser__hint">Esse link só tem áudio, então sai em MP3.</p>
          ) : (
            usingDefaultKind && <p className="chooser__hint">Herdando o formato padrão da lista.</p>
          )}
        </fieldset>

        <fieldset className="chooser__group">
          <legend className="chooser__legend">
            {kind === "audio" ? "Qualidade do áudio" : "Qualidade do vídeo"}
          </legend>

          {kind === "audio" ? (
            <p className="chooser__hint">
              O áudio sai em MP3 na melhor qualidade que o vídeo oferecer.
            </p>
          ) : (
            <>
              <div className="chips">
                <label className="chip">
                  <input
                    type="radio"
                    name="modal-height"
                    checked={height === null}
                    onChange={() => onChange(item.key, { ...item.override, height: null })}
                  />
                  Melhor disponível
                </label>
                {options.map((option) => (
                  <label className="chip" key={option}>
                    <input
                      type="radio"
                      name="modal-height"
                      checked={height === option}
                      onChange={() => onChange(item.key, { ...item.override, height: option })}
                    />
                    {option}p
                  </label>
                ))}
              </div>
              {options.length === 0 && (
                <p className="chooser__hint">
                  Esse vídeo não expõe uma lista de resoluções — vou baixar a melhor que houver.
                </p>
              )}
              {usingDefaultHeight && (
                <p className="chooser__hint">Herdando a qualidade padrão da lista.</p>
              )}
            </>
          )}
        </fieldset>

        {customized && (
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            onClick={() => onChange(item.key, {})}
          >
            Voltar a usar o padrão da lista
          </button>
        )}

        <div className="modal__actions">
          <button
            type="button"
            className="btn btn--primary btn--wrap"
            onClick={() => onDownload(item.key)}
          >
            <FiDownload aria-hidden="true" />
            Baixar {formatLabel(kind, height)} agora
          </button>
          <button type="button" className="btn btn--danger" onClick={() => onRemove(item.key)}>
            <FiTrash2 aria-hidden="true" />
            Tirar da lista
          </button>
        </div>
      </div>
    </dialog>
  );
}
