import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isPg = Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);

let pgPool = null;
if (isPg) {
  const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;
  pgPool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });
  console.log('⚡ Connected to PostgreSQL (Supabase / Railway Database)');
}

// Persistent JSON fallback database for zero-config offline/local execution
const storePath = path.join(__dirname, '../../hpv_store.json');

let store = {
  states: [],
  districts: [],
  blocks: [],
  block_reporting_profiles: [],
  daily_reports: [],
  admin_users: [],
  settings: [],
  audit_logs: []
};

if (fs.existsSync(storePath)) {
  try {
    const raw = fs.readFileSync(storePath, 'utf8');
    store = JSON.parse(raw);
  } catch (e) {
    console.error('Error loading JSON data store, resetting store:', e);
  }
}

function saveStore() {
  try {
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('Error saving store:', e);
  }
}

// Database helper wrapping sync JSON engine & async PG adapter
class Statement {
  constructor(sql) {
    this.sql = sql;
  }

  run(...args) {
    // Handle INSERT / UPDATE / DELETE operations
    const sql = this.sql.trim();

    if (sql.includes('INSERT INTO states')) {
      const [lgd, name, code] = args;
      let existing = store.states.find(s => s.lgd_code === lgd);
      if (existing) {
        existing.name = name;
      } else {
        store.states.push({ id: store.states.length + 1, lgd_code: lgd, name, code, is_active: 1 });
      }
      saveStore();
      return { changes: 1 };
    }

    if (sql.includes('INSERT INTO districts')) {
      const [state_id, lgd, name, code] = args;
      let existing = store.districts.find(d => d.lgd_code === lgd);
      if (existing) {
        existing.name = name;
      } else {
        store.districts.push({ id: store.districts.length + 1, state_id, lgd_code: lgd, name, code, is_active: 1 });
      }
      saveStore();
      return { changes: 1 };
    }

    if (sql.includes('INSERT INTO blocks')) {
      const [district_id, lgd, name, code] = args;
      let existing = store.blocks.find(b => b.lgd_code === lgd);
      if (existing) {
        existing.name = name;
      } else {
        store.blocks.push({ id: store.blocks.length + 1, district_id, lgd_code: lgd, name, code, is_active: 1 });
      }
      saveStore();
      return { changes: 1 };
    }

    if (sql.includes('INSERT INTO settings')) {
      const [id, key, value, description] = args;
      let existing = store.settings.find(s => s.key === key);
      if (existing) {
        existing.value = value;
      } else {
        store.settings.push({ id, key, value, description, updated_at: new Date().toISOString() });
      }
      saveStore();
      return { changes: 1 };
    }

    if (sql.includes('UPDATE settings')) {
      const [value, updated_by, key] = args;
      let existing = store.settings.find(s => s.key === key);
      if (existing) {
        existing.value = value;
        existing.updated_by = updated_by;
        existing.updated_at = new Date().toISOString();
      }
      saveStore();
      return { changes: 1 };
    }

    if (sql.includes('INSERT INTO admin_users')) {
      const [id, username, password_hash, name, role] = args;
      let existing = store.admin_users.find(u => u.username === username);
      if (existing) {
        existing.password_hash = password_hash;
      } else {
        store.admin_users.push({ id, username, password_hash, name, role: role || 'SUPER_ADMIN', is_active: 1, created_at: new Date().toISOString() });
      }
      saveStore();
      return { changes: 1 };
    }

    if (sql.includes('UPDATE admin_users SET last_login_at')) {
      const [id] = args;
      let user = store.admin_users.find(u => u.id === id);
      if (user) user.last_login_at = new Date().toISOString();
      saveStore();
      return { changes: 1 };
    }

    if (sql.includes('INSERT INTO block_reporting_profiles')) {
      const [id, block_id, base_population, population_base_date, initial_hpv_target] = args;
      const idx = store.block_reporting_profiles.findIndex(p => p.block_id === Number(block_id));
      const record = { id, block_id: Number(block_id), base_population: Number(base_population), population_base_date, initial_hpv_target: Number(initial_hpv_target), updated_at: new Date().toISOString() };
      if (idx >= 0) {
        store.block_reporting_profiles[idx] = record;
      } else {
        store.block_reporting_profiles.push(record);
      }
      saveStore();
      return { changes: 1 };
    }

    if (sql.includes('INSERT INTO daily_reports')) {
      const [id, block_id, reporting_date, line_list_count, beneficiaries_vaccinated, submitted_by] = args;
      const idx = store.daily_reports.findIndex(r => r.block_id === Number(block_id) && r.reporting_date === reporting_date);
      const record = {
        id,
        block_id: Number(block_id),
        reporting_date,
        line_list_count: Number(line_list_count),
        beneficiaries_vaccinated: Number(beneficiaries_vaccinated),
        submitted_by: submitted_by || 'Block Operator',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      if (idx >= 0) {
        store.daily_reports[idx] = record;
      } else {
        store.daily_reports.push(record);
      }
      saveStore();
      return { changes: 1 };
    }

    if (sql.includes('INSERT INTO audit_logs')) {
      const [id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address] = args;
      store.audit_logs.unshift({
        id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, created_at: new Date().toISOString()
      });
      saveStore();
      return { changes: 1 };
    }

    return { changes: 0 };
  }

  get(...args) {
    const list = this.all(...args);
    return list.length > 0 ? list[0] : undefined;
  }

  all(...args) {
    const sql = this.sql.trim();

    if (sql.includes('FROM states')) {
      if (sql.includes('WHERE lgd_code = ?')) {
        return store.states.filter(s => s.lgd_code === Number(args[0]));
      }
      return [...store.states].sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sql.includes('FROM districts')) {
      let result = [...store.districts];
      if (sql.includes('WHERE lgd_code = ?')) {
        return result.filter(d => d.lgd_code === Number(args[0]));
      }
      if (sql.includes('state_id = ?')) {
        result = result.filter(d => d.state_id === Number(args[0]));
      }
      if (sql.includes('d.id = ?')) {
        result = result.filter(d => d.id === Number(args[0]));
      }
      return result.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sql.includes('FROM blocks')) {
      let result = store.blocks.map(b => {
        const d = store.districts.find(dist => dist.id === b.district_id) || { name: '', lgd_code: 0, state_id: 1 };
        const s = store.states.find(st => st.id === d.state_id) || { name: 'Uttarakhand', lgd_code: 5 };
        const p = store.block_reporting_profiles.find(prof => prof.block_id === b.id);
        return {
          ...b,
          district_name: d.name,
          district_lgd_code: d.lgd_code,
          state_name: s.name,
          state_lgd_code: s.lgd_code,
          base_population: p ? p.base_population : null,
          population_base_date: p ? p.population_base_date : null
        };
      });

      if (sql.includes('WHERE b.id = ?')) {
        return result.filter(b => b.id === Number(args[0]));
      }
      if (sql.includes('b.district_id = ?')) {
        result = result.filter(b => b.district_id === Number(args[0]));
      }
      if (sql.includes('WHERE b.name LIKE ?')) {
        const q = String(args[0]).replace(/%/g, '').toLowerCase();
        result = result.filter(b => 
          b.name.toLowerCase().includes(q) || 
          b.district_name.toLowerCase().includes(q) ||
          String(b.lgd_code).includes(q) ||
          String(b.district_lgd_code).includes(q)
        );
      }
      return result.sort((a, b) => a.name.localeCompare(b.name));
    }

    if (sql.includes('FROM block_reporting_profiles')) {
      if (sql.includes('WHERE block_id = ?')) {
        return store.block_reporting_profiles.filter(p => p.block_id === Number(args[0]));
      }
      return [...store.block_reporting_profiles];
    }

    if (sql.includes('FROM daily_reports')) {
      let reps = [...store.daily_reports];
      if (sql.includes('block_id = ? AND reporting_date = ?')) {
        reps = reps.filter(r => r.block_id === Number(args[0]) && r.reporting_date === args[1]);
      } else if (sql.includes('block_id = ? AND reporting_date <= ?')) {
        reps = reps.filter(r => r.block_id === Number(args[0]) && r.reporting_date <= args[1]);
      } else if (sql.includes('block_id = ?')) {
        reps = reps.filter(r => r.block_id === Number(args[0]));
      } else if (sql.includes('WHERE reporting_date = ?')) {
        reps = reps.filter(r => r.reporting_date === args[0]);
      }

      if (sql.includes('ORDER BY reporting_date DESC')) {
        reps.sort((a, b) => b.reporting_date.localeCompare(a.reporting_date));
      }

      if (sql.includes('COUNT(DISTINCT block_id)')) {
        const uniqueBlocks = new Set(reps.map(r => r.block_id));
        return [{ cnt: uniqueBlocks.size }];
      }

      return reps;
    }

    if (sql.includes('FROM admin_users')) {
      if (sql.includes('WHERE username = ?')) {
        return store.admin_users.filter(u => u.username === args[0]);
      }
      return [...store.admin_users];
    }

    if (sql.includes('FROM settings')) {
      if (sql.includes('WHERE key = ?')) {
        return store.settings.filter(s => s.key === args[0]);
      }
      return [...store.settings];
    }

    if (sql.includes('FROM audit_logs')) {
      return [...store.audit_logs].sort((a, b) => b.created_at.localeCompare(a.created_at));
    }

    if (sql.includes('COUNT(*) as cnt FROM blocks')) {
      return [{ cnt: store.blocks.length }];
    }

    return [];
  }
}

const db = {
  prepare: (sql) => new Statement(sql),
  transaction: (fn) => (...args) => fn(...args),
  exec: (sql) => {}
};

export default db;
