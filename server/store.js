// Profile persistence. Uses PostgreSQL when DATABASE_URL is set (server-side only), otherwise an in-memory Map (dev).
const EMPTY = () => ({ name: '', settings: { sens: 1, sound: true, quality: 'auto' }, loadout: { primary: 'ak12', skin: 'std' }, stats: { matches: 0, kills: 0, deaths: 0 } });

export async function createStore(databaseUrl) {
  if (!databaseUrl) {
    const m = new Map();
    return { kind: 'memory', async get(uid) { return m.get(uid) || EMPTY(); }, async put(uid, data) { m.set(uid, data); }, async addResult(uid, r) { const d = m.get(uid) || EMPTY(); d.stats.matches++; d.stats.kills += r.kills; d.stats.deaths += r.deaths; m.set(uid, d); }, async close() {} };
  }
  const { default: pg } = await import('pg'); // optional dependency, loaded lazily
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 5, ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false } });
  return {
    kind: 'postgres',
    async get(uid) { const r = await pool.query('SELECT data FROM profiles WHERE user_id = $1', [uid]); return r.rows[0]?.data || EMPTY(); },
    async put(uid, data) { await pool.query('INSERT INTO profiles (user_id, data) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET data = $2, updated_at = now()', [uid, data]); },
    async addResult(uid, r) {
      const d = await this.get(uid); d.stats.matches++; d.stats.kills += r.kills; d.stats.deaths += r.deaths;
      await this.put(uid, d);
      await pool.query('INSERT INTO match_results (user_id, kills, deaths, rank) VALUES ($1,$2,$3,$4)', [uid, r.kills, r.deaths, r.rank]);
    },
    async close() { await pool.end(); },
  };
}
export { EMPTY };
