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

app.use(cors());
app.use(express.json());

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'hpv_salt_2026', 1000, 64, 'sha512').toString('hex');
}

// Helper: Calculate current population based on base date and 0.08% monthly growth rate
function calculateCurrentPopulation(basePop, baseDateStr, monthlyRate = 0.0008) {
  if (!basePop) return 0;
  if (!baseDateStr) return basePop;

  const baseDate = new Date(baseDateStr);
  const now = new Date();

  let months = (now.getFullYear() - baseDate.getFullYear()) * 12 + (now.getMonth() - baseDate.getMonth());
  if (months < 0) months = 0;

  const currentPop = basePop * Math.pow(1 + monthlyRate, months);
  return Math.round(currentPop);
}

// Helper: Audit Logger
function logAudit(userId, action, entityType, entityId, oldValue = null, newValue = null, ip = '') {
  try {
    const id = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId || 'SYSTEM',
      action,
      entityType,
      entityId ? String(entityId) : null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ip
    );
  } catch (err) {
    console.error('Audit Log Error:', err);
  }
}

// Helper: Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

// -------------------------------------------------------------
// PUBLIC & LOCATION ENDPOINTS
// -------------------------------------------------------------

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'HPV Reporting Portal API', time: new Date().toISOString() });
});

app.get('/api/locations/states', (req, res) => {
  const states = db.prepare('SELECT * FROM states WHERE is_active = 1').all();
  res.json(states);
});

app.get('/api/locations/districts', (req, res) => {
  const { stateId } = req.query;
  const districts = db.prepare('SELECT * FROM districts WHERE is_active = 1').all(stateId);
  res.json(districts);
});

app.get('/api/locations/blocks', (req, res) => {
  const { districtId } = req.query;
  const blocks = db.prepare('SELECT * FROM blocks WHERE is_active = 1').all(districtId);
  res.json(blocks);
});

app.get('/api/locations/search', (req, res) => {
  const { query } = req.query;
  if (!query || String(query).trim().length === 0) return res.json([]);

  const results = db.prepare('SELECT * FROM blocks WHERE b.name LIKE ?').all(String(query).trim());
  res.json(results);
});

// -------------------------------------------------------------
// BLOCK REPORTING ENDPOINTS
// -------------------------------------------------------------

