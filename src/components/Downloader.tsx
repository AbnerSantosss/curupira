"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  FiAlertTriangle,
  FiClipboard,
  FiDownload,
  FiFilm,
  FiMusic,
  FiSearch,
} from "react-icons/fi";
import type { Job, MediaInfo } from "@/lib/types";
import {
  ALLOWED_HEIGHTS,
  type Defaults,
  type PendingItem,
  effectiveHeight,
  effectiveKind,
  formatLabel,
} from "@/lib/pending";
import { Backdrop } from "./Backdrop";
import { PendingModal } from "./PendingModal";
import { PendingRow } from "./PendingRow";
import { QueueItem } from "./QueueItem";
import { detectPlatform } from "./PlatformIcon";

/** Espelha o teto de simultâneos do runner — só serve para normalizar o fundo 3D. */
const MAX_CONCURRENT = 3;

/** Marcos anunciados por leitor de tela — anunciar cada 1% viraria metralhadora. */
const MILESTONES = [25, 50, 75];

/** `children` é renderizado logo abaixo do formulário de link — hoje, a vitrine de plataformas. */
export function Downloader({ children }: { children?: React.ReactNode }) {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [defaults, setDefaults] = useState<Defaults>({ kind: "video", height: null });
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [announcement, setAnnouncement] = useState("");

  const inputId = useId();
  const errorId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const previousJobs = useRef(new Map<string, Job>());

  /* ---------------------------------------------------------------------- */
  /* Fila em tempo real                                                     */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    const source = new EventSource("/api/jobs/stream");

    source.addEventListener("jobs", (event) => {
      const { jobs: incoming } = JSON.parse((event as MessageEvent).data) as { jobs: Job[] };
      setJobs(incoming);

      // Anúncio acessível: só transições de estado e marcos de progresso.
      const messages: string[] = [];
      for (const job of incoming) {
        const before = previousJobs.current.get(job.id);
        if (before?.status !== job.status) {
          if (job.status === "done") messages.push(`Pronto: ${job.title}`);
          else if (job.status === "error") messages.push(`Falhou: ${job.title}. ${job.error ?? ""}`);
          else if (job.status === "converting") messages.push(`Convertendo ${job.title}`);
          else if (job.status === "downloading") messages.push(`Baixando ${job.title}`);
        } else if (before && job.status === "downloading") {
          const crossed = MILESTONES.find((m) => before.percent < m && job.percent >= m);
          if (crossed) messages.push(`${crossed} por cento: ${job.title}`);
        }
        previousJobs.current.set(job.id, job);
      }
      for (const id of previousJobs.current.keys()) {
        if (!incoming.some((j) => j.id === id)) previousJobs.current.delete(id);
      }
      if (messages.length) setAnnouncement(messages.join(". "));
    });

    return () => source.close();
  }, []);

  // Com o teclado virtual aberto o campo sobe para a borda do viewport e a
  // mensagem, logo abaixo, nasce coberta. Um erro invisível é um erro que não
  // existe para quem está no celular.
  useEffect(() => {
    if (!formError) return;
    const frame = requestAnimationFrame(() => {
      document.getElementById(errorId)?.scrollIntoView({ block: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [formError, errorId]);

  /* ---------------------------------------------------------------------- */
  /* Análise do link -> lista de espera                                     */
  /* ---------------------------------------------------------------------- */

  const analyze = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) {
      setFormError("Cole um link para começar.");
      inputRef.current?.focus();
      return;
    }

    setAnalyzing(true);
    setFormError(null);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = await response.json();

      if (!response.ok) {
        setFormError(data.error ?? "Não consegui ler esse link.");
        return;
      }

      const info = data as MediaInfo;
      let duplicate = false;

      setPending((current) => {
        // Colar o mesmo link duas vezes é acidente comum quando se enfileira
        // vários seguidos: melhor avisar do que baixar duas vezes.
        if (current.some((item) => item.info.webpageUrl === info.webpageUrl)) {
          duplicate = true;
          return current;
        }
        return [...current, { key: crypto.randomUUID(), info, override: {} }];
      });

      if (duplicate) {
        setFormError("Esse vídeo já está na lista de espera.");
        return;
      }

      // Campo limpo e focado: o padrão de uso é enfileirar vários links seguidos.
      setUrl("");
      setAnnouncement(`${info.title} entrou na lista de espera.`);
      inputRef.current?.focus();
    } catch {
      setFormError("Sem conexão com o servidor. Verifique se ele ainda está rodando.");
    } finally {
      setAnalyzing(false);
    }
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Lista de espera -> fila de downloads                                   */
  /* ---------------------------------------------------------------------- */

  const enqueue = useCallback(
    async (item: PendingItem, current: Defaults) => {
      const response = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: item.info.webpageUrl,
          kind: effectiveKind(item, current),
          height: effectiveHeight(item, current),
          title: item.info.title,
          thumbnail: item.info.thumbnail,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error ?? "Não consegui colocar na fila.");
      }
    },
    [],
  );

  const downloadOne = useCallback(
    async (key: string) => {
      const item = pending.find((entry) => entry.key === key);
      if (!item) return;

      setSubmitting(true);
      setFormError(null);
      setOpenKey(null);

      try {
        await enqueue(item, defaults);
        setPending((current) => current.filter((entry) => entry.key !== key));
        setAnnouncement(`${item.info.title} entrou na fila.`);
      } catch (err) {
        setFormError(err instanceof Error ? err.message : "Não consegui colocar na fila.");
      } finally {
        setSubmitting(false);
      }
    },
    [pending, defaults, enqueue],
  );

  const downloadAll = useCallback(async () => {
    if (!pending.length) return;
    setSubmitting(true);
    setFormError(null);
    setOpenKey(null);

    // `allSettled`: um link que expirou não pode impedir os outros de entrar.
    const results = await Promise.allSettled(pending.map((item) => enqueue(item, defaults)));
    const failed = pending.filter((_, index) => results[index].status === "rejected");
    const sent = pending.length - failed.length;

    setPending(failed);
    if (failed.length) {
      const first = results.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      const reason = first?.reason instanceof Error ? first.reason.message : "";
      setFormError(
        `${failed.length} de ${pending.length} não entraram na fila e continuam aqui. ${reason}`.trim(),
      );
    }
    if (sent > 0) {
      setAnnouncement(`${sent} ${sent === 1 ? "vídeo entrou" : "vídeos entraram"} na fila.`);
    }
    setSubmitting(false);
  }, [pending, defaults, enqueue]);

  const changeOverride = useCallback((key: string, override: PendingItem["override"]) => {
    setPending((current) =>
      current.map((item) => (item.key === key ? { ...item, override } : item)),
    );
  }, []);

  const removePending = useCallback((key: string) => {
    setPending((current) => current.filter((item) => item.key !== key));
    setOpenKey((open) => (open === key ? null : open));
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Ações da fila ativa                                                    */
  /* ---------------------------------------------------------------------- */

  const cancel = useCallback((id: string) => {
    void fetch(`/api/jobs/${id}`, { method: "DELETE" });
  }, []);

  const remove = useCallback((id: string) => {
    void fetch(`/api/jobs/${id}?mode=remove`, { method: "DELETE" });
  }, []);

  const retryJob = useCallback((id: string) => {
    void fetch(`/api/jobs/${id}`, { method: "POST" });
  }, []);

  const pasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
        setUrl(text.trim());
        void analyze(text);
      }
    } catch {
      // Navegador sem permissão de leitura da área de transferência: o campo
      // continua utilizável, então basta devolver o foco.
      setFormError("Não consegui ler a área de transferência. Cole com Ctrl+V no campo.");
      inputRef.current?.focus();
    }
  }, [analyze]);

  /* ---------------------------------------------------------------------- */

  const activeCount = jobs.filter(
    (j) => j.status === "downloading" || j.status === "converting" || j.status === "queued",
  ).length;

  const activity = useMemo(
    () => Math.min(1, activeCount / MAX_CONCURRENT),
    [activeCount],
  );

  const openItem = pending.find((item) => item.key === openKey) ?? null;
  const defaultLabel = formatLabel(defaults.kind, defaults.kind === "audio" ? null : defaults.height);

  return (
    <>
      <Backdrop activity={activity} />

      {/* Região viva única do app, com throttle por marcos. */}
      <p aria-live="polite" role="status" className="visually-hidden">
        {announcement}
      </p>

      <section className="panel panel--accent" aria-labelledby="form-heading">
        <h2 id="form-heading" className="visually-hidden">
          Adicionar vídeo à lista
        </h2>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void analyze(url);
          }}
          noValidate
        >
          <div className="field">
            <label className="field__label" htmlFor={inputId}>
              Link do vídeo
            </label>
            <div className="field__row">
              <input
                id={inputId}
                ref={inputRef}
                className="input"
                type="url"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
                enterKeyHint="go"
                placeholder="https://youtube.com/watch?v=..."
                value={url}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (formError) setFormError(null);
                }}
                aria-invalid={formError ? true : undefined}
                aria-describedby={formError ? errorId : undefined}
              />
              <button
                type="button"
                className="btn btn--quiet btn--icon"
                onClick={() => void pasteFromClipboard()}
                aria-label="Colar o link da área de transferência"
              >
                <FiClipboard aria-hidden="true" />
                <span className="btn__label">Colar</span>
              </button>
              <button type="submit" className="btn btn--primary btn--block" disabled={analyzing}>
                {analyzing ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Lendo…
                  </>
                ) : (
                  <>
                    <FiSearch aria-hidden="true" />
                    Adicionar
                  </>
                )}
              </button>
            </div>

            <p className="field__hint">
              Adicione quantos links quiser — nada baixa até você mandar.
            </p>

            {formError && (
              <p className="field__error" id={errorId}>
                <FiAlertTriangle aria-hidden="true" style={{ flexShrink: 0, marginTop: "0.2em" }} />
                <span>{formError}</span>
              </p>
            )}
          </div>
        </form>

        {analyzing && (
          <div className="pending pending--skeleton" aria-hidden="true">
            <div className="pending__thumb skeleton" />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: "1.2em", marginBottom: "var(--sp-2)" }} />
              <div className="skeleton" style={{ height: "1em", width: "40%", margin: "0 auto" }} />
            </div>
          </div>
        )}
      </section>

      {children}

      {pending.length > 0 && (
        <section className="staging" aria-labelledby="staging-heading">
          <div className="queue__head">
            <h2 id="staging-heading" className="queue__title">
              Lista de espera
            </h2>
            <span className="queue__count">
              {pending.length} {pending.length === 1 ? "vídeo" : "vídeos"} · nada baixando ainda
            </span>
          </div>

          <div className="panel staging__controls">
            <div className="chooser">
              <fieldset className="chooser__group">
                <legend className="chooser__legend">Formato padrão</legend>
                <div className="segmented">
                  <label className="segmented__option">
                    <input
                      type="radio"
                      name="default-kind"
                      checked={defaults.kind === "video"}
                      onChange={() => setDefaults((d) => ({ ...d, kind: "video" }))}
                    />
                    <FiFilm aria-hidden="true" />
                    Vídeo MP4
                  </label>
                  <label className="segmented__option">
                    <input
                      type="radio"
                      name="default-kind"
                      checked={defaults.kind === "audio"}
                      onChange={() => setDefaults((d) => ({ ...d, kind: "audio" }))}
                    />
                    <FiMusic aria-hidden="true" />
                    Áudio MP3
                  </label>
                </div>
              </fieldset>

              <fieldset className="chooser__group">
                <legend className="chooser__legend">Qualidade padrão</legend>
                {defaults.kind === "audio" ? (
                  <p className="chooser__hint">
                    O áudio sai em MP3 na melhor qualidade que cada vídeo oferecer.
                  </p>
                ) : (
                  <div className="chips">
                    <label className="chip">
                      <input
                        type="radio"
                        name="default-height"
                        checked={defaults.height === null}
                        onChange={() => setDefaults((d) => ({ ...d, height: null }))}
                      />
                      Melhor disponível
                    </label>
                    {ALLOWED_HEIGHTS.map((option) => (
                      <label className="chip" key={option}>
                        <input
                          type="radio"
                          name="default-height"
                          checked={defaults.height === option}
                          onChange={() => setDefaults((d) => ({ ...d, height: option }))}
                        />
                        {option}p
                      </label>
                    ))}
                  </div>
                )}
              </fieldset>
            </div>

            <p className="chooser__hint">
              Vale para quem está marcado como <strong>padrão</strong>. Quem você ajustou no
              modal mantém a própria escolha.
            </p>

            <div className="item__actions" style={{ marginTop: "var(--sp-4)" }}>
              <button
                type="button"
                className="btn btn--primary btn--wrap"
                onClick={() => void downloadAll()}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <span className="spinner" aria-hidden="true" />
                    Enfileirando…
                  </>
                ) : (
                  <>
                    <FiDownload aria-hidden="true" />
                    Baixar todos ({pending.length}) em {defaultLabel}
                  </>
                )}
              </button>
              <button
                type="button"
                className="btn btn--quiet"
                onClick={() => {
                  setPending([]);
                  setOpenKey(null);
                  setAnnouncement("Lista de espera esvaziada.");
                }}
                disabled={submitting}
              >
                Limpar lista
              </button>
            </div>
          </div>

          <ul className="staging__list">
            {pending.map((item) => (
              <PendingRow
                key={item.key}
                item={item}
                defaults={defaults}
                onOpen={setOpenKey}
                onRemove={removePending}
              />
            ))}
          </ul>
        </section>
      )}

      <PendingModal
        item={openItem}
        defaults={defaults}
        onChange={changeOverride}
        onDownload={(key) => void downloadOne(key)}
        onRemove={removePending}
        onClose={() => setOpenKey(null)}
      />

      <section className="queue" aria-labelledby="queue-heading">
        <div className="queue__head">
          <h2 id="queue-heading" className="queue__title">
            Fila de downloads
          </h2>
          <span className="queue__count">
            {jobs.length === 0
              ? "nenhum item"
              : `${jobs.length} ${jobs.length === 1 ? "item" : "itens"}${
                  activeCount > 0 ? ` · ${activeCount} em andamento` : ""
                }`}
          </span>
        </div>

        {jobs.length === 0 ? (
          <div className="empty">
            <p className="empty__title">Nada baixando ainda</p>
            <p>
              {pending.length > 0
                ? "Sua lista de espera está montada. Clique em Baixar todos, ou abra um vídeo para baixar só ele."
                : "Cole o link de um vídeo aí em cima para montar sua lista."}
            </p>
          </div>
        ) : (
          <ul className="queue__list">
            {jobs.map((job) => (
              <QueueItem
                key={job.id}
                job={job}
                onCancel={cancel}
                onRetry={retryJob}
                onRemove={remove}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

export { detectPlatform };
