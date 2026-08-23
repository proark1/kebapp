export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") {
    return;
  }

  const { startRoundMaintenanceLoop } = await import(
    "@/server/procurement/round-maintenance"
  );
  startRoundMaintenanceLoop();
}
