import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { supabase, useSupabase, store, saveStore } from './db/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'hpv-reporting-portal-secret-key-2026';

app.use(cors());
app.use(express.json());

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hashPassword(pw) {
  return crypto.pbkdf2Sync(pw, 'hpv_salt_2026', 1000, 64, 'sha512').toString('hex');
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

async function logAudit(userId, action, entityType, entityId) {
  if (!useSupabase) return;
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  await supabase.from('audit_logs').insert([{ id, user_id: userId || 'SYSTEM', action, entity_type: entityType, entity_id: entityId ? String(entityId) : null }]);
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function flattenBlock(b) {
  return {
    id: b.id, district_id: b.district_id, lgd_code: b.lgd_code,
    name: b.name, code: b.code, is_active: b.is_active,
    district_name: b.districts?.name ?? '',
    district_lgd_code: b.districts?.lgd_code ?? 0,
    state_name: b.districts?.states?.name ?? 'Uttarakhand',
    state_lgd_code: b.districts?.states?.lgd_code ?? 5
  };
}

// ─── Status ───────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'HPV Reporting Portal API', time: new Date().toISOString() });
});

app.get('/api/db-status', (req, res) => {
  res.json({
    database: useSupabase ? 'Supabase JS (HTTPS)' : 'JSON File Fallback',
    connected: useSupabase,
    env_vars: {
      SUPABASE_URL: Boolean(process.env.SUPABASE_URL),
      SUPABASE_SERVICE_KEY: Boolean(process.env.SUPABASE_SERVICE_KEY)
    }
  });
});

// ─── Locations ────────────────────────────────────────────────────────────────

