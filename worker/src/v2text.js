/* Règles pures de la communauté V2 (sans base, sans réseau). */

export const LOGOS = ['crown', 'fox', 'panda', 'demon', 'angel', 'bolt', 'star', 'mask'];

/** PV partagés et plafond de dégâts par participant. Le plafond est toujours inférieur aux PV :
    un seul coup ne peut pas vider un raid planifié. */
export const RAID_SPECS = {
  normal: { hp: 8000, cap: 900, points: 40, nft: false, boss: 0 },
  hard: { hp: 14000, cap: 1100, points: 70, nft: false, boss: 1 },
  nightmare: { hp: 22000, cap: 1400, points: 110, nft: false, boss: 2 },
  legend: { hp: 40000, cap: 1800, points: 160, nft: true, boss: 0 }
};

export function schedulerEnabled(env) {
  return String(env && env.V2_SCHEDULER || '') === '1';
}

export function capDamage(raw, cap) {
  const n = Math.max(0, Math.floor(Number(raw) || 0));
  const c = Math.max(1, Math.floor(Number(cap) || 1));
  if (n <= 0) return 1;
  return Math.min(c, n);
}

export function cleanLabel(s, min, max) {
  const t = String(s || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().replace(/\s+/g, ' ');
  if (t.length < min || t.length > max) return null;
  return t;
}

export function cleanMessage(s) {
  const t = String(s || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[<>]/g, '').trim();
  if (!t) return { error: 'Message vide' };
  if (t.length > 280) return { error: 'Message trop long' };
  return { text: t };
}

/** Semaine ISO UTC, ex. 2026-W46. */
export function isoWeek(ts) {
  const d = new Date(ts);
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return date.getUTCFullYear() + '-W' + String(week).padStart(2, '0');
}

/** Samedi 18:00 UTC, départ 18:20 UTC. Si le créneau est passé, le samedi suivant. */
export function saturdayWindow(now) {
  const d = new Date(now);
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const add = (6 - day.getUTCDay() + 7) % 7;
  const sat = new Date(day);
  sat.setUTCDate(sat.getUTCDate() + add);
  let opens = Date.UTC(sat.getUTCFullYear(), sat.getUTCMonth(), sat.getUTCDate(), 18, 0, 0);
  let starts = opens + 20 * 60 * 1000;
  if (now > starts) {
    opens += 7 * 86400000;
    starts = opens + 20 * 60 * 1000;
  }
  return { opensAt: opens, startsAt: starts, size: 8, source: 'calendar-saturday-18:00Z' };
}

export function weekStart(ts) {
  const d = new Date(ts);
  const day = d.getUTCDay() || 7;
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return start - (day - 1) * 86400000;
}
