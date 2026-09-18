import { getVersion, listJobs } from "@/lib/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stream SSE do estado da fila.
 *
 * Emite apenas quando o store muda (comparando o contador de versão), então uma
 * fila parada não gasta banda nem provoca re-render no cliente. Escolhido em vez
 * de WebSocket porque o fluxo é unidirecional e o SSE reconecta sozinho.
 */
export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let lastVersion = -1;
      let closed = false;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const tick = () => {
        const version = getVersion();
        if (version !== lastVersion) {
          lastVersion = version;
          send("jobs", { jobs: listJobs() });
        }
      };

      tick();
      const interval = setInterval(tick, 400);
      // Comentário periódico: mantém a conexão viva através de proxies que
      // encerram streams ociosos.
      const keepAlive = setInterval(() => {
        if (!closed) {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"));
          } catch {
            closed = true;
          }
        }
      }, 20_000);

      const cleanup = () => {
        closed = true;
        clearInterval(interval);
        clearInterval(keepAlive);
        try {
          controller.close();
        } catch {
          // Já fechado pelo cliente.
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
