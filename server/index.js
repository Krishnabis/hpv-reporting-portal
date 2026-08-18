import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db from './db/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'hpv-reporting-portal-secret-key-2026';
if (!process.env.JWT_SECRET) {
  console.warn('⚠️  WARNING: JWT_SECRET not set. Set JWT_SECRET in Vercel env vars for production!');
}

app.use(cors());
app.use(express.json());

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'hpv_salt_2026', 1000, 64, 'sha512').toString('hex');
}

function authenticateToken(req, res, next) {
  const token = (req.headers['authorization'] || '').split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

async function logAudit(userId, action, entityType, entityId, oldVal = null, newVal = null, ip = '') {
  try {
    const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (db.isPg) {
      await db.run(
        `INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id, userId || 'SYSTEM', action, entityType, entityId ? String(entityId) : null,
          oldVal ? JSON.stringify(oldVal) : null, newVal ? JSON.stringify(newVal) : null, ip]
      );
    } else {
      await db.run('INSERT INTO audit_logs', [id, userId || 'SYSTEM', action, entityType, entityId, oldVal, newVal, ip]);
    }
  } catch (err) { console.error('Audit log error:', err); }
}

// ─── Health & DB Status ───────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'HPV Reporting Portal API', time: new Date().toISOString() });
});

app.get('/api/db-status', (req, res) => {
  res.json({
    database: db.isPg ? 'PostgreSQL (Supabase)' : 'JSON File Fallback',
    connected_to_supabase: db.isPg,
    env_vars_present: { DATABASE_URL: Boolean(process.env.DATABASE_URL), SUPABASE_DB_URL: Boolean(process.env.SUPABASE_DB_URL) },
    note: db.isPg ? 'Data persisted in Supabase PostgreSQL' : 'WARNING: Using local JSON store — data will not persist on Vercel'
  });
});

// ─── Location Endpoints ───────────────────────────────────────────────────────

app.get('/api/locations/states', async (req, res) => {
  try {
    const rows = db.isPg
      ? await db.query('SELECT * FROM states WHERE is_active = true ORDER BY name')
      : await db.query('SELECT * FROM states WHERE is_active = 1');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/districts', async (req, res) => {
  try {
    const rows = db.isPg
      ? await db.query('SELECT * FROM districts WHERE is_active = true ORDER BY name')
      : await db.query('SELECT * FROM districts WHERE is_active = 1');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/blocks', async (req, res) => {
  try {
    let rows;
    if (db.isPg) {
      rows = await db.query(`
        SELECT b.id, b.district_id, b.lgd_code, b.name, b.code, b.is_active,
               d.name AS district_name, d.lgd_code AS district_lgd_code,
               s.name AS state_name, s.lgd_code AS state_lgd_code
        FROM blocks b
        JOIN districts d ON b.district_id = d.id
        JOIN states s ON d.state_id = s.id
        WHERE b.is_active = true
        ORDER BY b.name
      `);
    } else {
      rows = await db.query('SELECT * FROM blocks WHERE is_active = 1');
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Block Reporting Endpoints ────────────────────────────────────────────────

app.get('/api/blocks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let block;
    if (db.isPg) {
      block = await db.queryOne(`
        SELECT b.id, b.district_id, b.lgd_code, b.name, b.code,
               d.name AS district_name, d.lgd_code AS district_lgd_code,
               s.name AS state_name, s.lgd_code AS state_lgd_code
        FROM blocks b
        JOIN districts d ON b.district_id = d.id
        JOIN states s ON d.state_id = s.id
        WHERE b.id = $1`, [id]);
    } else {
      block = await db.queryOne('SELECT * FROM blocks WHERE b.id = ?', [id]);
    }

    if (!block) return res.status(404).json({ error: 'Block not found' });

    const profile = db.isPg
      ? await db.queryOne('SELECT * FROM block_reporting_profiles WHERE block_id = $1', [id])
      : await db.queryOne('SELECT * FROM block_reporting_profiles WHERE block_id = ?', [id]);

    // HPV target = flat 1% of base population
    const hpvTarget = profile ? Math.round(profile.base_population * 0.01) : 0;

    const todayStr = new Date().toISOString().split('T')[0];
    let todayReport, lastReport;

    if (db.isPg) {
      todayReport = await db.queryOne(
        'SELECT * FROM daily_reports WHERE block_id = $1 AND reporting_date = $2',
        [id, todayStr]
      );
      lastReport = await db.queryOne(
        'SELECT * FROM daily_reports WHERE block_id = $1 ORDER BY reporting_date DESC LIMIT 1',
        [id]
      );
    } else {
      todayReport = await db.queryOne('SELECT * FROM daily_reports WHERE block_id = ? AND reporting_date = ?', [id, todayStr]);
      const allReps = await db.query('SELECT * FROM daily_reports WHERE block_id = ? ORDER BY reporting_date DESC', [id]);
      lastReport = allReps[0] || null;
    }

    res.json({
      block: { id: block.id, name: block.name, lgd_code: block.lgd_code, district_name: block.district_name, district_lgd_code: block.district_lgd_code, state_name: block.state_name, state_lgd_code: block.state_lgd_code },
      profile: profile ? { ...profile, current_population: profile.base_population, current_hpv_target: hpvTarget } : null,
      today_submitted: Boolean(todayReport),
      today_report: todayReport || null,
      last_report: lastReport || null
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/blocks/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const { base_population, population_base_date } = req.body;

    if (!base_population || isNaN(base_population) || Number(base_population) <= 0) {
      return res.status(400).json({ error: 'Valid positive population is required' });
    }

    const baseDate = population_base_date || new Date().toISOString().split('T')[0];
    const initialTarget = Math.round(Number(base_population) * 0.01);
    const profId = `prof-${id}-${Date.now()}`;

    if (db.isPg) {
      await db.run(`
        INSERT INTO block_reporting_profiles (id, block_id, base_population, population_base_date, initial_hpv_target)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (block_id) DO UPDATE SET
          base_population = EXCLUDED.base_population,
          population_base_date = EXCLUDED.population_base_date,
          initial_hpv_target = EXCLUDED.initial_hpv_target,
          updated_at = CURRENT_TIMESTAMP`,
        [profId, Number(id), Number(base_population), baseDate, initialTarget]
      );
    } else {
      await db.run('INSERT INTO block_reporting_profiles', [profId, Number(id), Number(base_population), baseDate, initialTarget]);
    }

    await logAudit('BLOCK_OPERATOR', 'UPDATE_BLOCK_PROFILE', 'block', id, null, { base_population: Number(base_population) }, req.ip);
    res.json({ message: 'Baseline population saved', initial_hpv_target: initialTarget });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/block/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = db.isPg
      ? await db.query('SELECT * FROM daily_reports WHERE block_id = $1 ORDER BY reporting_date DESC', [id])
      : await db.query('SELECT * FROM daily_reports WHERE block_id = ? ORDER BY reporting_date DESC', [id]);
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reports/block/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reporting_date, line_list_count, beneficiaries_vaccinated, submitted_by } = req.body;

    if (!reporting_date) return res.status(400).json({ error: 'Reporting date is required' });
    if (line_list_count === undefined || isNaN(line_list_count)) return res.status(400).json({ error: 'Valid line list count is required' });
    if (beneficiaries_vaccinated === undefined || isNaN(beneficiaries_vaccinated)) return res.status(400).json({ error: 'Valid beneficiaries vaccinated count is required' });

    const reportId = `rep-${id}-${reporting_date}-${Date.now()}`;

    if (db.isPg) {
      await db.run(`
        INSERT INTO daily_reports (id, block_id, reporting_date, line_list_count, beneficiaries_vaccinated, submitted_by)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (block_id, reporting_date) DO UPDATE SET
          line_list_count = EXCLUDED.line_list_count,
          beneficiaries_vaccinated = EXCLUDED.beneficiaries_vaccinated,
          submitted_by = EXCLUDED.submitted_by,
          updated_at = CURRENT_TIMESTAMP`,
        [reportId, Number(id), reporting_date, Number(line_list_count), Number(beneficiaries_vaccinated), submitted_by || 'Block Operator']
      );
    } else {
      await db.run('INSERT INTO daily_reports', [reportId, Number(id), reporting_date, Number(line_list_count), Number(beneficiaries_vaccinated), submitted_by || 'Block Operator']);
    }

    await logAudit('BLOCK_OPERATOR', 'SUBMIT_REPORT', 'daily_report', reportId, null, { reporting_date, line_list_count, beneficiaries_vaccinated }, req.ip);
    res.json({ message: 'Report saved', report_id: reportId });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Admin Auth ───────────────────────────────────────────────────────────────

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    const user = db.isPg
      ? await db.queryOne('SELECT * FROM admin_users WHERE username = $1 AND is_active = true', [username])
      : await db.queryOne('SELECT * FROM admin_users WHERE username = ?', [username]);

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const hash = hashPassword(password);
    if (hash !== user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    // Update last login
    if (db.isPg) {
      await db.run('UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    } else {
      await db.run('UPDATE admin_users SET last_login_at', [user.id]);
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    await logAudit(user.id, 'ADMIN_LOGIN', 'admin_user', user.id, null, null, req.ip);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    let totalBlocks, reportedToday, totalReports;

    if (db.isPg) {
      const [tb, rt, tr] = await Promise.all([
        db.queryOne('SELECT COUNT(*) AS cnt FROM blocks WHERE is_active = true'),
        db.queryOne('SELECT COUNT(DISTINCT block_id) AS cnt FROM daily_reports WHERE reporting_date = $1', [todayStr]),
        db.queryOne('SELECT COUNT(*) AS cnt FROM daily_reports')
      ]);
      totalBlocks = Number(tb?.cnt || 0);
      reportedToday = Number(rt?.cnt || 0);
      totalReports = Number(tr?.cnt || 0);
    } else {
      const tb = await db.queryOne('SELECT COUNT(*) as cnt FROM blocks WHERE is_active = 1');
      const reps = await db.query('SELECT * FROM daily_reports WHERE reporting_date = ?', [todayStr]);
      const allReps = await db.query('SELECT * FROM daily_reports');
      totalBlocks = Number(tb?.cnt || 0);
      reportedToday = new Set(reps.map(r => r.block_id)).size;
      totalReports = allReps.length;
    }

    res.json({
      total_blocks: totalBlocks,
      reported_today: reportedToday,
      not_reported_today: totalBlocks - reportedToday,
      total_reports: totalReports,
      reporting_rate_today: totalBlocks > 0 ? ((reportedToday / totalBlocks) * 100).toFixed(1) : '0.0',
      date: todayStr
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/reports', authenticateToken, async (req, res) => {
  try {
    const { date, districtId, blockId, limit = 100 } = req.query;
    let rows;

    if (db.isPg) {
      let sql = `
        SELECT dr.*, b.name AS block_name, b.lgd_code AS block_lgd_code,
               d.name AS district_name, d.id AS district_id
        FROM daily_reports dr
        JOIN blocks b ON dr.block_id = b.id
        JOIN districts d ON b.district_id = d.id
        WHERE 1=1`;
      const params = [];
      if (date)       { params.push(date);        sql += ` AND dr.reporting_date = $${params.length}`; }
      if (districtId) { params.push(districtId);  sql += ` AND d.id = $${params.length}`; }
      if (blockId)    { params.push(blockId);      sql += ` AND dr.block_id = $${params.length}`; }
      params.push(Number(limit));
      sql += ` ORDER BY dr.reporting_date DESC, b.name LIMIT $${params.length}`;
      rows = await db.query(sql, params);
    } else {
      let reps = await db.query('SELECT * FROM daily_reports');
      if (date) reps = reps.filter(r => r.reporting_date === date);
      if (blockId) reps = reps.filter(r => r.block_id === Number(blockId));
      rows = reps.slice(0, Number(limit));
    }

    res.json(rows);
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/blocks', authenticateToken, async (req, res) => {
  try {
    const { districtId } = req.query;
    let rows;
    if (db.isPg) {
      let sql = `
        SELECT b.*, d.name AS district_name, d.lgd_code AS district_lgd_code,
               p.base_population, p.initial_hpv_target
        FROM blocks b
        JOIN districts d ON b.district_id = d.id
        LEFT JOIN block_reporting_profiles p ON b.id = p.block_id
        WHERE b.is_active = true`;
      const params = [];
      if (districtId) { params.push(districtId); sql += ` AND b.district_id = $1`; }
      sql += ' ORDER BY d.name, b.name';
      rows = await db.query(sql, params);
    } else {
      rows = await db.query('SELECT * FROM blocks WHERE is_active = 1');
    }
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/districts', authenticateToken, async (req, res) => {
  try {
    const rows = db.isPg
      ? await db.query('SELECT * FROM districts WHERE is_active = true ORDER BY name')
      : await db.query('SELECT * FROM districts WHERE is_active = 1');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/settings', authenticateToken, async (req, res) => {
  try {
    const rows = db.isPg
      ? await db.query('SELECT * FROM settings ORDER BY key')
      : await db.query('SELECT * FROM settings');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/admin/settings/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    if (!value) return res.status(400).json({ error: 'Value is required' });
    if (db.isPg) {
      await db.run('UPDATE settings SET value = $1, updated_by = $2, updated_at = CURRENT_TIMESTAMP WHERE key = $3', [String(value), req.user.username, key]);
    } else {
      await db.run('UPDATE settings', [String(value), req.user.username, key]);
    }
    await logAudit(req.user.id, 'UPDATE_SETTING', 'setting', key, null, { value }, req.ip);
    res.json({ message: 'Setting updated' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/audit-logs', authenticateToken, async (req, res) => {
  try {
    const rows = db.isPg
      ? await db.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200')
      : await db.query('SELECT * FROM audit_logs');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Admin Report Generator ────────────────────────────────────────────────────

app.get('/api/admin/report-generator', authenticateToken, async (req, res) => {
  try {
    const { date, groupBy = 'district' } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];

    if (!db.isPg) {
      return res.json({ date: reportDate, groups: [], total_blocks: 0, reported: 0 });
    }

    const rows = await db.query(`
      SELECT d.id AS district_id, d.name AS district_name,
             b.id AS block_id, b.name AS block_name,
             dr.line_list_count, dr.beneficiaries_vaccinated,
             p.base_population, p.initial_hpv_target
      FROM districts d
      JOIN blocks b ON b.district_id = d.id
      LEFT JOIN daily_reports dr ON dr.block_id = b.id AND dr.reporting_date = $1
      LEFT JOIN block_reporting_profiles p ON p.block_id = b.id
      WHERE b.is_active = true
      ORDER BY d.name, b.name`, [reportDate]);

    // Group by district
    const grouped = {};
    for (const row of rows) {
      const key = row.district_id;
      if (!grouped[key]) grouped[key] = { district_id: row.district_id, district_name: row.district_name, blocks: [], total_line_list: 0, total_vaccinated: 0, total_population: 0, total_target: 0, reported_count: 0 };
      const g = grouped[key];
      g.blocks.push(row);
      if (row.line_list_count !== null) {
        g.total_line_list += Number(row.line_list_count || 0);
        g.total_vaccinated += Number(row.beneficiaries_vaccinated || 0);
        g.reported_count++;
      }
      g.total_population += Number(row.base_population || 0);
      g.total_target += Number(row.initial_hpv_target || 0);
    }

    res.json({
      date: reportDate,
      groups: Object.values(grouped),
      total_blocks: rows.length,
      reported: rows.filter(r => r.line_list_count !== null).length
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Server Start ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 HPV Reporting Portal API running on port ${PORT}`);
  console.log(`📊 Database: ${db.isPg ? 'PostgreSQL (Supabase)' : 'Local JSON Store'}`);
});

export default app;
