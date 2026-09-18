import { NextResponse } from "next/server";
import { cancelJob, getJob, removeJob } from "@/lib/jobs";
import { retry } from "@/lib/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

/** `?mode=remove` tira o card da fila; o padrão apenas interrompe o download. */
export async function DELETE(request: Request, { params }: Context) {
  const { id } = await params;
  if (!getJob(id)) {
    return NextResponse.json({ error: "Esse download não está mais na fila." }, { status: 404 });
  }

  const mode = new URL(request.url).searchParams.get("mode");
  const ok = mode === "remove" ? removeJob(id) : cancelJob(id);

  return NextResponse.json({ ok });
}

/** Recoloca na fila um download que falhou ou foi cancelado. */
export async function POST(_request: Request, { params }: Context) {
  const { id } = await params;
  if (!getJob(id)) {
    return NextResponse.json({ error: "Esse download não está mais na fila." }, { status: 404 });
  }

  if (!retry(id)) {
    return NextResponse.json(
      { error: "Só dá para tentar de novo downloads que falharam ou foram cancelados." },
      { status: 409 },
    );
  }

  return NextResponse.json({ ok: true });
}
