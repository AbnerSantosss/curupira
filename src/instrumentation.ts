/** Roda uma vez na subida do servidor. */
export async function register() {
  // A faxina mexe em disco: só existe no runtime Node, nunca no edge.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startRetention } = await import("./lib/retention");
  startRetention();
}
