/** Orchestrates an already guarded connection; no VS Code dependency. */
export async function probeAuthentication(connect, config, options) {
  const session = await connect(config, options);
  try { return { endpoint: session.endpoint, hostKey: session.hostKey }; }
  finally { await session.close(); }
}
