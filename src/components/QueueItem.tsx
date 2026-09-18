"use client";

import {
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiDownload,
  FiFilm,
  FiMusic,
  FiRotateCcw,
  FiSlash,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import type { Job, JobStatus } from "@/lib/types";
import { formatBytes, formatEta, formatPercent, formatSpeed } from "@/lib/format";
import { PlatformBadge } from "./PlatformIcon";

/** Rótulo + ícone por estado: cor sozinha não comunica para todo mundo. */
const STATUS: Record<JobStatus, { label: string; Icon: IconType }> = {
  queued: { label: "Na fila", Icon: FiClock },
  downloading: { label: "Baixando", Icon: FiDownload },
  converting: { label: "Convertendo", Icon: FiMusic },
  done: { label: "Pronto", Icon: FiCheckCircle },
  error: { label: "Falhou", Icon: FiAlertTriangle },
  canceled: { label: "Cancelado", Icon: FiSlash },
};

interface Props {
  job: Job;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
}

export function QueueItem({ job, onCancel, onRetry, onRemove }: Props) {
  const { label, Icon } = STATUS[job.status];
  const inFlight = job.status === "downloading" || job.status === "converting";
  const kindLabel = job.kind === "audio" ? "MP3" : job.height ? `MP4 ${job.height}p` : "MP4";
  const KindIcon = job.kind === "audio" ? FiMusic : FiFilm;

  return (
    <li className={`item item--${job.status}`}>
      <div className="item__top">
        <div className="item__thumb">
          {job.thumbnail ? (
            /* Miniaturas vêm de dezenas de CDNs diferentes; otimizá-las exigiria
               liberar hosts arbitrários no next/image. */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={job.thumbnail} alt="" loading="lazy" decoding="async" />
          ) : (
            <KindIcon aria-hidden="true" />
          )}
        </div>

        <div>
          <h3 className="item__title" title={job.title}>
            {job.title}
          </h3>
          <div className="item__tags">
            <span className={`status status--${job.status}`}>
              <Icon aria-hidden="true" />
              {label}
            </span>
            <span className="tag">
              <KindIcon aria-hidden="true" />
              {kindLabel}
            </span>
            <PlatformBadge url={job.url} />
          </div>
        </div>
      </div>

      {job.status !== "error" && job.status !== "canceled" && (
        <div
          className="progress"
          role="progressbar"
          aria-valuenow={job.status === "converting" ? undefined : Math.round(job.percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${job.title}`}
        >
          <div
            className={[
              "progress__bar",
              job.status === "done" ? "progress__bar--done" : "",
              job.status === "converting" ? "progress__bar--indeterminate" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ width: `${job.status === "done" ? 100 : job.percent}%` }}
          />
        </div>
      )}

      {inFlight && (
        <p className="item__stats">
          <span>{formatPercent(job.percent)}</span>
          {job.totalBytes > 0 && (
            <span>
              {formatBytes(job.downloadedBytes)} de {formatBytes(job.totalBytes)}
            </span>
          )}
          {job.speed > 0 && <span>{formatSpeed(job.speed)}</span>}
          {job.eta > 0 && <span>{formatEta(job.eta)} restantes</span>}
          {job.status === "converting" && <span>Convertendo — falta pouco.</span>}
        </p>
      )}

      {job.status === "queued" && (
        <p className="item__stats">
          <span>Aguardando uma vaga na fila.</span>
        </p>
      )}

      {job.status === "done" && job.fileName && (
        <p className="item__stats">
          <span>{job.fileName}</span>
          {job.totalBytes > 0 && <span>{formatBytes(job.totalBytes)}</span>}
        </p>
      )}

      {job.status === "error" && job.error && (
        <p className="item__error">
          <FiAlertTriangle aria-hidden="true" style={{ flexShrink: 0, marginTop: "0.2em" }} />
          <span>{job.error}</span>
        </p>
      )}

      {job.status === "canceled" && (
        <p className="item__stats">
          <span>Você cancelou este download.</span>
        </p>
      )}

      <div className="item__actions">
        {job.status === "done" && (
          <a className="btn btn--primary btn--sm" href={`/api/jobs/${job.id}/file`} download>
            <FiDownload aria-hidden="true" />
            Salvar arquivo
          </a>
        )}

        {(job.status === "error" || job.status === "canceled") && (
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => onRetry(job.id)}>
            <FiRotateCcw aria-hidden="true" />
            Tentar de novo
          </button>
        )}

        {(inFlight || job.status === "queued") && (
          <button type="button" className="btn btn--danger btn--sm" onClick={() => onCancel(job.id)}>
            <FiX aria-hidden="true" />
            Cancelar
          </button>
        )}

        {!inFlight && job.status !== "queued" && (
          <button type="button" className="btn btn--quiet btn--sm" onClick={() => onRemove(job.id)}>
            <FiTrash2 aria-hidden="true" />
            Tirar da lista
          </button>
        )}
      </div>
    </li>
  );
}