app.get('/api/locations/states', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await supabase.from('states').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return res.json(data);
    }
    res.json(store.states.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/districts', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await supabase.from('districts').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return res.json(data);
    }
    res.json(store.districts.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/blocks', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('blocks')
        .select('*, districts!inner(name, lgd_code, states!inner(name, lgd_code))')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return res.json(data.map(flattenBlock));
    }
    // JSON fallback
    res.json(store.blocks.map(b => {
      const d = store.districts.find(x => x.id === b.district_id) || {};
      const s = store.states.find(x => x.id === d.state_id) || { name: 'Uttarakhand', lgd_code: 5 };
      return { ...b, district_name: d.name || '', district_lgd_code: d.lgd_code || 0, state_name: s.name, state_lgd_code: s.lgd_code };
    }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Block Reporting ──────────────────────────────────────────────────────────

app.get('/api/blocks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let block, profile, todayReport, lastReport;

    if (useSupabase) {
      const { data: blockData, error: bErr } = await supabase
        .from('blocks')
        .select('*, districts!inner(name, lgd_code, states!inner(name, lgd_code))')
        .eq('id', id)
        .single();
      if (bErr || !blockData) return res.status(404).json({ error: 'Block not found' });
      block = flattenBlock(blockData);

      const { data: profileData } = await supabase
        .from('block_reporting_profiles')
        .select('*')
        .eq('block_id', id)
        .maybeSingle();
      profile = profileData || null;

      const todayStr = new Date().toISOString().split('T')[0];
      const { data: todayData } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('block_id', id)
        .eq('reporting_date', todayStr)
        .maybeSingle();
      todayReport = todayData || null;

      const { data: lastData } = await supabase
        .from('daily_reports')
        .select('*')
        .eq('block_id', id)
        .order('reporting_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      lastReport = lastData || null;
    } else {
      // JSON fallback
      const b = store.blocks.find(x => x.id === Number(id));
      if (!b) return res.status(404).json({ error: 'Block not found' });
      const d = store.districts.find(x => x.id === b.district_id) || {};
      const s = store.states.find(x => x.id === d.state_id) || { name: 'Uttarakhand', lgd_code: 5 };
      block = { ...b, district_name: d.name, district_lgd_code: d.lgd_code, state_name: s.name, state_lgd_code: s.lgd_code };
      profile = store.block_reporting_profiles.find(x => x.block_id === Number(id)) || null;
      const todayStr = new Date().toISOString().split('T')[0];
      todayReport = store.daily_reports.find(r => r.block_id === Number(id) && r.reporting_date === todayStr) || null;
      const reps = store.daily_reports.filter(r => r.block_id === Number(id)).sort((a, b) => b.reporting_date.localeCompare(a.reporting_date));
      lastReport = reps[0] || null;
    }

    const hpvTarget = profile ? Math.round(profile.base_population * 0.01) : 0;

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
    if (!base_population || Number(base_population) <= 0) return res.status(400).json({ error: 'Valid positive population required' });

    const baseDate = population_base_date || new Date().toISOString().split('T')[0];
    const initialTarget = Math.round(Number(base_population) * 0.01);
    const profId = `prof-${id}-${Date.now()}`;

    if (useSupabase) {
      const { error } = await supabase.from('block_reporting_profiles').upsert(
        [{ id: profId, block_id: Number(id), base_population: Number(base_population), population_base_date: baseDate, initial_hpv_target: initialTarget }],
        { onConflict: 'block_id', ignoreDuplicates: false }
      );
      if (error) throw error;
    } else {
      const idx = store.block_reporting_profiles.findIndex(x => x.block_id === Number(id));
      const rec = { id: profId, block_id: Number(id), base_population: Number(base_population), population_base_date: baseDate, initial_hpv_target: initialTarget, updated_at: new Date().toISOString() };
      if (idx >= 0) store.block_reporting_profiles[idx] = rec; else store.block_reporting_profiles.push(rec);
      saveStore();
    }

    await logAudit('BLOCK_OPERATOR', 'UPDATE_PROFILE', 'block', id);
    res.json({ message: 'Population saved', initial_hpv_target: initialTarget });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/reports/block/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (useSupabase) {
      const { data, error } = await supabase.from('daily_reports').select('*').eq('block_id', id).order('reporting_date', { ascending: false });
      if (error) throw error;
      return res.json(data);
    }
    res.json(store.daily_reports.filter(r => r.block_id === Number(id)).sort((a, b) => b.reporting_date.localeCompare(a.reporting_date)));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/reports/block/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reporting_date, line_list_count, beneficiaries_vaccinated, submitted_by } = req.body;

    if (!reporting_date) return res.status(400).json({ error: 'Reporting date required' });
    if (line_list_count === undefined || isNaN(line_list_count)) return res.status(400).json({ error: 'Valid line list count required' });
    if (beneficiaries_vaccinated === undefined || isNaN(beneficiaries_vaccinated)) return res.status(400).json({ error: 'Valid vaccinated count required' });

    const reportId = `rep-${id}-${reporting_date}`;

    if (useSupabase) {
      const { error } = await supabase.from('daily_reports').upsert(
        [{ id: reportId, block_id: Number(id), reporting_date, line_list_count: Number(line_list_count), beneficiaries_vaccinated: Number(beneficiaries_vaccinated), submitted_by: submitted_by || 'Block Operator' }],
        { onConflict: 'block_id,reporting_date', ignoreDuplicates: false }
      );
      if (error) throw error;
    } else {
      const idx = store.daily_reports.findIndex(r => r.block_id === Number(id) && r.reporting_date === reporting_date);
      const rec = { id: reportId, block_id: Number(id), reporting_date, line_list_count: Number(line_list_count), beneficiaries_vaccinated: Number(beneficiaries_vaccinated), submitted_by: submitted_by || 'Block Operator', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (idx >= 0) store.daily_reports[idx] = rec; else store.daily_reports.push(rec);
      saveStore();
    }

    await logAudit('BLOCK_OPERATOR', 'SUBMIT_REPORT', 'daily_report', reportId);
    res.json({ message: 'Report saved', report_id: reportId });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Admin Auth ───────────────────────────────────────────────────────────────

app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    let user;
    if (useSupabase) {
      const { data, error } = await supabase.from('admin_users').select('*').eq('username', username).eq('is_active', true).maybeSingle();
      if (error) throw error;
      user = data;
    } else {
      user = store.admin_users.find(u => u.username === username && u.is_active);
    }

    if (!user || hashPassword(password) !== user.password_hash) return res.status(401).json({ error: 'Invalid credentials' });

    if (useSupabase) {
      await supabase.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET, { expiresIn: '24h' });
    await logAudit(user.id, 'ADMIN_LOGIN', 'admin_user', user.id);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role } });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Admin Dashboard ──────────────────────────────────────────────────────────

app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    let totalBlocks = 0, reportedToday = 0, totalReports = 0;

    if (useSupabase) {
      const [{ count: tb }, { count: rr }, { count: tr }] = await Promise.all([
        supabase.from('blocks').select('*', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('daily_reports').select('block_id', { count: 'exact', head: true }).eq('reporting_date', todayStr),
        supabase.from('daily_reports').select('*', { count: 'exact', head: true })
      ]);
      totalBlocks = tb || 0;
      reportedToday = rr || 0;
      totalReports = tr || 0;
    } else {
      totalBlocks = store.blocks.length;
      reportedToday = new Set(store.daily_reports.filter(r => r.reporting_date === todayStr).map(r => r.block_id)).size;
      totalReports = store.daily_reports.length;
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

app.get('/api/admin/kpis', authenticateToken, async (req, res) => {
  try {
    const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];
    if (!useSupabase) return res.json({ total_blocks: 0, reporting_today: 0, total_line_list: 0, total_vaccinated: 0, overall_coverage_pct: 0, overall_linelist_pct: 0, district_chart_data: [] });

    // 1. Fetch all active blocks with district info
    const { data: blocks, error: bErr } = await supabase
      .from('blocks')
      .select('id, district_id, districts!inner(name)')
      .eq('is_active', true);
    if (bErr) throw bErr;

    // 2. Fetch ALL block_reporting_profiles in one shot (no join issues)
    const { data: profiles, error: pErr } = await supabase
      .from('block_reporting_profiles')
      .select('block_id, base_population, initial_hpv_target');
    if (pErr) throw pErr;

    // 3. Fetch cumulative reports up to the selected date
    const { data: reports, error: rErr } = await supabase
      .from('daily_reports')
      .select('block_id, line_list_count, beneficiaries_vaccinated, reporting_date')
      .lte('reporting_date', targetDateStr)
      .order('reporting_date', { ascending: false });
    if (rErr) throw rErr;

    // Build lookup maps
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.block_id] = p; });

    const reportMap = {};
    (reports || []).forEach(r => { 
      if (!reportMap[r.block_id]) {
        reportMap[r.block_id] = r;
      }
    });

    let totalBlocks = blocks?.length || 0;
    let totalLineList = 0;
    let totalVaccinated = 0;
    let reportingToday = 0;
    let totalTarget = 0;

    const districtStats = {};

    (blocks || []).forEach(b => {
      const dName = b.districts?.name || 'Unknown';
      if (!districtStats[dName]) districtStats[dName] = { name: dName, vaccinated: 0, lineList: 0, target: 0 };

      const prof = profileMap[b.id];
      // Target is stored directly OR calculated as 1% of base_population
      const target = prof?.initial_hpv_target || (prof?.base_population ? Math.round(prof.base_population * 0.01) : 0);
      totalTarget += target;
      districtStats[dName].target += target;

      const rep = reportMap[b.id];
      if (rep) {
        if (rep.reporting_date === targetDateStr) reportingToday++;
        const ll = rep.line_list_count || 0;
        const vacc = rep.beneficiaries_vaccinated || 0;
        totalLineList += ll;
        totalVaccinated += vacc;
        districtStats[dName].lineList += ll;
        districtStats[dName].vaccinated += vacc;
      }
    });

    const district_chart_data = Object.values(districtStats).map((d) => ({
      district: d.name,
      vaccinated: d.vaccinated,
      lineList: d.lineList,
      target: d.target,
      coveragePct: d.target > 0 ? parseFloat(((d.vaccinated / d.target) * 100).toFixed(1)) : 0,
      lineListPct: d.target > 0 ? parseFloat(((d.lineList / d.target) * 100).toFixed(1)) : 0,
    })).sort((a, b) => b.coveragePct - a.coveragePct);

    res.json({
      total_blocks: totalBlocks,
      reporting_today: reportingToday,
      total_line_list: totalLineList,
      total_vaccinated: totalVaccinated,
      total_target: totalTarget,
      overall_coverage_pct: totalTarget > 0 ? parseFloat(((totalVaccinated / totalTarget) * 100).toFixed(1)) : 0,
      overall_linelist_pct: totalTarget > 0 ? parseFloat(((totalLineList / totalTarget) * 100).toFixed(1)) : 0,
      district_chart_data
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});


app.get('/api/admin/reports', authenticateToken, async (req, res) => {
  try {
    const { date, districtId, blockId, limit = 200 } = req.query;
    if (!useSupabase) return res.json([]);

    let query = supabase.from('daily_reports')
      .select('*, blocks!inner(name, lgd_code, districts!inner(name, id))')
      .order('reporting_date', { ascending: false })
      .limit(Number(limit));

    if (date) query = query.eq('reporting_date', date);
    if (blockId) query = query.eq('block_id', blockId);

    const { data, error } = await query;
    if (error) throw error;

    const rows = data.map(r => ({
      ...r,
      block_name: r.blocks?.name,
      block_lgd_code: r.blocks?.lgd_code,
      district_name: r.blocks?.districts?.name,
      district_id: r.blocks?.districts?.id,
      blocks: undefined
    }));

    if (districtId) return res.json(rows.filter(r => String(r.district_id) === String(districtId)));
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/blocks', authenticateToken, async (req, res) => {
  try {
    const { districtId } = req.query;
    if (!useSupabase) return res.json([]);

    let query = supabase.from('blocks')
      .select('*, districts!inner(name, lgd_code), block_reporting_profiles(base_population, initial_hpv_target)')
      .eq('is_active', true)
      .order('name');

    if (districtId) query = query.eq('district_id', districtId);
    const { data, error } = await query;
    if (error) throw error;

    res.json(data.map(b => ({
      ...b,
      district_name: b.districts?.name,
      district_lgd_code: b.districts?.lgd_code,
      base_population: b.block_reporting_profiles?.[0]?.base_population || null,
      initial_hpv_target: b.block_reporting_profiles?.[0]?.initial_hpv_target || null,
      districts: undefined,
      block_reporting_profiles: undefined
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/districts', authenticateToken, async (req, res) => {
  try {
    if (!useSupabase) return res.json([]);
    const { data, error } = await supabase.from('districts').select('*').eq('is_active', true).order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/settings', authenticateToken, async (req, res) => {
  try {
    if (!useSupabase) return res.json([]);
    const { data, error } = await supabase.from('settings').select('*').order('key');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/audit-logs', authenticateToken, async (req, res) => {
  try {
    if (!useSupabase) return res.json([]);
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/reports/generate', authenticateToken, async (req, res) => {
  try {
    const { date, districtId, blockId, level = 'BLOCK' } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];
    if (!useSupabase) return res.json({ rows: [] });

    // 1. Fetch blocks (no profile join — avoids Supabase returning empty arrays)
    let bQuery = supabase
      .from('blocks')
      .select(`
        id, name, lgd_code, district_id,
        districts!inner(id, name, lgd_code)
      `)
      .eq('is_active', true)
      .order('name');
    
    if (districtId && districtId !== 'ALL') bQuery = bQuery.eq('district_id', districtId);
    if (blockId && blockId !== 'ALL') bQuery = bQuery.eq('id', blockId);

    const { data: blocks, error: bErr } = await bQuery;
    if (bErr) throw bErr;

    // 2. Fetch ALL profiles in a separate query
    const { data: profiles, error: pErr } = await supabase
      .from('block_reporting_profiles')
      .select('block_id, base_population, initial_hpv_target');
    if (pErr) throw pErr;

    // 3. Fetch reports up to this date
    const { data: reports, error: rErr } = await supabase
      .from('daily_reports')
      .select('block_id, line_list_count, beneficiaries_vaccinated, reporting_date')
      .lte('reporting_date', reportDate)
      .order('reporting_date', { ascending: false });
    if (rErr) throw rErr;

    // Build lookup maps
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.block_id] = p; });

    const reportsMap = {};
    (reports || []).forEach(r => { 
      if (!reportsMap[r.block_id]) {
        reportsMap[r.block_id] = r; 
      }
    });

    // Map to block-level data
    const blockData = blocks.map(b => {
      const rep = reportsMap[b.id];
      const prof = profileMap[b.id];
      const pop = prof?.base_population || 0;
      // Use stored target if available, otherwise calculate as 1% of population
      const target = prof?.initial_hpv_target || (pop > 0 ? Math.round(pop * 0.01) : 0);
      
      return {
        id: b.id,
        name: b.name,
        lgd_code: b.lgd_code,
        district_id: b.district_id,
        district_name: b.districts?.name,
        district_lgd_code: b.districts?.lgd_code,
        population: pop,
        hpv_target: target,
        last_reporting_date: rep ? rep.reporting_date : '—',
        line_list_received: rep ? (rep.line_list_count || 0) : 0,
        beneficiaries_vaccinated: rep ? (rep.beneficiaries_vaccinated || 0) : 0,
        has_report: !!rep
      };
    });

    let finalRows = [];

    if (level === 'DISTRICT') {
      const distGroup = {};
      blockData.forEach(b => {
        if (!distGroup[b.district_id]) {
          distGroup[b.district_id] = {
            id: b.district_id,
            name: `${b.district_name} District`,
            lgd_code: b.district_lgd_code,
            population: 0,
            hpv_target: 0,
            line_list_received: 0,
            beneficiaries_vaccinated: 0,
            last_reporting_date: '—',
            has_report: false
          };
        }
        const g = distGroup[b.district_id];
        g.population += b.population;
        g.hpv_target += b.hpv_target;
        if (b.has_report) {
          g.line_list_received += b.line_list_received;
          g.beneficiaries_vaccinated += b.beneficiaries_vaccinated;
          g.has_report = true;
          g.last_reporting_date = reportDate;
        }
      });
      finalRows = Object.values(distGroup);
    } else if (level === 'STATE') {
      const stateObj = {
        id: 'uttarakhand',
        name: 'Uttarakhand State',
        lgd_code: 5,
        population: 0,
        hpv_target: 0,
        line_list_received: 0,
        beneficiaries_vaccinated: 0,
        last_reporting_date: '—',
        has_report: false
      };
      blockData.forEach(b => {
        stateObj.population += b.population;
        stateObj.hpv_target += b.hpv_target;
        if (b.has_report) {
          stateObj.line_list_received += b.line_list_received;
          stateObj.beneficiaries_vaccinated += b.beneficiaries_vaccinated;
          stateObj.has_report = true;
          stateObj.last_reporting_date = reportDate;
        }
      });
      finalRows = [stateObj];
    } else {
      finalRows = blockData;
    }

    // Calculate percentages; nullify if no report submitted
    const rows = finalRows.map(r => {
      const tgt = r.hpv_target;
      return {
        ...r,
        // Always show population/target even if no report
        line_list_received: r.has_report ? r.line_list_received : null,
        beneficiaries_vaccinated: r.has_report ? r.beneficiaries_vaccinated : null,
        line_list_received_pct: r.has_report && tgt > 0
          ? parseFloat(((r.line_list_received / tgt) * 100).toFixed(1))
          : null,
        vaccination_coverage_pct: r.has_report && tgt > 0
          ? parseFloat(((r.beneficiaries_vaccinated / tgt) * 100).toFixed(1))
          : null
      };
    });

    res.json({ rows });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 HPV Reporting Portal API on port ${PORT}`);
  console.log(`📊 DB: ${useSupabase ? 'Supabase JS (HTTPS)' : 'JSON fallback'}`);
});

export default app;
