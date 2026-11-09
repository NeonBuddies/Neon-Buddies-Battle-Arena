/* Shared, server-authoritative platform features. Additive and payment-disabled by default. */
const AVATARS = new Set(['neon-default', 'neon-cyan', 'neon-magenta', 'neon-gold', 'neon-violet']);
const DAY_REWARDS = [
  { type: 'gems', id: 'gems', qty: 50, label: '50 gems' },
  { type: 'xp', id: 'xp', qty: 250, label: '250 XP' },
  { type: 'material', id: 'evolution-core', qty: 3, label: '3 noyaux d’évolution' },
  { type: 'gems', id: 'gems', qty: 100, label: '100 gems' },
  { type: 'skin', id: 'skin-neon-pulse', qty: 1, label: 'Skin Neon Pulse' },
  { type: 'character', id: '0021', qty: 1, label: 'Neon Buddy #0021' },
  { type: 'skin', id: 'skin-prismatic-crown', qty: 1, label: 'Skin exclusif Prismatic Crown' }
];
const PASS_XP_PER_LEVEL = 1000;
const PASS_LEVELS = 30;
const DAILY_MISSIONS = [
  { id: 'daily-win', label: 'Gagner 3 combats', target: 3, reward: { type: 'gems', id: 'gems', qty: 25 } },
  { id: 'daily-fight', label: 'Disputer 5 combats', target: 5, reward: { type: 'xp', id: 'xp', qty: 150 } },
  { id: 'daily-variety', label: 'Utiliser 2 personnages différents', target: 2, reward: { type: 'material', id: 'evolution-core', qty: 2 } }
];
const WEEKLY_MISSIONS = [
  { id: 'weekly-win', label: 'Gagner 15 combats', target: 15, reward: { type: 'gems', id: 'gems', qty: 150 } },
  { id: 'weekly-boss', label: 'Vaincre 3 boss', target: 3, reward: { type: 'material', id: 'evolution-core', qty: 10 } },
  { id: 'weekly-characters', label: 'Utiliser 5 personnages différents', target: 5, reward: { type: 'skin', id: 'skin-weekly-champion', qty: 1 } }
];
const TEST_PRODUCTS = new Map([
  ['gems-100', { type: 'gems', id: 'gems', qty: 100, label: '100 gems de test' }],
  ['evolution-pack', { type: 'material', id: 'evolution-core', qty: 10, label: 'Pack évolution de test' }],
  ['skin-neon-pulse', { type: 'skin', id: 'skin-neon-pulse', qty: 1, label: 'Skin Neon Pulse de test' }],
  ['battle-pass-30', { type: 'battle-pass', id: 'season-current', qty: 1, label: 'Battle Pass de test' }]
]);