app.get('/api/blocks/:id', (req, res) => {
  const { id } = req.params;
  const blocks = db.prepare('SELECT * FROM blocks WHERE b.id = ?').all(id);
  const block = blocks[0];

  if (!block) return res.status(404).json({ error: 'Block not found' });

  const profiles = db.prepare('SELECT * FROM block_reporting_profiles WHERE block_id = ?').all(id);
  const profile = profiles[0] || null;

  const growthSettings = db.prepare("SELECT * FROM settings WHERE key = 'monthly_population_growth'").all('monthly_population_growth');
  const targetSettings = db.prepare("SELECT * FROM settings WHERE key = 'hpv_target_percentage'").all('hpv_target_percentage');

  const growthRate = growthSettings[0] ? parseFloat(growthSettings[0].value) : 0.0008;
  const targetPct = targetSettings[0] ? parseFloat(targetSettings[0].value) : 0.01;

  let currentPopulation = 0;
  let currentTarget = 0;

  if (profile) {
    currentPopulation = calculateCurrentPopulation(profile.base_population, profile.population_base_date, growthRate);
    currentTarget = Math.round(currentPopulation * targetPct);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const todayReports = db.prepare('SELECT * FROM daily_reports WHERE block_id = ? AND reporting_date = ?').all(id, todayStr);
  const allReports = db.prepare('SELECT * FROM daily_reports WHERE block_id = ? ORDER BY reporting_date DESC').all(id);

  res.json({
    block: {
      id: block.id,
      name: block.name,
      lgd_code: block.lgd_code,
      district_name: block.district_name,
      district_lgd_code: block.district_lgd_code,
      state_name: block.state_name,
      state_lgd_code: block.state_lgd_code
    },
    profile: profile ? {
      ...profile,
      current_population: currentPopulation,
      current_hpv_target: currentTarget
    } : null,
    today_submitted: todayReports.length > 0,
    today_report: todayReports[0] || null,
    last_report: allReports[0] || null
  });
});

app.post('/api/blocks/:id/profile', (req, res) => {
  const { id } = req.params;
  const { base_population, population_base_date } = req.body;

  if (!base_population || isNaN(base_population) || Number(base_population) <= 0) {
    return res.status(400).json({ error: 'Valid positive population is required' });
  }

  const baseDate = population_base_date || new Date().toISOString().split('T')[0];
  const targetSettings = db.prepare("SELECT * FROM settings WHERE key = 'hpv_target_percentage'").all('hpv_target_percentage');
  const targetPct = targetSettings[0] ? parseFloat(targetSettings[0].value) : 0.01;

  const initialTarget = Math.round(Number(base_population) * targetPct);
  const existingProfiles = db.prepare('SELECT * FROM block_reporting_profiles WHERE block_id = ?').all(id);
  const profId = existingProfiles[0] ? existingProfiles[0].id : `prof-${id}-${Date.now()}`;

  db.prepare(`
    INSERT INTO block_reporting_profiles (id, block_id, base_population, population_base_date, initial_hpv_target)
    VALUES (?, ?, ?, ?, ?)
  `).run(profId, Number(id), Number(base_population), baseDate, initialTarget);

  logAudit('BLOCK_OPERATOR', 'UPDATE_BLOCK_PROFILE', 'block_reporting_profile', profId, existingProfiles[0], {
    base_population: Number(base_population),
    population_base_date: baseDate,
    initial_hpv_target: initialTarget
  }, req.ip);

  res.json({ message: 'One-time baseline population profile saved successfully', initial_hpv_target: initialTarget });
});

app.post('/api/reports/block/:id', (req, res) => {
  const { id } = req.params;
  const { reporting_date, line_list_count, beneficiaries_vaccinated, submitted_by } = req.body;

  if (!reporting_date) return res.status(400).json({ error: 'Reporting date is required' });
  if (line_list_count === undefined || isNaN(line_list_count)) return res.status(400).json({ error: 'Valid line list count is required' });
  if (beneficiaries_vaccinated === undefined || isNaN(beneficiaries_vaccinated)) return res.status(400).json({ error: 'Valid beneficiaries vaccinated count is required' });

  const existing = db.prepare('SELECT * FROM daily_reports WHERE block_id = ? AND reporting_date = ?').all(id, reporting_date)[0];
  const reportId = existing ? existing.id : `rep-${id}-${reporting_date}-${Date.now()}`;

  db.prepare(`
    INSERT INTO daily_reports (id, block_id, reporting_date, line_list_count, beneficiaries_vaccinated, submitted_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(reportId, Number(id), reporting_date, Number(line_list_count), Number(beneficiaries_vaccinated), submitted_by || 'Block Operator');

  logAudit('BLOCK_OPERATOR', existing ? 'UPDATE_DAILY_REPORT' : 'CREATE_DAILY_REPORT', 'daily_report', reportId, existing, {
    reporting_date,
    line_list_count: Number(line_list_count),
    beneficiaries_vaccinated: Number(beneficiaries_vaccinated)
  }, req.ip);

  res.json({ message: 'Daily report saved successfully', report_id: reportId });
});

app.get('/api/reports/block/:id', (req, res) => {
  const { id } = req.params;
  const reports = db.prepare('SELECT * FROM daily_reports WHERE block_id = ? ORDER BY reporting_date DESC').all(id);
  res.json(reports);
});

// -------------------------------------------------------------
// ADMIN AUTHENTICATION
// -------------------------------------------------------------

app.post('/api/auth/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password are required' });

  const users = db.prepare('SELECT * FROM admin_users WHERE username = ?').all(username);
  const user = users[0];

  if (!user) return res.status(401).json({ error: 'Invalid username or password' });

  const inputHash = hashPassword(password);
  if (inputHash !== user.password_hash) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  db.prepare('UPDATE admin_users SET last_login_at = ? WHERE id = ?').run(user.id);

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });

  logAudit(user.id, 'ADMIN_LOGIN', 'admin_user', user.id, null, { username: user.username }, req.ip);

  res.json({
    token,
    user: { id: user.id, username: user.username, name: user.name, role: user.role }
  });
});

// -------------------------------------------------------------
// ADMIN DASHBOARD & REPORTS GENERATOR
// -------------------------------------------------------------

app.get('/api/admin/kpis', (req, res) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const totalBlocksRow = db.prepare('SELECT COUNT(*) as cnt FROM blocks').get();
  const reportingTodayRow = db.prepare('SELECT COUNT(DISTINCT block_id) as cnt FROM daily_reports WHERE reporting_date = ?').get(todayStr);

  const growthSettings = db.prepare("SELECT * FROM settings WHERE key = 'monthly_population_growth'").all('monthly_population_growth');
  const targetSettings = db.prepare("SELECT * FROM settings WHERE key = 'hpv_target_percentage'").all('hpv_target_percentage');

  const growthRate = growthSettings[0] ? parseFloat(growthSettings[0].value) : 0.0008;
  const targetPct = targetSettings[0] ? parseFloat(targetSettings[0].value) : 0.01;

  const blocks = db.prepare('SELECT * FROM blocks').all();

  let totalLineList = 0;
  let totalVaccinated = 0;
  let totalTargetPop = 0;

  const districtStatsMap = new Map();

  for (const block of blocks) {
    let currentPop = 0;
    let target = 0;
    if (block.base_population) {
      currentPop = calculateCurrentPopulation(block.base_population, block.population_base_date, growthRate);
      target = Math.round(currentPop * targetPct);
    }

    totalTargetPop += target;

    const latestReps = db.prepare('SELECT * FROM daily_reports WHERE block_id = ? ORDER BY reporting_date DESC').all(block.id);
    const latestRep = latestReps[0];

    const lineList = latestRep ? latestRep.line_list_count : 0;
    const vaccinated = latestRep ? latestRep.beneficiaries_vaccinated : 0;

    totalLineList += lineList;
    totalVaccinated += vaccinated;

    if (!districtStatsMap.has(block.district_name)) {
      districtStatsMap.set(block.district_name, {
        district: block.district_name,
        targetPop: 0,
        lineList: 0,
        vaccinated: 0
      });
    }

    const distStat = districtStatsMap.get(block.district_name);
    distStat.targetPop += target;
    distStat.lineList += lineList;
    distStat.vaccinated += vaccinated;
  }

  const districtChartData = Array.from(districtStatsMap.values()).map(d => ({
    district: d.district,
    vaccinated: d.vaccinated,
    lineList: d.lineList,
    target: d.targetPop,
    coveragePct: d.targetPop > 0 ? parseFloat(((d.vaccinated / d.targetPop) * 100).toFixed(2)) : 0
  })).sort((a, b) => b.coveragePct - a.coveragePct);

  res.json({
    total_blocks: totalBlocksRow ? totalBlocksRow.cnt : blocks.length,
    reporting_today: reportingTodayRow ? reportingTodayRow.cnt : 0,
    total_line_list: totalLineList,
    total_vaccinated: totalVaccinated,
    total_target_pop: totalTargetPop,
    overall_coverage_pct: totalTargetPop > 0 ? parseFloat(((totalVaccinated / totalTargetPop) * 100).toFixed(2)) : 0,
    district_chart_data: districtChartData
  });
});

app.get('/api/admin/reports/generate', (req, res) => {
  const { date, level = 'State', districtId, blockId } = req.query;

  const reportDate = date || new Date().toISOString().split('T')[0];

  const growthSettings = db.prepare("SELECT * FROM settings WHERE key = 'monthly_population_growth'").all('monthly_population_growth');
  const targetSettings = db.prepare("SELECT * FROM settings WHERE key = 'hpv_target_percentage'").all('hpv_target_percentage');

  const growthRate = growthSettings[0] ? parseFloat(growthSettings[0].value) : 0.0008;
  const targetPct = targetSettings[0] ? parseFloat(targetSettings[0].value) : 0.01;

  if (level === 'Block' || (blockId && blockId !== 'ALL')) {
    let blockRows = db.prepare('SELECT * FROM blocks').all();

    if (blockId && blockId !== 'ALL') {
      blockRows = blockRows.filter(b => b.id === Number(blockId));
    } else if (districtId && districtId !== 'ALL') {
      blockRows = blockRows.filter(b => b.district_id === Number(districtId));
    }

    const rows = blockRows.map(b => {
      const currentPop = b.base_population ? calculateCurrentPopulation(b.base_population, b.population_base_date, growthRate) : 0;
      const targetPop = Math.round(currentPop * targetPct);

      const dailies = db.prepare('SELECT * FROM daily_reports WHERE block_id = ? AND reporting_date <= ? ORDER BY reporting_date DESC').all(b.id, reportDate);
      const daily = dailies[0];

      const lineList = daily ? daily.line_list_count : null;
      const vaccinated = daily ? daily.beneficiaries_vaccinated : null;
      const lastDate = daily ? daily.reporting_date : '—';

      const lineListPct = (lineList !== null && targetPop > 0) ? parseFloat(((lineList / targetPop) * 100).toFixed(2)) : null;
      const coveragePct = (vaccinated !== null && targetPop > 0) ? parseFloat(((vaccinated / targetPop) * 100).toFixed(2)) : null;

      return {
        id: b.id,
        name: b.name,
        lgd_code: b.lgd_code,
        district_name: b.district_name,
        district_lgd_code: b.district_lgd_code,
        state_name: b.state_name,
        state_lgd_code: b.state_lgd_code,
        population: currentPop || null,
        hpv_target: targetPop || null,
        last_reporting_date: lastDate,
        line_list_received: lineList,
        beneficiaries_vaccinated: vaccinated,
        line_list_received_pct: lineListPct,
        vaccination_coverage_pct: coveragePct
      };
    });

    return res.json({ level: 'Block', report_date: reportDate, rows });
  }

  let districts = db.prepare('SELECT * FROM districts').all();

  if (districtId && districtId !== 'ALL') {
    districts = districts.filter(d => d.id === Number(districtId));
  }

  const rows = districts.map(d => {
    const blocksInDist = db.prepare('SELECT * FROM blocks WHERE b.district_id = ?').all(d.id);

    let distPopulation = 0;
    let distTarget = 0;
    let distLineList = 0;
    let distVaccinated = 0;
    let hasReports = false;
    let latestReportDate = '—';

    for (const b of blocksInDist) {
      if (b.base_population) {
        const curPop = calculateCurrentPopulation(b.base_population, b.population_base_date, growthRate);
        const tgt = Math.round(curPop * targetPct);
        distPopulation += curPop;
        distTarget += tgt;
      }

      const dailies = db.prepare('SELECT * FROM daily_reports WHERE block_id = ? AND reporting_date <= ? ORDER BY reporting_date DESC').all(b.id, reportDate);
      const daily = dailies[0];

      if (daily) {
        hasReports = true;
        distLineList += daily.line_list_count;
        distVaccinated += daily.beneficiaries_vaccinated;
        if (latestReportDate === '—' || daily.reporting_date > latestReportDate) {
          latestReportDate = daily.reporting_date;
        }
      }
    }

    const lineListPct = (hasReports && distTarget > 0) ? parseFloat(((distLineList / distTarget) * 100).toFixed(2)) : null;
    const coveragePct = (hasReports && distTarget > 0) ? parseFloat(((distVaccinated / distTarget) * 100).toFixed(2)) : null;

    return {
      id: d.id,
      name: d.name,
      lgd_code: d.lgd_code,
      state_name: d.state_name,
      state_lgd_code: d.state_lgd_code,
      population: distPopulation > 0 ? distPopulation : null,
      hpv_target: distTarget > 0 ? distTarget : null,
      last_reporting_date: latestReportDate,
      line_list_received: hasReports ? distLineList : null,
      beneficiaries_vaccinated: hasReports ? distVaccinated : null,
      line_list_received_pct: lineListPct,
      vaccination_coverage_pct: coveragePct
    };
  });

  res.json({ level: level || 'District', report_date: reportDate, rows });
});

app.get('/api/admin/settings', (req, res) => {
  const settings = db.prepare('SELECT * FROM settings').all();
  res.json(settings);
});

app.put('/api/admin/settings', authenticateToken, (req, res) => {
  const { settings } = req.body;
  if (!Array.isArray(settings)) return res.status(400).json({ error: 'Settings array required' });

  for (const item of settings) {
    db.prepare('UPDATE settings SET value = ?, updated_by = ? WHERE key = ?').run(String(item.value), req.user.id, item.key);
  }

  logAudit(req.user.id, 'UPDATE_SETTINGS', 'settings', 'GLOBAL', null, settings, req.ip);

  res.json({ message: 'Settings updated successfully' });
});

app.get('/api/admin/audit-logs', authenticateToken, (req, res) => {
  const logs = db.prepare('SELECT * FROM audit_logs').all();
  res.json(logs);
});

app.get('/api/admin/users', authenticateToken, (req, res) => {
  const users = db.prepare('SELECT * FROM admin_users').all();
  res.json(users);
});

app.listen(PORT, () => {
  console.log(`🚀 HPV Reporting Portal API Server running on port ${PORT}`);
});

export default app;
