/** Durée minimale d'un combat classé. 150000 ms en production.
 * HARNESS_FAST_FIGHT n'existe que dans les tests : il ne doit pas être défini dans wrangler.toml. */
export const PRODUCTION_MIN_MS = 150000;

export function fightWindow(env, now, headerMin) {
  const harness = !!(env && env.HARNESS_FAST_FIGHT === '1');
  let min = PRODUCTION_MIN_MS;
  if (harness) {
    const configured = Number(env.FIGHT_MIN_MS ?? 0);
    min = Number.isFinite(configured) && configured >= 0 ? configured : 0;
    if (headerMin != null && headerMin !== '') {
      const n = Number(headerMin);
      if (Number.isFinite(n) && n >= 0 && n <= PRODUCTION_MIN_MS) min = n;
    }
  }
  const startedAt = now;
  return { minDurationMs: min, startedAt, readyAt: startedAt + min };
}

/** Horloge de test, ignorée si le harness n'est pas actif. */
export function clockNow(env, header) {
  if (env && env.HARNESS_FAST_FIGHT === '1' && header != null && header !== '') {
    const n = Number(header);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return Date.now();
}
