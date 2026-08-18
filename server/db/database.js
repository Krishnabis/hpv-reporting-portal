import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── PostgreSQL (Supabase/Railway) ────────────────────────────────────────────
const isPg = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
let pgPool = null;

if (isPg) {
  pgPool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
    max: 10
  });
  console.log('⚡ Connected to PostgreSQL (Supabase)');
}

// ─── JSON File Fallback (local dev without DATABASE_URL) ─────────────────────
const storePath = path.join(__dirname, '../../hpv_store.json');
let store = { states: [], districts: [], blocks: [], block_reporting_profiles: [], daily_reports: [], admin_users: [], settings: [], audit_logs: [] };

if (!isPg && fs.existsSync(storePath)) {
  try { store = JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch (e) { console.error('JSON store load error:', e); }
}

function saveStore() {
  if (!isPg) {
    try { fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8'); } catch (e) { console.error('JSON store save error:', e); }
  }
}

// JSON fallback query engine
function jsonQuery(sql, params) {
  const s = sql.trim();
  const p = params || [];

  if (s.includes('FROM states')) return [...store.states].sort((a, b) => a.name.localeCompare(b.name));

  if (s.includes('FROM districts')) {
    let r = [...store.districts];
    if (s.includes('WHERE id = ') || s.includes('WHERE d.id = ')) r = r.filter(d => d.id === Number(p[0]));
    else if (s.includes('lgd_code = ')) r = r.filter(d => d.lgd_code === Number(p[0]));
    return r.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (s.includes('FROM blocks')) {
    let r = store.blocks.map(b => {
      const d = store.districts.find(x => x.id === b.district_id) || {};
      const st = store.states.find(x => x.id === d.state_id) || { name: 'Uttarakhand', lgd_code: 5 };
      return { ...b, district_name: d.name || '', district_lgd_code: d.lgd_code || 0, state_name: st.name, state_lgd_code: st.lgd_code };
    });
    if (s.includes('WHERE b.id = ') || s.includes('WHERE id = ')) r = r.filter(b => b.id === Number(p[0]));
    if (s.includes('district_id = ')) r = r.filter(b => b.district_id === Number(p[0]));
    return r.sort((a, b) => a.name.localeCompare(b.name));
  }

  if (s.includes('FROM block_reporting_profiles')) {
    if (s.includes('block_id = ')) return store.block_reporting_profiles.filter(x => x.block_id === Number(p[0]));
    return [...store.block_reporting_profiles];
  }

  if (s.includes('FROM daily_reports')) {
    let r = [...store.daily_reports];
    if (s.includes('block_id = ') && s.includes('reporting_date = ')) r = r.filter(x => x.block_id === Number(p[0]) && x.reporting_date === p[1]);
    else if (s.includes('block_id = ')) r = r.filter(x => x.block_id === Number(p[0]));
    else if (s.includes('reporting_date = ')) r = r.filter(x => x.reporting_date === p[0]);
    if (s.includes('ORDER BY reporting_date DESC')) r.sort((a, b) => b.reporting_date.localeCompare(a.reporting_date));
    if (s.includes('COUNT(DISTINCT block_id)')) return [{ cnt: new Set(r.map(x => x.block_id)).size }];
    return r;
  }

  if (s.includes('FROM admin_users')) {
    if (s.includes('username = ')) return store.admin_users.filter(u => u.username === p[0]);
    return [...store.admin_users];
  }

  if (s.includes('FROM settings')) {
    if (s.includes('key = ')) return store.settings.filter(x => x.key === p[0]);
    return [...store.settings];
  }

  if (s.includes('FROM audit_logs')) return [...store.audit_logs].sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (s.includes('COUNT(*) as cnt FROM blocks')) return [{ cnt: store.blocks.length }];
  return [];
}

function jsonRun(sql, params) {
  const s = sql.trim();
  const p = params || [];

  if (s.includes('INSERT INTO block_reporting_profiles') || s.includes('block_reporting_profiles')) {
    const [id, block_id, base_population, population_base_date, initial_hpv_target] = p;
    const idx = store.block_reporting_profiles.findIndex(x => x.block_id === Number(block_id));
    const rec = { id, block_id: Number(block_id), base_population: Number(base_population), population_base_date, initial_hpv_target: Number(initial_hpv_target), updated_at: new Date().toISOString() };
    if (idx >= 0) store.block_reporting_profiles[idx] = rec; else store.block_reporting_profiles.push(rec);
    saveStore(); return { rowCount: 1 };
  }

  if (s.includes('INSERT INTO daily_reports') || s.includes('daily_reports')) {
    const [id, block_id, reporting_date, line_list_count, beneficiaries_vaccinated, submitted_by] = p;
    const idx = store.daily_reports.findIndex(x => x.block_id === Number(block_id) && x.reporting_date === reporting_date);
    const rec = { id, block_id: Number(block_id), reporting_date, line_list_count: Number(line_list_count), beneficiaries_vaccinated: Number(beneficiaries_vaccinated), submitted_by: submitted_by || 'Block Operator', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    if (idx >= 0) store.daily_reports[idx] = rec; else store.daily_reports.push(rec);
    saveStore(); return { rowCount: 1 };
  }

  if (s.includes('INSERT INTO admin_users')) {
    const [id, username, password_hash, name, role] = p;
    const exists = store.admin_users.find(u => u.username === username);
    if (!exists) store.admin_users.push({ id, username, password_hash, name, role: role || 'SUPER_ADMIN', is_active: 1, created_at: new Date().toISOString() });
    else exists.password_hash = password_hash;
    saveStore(); return { rowCount: 1 };
  }

  if (s.includes('INSERT INTO settings')) {
    const [id, key, value, description] = p;
    const exists = store.settings.find(x => x.key === key);
    if (!exists) store.settings.push({ id, key, value, description, updated_at: new Date().toISOString() });
    else exists.value = value;
    saveStore(); return { rowCount: 1 };
  }

  if (s.includes('INSERT INTO audit_logs')) {
    const [id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address] = p;
    store.audit_logs.unshift({ id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at: new Date().toISOString() });
    saveStore(); return { rowCount: 1 };
  }

  if (s.includes('UPDATE admin_users') && s.includes('last_login_at')) {
    const u = store.admin_users.find(x => x.id === p[0]);
    if (u) u.last_login_at = new Date().toISOString();
    saveStore(); return { rowCount: 1 };
  }

  if (s.includes('UPDATE settings')) {
    const [value, updated_by, key] = p;
    const s2 = store.settings.find(x => x.key === key);
    if (s2) { s2.value = value; s2.updated_by = updated_by; s2.updated_at = new Date().toISOString(); }
    saveStore(); return { rowCount: 1 };
  }

  return { rowCount: 0 };
}

// ─── Unified Async DB Interface ───────────────────────────────────────────────
const db = {
  isPg,

  async query(sql, params = []) {
    if (isPg) {
      const { rows } = await pgPool.query(sql, params);
      return rows;
    }
    return Promise.resolve(jsonQuery(sql, params));
  },

  async queryOne(sql, params = []) {
    const rows = await db.query(sql, params);
    return rows[0] || null;
  },

  async run(sql, params = []) {
    if (isPg) {
      const result = await pgPool.query(sql, params);
      return { rowCount: result.rowCount };
    }
    return Promise.resolve(jsonRun(sql, params));
  }
};

export default db;