function now() { return Date.now(); }
function dayKey(ts = now()) { return new Date(ts).toISOString().slice(0, 10); }
function weekKey(ts = now()) { const d = new Date(ts); const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() - day + 1); return d.toISOString().slice(0, 10); }
function seasonKey(ts = now()) { const d = new Date(ts); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`; }
function seasonEnds(ts = now()) { const d = new Date(ts); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1); }
function dailyIndex(day) { return (Math.floor(Date.parse(day) / 86400000) % 7 + 7) % 7 + 1; }
function cleanText(v, max) { return String(v || '').replace(/[<>]/g, '').trim().slice(0, max); }
function rewardKey(r) { return `${r.type}:${r.id}`; }

async function ensureEconomy(env, address) {
  const row = await env.DB.prepare('SELECT * FROM player_economy WHERE address = ?1').bind(address).first();
  if (row) return row;
  const t = now();
  await env.DB.prepare('INSERT OR IGNORE INTO player_economy (address, updated_at) VALUES (?1, ?2)').bind(address, t).run();
  return await env.DB.prepare('SELECT * FROM player_economy WHERE address = ?1').bind(address).first();
}
async function grantItem(env, address, reward, source) {
  const t = now();
  if (reward.type === 'gems') {
    await ensureEconomy(env, address);
    await env.DB.prepare('UPDATE player_economy SET gems = gems + ?1, updated_at = ?2 WHERE address = ?3').bind(reward.qty, t, address).run();
  } else if (reward.type === 'material') {
    await ensureEconomy(env, address);
    await env.DB.prepare('UPDATE player_economy SET materials = materials + ?1, updated_at = ?2 WHERE address = ?3').bind(reward.qty, t, address).run();
  }
  await env.DB.prepare(`INSERT INTO inventory (address,item_type,item_id,quantity,source,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?6)
    ON CONFLICT(address,item_type,item_id) DO UPDATE SET quantity=quantity+excluded.quantity, updated_at=excluded.updated_at`)
    .bind(address, reward.type, reward.id, reward.qty, source, t).run();
}
async function claimDaily(env, address) {
  const day = dayKey(), idx = dailyIndex(day), reward = DAY_REWARDS[idx - 1], t = now();
  const exists = await env.DB.prepare('SELECT * FROM daily_reward_claims WHERE address = ?1 AND day = ?2').bind(address, day).first();
  if (exists) return { claimed: false, duplicate: true, day, dayIndex: idx, reward: JSON.parse(exists.reward_json) };
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO daily_reward_claims (address,day,day_index,reward_json,claimed_at) VALUES (?1,?2,?3,?4,?5)')
    .bind(address, day, idx, JSON.stringify(reward), t).run();
  if (!ins.meta.changes) return { claimed: false, duplicate: true, day, dayIndex: idx, reward };
  await grantItem(env, address, reward, `daily:${day}`);
  return { claimed: true, duplicate: false, day, dayIndex: idx, reward };
}
function passRewards(track, level) {
  if (level < 1 || level > PASS_LEVELS) return null;
  if (track === 'free') return level % 5 === 0 ? { type: 'gems', id: 'gems', qty: 50, label: '50 gems' } : { type: 'material', id: 'evolution-core', qty: 2, label: '2 noyaux d’évolution' };
  if (track === 'premium') return level % 10 === 0 ? { type: 'character', id: String(30 + level).padStart(4, '0'), qty: 1, label: 'Personnage Battle Pass' } : { type: 'skin', id: `skin-pass-${level}`, qty: 1, label: `Skin Battle Pass #${level}` };
  return null;
}
async function claimPass(env, address, track, level) {
  const season = seasonKey(), p = await env.DB.prepare('SELECT * FROM battle_pass_progress WHERE address = ?1 AND season = ?2').bind(address, season).first();
  if (!p || p.xp < level * PASS_XP_PER_LEVEL - 1) throw new Error('Niveau de Battle Pass non débloqué');
  if (track === 'premium' && !p.premium) throw new Error('Pass Premium non activé');
  const reward = passRewards(track, Number(level));
  if (!reward) throw new Error('Récompense invalide');
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO battle_pass_claims (address,season,track,level,claimed_at) VALUES (?1,?2,?3,?4,?5)')
    .bind(address, season, track, level, now()).run();
  if (!ins.meta.changes) return { claimed: false, duplicate: true, season, track, level, reward };
  await grantItem(env, address, reward, `battle-pass:${season}:${track}:${level}`);
  return { claimed: true, duplicate: false, season, track, level, reward };
}
async function testPurchase(env, address, productId) {
  const reward = TEST_PRODUCTS.get(String(productId));
  if (!reward) throw new Error('Produit de test inconnu');
  const existing = await env.DB.prepare("SELECT id,product_id,status FROM shop_orders WHERE address=?1 AND product_id=?2 AND payment_mode='test'").bind(address, productId).first();
  if (existing) return { order: existing, duplicate: true, payment: 'test', charged: '0 ETH' };
  const t = now(), id = `test-order-${crypto.randomUUID()}`;
  await env.DB.prepare("INSERT INTO shop_orders (id,address,product_id,quantity,payment_mode,status,created_at,fulfilled_at) VALUES (?1,?2,?3,1,'test','fulfilled',?4,?4)").bind(id,address,productId,t).run();
  await grantItem(env, address, reward, `shop:test:${id}`);
  return { order: { id, productId, status: 'fulfilled' }, duplicate: false, payment: 'test', charged: '0 ETH', item: reward };
}
async function purchaseProduct(env, address, product, txHash) {
  const existing = await env.DB.prepare('SELECT id,product_id,status FROM shop_orders WHERE tx_hash = ?1').bind(txHash).first();
  if (existing) return { order: existing, duplicate: true, payment: 'crypto', item: null };
  const reward = product.category === 'gems'
    ? { type: 'gems', id: product.id, qty: Number(product.quantity || 0), label: product.name }
    : { type: product.category === 'nfts' ? 'nft' : product.category === 'characters' ? 'character' : product.category === 'skins' ? 'skin' : 'premium', id: product.id, qty: 1, label: product.name };
  if (!reward.qty) throw new Error('Produit sans quantité valide');
  const t = now(), id = `order-${crypto.randomUUID()}`;
  await env.DB.prepare("INSERT INTO shop_orders (id,address,product_id,quantity,payment_mode,status,tx_hash,created_at,fulfilled_at) VALUES (?1,?2,?3,1,'crypto','fulfilled',?4,?5,?5)")
    .bind(id, address, product.id, txHash, t).run();
  await grantItem(env, address, reward, `shop:crypto:${id}`);
  return { order: { id, productId: product.id, status: 'fulfilled', txHash }, duplicate: false, payment: 'crypto', charged: product.priceEth + ' ETH', item: reward };
}
async function updateProfile(env, address, body) {
  const username = cleanText(body.username, 20).replace(/[^\p{L}\p{N} _.-]/gu, '').trim() || null;
  const avatar = AVATARS.has(body.avatar) ? body.avatar : 'neon-default';
  const favorite = body.favoriteChar == null || /^\d{4}$/.test(String(body.favoriteChar)) ? (body.favoriteChar ? String(body.favoriteChar) : null) : null;
  const privacy = JSON.stringify({ showHistory: body.showHistory !== false, showFavorite: body.showFavorite !== false, showWallet: body.showWallet === true });
  const t = now();
  await env.DB.prepare('INSERT INTO player_profiles (address,username,avatar,favorite_char,privacy_json,updated_at) VALUES (?1,?2,?3,?4,?5,?6) ON CONFLICT(address) DO UPDATE SET username=excluded.username,avatar=excluded.avatar,favorite_char=excluded.favorite_char,privacy_json=excluded.privacy_json,updated_at=excluded.updated_at').bind(address, username, avatar, favorite, privacy, t).run();
  await env.DB.prepare('UPDATE players SET name=?1 WHERE address=?2').bind(username, address).run();
  return { username, avatar, favoriteChar: favorite, privacy: JSON.parse(privacy) };
}
async function evolveCharacter(env, address, charId) {
  if (!/^\d{4}$/.test(String(charId))) throw new Error('Personnage officiel requis');
  const row = await env.DB.prepare('SELECT * FROM character_evolution WHERE address=?1 AND char_id=?2').bind(address, charId).first();
  const stage = row ? Number(row.stage) : 1;
  if (stage >= 3) throw new Error('Stade maximum atteint');
  const next = stage + 1, materialCost = next === 2 ? 5 : 10, gemCost = next === 2 ? 10 : 25;
  const eco = await ensureEconomy(env, address);
  if (eco.materials < materialCost || eco.gems < gemCost) throw new Error(`Ressources insuffisantes : ${materialCost} matériaux et ${gemCost} gems requis`);
  const bonuses = next === 2 ? { attack: 5, defense: 5, health: 10 } : { attack: 10, defense: 10, health: 20 };
  const t = now();
  await env.DB.prepare('UPDATE player_economy SET materials=materials-?1,gems=gems-?2,updated_at=?3 WHERE address=?4 AND materials>=?1 AND gems>=?2').bind(materialCost, gemCost, t, address).run();
  await env.DB.prepare('INSERT INTO character_evolution (address,char_id,stage,attack_bonus,defense_bonus,health_bonus,materials_spent,gems_spent,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9) ON CONFLICT(address,char_id) DO UPDATE SET stage=excluded.stage,attack_bonus=excluded.attack_bonus,defense_bonus=excluded.defense_bonus,health_bonus=excluded.health_bonus,materials_spent=character_evolution.materials_spent+excluded.materials_spent,gems_spent=character_evolution.gems_spent+excluded.gems_spent,updated_at=excluded.updated_at').bind(address,charId,next,bonuses.attack,bonuses.defense,bonuses.health,materialCost,gemCost,t).run();
  return { charId, stage: next, bonuses, cost: { materials: materialCost, gems: gemCost } };
}
async function registerTournament(env, address, fighterId, type = 'daily') {
  if (!/^(daily|weekly)$/.test(type) || !/^\d{4}$/.test(String(fighterId))) throw new Error('Inscription invalide');
  const periodKey = type === 'weekly' ? weekKey() : dayKey(), size = type === 'weekly' ? 16 : 8, t = now();
  const id = `platform-${type}-${periodKey}`;
  await env.DB.prepare('INSERT OR IGNORE INTO platform_tournaments (id,period_type,period_key,size,status,created_at,updated_at) VALUES (?1,?2,?3,?4,\'open\',?5,?5)').bind(id,type,periodKey,size,t).run();
  await env.DB.prepare('INSERT OR IGNORE INTO platform_tournament_entries (tournament_id,address,fighter_id,joined_at) VALUES (?1,?2,?3,?4)').bind(id,address,String(fighterId),t).run();
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM platform_tournament_entries WHERE tournament_id=?1').bind(id).first();
  return { id, type, periodKey, size, registered: true, entries: count.n };
}
async function recordBattleProgress(env, address, matches, profile, mode) {
  const season = seasonKey(), xp = matches.reduce((sum, m) => sum + (m.result.winner === 'A' ? 250 : 100), 0);
  const t = now();
  await env.DB.prepare('INSERT INTO battle_pass_progress (address,season,xp,premium,updated_at) VALUES (?1,?2,?3,0,?4) ON CONFLICT(address,season) DO UPDATE SET xp=xp+excluded.xp,updated_at=excluded.updated_at').bind(address, season, xp, t).run();
  const achievements = [];
  if ((profile.wins || 0) >= 1) achievements.push('first-win');
  if ((profile.wins || 0) >= 10) achievements.push('ten-wins');
  if (mode === 'boss' && matches.some(m => m.result.winner === 'A')) achievements.push('boss-hunter');
  for (const id of achievements) await env.DB.prepare('INSERT OR IGNORE INTO achievements (address,achievement_id,unlocked_at) VALUES (?1,?2,?3)').bind(address, id, t).run();
  const week = weekKey(), current = await env.DB.prepare('SELECT state_json FROM weekly_missions WHERE address=?1 AND week=?2').bind(address, week).first();
  const state = current ? JSON.parse(current.state_json) : { progress: {}, claimed: {} };
  state.progress['weekly-win'] = Math.min(15, (state.progress['weekly-win'] || 0) + matches.filter(m => m.result.winner === 'A').length);
  state.progress['weekly-boss'] = Math.min(3, (state.progress['weekly-boss'] || 0) + (mode === 'boss' && matches.some(m => m.result.winner === 'A') ? 1 : 0));
  await env.DB.prepare('INSERT INTO weekly_missions (address,week,state_json,updated_at) VALUES (?1,?2,?3,?4) ON CONFLICT(address,week) DO UPDATE SET state_json=excluded.state_json,updated_at=excluded.updated_at').bind(address, week, JSON.stringify(state), t).run();
  return { season, xp, achievements };
}
async function claimMission(env, address, missionId) {
  const mission = WEEKLY_MISSIONS.find(m => m.id === String(missionId));
  if (!mission) throw new Error('Mission inconnue');
  const week = weekKey(), row = await env.DB.prepare('SELECT state_json FROM weekly_missions WHERE address=?1 AND week=?2').bind(address, week).first();
  const state = row ? JSON.parse(row.state_json) : { progress: {}, claimed: {} };
  if ((state.progress[mission.id] || 0) < mission.target) throw new Error('Mission non terminée');
  if (state.claimed[mission.id]) return { claimed: false, duplicate: true, week, missionId };
  state.claimed[mission.id] = true;
  await env.DB.prepare('UPDATE weekly_missions SET state_json=?1,updated_at=?2 WHERE address=?3 AND week=?4').bind(JSON.stringify(state), now(), address, week).run();
  await grantItem(env, address, mission.reward, `mission:${week}:${mission.id}`);
  return { claimed: true, duplicate: false, week, missionId, reward: mission.reward };
}
async function useInventoryItem(env, address, itemType, itemId) {
  const type = String(itemType || ''), id = String(itemId || '');
  const item = await env.DB.prepare('SELECT quantity FROM inventory WHERE address=?1 AND item_type=?2 AND item_id=?3').bind(address, type, id).first();
  if (!item || item.quantity < 1) throw new Error('Article indisponible');
  if (type === 'skin') {
    await env.DB.prepare('UPDATE player_profiles SET equipped_skin=?1,updated_at=?2 WHERE address=?3').bind(id, now(), address).run();
    return { used: true, type, itemId: id, equipped: id };
  }
  if (type === 'character') {
    const unlock = id === 'character-pack-basic' ? '0001' : id === 'character-pack-plus' ? '0011' : id === 'character-pack-elite' ? '0021' : id;
    await env.DB.prepare('UPDATE inventory SET quantity=quantity-1,updated_at=?1 WHERE address=?2 AND item_type=?3 AND item_id=?4 AND quantity>0').bind(now(), address, type, id).run();
    await grantItem(env, address, { type:'character', id:unlock, qty:1, label:`Personnage débloqué #${unlock}` }, `pack-opened:${id}`);
    return { used: true, type, itemId: id, unlockedCharacter: unlock };
  }
  throw new Error('Cet article est une pièce de collection et ne nécessite pas d’activation');
}
async function featureSnapshot(env, address) {
  const day = dayKey(), week = weekKey(), season = seasonKey();
  const [eco, pass, inv, daily, ach, guild, weekly, profile] = await Promise.all([
    ensureEconomy(env, address),
    env.DB.prepare('SELECT * FROM battle_pass_progress WHERE address = ?1 AND season = ?2').bind(address, season).first(),
    env.DB.prepare('SELECT item_type,item_id,quantity,source,updated_at FROM inventory WHERE address = ?1 ORDER BY updated_at DESC').bind(address).all(),
    env.DB.prepare('SELECT day,day_index,reward_json,claimed_at FROM daily_reward_claims WHERE address = ?1 ORDER BY claimed_at DESC LIMIT 14').bind(address).all(),
    env.DB.prepare('SELECT achievement_id,unlocked_at,claimed_at FROM achievements WHERE address = ?1 ORDER BY unlocked_at DESC').bind(address).all(),
    env.DB.prepare('SELECT g.id,g.name,g.slug,g.logo,gm.role FROM guild_members gm JOIN guilds g ON g.id=gm.guild_id WHERE gm.address=?1').bind(address).first(),
    env.DB.prepare('SELECT state_json FROM weekly_missions WHERE address=?1 AND week=?2').bind(address, week).first(),
    env.DB.prepare('SELECT equipped_skin FROM player_profiles WHERE address=?1').bind(address).first()
  ]);
  const weeklyState = weekly ? JSON.parse(weekly.state_json) : { progress: {}, claimed: {} };
  return { day, dayIndex: dailyIndex(day), dayRewards: DAY_REWARDS, week, dailyMissions: DAILY_MISSIONS, weeklyMissions: WEEKLY_MISSIONS.map(m => ({ id:m.id, label:m.label, target:m.target, reward:m.reward, progress:weeklyState.progress[m.id] || 0, claimed:!!weeklyState.claimed[m.id] })), season, seasonEnds: seasonEnds(), pass: { levels: PASS_LEVELS, xpPerLevel: PASS_XP_PER_LEVEL, progress: pass || { xp: 0, premium: 0 } }, economy: { gems: eco.gems, materials: eco.materials }, inventory: inv.results, equippedSkin: profile?.equipped_skin || null, dailyClaims: daily.results.map(r => ({ day:r.day, dayIndex:r.day_index, reward:JSON.parse(r.reward_json), claimedAt:r.claimed_at })), achievements: ach.results, guild: guild || null };
}
async function createGuild(env, address, body) {
  const existing = await env.DB.prepare('SELECT guild_id FROM guild_members WHERE address=?1').bind(address).first();
  if (existing) throw new Error('Tu es déjà dans une guilde');
  const name = cleanText(body.name, 32); const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32);
  if (name.length < 3 || !slug) throw new Error('Nom de guilde invalide');
  const id = `g-${crypto.randomUUID()}`; const t = now();
  await env.DB.prepare('INSERT INTO guilds (id,name,slug,description,logo,leader,created_at,updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?7)').bind(id,name,slug,cleanText(body.description,240),AVATARS.has(body.logo) ? body.logo : 'neon-guild-1',address,t).run();
  await env.DB.prepare('INSERT INTO guild_members (guild_id,address,role,joined_at) VALUES (?1,?2,?3,?4)').bind(id,address,'leader',t).run();
  return { id, name, slug };
}
async function inviteGuildMember(env, address, guildId, invitedAddress) {
  const target = String(invitedAddress || '').toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(target)) throw new Error('Adresse de joueur invalide');
  const leader = await env.DB.prepare("SELECT role FROM guild_members WHERE guild_id=?1 AND address=?2 AND role IN ('leader','officer')").bind(guildId,address).first();
  if (!leader) throw new Error('Droit de gestion requis');
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id=?1').bind(guildId).first();
  if (count.n >= 50) throw new Error('Guilde complète');
  await env.DB.prepare('INSERT INTO guild_invites (guild_id,address,invited_by,status,created_at) VALUES (?1,?2,?3,\'pending\',?4) ON CONFLICT(guild_id,address) DO UPDATE SET status=\'pending\',invited_by=excluded.invited_by,created_at=excluded.created_at').bind(guildId,target,address,now()).run();
  return { guildId, address: target, status: 'pending' };
}
async function decideGuildInvite(env, address, guildId, decision) {
  const invite = await env.DB.prepare("SELECT * FROM guild_invites WHERE guild_id=?1 AND address=?2 AND status='pending'").bind(guildId,address).first();
  if (!invite) throw new Error('Invitation introuvable ou déjà traitée');
  if (decision !== 'accept') {
    await env.DB.prepare("UPDATE guild_invites SET status='declined',decided_at=?1 WHERE guild_id=?2 AND address=?3 AND status='pending'").bind(now(),guildId,address).run();
    return { guildId, status: 'declined' };
  }
  const existing = await env.DB.prepare('SELECT guild_id FROM guild_members WHERE address=?1').bind(address).first();
  if (existing) throw new Error('Tu es déjà dans une guilde');
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM guild_members WHERE guild_id=?1').bind(guildId).first();
  if (count.n >= 50) throw new Error('Guilde complète');
  await env.DB.prepare('INSERT INTO guild_members (guild_id,address,role,joined_at) VALUES (?1,?2,\'member\',?3)').bind(guildId,address,now()).run();
  await env.DB.prepare("UPDATE guild_invites SET status='accepted',decided_at=?1 WHERE guild_id=?2 AND address=?3 AND status='pending'").bind(now(),guildId,address).run();
  return { guildId, status: 'accepted' };
}
async function guildChat(env, address, guildId, body) {
  const member = await env.DB.prepare('SELECT 1 FROM guild_members WHERE guild_id=?1 AND address=?2').bind(guildId,address).first();
  if (!member) throw new Error('Membre de guilde requis');
  const text = cleanText(body.body, 300); if (text.length < 1) throw new Error('Message vide');
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM guild_messages WHERE guild_id=?1 AND address=?2 AND created_at>?3').bind(guildId,address,now()-60000).first();
  if (recent.n >= 10) throw new Error('Limite anti-spam atteinte');
  const r = await env.DB.prepare('INSERT INTO guild_messages (guild_id,address,body,created_at) VALUES (?1,?2,?3,?4) RETURNING id,created_at').bind(guildId,address,text,now()).first();
  return { id:r.id, body:text, createdAt:r.created_at };
}
async function adminDashboard(env) {
  const [players,battles,guilds,guildMembers,tournamentEntries,evolutions,passXp,sales,claims] = await Promise.all([
    env.DB.prepare('SELECT COUNT(*) AS n FROM players').first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM fights WHERE created_at > ?1').bind(now()-86400000).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM guilds').first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM guild_members').first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM platform_tournament_entries WHERE joined_at > ?1").bind(now()-604800000).first(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM character_evolution').first(),
    env.DB.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM battle_pass_progress').first(),
    env.DB.prepare("SELECT COUNT(*) AS n FROM inventory WHERE source LIKE 'shop:%'").first(),
    env.DB.prepare('SELECT status,COUNT(*) AS n FROM rewards GROUP BY status').all()
  ]);
  return { players: players.n, battles24h: battles.n, guilds: guilds.n, guildMembers: guildMembers.n, tournamentEntries7d: tournamentEntries.n, evolvedCharacters: evolutions.n, battlePassXp: passXp.n, storeItemsGranted: sales.n, rewards: Object.fromEntries(claims.results.map(x => [x.status, x.n])), payments: { enabled: false, configured: false } };
}
export { claimDaily, claimPass, testPurchase, purchaseProduct, useInventoryItem, updateProfile, evolveCharacter, registerTournament, recordBattleProgress, claimMission, featureSnapshot, createGuild, inviteGuildMember, decideGuildInvite, guildChat, adminDashboard, seasonKey, dayKey, weekKey, grantItem, PASS_LEVELS, PASS_XP_PER_LEVEL };
