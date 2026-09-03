import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { supabase, useSupabase, store, saveStore } from './db/database.js';


dotenv.config();

// Helper to get batch inventory for a given CCL under the new single-record model.
// New model: RECEIVE = only external (source_ccl_id IS NULL)
//            ISSUE   = one record with source + destination; balance derived as:
//              +RECEIVED where facility_id = this CCL
//              +ISSUED   where destination_ccl_id = this CCL's ccl_id  (received internally)
//              -ISSUED   where facility_id         = this CCL's db id  (sent out)
async function getBatchInventory(batch_no, level, state_id, district_id, facility_id, ccl_id = null) {
  if (!batch_no) return 0;

  let query = supabase
    .from('vaccine_stock_transactions')
    .select('quantity_doses, transaction_type, facility_id, destination_ccl_id, source_ccl_id')
    .eq('batch_no', batch_no);

  if (state_id) query = query.eq('state_id', state_id);

  const { data } = await query;
  if (!data) return 0;

  let balance = 0;

  for (const tx of data) {
    const qty = Number(tx.quantity_doses || 0);

    if (tx.transaction_type === 'RECEIVED') {
      // Only count external receipts (no internal source) at this CCL
      const isThisCCL = facility_id
        ? String(tx.facility_id) === String(facility_id)
        : (String(tx.level || '') === String(level));
      if (isThisCCL && !tx.source_ccl_id) balance += qty;

    } else if (tx.transaction_type === 'ISSUED') {
      // Outflow: this CCL issued the doses
      const isSource = facility_id
        ? String(tx.facility_id) === String(facility_id)
        : (String(tx.level || '') === String(level) &&
           (district_id ? String(tx.district_id) === String(district_id) : !tx.district_id));
      if (isSource) balance -= qty;

      // Inflow: doses were issued TO this CCL
      if (ccl_id && tx.destination_ccl_id === ccl_id) balance += qty;
    }
  }

  return balance;
}



// Helper to safely handle created_by for Supabase UUID columns
function getValidUuid(id) {
  if (!id) return null;
  // Since admin_users.id is actually a VARCHAR (e.g. 'admin-1234'), we just return it as a string
  return String(id);
}

const app = express();
const PORT = process.env.PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'hpv-reporting-portal-secret-key-2026';

// 1. Restrict CORS to only allowed frontend URLs
const allowedOrigins = [
  'http://localhost:5173', // Local Vite development server
  'http://localhost:3000', // Alternative local dev server
  process.env.FRONTEND_URL // Production frontend URL from Vercel (add this to your Vercel env vars!)
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl) or if origin is in our allowed list
    // Also allows any Vercel preview/production domain as a fallback
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '50mb' }));

// 2. Global Rate Limiting: max 1500 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 1500,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use(globalLimiter);

// 3. Strict Rate Limiting for Login endpoints (prevents brute-forcing passcodes)
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 20, // Max 20 login attempts per 10 minutes per IP
  message: { error: 'Too many login attempts. Please try again after 10 minutes.' }
});

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

async function logAudit(userId, action, entityType, entityId, req = null) {
  if (!useSupabase) return;
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const logData = { id, user_id: userId || 'SYSTEM', action, entity_type: entityType, entity_id: entityId ? String(entityId) : null };
  if (req) {
    logData.device_info = req.headers['user-agent'] || null;
    logData.ip_address = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || null;
  }
  await supabase.from('audit_logs').insert([logData]);
}

// ─── Supabase helpers ─────────────────────────────────────────────────────────

function flattenBlock(b) {
  const dist = b.districts || {};
  const div = dist.divisions || {};
  const st = div.states || dist.states || {}; // Fallback in case old relation is kept
  const c = st.countries || {};
  
  return {
    id: b.id, district_id: b.district_id, lgd_code: b.lgd_code,
    name: b.health_block_name || b.name, code: b.code, is_active: b.is_active, is_urban: Boolean(b.is_urban), area_type: b.area_type || (b.is_urban ? 'City' : 'Block'),
    district_name: dist.name ?? '',
    district_lgd_code: dist.lgd_code ?? 0,
    division_name: div.name ?? '',
    division_system_code: div.system_code ?? '', // Renamed from lgd_code for divisions
    state_name: st.name ?? 'Uttarakhand',
    state_lgd_code: st.lgd_code ?? 5,
    country_name: c.name ?? 'India',
    country_lgd_code: c.lgd_code ?? 'IN'
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

// ─── Admin Population ─────────────────────────────────────────────────────────

app.get('/api/admin/population', authenticateToken, async (req, res) => {
  try {
    let blockData = [];
    if (useSupabase) {
      const { data: blocks } = await supabase.from('blocks').select('*').limit(100000);
      const { data: districts } = await supabase.from('districts').select('*').limit(100000);
      const { data: states } = await supabase.from('states').select('*').limit(10000);
      const { data: divisions } = await supabase.from('divisions').select('*').limit(10000);
      const { data: profiles } = await supabase.from('block_reporting_profiles').select('*').limit(100000);
      const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);
      blockData = blocks.map(b => {
        const dist = districts.find(d => d.id === b.district_id) || {};
        const div = divisions.find(d => d.id === dist.division_id) || {};
        const st = states.find(s => s.id === dist.state_id) || {};
        const prof = profiles.find(p => p.block_id === b.id) || null;
        return {
          id: b.id,
          name: b.name,
          is_urban: Boolean(b.is_urban),
          district_name: dist.name,
          division_name: div.name || 'Unknown',
          state_name: st.name,
          state_id: st.id,
          profile: prof
        };
      });
      if (targetStateId) {
        blockData = blockData.filter(b => String(b.state_id) === String(targetStateId));
      }
    } else {
      blockData = store.blocks.map(b => {
        const dist = store.districts.find(d => d.id === b.district_id) || {};
        const st = store.states.find(s => s.id === dist.state_id) || { name: 'Uttarakhand' };
        const prof = store.block_reporting_profiles.find(p => p.block_id === b.id) || null;
        return {
          id: b.id,
          name: b.name,
          is_urban: Boolean(b.is_urban),
          district_name: dist.name,
          division_name: div.name || 'Unknown',
          state_name: st.name,
          profile: prof
        };
      });
    }
    res.json(blockData);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

// ─── Locations ────────────────────────────────────────────────────────────────

app.get('/api/locations/countries', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await supabase.from('countries').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return res.json(data);
    }
    res.json([]);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/locations/divisions', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await supabase.from('divisions').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return res.json(data);
    }
    res.json([]);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/locations/states', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await supabase.from('states').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return res.json(data);
    }
    res.json(store.states.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/locations/districts', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await supabase.from('districts').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return res.json(data);
    }
    res.json(store.districts.sort((a, b) => a.name.localeCompare(b.name)));
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/locations/blocks', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('blocks')
        .select('*, districts(name, lgd_code, divisions(name, system_code, states(name, lgd_code, countries(name, lgd_code))))')
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
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

// ─── Block Auth ───────────────────────────────────────────────────────────────

app.post('/api/blocks/login', loginLimiter, async (req, res) => {
  try {
    const { blockId, passcode } = req.body;
    let actualPasscode = '2026';
    if (useSupabase) {
      const { data } = await supabase.from('blocks').select('passcode').eq('id', blockId).maybeSingle();
      if (data && data.passcode) actualPasscode = data.passcode;
    } else {
      const b = store.blocks.find(x => x.id === Number(blockId));
      if (b && b.passcode) actualPasscode = b.passcode;
    }
    
    if (passcode === actualPasscode) {
      const token = Buffer.from(`block_auth_${blockId}_${Date.now()}`).toString('base64');
      res.json({ success: true, token });
    } else {
      res.status(401).json({ error: 'Invalid passcode' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/blocks/change-passcode', async (req, res) => {
  try {
    const { blockId, currentPasscode, newPasscode } = req.body;
    let actualPasscode = '2026';
    if (useSupabase) {
      const { data } = await supabase.from('blocks').select('passcode').eq('id', blockId).maybeSingle();
      if (data && data.passcode) actualPasscode = data.passcode;
    } else {
      const b = store.blocks.find(x => x.id === Number(blockId));
      if (b && b.passcode) actualPasscode = b.passcode;
    }
    
    if (currentPasscode !== actualPasscode) {
      return res.status(401).json({ error: 'Incorrect current passcode' });
    }
    
    if (useSupabase) {
      await supabase.from('blocks').update({ passcode: newPasscode }).eq('id', blockId);
    } else {
      const b = store.blocks.find(x => x.id === Number(blockId));
      if (b) b.passcode = newPasscode;
      saveStore();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/blocks/reset-passcode', async (req, res) => {
  try {
    const { blockId } = req.body;
    if (useSupabase) {
      await supabase.from('blocks').update({ passcode: null }).eq('id', blockId);
    } else {
      const b = store.blocks.find(x => x.id === Number(blockId));
      if (b) b.passcode = null;
      saveStore();
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Block Reporting ──────────────────────────────────────────────────────────

app.get('/api/blocks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let block, profile, todayReport, lastReport, latestMonthlyReport;

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

      const { data: monthlyData } = await supabase
        .from('monthly_due_list_reports')
        .select('*')
        .eq('block_id', id)
        .order('reporting_month', { ascending: false })
        .limit(1)
        .maybeSingle();
      latestMonthlyReport = monthlyData || null;
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
      
      const mReps = (store.monthly_due_list_reports || []).filter(r => r.block_id === Number(id)).sort((a, b) => b.reporting_month.localeCompare(a.reporting_month));
      latestMonthlyReport = mReps[0] || null;
    }

    const hpvTarget = profile ? Math.round(profile.base_population * 0.01) : 0;

    res.json({
      block: { id: block.id, name: block.name, lgd_code: block.lgd_code, district_name: block.district_name, district_lgd_code: block.district_lgd_code, state_name: block.state_name, state_lgd_code: block.state_lgd_code, is_urban: Boolean(block.is_urban) },
      profile: profile ? { ...profile, current_population: profile.base_population, current_hpv_target: hpvTarget } : null,
      today_submitted: Boolean(todayReport),
      today_report: todayReport || null,
      last_report: lastReport || null,
      latest_monthly_report: latestMonthlyReport || null
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
        [{ id: profId, block_id: Number(id), base_population: Number(base_population), population_base_date: baseDate, initial_hpv_target: initialTarget, is_unlocked: false, unlock_requested: false }],
        { onConflict: 'block_id', ignoreDuplicates: false }
      );
      if (error) throw error;
    } else {
      const idx = store.block_reporting_profiles.findIndex(x => x.block_id === Number(id));
      const rec = { id: profId, block_id: Number(id), base_population: Number(base_population), population_base_date: baseDate, initial_hpv_target: initialTarget, is_unlocked: false, unlock_requested: false, updated_at: new Date().toISOString() };
      if (idx >= 0) store.block_reporting_profiles[idx] = rec; else store.block_reporting_profiles.push(rec);
      saveStore();
    }

    await logAudit('BLOCK_OPERATOR', 'UPDATE_PROFILE', 'block', id);
    res.json({ message: 'Population saved', initial_hpv_target: initialTarget });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/blocks/:id/request-unlock', async (req, res) => {
  try {
    const { id } = req.params;
    if (useSupabase) {
      const { error } = await supabase.from('block_reporting_profiles').update({ unlock_requested: true }).eq('block_id', id);
      if (error) throw error;
    } else {
      const prof = store.block_reporting_profiles.find(x => x.block_id === Number(id));
      if (prof) {
        prof.unlock_requested = true;
        prof.updated_at = new Date().toISOString();
        saveStore();
      }
    }
    await logAudit('BLOCK_OPERATOR', 'REQUEST_POPULATION_UNLOCK', 'block', id);
    res.json({ message: 'Unlock requested successfully' });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/blocks/:id/unlock-population', async (req, res) => {
  try {
    const { id } = req.params;
    if (useSupabase) {
      const { error } = await supabase.from('block_reporting_profiles').update({ is_unlocked: true, unlock_requested: false }).eq('block_id', id);
      if (error) throw error;
    } else {
      const prof = store.block_reporting_profiles.find(x => x.block_id === Number(id));
      if (prof) {
        prof.is_unlocked = true;
        prof.unlock_requested = false;
        prof.updated_at = new Date().toISOString();
        saveStore();
      }
    }
    await logAudit('ADMIN', 'UNLOCK_POPULATION', 'block', id);
    res.json({ message: 'Population editing unlocked successfully' });
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
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.post('/api/reports/block/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reporting_date, sessions_held, beneficiaries_vaccinated, submitted_by } = req.body;

    if (!reporting_date) return res.status(400).json({ error: 'Reporting date required' });
    if (sessions_held === undefined || isNaN(sessions_held)) return res.status(400).json({ error: 'Valid sessions held count required' });
    if (beneficiaries_vaccinated === undefined || isNaN(beneficiaries_vaccinated)) return res.status(400).json({ error: 'Valid vaccinated count required' });

    const reportId = `rep-${id}-${reporting_date}`;

    if (useSupabase) {
      const { data: lastRep } = await supabase.from('daily_reports').select('line_list_count').eq('block_id', Number(id)).order('reporting_date', { ascending: false }).limit(1).maybeSingle();
      let prevLineList = lastRep ? lastRep.line_list_count : 0;
      
      const vaxCount = Number(beneficiaries_vaccinated);
      if (vaxCount > prevLineList) {
        prevLineList = vaxCount;
      }

      const { error } = await supabase.from('daily_reports').upsert(
        [{ id: reportId, block_id: Number(id), reporting_date, sessions_held: Number(sessions_held), beneficiaries_vaccinated: vaxCount, line_list_count: prevLineList, submitted_by: submitted_by || 'Block Operator' }],
        { onConflict: 'block_id,reporting_date', ignoreDuplicates: false }
      );
      if (error) throw error;
    } else {
      const idx = store.daily_reports.findIndex(r => r.block_id === Number(id) && r.reporting_date === reporting_date);
      const reps = store.daily_reports.filter(r => r.block_id === Number(id)).sort((a, b) => b.reporting_date.localeCompare(a.reporting_date));
      let prevLineList = reps.length > 0 ? reps[0].line_list_count : 0;
      
      const vaxCount = Number(beneficiaries_vaccinated);
      if (vaxCount > prevLineList) {
        prevLineList = vaxCount;
      }

      const rec = { id: reportId, block_id: Number(id), reporting_date, sessions_held: Number(sessions_held), beneficiaries_vaccinated: vaxCount, line_list_count: prevLineList, submitted_by: submitted_by || 'Block Operator', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (idx >= 0) store.daily_reports[idx] = rec; else store.daily_reports.push(rec);
      saveStore();
    }

    await logAudit('BLOCK_OPERATOR', 'SUBMIT_REPORT', 'daily_report', reportId);
    res.json({ message: 'Report saved', report_id: reportId });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Admin Auth ───────────────────────────────────────────────────────────────

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

    let user;
    let stateName = null;
    let districtName = null;
    let cclFacilityName = null;
    let cclUnitLevel = null;
    if (useSupabase) {
      let { data, error } = await supabase.from('admin_users').select('*, states(name), districts(name)').eq('username', username).eq('is_active', true).maybeSingle();
      if (error && (error.code === '42703' || error.code === 'PGRST204' || (error.message && error.message.includes('district')))) {
        const fallback = await supabase.from('admin_users').select('*, states(name)').eq('username', username).eq('is_active', true).maybeSingle();
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      user = data;
      if (user?.states) stateName = user.states.name;
      if (user?.districts) districtName = user.districts.name;
      
      if (user?.role === 'VACCINE_MANAGER' && user?.ccl_id) {
        const { data: ccp } = await supabase.from('vaccine_ccp').select('to_ccl, unit_level, district_id, districts(name)').eq('ccl_id', user.ccl_id).maybeSingle();
        if (ccp) {
          cclFacilityName = ccp.to_ccl;
          cclUnitLevel = ccp.unit_level;
          if (ccp.district_id) {
            user.district_id = ccp.district_id;
            if (ccp.districts) districtName = ccp.districts.name;
          }
        }
      }
    } else {
      user = store.admin_users.find(u => u.username === username && u.is_active);
      if (user?.state_id) {
          const s = store.states.find(st => st.id === user.state_id);
          if (s) stateName = s.name;
      }
      if (user?.district_id) {
          const d = store.districts.find(dt => dt.id === user.district_id);
          if (d) districtName = d.name;
      }
    }

    if (!user || hashPassword(password) !== user.password_hash) {
      if (user) await logAudit(user.id, 'FAILED_LOGIN', 'admin_user', user.id, req);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (useSupabase) {
      await supabase.from('admin_users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id);
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name, state_id: user.state_id, state_name: stateName, district_id: user.district_id, district_name: districtName, ccl_id: user.ccl_id, ccl_to_ccl: cclFacilityName, ccl_unit_level: cclUnitLevel }, JWT_SECRET, { expiresIn: '24h' });
    await logAudit(user.id, 'ADMIN_LOGIN', 'admin_user', user.id, req);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role, state_id: user.state_id, state_name: stateName, district_id: user.district_id, district_name: districtName, ccl_id: user.ccl_id, ccl_to_ccl: cclFacilityName, ccl_unit_level: cclUnitLevel } });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/me', authenticateToken, async (req, res) => {
  try {
    let user = { ...req.user };
    if (user.role === 'VACCINE_MANAGER' && user.ccl_id && !user.district_name) {
       const { data: ccp } = await supabase.from('vaccine_ccp').select('district_id, districts(name)').eq('ccl_id', user.ccl_id).maybeSingle();
       if (ccp && ccp.districts) {
         user.district_id = ccp.district_id;
         user.district_name = ccp.districts.name;
       }
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Admin Logout ─────────────────────────────────────────────────────────────
app.post('/api/admin/logout', authenticateToken, async (req, res) => {
  try {
    await logAudit(req.user.id, 'LOGOUT', 'admin_user', req.user.id, req);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

// Change own password
app.put('/api/admin/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new passwords required' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters' });

    const userId = req.user.id;
    let user;
    if (useSupabase) {
      const { data, error } = await supabase.from('admin_users').select('*').eq('id', userId).maybeSingle();
      if (error) throw error;
      user = data;
    } else {
      user = store.admin_users.find(u => u.id === userId);
    }

    if (!user || hashPassword(currentPassword) !== user.password_hash) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    const newHash = hashPassword(newPassword);
    if (useSupabase) {
      const { error } = await supabase.from('admin_users').update({ password_hash: newHash, updated_at: new Date().toISOString() }).eq('id', userId);
      if (error) throw error;
    } else {
      const idx = store.admin_users.findIndex(u => u.id === userId);
      if (idx >= 0) { store.admin_users[idx].password_hash = newHash; saveStore(); }
    }

    await logAudit(userId, 'CHANGE_PASSWORD', 'admin_user', userId);
    res.json({ message: 'Password changed successfully' });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// List admin users
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    if (useSupabase) {
      let { data, error } = await supabase.from('admin_users').select('id, username, name, role, is_active, created_at, last_login_at, state_id, states(name), district_id, districts(name), ccl_id').order('created_at', { ascending: false });
      if (error && (error.code === '42703' || error.code === 'PGRST204' || (error.message && error.message.includes('district')))) {
        const fallback = await supabase.from('admin_users').select('id, username, name, role, is_active, created_at, last_login_at, state_id, states(name)').order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      
      const cclIds = [...new Set(data.filter(u => u.role === 'VACCINE_MANAGER' && u.ccl_id).map(u => u.ccl_id))];
      let cclMap = {};
      if (cclIds.length > 0) {
        const { data: ccps } = await supabase.from('vaccine_ccp').select('ccl_id, to_ccl, districts(name)').in('ccl_id', cclIds);
        if (ccps) ccps.forEach(c => cclMap[c.ccl_id] = c);
      }

      return res.json(data.map(u => {
        let district_name = u.districts ? u.districts.name : null;
        let ccl_to_ccl = null;
        if (u.role === 'VACCINE_MANAGER' && u.ccl_id && cclMap[u.ccl_id]) {
          ccl_to_ccl = cclMap[u.ccl_id].to_ccl;
          if (cclMap[u.ccl_id].districts && cclMap[u.ccl_id].districts.name) {
            district_name = cclMap[u.ccl_id].districts.name;
          }
        }
        return {
          ...u,
          state_name: u.states ? u.states.name : null,
          district_name,
          ccl_to_ccl
        };
      }));
    }
    res.json(store.admin_users.map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role, is_active: u.is_active, created_at: u.created_at, state_id: u.state_id, district_id: u.district_id })));
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

// Create new admin user
app.post('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const { username, name, password, role = 'ADMIN', state_id, district_id, ccl_id } = req.body;
    if (!username || !name || !password) return res.status(400).json({ error: 'Username, name and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const newId = `admin-${Date.now()}`;
    const passwordHash = hashPassword(password);

    if (useSupabase) {
      // Check if username already exists
      const { data: existing } = await supabase.from('admin_users').select('id').eq('username', username).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Username already exists' });

      let { error } = await supabase.from('admin_users').insert([{
        id: newId, username, name, password_hash: passwordHash, role, is_active: true, state_id: state_id ? Number(state_id) : null, district_id: district_id ? Number(district_id) : null, ccl_id: ccl_id || null
      }]);
      if (error && (error.code === '42703' || error.code === 'PGRST204' || (error.message && error.message.includes('district')))) {
        const fallback = await supabase.from('admin_users').insert([{
          id: newId, username, name, password_hash: passwordHash, role, is_active: true, state_id: state_id ? Number(state_id) : null
        }]);
        error = fallback.error;
      }
      if (error) throw error;
    } else {
      if (store.admin_users.find(u => u.username === username)) return res.status(409).json({ error: 'Username already exists' });
      store.admin_users.push({ id: newId, username, name, password_hash: passwordHash, role, is_active: true, created_at: new Date().toISOString(), state_id: state_id ? Number(state_id) : null, district_id: district_id ? Number(district_id) : null });
      saveStore();
    }

    await logAudit(req.user.id, 'CREATE_ADMIN', 'admin_user', newId);
    res.json({ message: 'Admin user created successfully', id: newId });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Toggle admin user status

app.put('/api/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { id } = req.params;
    const { name, username, password, role, state_id, district_id, status } = req.body;
    
    let updateData = {
      name,
      username,
      role,
      state_id: state_id ? Number(state_id) : null,
      district_id: district_id ? Number(district_id) : null,
      updated_at: new Date().toISOString()
    };
    
    if (password) {
      updateData.password_hash = hashPassword(password);
    }
    
    if (status) {
      updateData.status = status;
      if (status === 'ACTIVE') updateData.is_active = true;
      if (status === 'DISABLED') updateData.is_active = false;
    }

    if (useSupabase) {
      let { error } = await supabase.from('admin_users').update(updateData).eq('id', id);
      
      // Fallback if status column does not exist
      if (error && (error.code === '42703' || (error.message && error.message.includes('status')))) {
        const fallbackData = { ...updateData };
        delete fallbackData.status;
        const fallback = await supabase.from('admin_users').update(fallbackData).eq('id', id);
        error = fallback.error;
      }
      
      if (error) throw error;
      
      logAudit(req.user.id, 'UPDATE_ADMIN_USER', 'Updated admin user details', { target_id: id, name, role, username, status });
      res.json({ success: true });
    } else {
      const idx = store.admin_users.findIndex(u => u.id === id);
      if (idx === -1) return res.status(404).json({ error: 'User not found' });
      store.admin_users[idx] = { ...store.admin_users[idx], ...updateData };
      res.json({ success: true });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { id } = req.params;
    
    if (useSupabase) {
      const { error } = await supabase.from('admin_users').delete().eq('id', id);
      if (error) throw error;
      
      logAudit(req.user.id, 'DELETE_ADMIN_USER', 'Deleted admin user', { target_id: id });
      res.json({ success: true });
    } else {
      store.admin_users = store.admin_users.filter(u => u.id !== id);
      res.json({ success: true });
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/admin/users/:id/toggle-status', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Only super admin can modify users' });
    const targetUserId = req.params.id;
    const { is_active } = req.body;
    
    if (useSupabase) {
      const { error } = await supabase.from('admin_users').update({ is_active }).eq('id', targetUserId);
      if (error) throw error;
    } else {
      const idx = store.admin_users.findIndex(u => u.id === targetUserId);
      if (idx >= 0) {
        store.admin_users[idx].is_active = is_active;
        saveStore();
      } else {
        return res.status(404).json({ error: 'User not found' });
      }
    }
    
    await logAudit(req.user.id, is_active ? 'ENABLE_ADMIN' : 'DISABLE_ADMIN', 'admin_user', targetUserId);
    res.json({ message: `User ${is_active ? 'enabled' : 'disabled'} successfully` });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Add new State
app.post('/api/admin/locations/state', authenticateToken, async (req, res) => {
  try {
    const { name, lgd_code } = req.body;
    if (!name || !lgd_code) return res.status(400).json({ error: 'Name and LGD code required' });
    let newId;
    if (useSupabase) {
      const { data, error } = await supabase.from('states').insert([{ name, lgd_code: Number(lgd_code), is_active: true }]).select();
      if (error) throw error;
      newId = data[0].id;
    } else {
      newId = Date.now();
      store.states.push({ id: newId, name, lgd_code: Number(lgd_code), is_active: true });
      saveStore();
    }
    await logAudit(req.user.id, 'CREATE_STATE', 'state', newId);
    res.json({ message: 'State created', id: newId });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Add new District
app.post('/api/admin/locations/district', authenticateToken, async (req, res) => {
  try {
    const { name, lgd_code, state_id } = req.body;
    if (!name || !lgd_code || !state_id) return res.status(400).json({ error: 'Name, LGD code and state required' });
    let newId;
    if (useSupabase) {
      const { data, error } = await supabase.from('districts').insert([{ name, lgd_code: Number(lgd_code), state_id: Number(state_id), is_active: true }]).select();
      if (error) throw error;
      newId = data[0].id;
    } else {
      newId = Date.now();
      store.districts.push({ id: newId, name, lgd_code: Number(lgd_code), state_id: Number(state_id), is_active: true });
      saveStore();
    }
    await logAudit(req.user.id, 'CREATE_DISTRICT', 'district', newId);
    res.json({ message: 'District created', id: newId });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// Add new Block or Urban Body (is_urban flag)
app.post('/api/admin/locations/block', authenticateToken, async (req, res) => {
  try {
    const { name, lgd_code, district_id, is_urban = false } = req.body;
    if (!name || !lgd_code || !district_id) return res.status(400).json({ error: 'Name, LGD code and district required' });
    let newId;
    if (useSupabase) {
      const { data, error } = await supabase.from('blocks').insert([{
        name, lgd_code: Number(lgd_code), district_id: Number(district_id),
        is_active: true, is_urban: Boolean(is_urban), code: String(lgd_code)
      }]).select();
      if (error) throw error;
      newId = data[0].id;
    } else {
      newId = Date.now();
      store.blocks.push({ id: newId, name, lgd_code: Number(lgd_code), district_id: Number(district_id), is_active: true, is_urban: Boolean(is_urban), code: String(lgd_code) });
      saveStore();
    }
    await logAudit(req.user.id, is_urban ? 'CREATE_URBAN_BODY' : 'CREATE_BLOCK', 'block', newId);
    res.json({ message: `${is_urban ? 'Urban Body' : 'Block'} created`, id: newId });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Admin Dashboard ──────────────────────────────────────────────────────────



app.get('/api/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    let totalBlocks = 0, reportedToday = 0, totalReports = 0;

    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);

    if (useSupabase) {
      let bq = supabase.from('blocks').select(targetStateId ? 'id, districts!inner(state_id)' : 'id').eq('is_active', true);
      if (targetStateId) bq = bq.eq('districts.state_id', targetStateId);
      const { data: vBlocks } = await bq;
      const vIds = (vBlocks || []).map(b => b.id);
      
      if (vIds.length === 0) {
        totalBlocks = 0; reportedToday = 0; totalReports = 0;
      } else {
        const [{ count: rr }, { count: tr }] = await Promise.all([
          supabase.from('daily_reports').select('block_id', { count: 'exact', head: true }).eq('reporting_date', todayStr).in('block_id', vIds),
          supabase.from('daily_reports').select('id', { count: 'exact', head: true }).in('block_id', vIds)
        ]);
        totalBlocks = vIds.length;
        reportedToday = rr || 0;
        totalReports = tr || 0;
      }
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
    if (!useSupabase) return res.json({ total_blocks: 0, reporting_today: 0, total_line_list: 0, total_vaccinated: 0, overall_coverage_pct: 0, overall_linelist_pct: 0, district_chart_data: [], latest_reporting_date: null });

    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);
    const userDistrictId = req.user.district_id || (req.user.role === 'DISTRICT_ADMIN' ? req.user.district_id : null);
    const targetDistrictId = userDistrictId || (req.query.district_id && req.query.district_id !== 'ALL' ? req.query.district_id : null);

    // 1. Fetch all active blocks with district info
    let bq = supabase
      .from('blocks')
      .select(targetStateId ? 'id, name, health_block_name, is_urban, district_id, districts!inner(name, state_id, divisions(name))' : 'id, name, health_block_name, is_urban, district_id, districts!inner(name, divisions(name))')
      .eq('is_active', true);
    if (targetStateId) bq = bq.eq('districts.state_id', targetStateId);
    const { data: blocks, error: bErr } = await bq;
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
        reportMap[r.block_id] = { latest: r, prev: null };
      } else if (!reportMap[r.block_id].prev && r.reporting_date !== reportMap[r.block_id].latest.reporting_date) {
        reportMap[r.block_id].prev = r;
      }
    });

    const { data: stockTx } = await supabase
      .from('vaccine_stock_transactions')
      .select('block_id, quantity_doses, transaction_type')
      .eq('level', 3);
    const blockStockMap = {};
    (stockTx || []).forEach(tx => {
       if (tx.block_id && tx.transaction_type === 'RECEIVED') {
           blockStockMap[tx.block_id] = (blockStockMap[tx.block_id] || 0) + Number(tx.quantity_doses);
       }
    });

    let totalBlocks = targetDistrictId && String(targetDistrictId) !== 'ALL' ? (blocks || []).filter(b => String(b.district_id) === String(targetDistrictId)).length : (blocks?.length || 0);
    let totalLineList = 0;
    let totalVaccinated = 0;
    let reportingToday = 0;
    let totalTarget = 0;
    let totalPopulation = 0;

    const districtStats = {};

    (blocks || []).forEach(b => {
      const dName = b.districts?.name || 'Unknown';
      if (!districtStats[dName]) districtStats[dName] = { name: dName, vaccinated: 0, lineList: 0, target: 0, population: 0, deltaVaccinated: 0, deltaLineList: 0, hasLowStockBlock: false };

      const prof = profileMap[b.id];
      // Target is stored directly OR calculated as 1% of base_population
      const target = prof?.initial_hpv_target || (prof?.base_population ? Math.round(prof.base_population * 0.01) : 0);
      const pop = prof?.base_population || 0;
      
      const isTargetDist = !targetDistrictId || String(targetDistrictId) === 'ALL' || String(b.district_id) === String(targetDistrictId);

      if (isTargetDist) {
        totalTarget += target;
        totalPopulation += pop;
      }
      districtStats[dName].target += target;
      districtStats[dName].population += pop;

      const repData = reportMap[b.id];
      if (repData && repData.latest) {
        const hasTodayEntry = (repData.latest.reporting_date === targetDateStr);
        if (hasTodayEntry && isTargetDist) reportingToday++;

        const ll = repData.latest.line_list_count || 0;
        const vacc = repData.latest.beneficiaries_vaccinated || 0;

        if (isTargetDist) {
          totalLineList += ll;
          totalVaccinated += vacc;
        }
        districtStats[dName].lineList += ll;
        districtStats[dName].vaccinated += vacc;

        if (hasTodayEntry) {
          const prevLl = repData.prev?.line_list_count || 0;
          const prevVacc = repData.prev?.beneficiaries_vaccinated || 0;
          districtStats[dName].deltaLineList += Math.max(0, ll - prevLl);
          districtStats[dName].deltaVaccinated += Math.max(0, vacc - prevVacc);
        }
      }
      
      // Calculate Low Stock
      const vaccCalc = repData?.latest?.beneficiaries_vaccinated || 0;
      const received = blockStockMap[b.id] || 0;
      const stockBalance = received - vaccCalc;
      const isLowStock = target > 0 && stockBalance < (target * 0.25);
      if (isLowStock) {
        districtStats[dName].hasLowStockBlock = true;
      }
    });

    const district_chart_data = Object.values(districtStats).map((d) => {
      const distTarget = Math.round(d.population * 0.01);
      return {
        district: d.name,
        vaccinated: d.vaccinated,
        lineList: d.lineList,
        target: distTarget,
        deltaVaccinated: d.deltaVaccinated,
        deltaLineList: d.deltaLineList,
        hasLowStockBlock: d.hasLowStockBlock,
        coveragePct: distTarget > 0 ? parseFloat(((d.vaccinated / distTarget) * 100).toFixed(1)) : 0,
        lineListPct: distTarget > 0 ? parseFloat(((d.lineList / distTarget) * 100).toFixed(1)) : 0,
      };
    }).sort((a, b) => b.coveragePct - a.coveragePct);

    const block_chart_data = (blocks || []).map((b) => {
      const dName = b.districts?.name || 'Unknown';
      const prof = profileMap[b.id];
      const target = prof?.initial_hpv_target || (prof?.base_population ? Math.round(prof.base_population * 0.01) : 0);
      const repData = reportMap[b.id];
      const hasTodayEntry = (repData?.latest?.reporting_date === targetDateStr);

      const ll = repData?.latest?.line_list_count || 0;
      const vacc = repData?.latest?.beneficiaries_vaccinated || 0;
      const prevLl = repData?.prev?.line_list_count || 0;
      const prevVacc = repData?.prev?.beneficiaries_vaccinated || 0;

      const deltaVaccinated = hasTodayEntry ? Math.max(0, vacc - prevVacc) : 0;
      const deltaLineList = hasTodayEntry ? Math.max(0, ll - prevLl) : 0;
      
      const received = blockStockMap[b.id] || 0;
      const stockBalance = received - vacc;
      const isLowStock = target > 0 && stockBalance < (target * 0.25);
      
      return {
        block: b.health_block_name || b.name,
        block_id: b.id,
        is_urban: b.is_urban,
        district: dName,
        vaccinated: vacc,
        lineList: ll,
        target: target,
        isLowStock: isLowStock,
        deltaVaccinated: deltaVaccinated,
        deltaLineList: deltaLineList,
        coveragePct: target > 0 ? parseFloat(((vacc / target) * 100).toFixed(1)) : 0,
        lineListPct: target > 0 ? parseFloat(((ll / target) * 100).toFixed(1)) : 0,
      };
    }).sort((a, b) => b.coveragePct - a.coveragePct);

    const exactTotalTarget = Math.round(totalPopulation * 0.01);

    res.json({
      total_blocks: totalBlocks,
      reporting_today: reportingToday,
      total_line_list: totalLineList,
      total_vaccinated: totalVaccinated,
      total_target: exactTotalTarget,
      total_population: totalPopulation,
      overall_coverage_pct: exactTotalTarget > 0 ? parseFloat(((totalVaccinated / exactTotalTarget) * 100).toFixed(1)) : 0,
      overall_linelist_pct: exactTotalTarget > 0 ? parseFloat(((totalLineList / exactTotalTarget) * 100).toFixed(1)) : 0,
      district_chart_data,
      block_chart_data,
      latest_reporting_date: reports && reports.length > 0 ? reports[0].reporting_date : null
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/public/overall-stats', async (req, res) => {
  try {
    const targetDateStr = req.query.date || new Date().toISOString().split('T')[0];
    if (!useSupabase) return res.json({ total_blocks: 0, total_line_list: 0, total_vaccinated: 0, overall_coverage_pct: 0, overall_linelist_pct: 0 });

    const { data: blocks, error: bErr } = await supabase.from('blocks').select('id, district_id').eq('is_active', true);
    if (bErr) throw bErr;

    const { data: profiles, error: pErr } = await supabase.from('block_reporting_profiles').select('block_id, base_population, initial_hpv_target');
    if (pErr) throw pErr;

    const { data: reports, error: rErr } = await supabase.from('daily_reports')
      .select('block_id, line_list_count, beneficiaries_vaccinated, reporting_date')
      .lte('reporting_date', targetDateStr)
      .order('reporting_date', { ascending: false });
    if (rErr) throw rErr;

    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.block_id] = p; });

    const reportMap = {};
    (reports || []).forEach(r => { 
      if (!reportMap[r.block_id]) reportMap[r.block_id] = r;
    });

    let totalLineList = 0, totalVaccinated = 0, totalTarget = 0, totalPopulation = 0;

    (blocks || []).forEach(b => {
      const prof = profileMap[b.id];
      const target = prof?.initial_hpv_target || (prof?.base_population ? Math.round(prof.base_population * 0.01) : 0);
      const pop = prof?.base_population || 0;
      totalTarget += target;
      totalPopulation += pop;

      const rep = reportMap[b.id];
      if (rep) {
        totalLineList += rep.line_list_count || 0;
        totalVaccinated += rep.beneficiaries_vaccinated || 0;
      }
    });

    res.json({
      total_blocks: blocks?.length || 0,
      total_target: totalTarget,
      total_population: totalPopulation,
      total_line_list: totalLineList,
      total_vaccinated: totalVaccinated,
      overall_coverage_pct: totalTarget > 0 ? ((totalVaccinated / totalTarget) * 100).toFixed(1) : 0,
      overall_linelist_pct: totalTarget > 0 ? ((totalLineList / totalTarget) * 100).toFixed(1) : 0
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── HPV Vaccine Stock Monitoring Dashboard ──────────────────────────────────────────

app.get('/api/vaccine/dashboard', authenticateToken, async (req, res) => {
  try {
    if (!useSupabase) return res.status(500).json({ error: 'Supabase required' });
    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);
    const userRole = req.user.role;
    const userDistrictId = req.user.district_id; // Added manually by login handler if exists

    // 1. Fetch facilities
    let ccpQuery = supabase.from('vaccine_ccp').select('*');
    if (targetStateId) ccpQuery = ccpQuery.eq('state_id', targetStateId);
    const { data: rawFacilities, error: fErr } = await ccpQuery;
    if (fErr) throw fErr;
    const facilities = rawFacilities || [];
    // Counts
    console.log('Total facilities fetched:', facilities?.length);
    if (facilities && facilities.length > 0) {
      console.log('Sample unit_levels:', facilities.slice(0, 5).map(f => f.unit_level));
    }
    const stateStoresCount = facilities.filter(f => String(f.unit_level).trim() === '1').length;
    const districtStoresCount = facilities.filter(f => String(f.unit_level).trim() === '2').length;
    const blockStoresCount = facilities.filter(f => String(f.unit_level).trim() === '3').length;

    // 2. Fetch stock transactions
    let txQuery = supabase.from('vaccine_stock_transactions').select('*');
    let balQuery = supabase.from('monthly_balance').select('*');

    if (targetStateId) {
       txQuery = txQuery.eq('state_id', targetStateId);
       balQuery = balQuery.eq('state_id', targetStateId);
    }
    const [ {data: stockTx}, {data: bal} ] = await Promise.all([txQuery, balQuery]);

    const tx = [
      ...(stockTx || []).map(t => ({...t})),
      ...(bal || []).map(t => ({...t, transaction_type: 'MONTH_END_BALANCE', level: t.block_id ? '3' : (t.district_id ? '2' : '1'), quantity_doses: t.qty_doses, balance_month: t.transaction_date}))
    ];

    // Helper to get latest month end balance
    const getMonthEnd = (level, filterFn = () => true) => {
      const balances = tx.filter(t => t.transaction_type === 'MONTH_END_BALANCE' && String(t.level) === String(level) && filterFn(t));
      balances.sort((a, b) => new Date(b.balance_month).getTime() - new Date(a.balance_month).getTime());
      return balances.length > 0 ? Number(balances[0].quantity_doses) : 0;
    };

    // State Calculations (new model: RECEIVED=external only, no source_ccl_id)
    const stateReceived = tx.filter(t => t.transaction_type === 'RECEIVED' && String(t.level) === '1' && !t.source_ccl_id).reduce((sum, t) => sum + Number(t.quantity_doses), 0);
    const stateIssued = tx.filter(t => t.transaction_type === 'ISSUED' && String(t.level) === '1').reduce((sum, t) => sum + Number(t.quantity_doses), 0);
    const stateStock = stateReceived - stateIssued;
    const stateMonthEnd = getMonthEnd('1');
    const stateVWF = (stateIssued + stateStock) > 0 ? (stateReceived / (stateIssued + stateStock)) : 0;

    // District Calculations (new model: district receives via ISSUED where destination matches their CCL)
    const distIssuedIn = tx.filter(t => t.transaction_type === 'ISSUED' && String(t.destination_level) === '2').reduce((sum, t) => sum + Number(t.quantity_doses), 0);
    const distIssuedOut = tx.filter(t => t.transaction_type === 'ISSUED' && String(t.level) === '2').reduce((sum, t) => sum + Number(t.quantity_doses), 0);
    const distReceived = distIssuedIn; // inflow at district = doses issued to them
    const distIssued = distIssuedOut;
    const distStock = distReceived - distIssued;
    const distMonthEnd = getMonthEnd('2');
    const distVWF = (distIssued + distStock) > 0 ? (distReceived / (distIssued + distStock)) : 0;

    // Block Calculations (new model: block receives via ISSUED where destination_level = 3)
    const blockReceived = tx.filter(t => t.transaction_type === 'ISSUED' && String(t.destination_level) === '3').reduce((sum, t) => sum + Number(t.quantity_doses), 0);
    
    // For Block Vaccinated, we need the existing vaccination data
    let reportQuery = supabase.from('daily_reports').select('block_id, beneficiaries_vaccinated, reporting_date, blocks(district_id, districts(state_id))').order('reporting_date', { ascending: false });
    const { data: rawReports, error: rErr } = await reportQuery;
    if (rErr) throw rErr;
    
    let validReports = rawReports || [];
    if (targetStateId) validReports = validReports.filter(r => r.blocks?.districts?.state_id == targetStateId);

    // Deduplicate to track latest and prev reports per block
    const latestReportsMap = {};
    validReports.forEach(r => {
      if (!latestReportsMap[r.block_id]) {
        latestReportsMap[r.block_id] = { latest: r, prev: null };
      } else if (!latestReportsMap[r.block_id].prev && r.reporting_date !== latestReportsMap[r.block_id].latest.reporting_date) {
        latestReportsMap[r.block_id].prev = r;
      }
    });
    const deduplicatedReports = Object.values(latestReportsMap).map(m => m.latest);

    const blockVaccinated = deduplicatedReports.reduce((sum, r) => sum + (Number(r.beneficiaries_vaccinated) || 0), 0);
    const blockStock = blockReceived - blockVaccinated;
    const blockMonthEnd = getMonthEnd('3');
    const blockVWF = (distIssued + blockStock) > 0 ? (blockReceived / (distIssued + blockStock)) : 0; // Using distIssued as proxy for block issued (vaccination) or should it be blockVaccinated? Formula says Issued + StockBalance. Block doesn't issue, it vaccinates. We'll use Vaccinated.
    const realBlockVWF = (blockVaccinated + blockStock) > 0 ? (blockReceived / (blockVaccinated + blockStock)) : 0;

    const utilization = distReceived > 0 ? (blockVaccinated / distReceived) * 100 : 0;

    // District Utilization (for map & ranking)
    let dq = supabase.from('districts').select('id, name, state_id').eq('is_active', true);
    if (targetStateId) dq = dq.eq('state_id', targetStateId);
    const allDistricts = (await dq).data || [];
    
    const districtStats = {};
    allDistricts.forEach(d => {
       districtStats[d.id] = { vaccinated: 0, issued: 0, deltaVaccinated: 0, target: 0, stockBalance: 0 };
    });

    // Fetch profiles for targets
    const { data: profs } = await supabase.from('block_reporting_profiles').select('block_id, base_population, initial_hpv_target');
    const profMap = {};
    (profs || []).forEach(p => { profMap[p.block_id] = p; });
    
    // Block Utilization (for drill down)
    const blockStats = {};
    Object.values(latestReportsMap).forEach(m => {
      const r = m.latest;
      const prevR = m.prev;
      const bId = r.block_id;
      const dName = allDistricts.find(d => String(d.id) === String(r.blocks?.district_id))?.name;
      if (bId) {
        if (!blockStats[bId]) blockStats[bId] = { vaccinated: 0, received: 0, deltaVaccinated: 0, districtName: dName };
        const vacc = Number(r.beneficiaries_vaccinated) || 0;
        const prevVacc = Number(prevR?.beneficiaries_vaccinated) || 0;
        blockStats[bId].vaccinated += vacc;
        blockStats[bId].deltaVaccinated += (vacc - prevVacc);
      }
    });

    tx.filter(t => t.transaction_type === 'RECEIVED' && String(t.level) === '3').forEach(t => {
       const bId = t.block_id;
       const dName = allDistricts.find(d => String(d.id) === String(t.district_id))?.name;
       if (bId) {
         if (!blockStats[bId]) blockStats[bId] = { vaccinated: 0, received: 0, deltaVaccinated: 0, districtName: dName };
         blockStats[bId].received += Number(t.quantity_doses);
       }
    });


    // Fetch latest stock ledger to get accurate current stock balances for blocks
    const { data: rawLedgers, error: lErr } = await supabase.from('vaccine_stock_ledger').select('block_id, entity_type, closing_stock_estimated, reporting_month').order('reporting_month', { ascending: false });
    if (lErr) throw lErr;
    const latestLedgers = {};
    (rawLedgers || []).forEach(r => {
      const key = r.entity_type === 'BLOCK' ? `block_${r.block_id}` : `district_${r.district_id}`;
      if (!latestLedgers[key]) latestLedgers[key] = r;
    });

    let bq = supabase.from('blocks').select('id, name, health_block_name, is_urban, district_id, districts!inner(name, state_id)').eq('is_active', true);
    if (targetStateId) bq = bq.eq('districts.state_id', targetStateId);
    const allBlocks = (await bq).data || [];

    const districtLowStock = {};
    const districtCriticalStock = {};

    const blockUtilization = allBlocks.map(b => {
      const bId = b.id;
      const dId = b.district_id;
      const stat = blockStats[bId] || { vaccinated: 0, received: 0, deltaVaccinated: 0 };
      const blkName = b.health_block_name || b.name || 'Unknown';
      const distName = b.districts?.name || 'Unknown';
      const utilPct = stat.received > 0 ? (stat.vaccinated / stat.received) * 100 : 0;
      
      const prof = profMap[bId];
      const target = prof?.initial_hpv_target || (prof?.base_population ? Math.round(prof.base_population * 0.01) : 0);
      
      const ledger = latestLedgers[`block_${bId}`];
      const stockBalance = ledger && ledger.closing_stock_estimated != null ? ledger.closing_stock_estimated : Math.max(0, stat.received - stat.vaccinated);
      
      const isLowStock = target > 0 && stockBalance < (target * 0.25);
      const isCriticalStock = target > 0 && stockBalance < (target * 0.10);
      
      if (isLowStock) districtLowStock[dId] = true;
      if (isCriticalStock) districtCriticalStock[dId] = true;

      if (dId && districtStats[dId]) {
         districtStats[dId].vaccinated += stat.vaccinated;
         districtStats[dId].issued += stat.received;
         districtStats[dId].deltaVaccinated += stat.deltaVaccinated;
         districtStats[dId].target += target;
         districtStats[dId].stockBalance += stockBalance;
      }

      return {
        block: blkName,
        is_urban: b.is_urban,
        block_id: bId,
        district: distName,
        vaccinated: stat.vaccinated,
        issued: stat.received,
        deltaVaccinated: stat.deltaVaccinated,
        isLowStock: isLowStock,
        isCriticalStock: isCriticalStock,
        stockBalance: stockBalance,
        target: target,
        utilizationPct: parseFloat(utilPct.toFixed(1))
      };
    }).sort((a, b) => b.utilizationPct - a.utilizationPct);
    
    const districtUtilization = allDistricts.map(d => {
      const dId = d.id;
      const stat = districtStats[dId] || { vaccinated: 0, issued: 0, deltaVaccinated: 0, stockBalance: 0, target: 0 };
      const distName = d.name || 'Unknown';
      const utilPct = stat.issued > 0 ? (stat.vaccinated / stat.issued) * 100 : 0;
      
      const isLowStock = stat.target > 0 && stat.stockBalance < (stat.target * 0.25);
      const isCriticalStock = stat.target > 0 && stat.stockBalance < (stat.target * 0.10);

      return {
        district: distName,
        district_id: dId,
        vaccinated: stat.vaccinated,
        issued: stat.issued,
        deltaVaccinated: stat.deltaVaccinated,
        hasLowStockBlock: districtLowStock[dId] || false,
        hasCriticalStockBlock: districtCriticalStock[dId] || false,
        isLowStock: isLowStock,
        isCriticalStock: isCriticalStock,
        stockBalance: stat.stockBalance,
        target: stat.target,
        utilizationPct: parseFloat(utilPct.toFixed(1))
      };
    }).sort((a, b) => b.utilizationPct - a.utilizationPct);

    res.json({
      state: { stores: stateStoresCount, received: stateReceived, issued: stateIssued, stockBalance: stateStock, monthEndBalance: stateMonthEnd, vwf: parseFloat(stateVWF.toFixed(2)) },
      district: { stores: districtStoresCount, received: distReceived, issued: distIssued, stockBalance: distStock, monthEndBalance: distMonthEnd, vwf: parseFloat(distVWF.toFixed(2)) },
      block: { coldChainPoints: blockStoresCount, received: blockReceived, vaccinated: blockVaccinated, stockBalance: blockStock, monthEndBalance: blockMonthEnd, vwf: parseFloat(realBlockVWF.toFixed(2)) },
      utilization: parseFloat(utilization.toFixed(1)),
      districtUtilization,
      blockUtilization
    });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/vaccine/facilities', authenticateToken, async (req, res) => {
  try {
    const { unit_level, state_id, district_id } = req.query;
    let query = supabase.from('vaccine_ccp').select('*, states(name), districts(name), blocks(name)').eq('status', 'Active');
    
    if (unit_level) query = query.eq('unit_level', String(unit_level));
    if (state_id) query = query.eq('state_id', state_id);
    if (district_id) query = query.eq('district_id', district_id);

    let effectiveDistrictId = req.user.district_id;
    if (req.user.role === 'VACCINE_MANAGER' && req.user.ccl_id && !effectiveDistrictId) {
       const { data: mgrCcp } = await supabase.from('vaccine_ccp').select('district_id').eq('ccl_id', req.user.ccl_id).maybeSingle();
       if (mgrCcp && mgrCcp.district_id) effectiveDistrictId = mgrCcp.district_id;
    }

    if (effectiveDistrictId) {
       query = query.eq('district_id', effectiveDistrictId);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    const formatted = data.map(f => {
      let locationPrefix = '';
      if (f.to_ccl?.toLowerCase().includes('divisional') || String(f.unit_level) === '2') {
         locationPrefix = f.districts?.name || '';
      } else if (String(f.unit_level) === '1') {
         locationPrefix = f.states?.name || '';
      } else if (String(f.unit_level) === '3') {
         locationPrefix = (f.districts?.name ? f.districts.name + ' - ' : '') + (f.blocks?.name || '');
      }
      
      return {
        ...f,
        display_name: (locationPrefix ? `${locationPrefix} - ${f.to_ccl}` : f.to_ccl) + (f.ccl_block_hq_yes === 'Y' ? ' - HQ' : '')
      };
    });

    res.json(formatted);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.post('/api/vaccine/stock/receive', authenticateToken, async (req, res) => {
  try {
    const isAllowedVaccineManager = req.user.role === 'VACCINE_MANAGER' && String(req.user.ccl_unit_level) !== '2';

    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN' && !isAllowedVaccineManager) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    // Assuming ADMIN means State Admin if they don't have district_id.
    // If they have district_id, they shouldn't be calling this.
    if (req.user.district_id && !isAllowedVaccineManager) {
      return res.status(403).json({ error: 'District Admin cannot manually receive stock' });
    }

    const { date, quantity, notes, batch_no, batch_expiry_date, manufacture_name } = req.body;
    if (!date || isNaN(Number(quantity)) || Number(quantity) <= 0 || !batch_no) return res.status(400).json({ error: 'Invalid input' });

    const { data, error } = await supabase.from('vaccine_stock_transactions').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'RECEIVED',
      transaction_date: date,
      quantity_doses: Number(quantity),
      remarks: [notes, `Recorded by: ${req.user.name || req.user.username}`].filter(Boolean).join(' | '),
      level: isAllowedVaccineManager ? String(req.user.ccl_unit_level || '1') : '1',
      destination_level: isAllowedVaccineManager ? String(req.user.ccl_unit_level || '1') : '1',
      batch_no: batch_no,
      batch_expiry_date: batch_expiry_date || null,
      manufacture_name: manufacture_name || null,
      state_id: req.user.state_id,
      created_by: getValidUuid(req.user.id),
      destination_ccl_id: isAllowedVaccineManager ? (req.user.ccl_id || null) : null,
      destination_ccl_name: isAllowedVaccineManager ? (req.user.ccl_to_ccl || null) : null
    }]).select();

    if (error) throw error;

    res.json({ success: true, transaction: data[0] });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.post('/api/vaccine/stock/issue', authenticateToken, async (req, res) => {
  try {
    const { date, quantity, destination_level, destination_facility_id, notes, batch_no } = req.body;
    if (!date || isNaN(Number(quantity)) || Number(quantity) <= 0 || !destination_level || !destination_facility_id || !batch_no) {
       return res.status(400).json({ error: 'Invalid input' });
    }

    const qty = Number(quantity);
    const destLvl = Number(destination_level);
    const isDistrictAdmin = !!req.user.district_id;
    const currentLevel = isDistrictAdmin ? 2 : 1;

    // Validate facility exists
    const { data: destFacility, error: fErr } = await supabase.from('vaccine_ccp').select('*').eq('id', destination_facility_id).single();
    if (fErr || !destFacility) return res.status(400).json({ error: 'Invalid destination facility' });

    if (String(destFacility.unit_level) !== String(destLvl)) {
       return res.status(400).json({ error: 'Facility unit level mismatch' });
    }

    if (isDistrictAdmin && destFacility.district_id !== req.user.district_id) {
       return res.status(403).json({ error: 'Cannot issue to a facility outside your district' });
    }

    // Fetch sender facility details FIRST (needed for inventory check + insert)
    let senderFacility = null;
    if (req.user.ccl_id) {
       const { data: sFacility } = await supabase.from('vaccine_ccp').select('*').eq('ccl_id', req.user.ccl_id).maybeSingle();
       if (sFacility) senderFacility = sFacility;
    }

    // Check available stock for THIS BATCH at issuing CCL
    const senderCclId = req.user.ccl_id || null;
    const availableStock = await getBatchInventory(
      batch_no,
      currentLevel,
      req.user.state_id,
      req.user.district_id,
      senderFacility ? senderFacility.id : null,
      senderCclId
    );

    if (availableStock < qty) {
      return res.status(400).json({ error: `Insufficient stock for batch ${batch_no}. Available: ${availableStock}` });
    }

    // Insert ONE ISSUED transaction capturing both source and destination
    const { data: issueTx, error: issueErr } = await supabase.from('vaccine_stock_transactions').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'ISSUED',
      transaction_date: date,
      quantity_doses: qty,
      batch_no: batch_no,
      level: String(currentLevel),
      source_level: String(currentLevel),
      destination_level: String(destLvl),
      // Source CCL (who is issuing)
      source_ccl_id: senderFacility ? (senderFacility.ccl_id || null) : (req.user.ccl_id || null),
      source_ccl_name: senderFacility ? senderFacility.to_ccl : (req.user.ccl_to_ccl || null),
      // Destination CCL (who will receive)
      destination_ccl_name: destFacility.to_ccl,
      destination_ccl_id: destFacility.ccl_id,
      remarks: [notes, `Recorded by: ${req.user.name || req.user.username}`].filter(Boolean).join(' | '),
      state_id: senderFacility ? senderFacility.state_id : req.user.state_id,
      district_id: senderFacility ? senderFacility.district_id : (req.user.district_id || null),
      block_id: senderFacility ? senderFacility.block_id : (req.user.block_id || null),
      facility_id: senderFacility ? senderFacility.id : null,
      created_by: getValidUuid(req.user.id)
    }]).select().single();

    if (issueErr) throw issueErr;

    // NOTE: No downstream RECEIVED record is created.
    // Under the new model, RECEIVED is only for external (supplier) receipts.
    // Internal transfers are tracked solely via the ISSUED record (source → destination).

    // Keep block balance helper field in sync
    if (destFacility.block_id) {
       const { data: oldBData } = await supabase.from('blocks').select('balance_vaccine').eq('id', destFacility.block_id).single();
       if (oldBData) {
          await supabase.from('blocks').update({ balance_vaccine: (oldBData.balance_vaccine || 0) + qty }).eq('id', destFacility.block_id);
       }
    }

    res.json({ success: true, transaction: issueTx });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

// ─── One-time cleanup: delete internally-generated duplicate RECEIVED records ──────
// These are RECEIVED records with a non-null source_ccl_id, meaning they were auto-
// created by the old issue flow (not real external supplier receipts).
app.post('/api/admin/cleanup-duplicate-received', authenticateToken, async (req, res) => {
  try {
    if (!useSupabase) return res.status(500).json({ error: 'Requires Supabase' });
    if (!['SUPER_ADMIN', 'STATE_ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Super Admin or State Admin only' });
    }

    const dryRun = req.query.dryRun !== 'false'; // default is dry run

    // Find duplicates: RECEIVED records with a source_ccl_id set (internal transfers)
    const { data: dupes, error: findErr } = await supabase
      .from('vaccine_stock_transactions')
      .select('id, transaction_date, quantity_doses, batch_no, destination_ccl_name, source_ccl_name')
      .eq('transaction_type', 'RECEIVED')
      .not('source_ccl_id', 'is', null);

    if (findErr) throw findErr;

    if (dryRun) {
      return res.json({
        dryRun: true,
        message: `Found ${dupes?.length || 0} duplicate internally-generated RECEIVED records. POST with ?dryRun=false to delete them.`,
        records: dupes || []
      });
    }

    // Actually delete
    const { error: delErr } = await supabase
      .from('vaccine_stock_transactions')
      .delete()
      .eq('transaction_type', 'RECEIVED')
      .not('source_ccl_id', 'is', null);

    if (delErr) throw delErr;

    res.json({
      success: true,
      deleted: dupes?.length || 0,
      message: `Successfully deleted ${dupes?.length || 0} duplicate RECEIVED records.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/vaccine/stock/month-end', authenticateToken, async (req, res) => {
  try {
    const { month, quantity, reportingPersonName, reportingPersonMobile, notes, batch_no } = req.body;
    if (!month || isNaN(Number(quantity)) || Number(quantity) < 0 || !reportingPersonName || !reportingPersonMobile || !batch_no) {
      return res.status(400).json({ error: 'Invalid input. Batch No is required.' });
    }
    
    // Check if month is valid (must be strictly before current month)
    const selectedDate = new Date(month + '-01T00:00:00Z');
    const currentDate = new Date();
    currentDate.setDate(1); // First of current month
    currentDate.setHours(0,0,0,0);

    if (selectedDate >= currentDate) {
      return res.status(400).json({ error: 'Cannot select current or future month for month end balance' });
    }

    const currentLevel = req.user.district_id ? 2 : 1;
    
    const currentBal = await getBatchInventory(batch_no, currentLevel, req.user.state_id, req.user.district_id, null);
    const diff = Number(quantity) - currentBal;

    const { data, error } = await supabase.from('monthly_balance').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'MONTH_END_BALANCE',
      transaction_date: month + '-01',
      qty_doses: Number(quantity),
      ccl_manager_handler_name: reportingPersonName,
      ccl_manager_handler_mobile_no: reportingPersonMobile,
      remarks: notes || null,
      batch_no: batch_no,
      state_id: req.user.state_id,
      district_id: req.user.district_id || null,
      created_by: getValidUuid(req.user.id)
    }]).select();

    if (error) throw error;
    
    if (diff !== 0) {
      // Insert ADJUSTMENT transaction to sync physical balance
      await supabase.from('vaccine_stock_transactions').insert([{
        vaccine_type: 'HPV Vaccine',
        transaction_type: diff > 0 ? 'RECEIVED' : 'ISSUED',
        transaction_date: month + '-01',
        quantity_doses: Math.abs(diff),
        batch_no: batch_no,
        level: String(currentLevel),
        remarks: 'Auto-adjustment from Month End Balance: ' + (notes || ''),
        state_id: req.user.state_id,
        district_id: req.user.district_id || null,
        created_by: getValidUuid(req.user.id)
      }]);
    }
    
    res.json({ success: true, transaction: data[0] });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/vaccine/stock', authenticateToken, async (req, res) => {
  try {
     let txQuery = supabase.from('vaccine_stock_transactions').select('*').order('created_at', { ascending: false }).limit(50);
     let balanceQuery = supabase.from('monthly_balance').select('*').order('created_at', { ascending: false }).limit(25);

     if (req.user.state_id) {
        txQuery = txQuery.eq('state_id', req.user.state_id);
        balanceQuery = balanceQuery.eq('state_id', req.user.state_id);
     }
     if (req.user.district_id) {
        txQuery = txQuery.eq('district_id', req.user.district_id);
        balanceQuery = balanceQuery.eq('district_id', req.user.district_id);
     }
     if (req.user.block_id) {
        txQuery = txQuery.eq('block_id', req.user.block_id);
        balanceQuery = balanceQuery.eq('block_id', req.user.block_id);
     }
     if (req.user.facility_id) {
        txQuery = txQuery.eq('facility_id', req.user.facility_id);
        balanceQuery = balanceQuery.eq('facility_id', req.user.facility_id);
     }

     const [ {data: txs}, {data: bal} ] = await Promise.all([txQuery, balanceQuery]);
     
     // Merge and sort
     const allTx = [
       ...(txs || []).map(t => ({...t, type: 'vaccine_stock_transactions', display_type: t.transaction_type})),
       ...(bal || []).map(t => ({...t, type: 'monthly_balance', display_type: 'MONTH_END_BALANCE', quantity_doses: t.qty_doses}))
     ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

     res.json(allTx);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/admin/reports', authenticateToken, async (req, res) => {
  try {
    const { date, districtId, blockId, limit = 200 } = req.query;
    if (!useSupabase) return res.json([]);

    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);

    let query = supabase.from('daily_reports')
      .select(targetStateId ? '*, blocks!inner(name, lgd_code, districts!inner(name, id, state_id))' : '*, blocks!inner(name, lgd_code, districts!inner(name, id))')
      .order('reporting_date', { ascending: false })
      .limit(Number(limit));
    if (targetStateId) query = query.eq('blocks.districts.state_id', targetStateId);

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
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/admin/blocks', authenticateToken, async (req, res) => {
  try {
    const { districtId } = req.query;
    if (!useSupabase) return res.json([]);

    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);

    let query = supabase.from('blocks')
      .select(targetStateId ? '*, districts!inner(name, lgd_code, state_id), block_reporting_profiles(base_population, initial_hpv_target)' : '*, districts!inner(name, lgd_code), block_reporting_profiles(base_population, initial_hpv_target)')
      .eq('is_active', true)
      .order('name');
    if (targetStateId) query = query.eq('districts.state_id', targetStateId);

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
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/admin/districts', authenticateToken, async (req, res) => {
  try {
    if (!useSupabase) return res.json([]);
    const { data, error } = await supabase.from('districts').select('*').eq('is_active', true).order('name');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/admin/settings', authenticateToken, async (req, res) => {
  try {
    if (!useSupabase) return res.json([]);
    const { data, error } = await supabase.from('settings').select('*').order('key');
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/admin/audit-logs', authenticateToken, async (req, res) => {
  try {
    if (!useSupabase) return res.json([]);
    const { data, error } = await supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/admin/trend', authenticateToken, async (req, res) => {
  try {
        const { level = 'STATE', districtId, blockId, divisionId } = req.query;
    if (!useSupabase) return res.json({ profile: { base_population: 0 }, reports: [] });

        // 1. Fetch blocks
    let bQuery = supabase.from('blocks').select('id, name, district_id, districts!inner(division_id)').eq('is_active', true);
    if (level === 'DIVISION' && divisionId && divisionId !== 'ALL') {
      bQuery = bQuery.eq('districts.division_id', divisionId);
    } else if (level === 'DISTRICT' && districtId && districtId !== 'ALL') {
      bQuery = bQuery.eq('district_id', districtId);
    } else if (level === 'BLOCK' && blockId && blockId !== 'ALL') {
      bQuery = bQuery.eq('id', blockId);
    }
    const { data: blocks, error: bErr } = await bQuery;
    if (bErr) throw bErr;
    const blockIds = blocks.map(b => b.id);

    if (blockIds.length === 0) {
      return res.json({ profile: { base_population: 0 }, reports: [] });
    }

    // 2. Fetch profiles
    const { data: profiles, error: pErr } = await supabase
      .from('block_reporting_profiles')
      .select('block_id, base_population')
      .in('block_id', blockIds);
    if (pErr) throw pErr;
    
    let totalBasePopulation = 0;
    profiles.forEach(p => { totalBasePopulation += p.base_population || 0; });

    // 3. Fetch all reports for these blocks
    const { data: reports, error: rErr } = await supabase
      .from('daily_reports')
      .select('block_id, reporting_date, line_list_count, beneficiaries_vaccinated')
      .in('block_id', blockIds)
      .order('reporting_date', { ascending: true });
    if (rErr) throw rErr;

    // 4. Extract unique dates
    const uniqueDates = [...new Set(reports.map(r => r.reporting_date))].sort();

    // 5. Aggregate cumulative data per date
    const aggregatedReports = [];
    const latestPerBlock = {};
    let rIdx = 0;
    
    for (const date of uniqueDates) {
      while (rIdx < reports.length && reports[rIdx].reporting_date <= date) {
        latestPerBlock[reports[rIdx].block_id] = reports[rIdx];
        rIdx++;
      }
      
      let sumLL = 0;
      let sumVacc = 0;
      for (const bId of Object.keys(latestPerBlock)) {
        sumLL += latestPerBlock[bId].line_list_count || 0;
        sumVacc += latestPerBlock[bId].beneficiaries_vaccinated || 0;
      }
      
      aggregatedReports.push({
        reporting_date: date,
        line_list_count: sumLL,
        beneficiaries_vaccinated: sumVacc
      });
    }
    
    res.json({
      profile: { base_population: totalBasePopulation },
      reports: aggregatedReports
    });
    
  } catch (err) {
    console.error('Trend generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/reports/completeness', authenticateToken, async (req, res) => {
  try {
    const { level, location_id, report_type, from_date, to_date } = req.query;
    if (!useSupabase) return res.json({ rows: [], kpis: {} });
    
    // 1. Fetch reporting units (Blocks) based on location filters
    let bQuery = supabase.from('blocks').select(`
        id, name, district_id,
        districts!inner(id, name, state_id, division_id, divisions(name))
      `).eq('is_active', true);
      
    const targetStateId = req.user?.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);
    const userDistrictId = req.user?.district_id || (req.user?.role === 'DISTRICT_ADMIN' ? req.user.district_id : null);
    const filterDist = userDistrictId || req.query.district_id || req.query.districtId || req.query.location_id;
    if (targetStateId) bQuery = bQuery.eq('districts.state_id', targetStateId);
    
    if (filterDist && String(filterDist).toUpperCase() !== 'ALL') {
      const distStr = String(filterDist).toUpperCase();
      if (distStr === 'KUMAON' || distStr === 'GARHWAL') {
        const kumaonDists = ['almora', 'bageshwar', 'champawat', 'nainital', 'pithoragarh', 'udham singh nagar'];
        const garhwalDists = ['chamoli', 'dehradun', 'haridwar', 'pauri garhwal', 'tehri garhwal', 'uttarkashi', 'rudraprayag'];
        const targetNames = distStr === 'KUMAON' ? kumaonDists : garhwalDists;
        const { data: matchedDists } = await supabase.from('districts').select('id, name, divisions(name)');
        const filteredIds = (matchedDists || [])
          .filter(d => targetNames.includes((d.name || '').toLowerCase()) || (d.divisions?.name || '').toUpperCase().includes(distStr))
          .map(d => d.id);
        if (filteredIds.length > 0) {
          bQuery = bQuery.in('district_id', filteredIds);
        }
      } else {
        bQuery = bQuery.eq('district_id', filterDist);
      }
    }
    
    const { data: blocks, error: bErr } = await bQuery;
    if (bErr) throw bErr;
    if (!blocks || blocks.length === 0) {
      return res.json({ rows: [], kpis: { expected: 0, received: 0, onTime: 0, reportingPct: 0, onTimePct: 0, units: 0 } });
    }
    
    const blockIds = blocks.map(b => b.id);
    const fromDate = new Date(from_date);
    const toDate = new Date(to_date);
    const msInDay = 24 * 60 * 60 * 1000;
    const daysExpected = Math.max(1, Math.floor((toDate.getTime() - fromDate.getTime()) / msInDay) + 1);
    
    // Expected monthly reports
    let monthsExpected = 1;
    let tempDate = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    const monthList = [];
    while (tempDate <= toDate) {
      const ym = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
      if (!monthList.includes(ym)) monthList.push(ym);
      tempDate.setMonth(tempDate.getMonth() + 1);
    }
    monthsExpected = monthList.length;
    
    let dailyReports = [];
    let dueListReports = [];
    let stockReports = [];
    
    if (report_type === 'ALL' || report_type === 'DAILY_PROGRESS') {
      const { data } = await supabase.from('daily_reports')
        .select('*')
        .in('block_id', blockIds)
        .gte('reporting_date', from_date)
        .lte('reporting_date', to_date);
      dailyReports = data || [];
    }
    
    if (report_type === 'ALL' || report_type === 'MONTHLY_DUE_LIST') {
      const { data } = await supabase.from('monthly_due_list_reports')
        .select('*')
        .in('block_id', blockIds)
        .in('reporting_month', monthList);
      dueListReports = data || [];
    }
    
    if (report_type === 'ALL' || report_type === 'MONTHLY_STOCK') {
      const { data } = await supabase.from('monthly_balance')
        .select('*')
        .in('block_id', blockIds)
        .in('month', monthList);
      stockReports = data || [];
    }

    // Fetch all-time last reporting date per block (outside the date range filter)
    const { data: allTimeDailyReports } = await supabase
      .from('daily_reports')
      .select('block_id, reporting_date')
      .in('block_id', blockIds)
      .order('reporting_date', { ascending: false });

    // Build a map of block_id -> latest reporting_date ever
    const lastReportedMap = {};
    (allTimeDailyReports || []).forEach(r => {
      if (!lastReportedMap[r.block_id]) {
        lastReportedMap[r.block_id] = r.reporting_date;
      }
    });

    // Helper: get latest reporting_date across blockIds
    const getLastReported = (bIds) => {
      let latest = null;
      for (const bid of bIds) {
        const d = lastReportedMap[bid];
        if (d && (!latest || d > latest)) latest = d;
      }
      return latest;
    };
    
    const rows = [];
    let totalExpected = 0;
    let totalReceived = 0;
    let totalOnTime = 0;
    
    let unitsToProcess = [];
    if (level === 'Division') {
      const dMap = new Map();
      for (const b of blocks) {
        if (!dMap.has(b.district_id)) {
          dMap.set(b.district_id, { id: b.district_id, name: b.districts?.name || 'Unknown', isUrban: false, blockIds: [] });
        }
        dMap.get(b.district_id).blockIds.push(b.id);
      }
      unitsToProcess = Array.from(dMap.values());
    } else {
      unitsToProcess = blocks.map(b => ({ id: b.id, name: b.name, isUrban: b.is_urban, blockIds: [b.id] }));
    }
    
    for (const unit of unitsToProcess) {
      const numBlocks = unit.blockIds.length;
      if (report_type === 'ALL' || report_type === 'DAILY_PROGRESS') {
        const unitDaily = dailyReports.filter(r => unit.blockIds.includes(r.block_id));
        const expected = daysExpected * numBlocks;
        const submitted = unitDaily.length;
        
        let onTimeCount = 0;
        let lastReported = null;
        
        unitDaily.forEach(r => {
           const repDate = new Date(r.reporting_date);
           const cutoff = new Date(repDate.getTime() + (24 * 60 * 60 * 1000));
           cutoff.setHours(15, 59, 59, 999);
           const created = new Date(r.created_at || r.submitted_at || new Date().toISOString());
           if (created <= cutoff) onTimeCount++;
           if (!lastReported || created > lastReported) lastReported = created;
        });
        
        const reportingPct = expected > 0 ? Math.round((submitted / expected) * 100) : 0;
        const onTimePct = expected > 0 ? Math.round((onTimeCount / expected) * 100) : 0;
        
        totalExpected += expected;
        totalReceived += submitted;
        totalOnTime += onTimeCount;
        
        rows.push({
          unitName: unit.name,
          isUrban: unit.isUrban,
          reportName: 'Daily Progress Report',
          frequency: 'Daily',
          lastReported: getLastReported(unit.blockIds),
          expected,
          submitted,
          reportingPct,
          onTimePct,
          status: submitted >= expected ? 'Complete' : (submitted > 0 ? 'Late' : 'Pending')
        });
      }
      
      if (report_type === 'ALL' || report_type === 'MONTHLY_DUE_LIST') {
        const unitDue = dueListReports.filter(r => unit.blockIds.includes(r.block_id));
        const expected = monthsExpected * numBlocks;
        const submitted = unitDue.length;
        
        let onTimeCount = 0;
        let lastReported = null;
        
        unitDue.forEach(r => {
           const [yr, mo] = r.reporting_month.split('-');
           const cutoff = new Date(parseInt(yr), parseInt(mo), 5, 23, 59, 59); 
           const created = new Date(r.submitted_at || r.created_at || new Date().toISOString());
           if (created <= cutoff) onTimeCount++;
           if (!lastReported || created > lastReported) lastReported = created;
        });
        
        const reportingPct = expected > 0 ? Math.round((submitted / expected) * 100) : 0;
        const onTimePct = expected > 0 ? Math.round((onTimeCount / expected) * 100) : 0;
        
        totalExpected += expected;
        totalReceived += submitted;
        totalOnTime += onTimeCount;
        
        rows.push({
          unitName: unit.name,
          isUrban: unit.isUrban,
          reportName: 'Monthly Due List Report',
          frequency: 'Monthly',
          lastReported: lastReported ? lastReported.toISOString() : null,
          expected,
          submitted,
          reportingPct,
          onTimePct,
          status: submitted >= expected ? 'Complete' : (submitted > 0 ? 'Late' : 'Pending')
        });
      }
      
      if (report_type === 'ALL' || report_type === 'MONTHLY_STOCK') {
        const unitStock = stockReports.filter(r => unit.blockIds.includes(r.block_id));
        const expected = monthsExpected * numBlocks;
        const submitted = unitStock.length;
        
        let onTimeCount = 0;
        let lastReported = null;
        
        unitStock.forEach(r => {
           const [yr, mo] = r.month.split('-');
           const cutoff = new Date(parseInt(yr), parseInt(mo), 5, 23, 59, 59);
           const created = new Date(r.created_at || r.submitted_at || new Date().toISOString());
           if (created <= cutoff) onTimeCount++;
           if (!lastReported || created > lastReported) lastReported = created;
        });
        
        const reportingPct = expected > 0 ? Math.round((submitted / expected) * 100) : 0;
        const onTimePct = expected > 0 ? Math.round((onTimeCount / expected) * 100) : 0;
        
        totalExpected += expected;
        totalReceived += submitted;
        totalOnTime += onTimeCount;
        
        rows.push({
          unitName: unit.name,
          isUrban: unit.isUrban,
          reportName: 'Monthly Vaccine Stock Balance Report',
          frequency: 'Monthly',
          lastReported: lastReported ? lastReported.toISOString() : null,
          expected,
          submitted,
          reportingPct,
          onTimePct,
          status: submitted >= expected ? 'Complete' : (submitted > 0 ? 'Late' : 'Pending')
        });
      }
    }
    
    res.json({
      kpis: {
        expected: totalExpected,
        received: totalReceived,
        reportingPct: totalExpected > 0 ? Math.round((totalReceived / totalExpected) * 100) : 0,
        onTimePct: totalExpected > 0 ? Math.round((totalOnTime / totalExpected) * 100) : 0,
        units: blocks.length
      },
      rows
    });
  } catch (err) {
    console.error('Completeness API error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/reports/generate', authenticateToken, async (req, res) => {
  try {
    const { date, districtId, blockId, divisionId, level = 'BLOCK' } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];
    if (!useSupabase) return res.json({ rows: [] });

    // 1. Fetch blocks — include hpv_target column directly from blocks table
    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);
    const userDistrictId = req.user.district_id || (req.user.role === 'DISTRICT_ADMIN' ? req.user.district_id : null);
    const effectiveDistrictId = userDistrictId || (districtId && districtId !== 'ALL' ? districtId : null);

    let bQuery = supabase
      .from('blocks')
      .select(`
        id, name, health_block_name, is_urban, lgd_code, district_id, hpv_target,
        districts!inner(id, name, lgd_code, state_id, division_id, divisions(name))
      `)
      .eq('is_active', true)
      .order('name');
      
    if (targetStateId) {
      bQuery = bQuery.eq('districts.state_id', targetStateId);
    }
    
    if (effectiveDistrictId && String(effectiveDistrictId).toUpperCase() !== 'ALL') {
      const distStr = String(effectiveDistrictId).toUpperCase();
      if (distStr === 'KUMAON' || distStr === 'GARHWAL') {
        const kumaonDists = ['almora', 'bageshwar', 'champawat', 'nainital', 'pithoragarh', 'udham singh nagar'];
        const garhwalDists = ['chamoli', 'dehradun', 'haridwar', 'pauri garhwal', 'tehri garhwal', 'uttarkashi', 'rudraprayag'];
        const targetNames = distStr === 'KUMAON' ? kumaonDists : garhwalDists;
        const { data: matchedDists } = await supabase.from('districts').select('id, name, divisions(name)');
        const filteredIds = (matchedDists || [])
          .filter(d => targetNames.includes((d.name || '').toLowerCase()) || (d.divisions?.name || '').toUpperCase().includes(distStr))
          .map(d => d.id);
        if (filteredIds.length > 0) {
          bQuery = bQuery.in('district_id', filteredIds);
        }
      } else {
        bQuery = bQuery.eq('district_id', effectiveDistrictId);
      }
    }
    if (divisionId && divisionId !== 'ALL') bQuery = bQuery.eq('districts.division_id', divisionId);
    if (blockId && blockId !== 'ALL') bQuery = bQuery.eq('id', blockId);

    const { data: blocks, error: bErr } = await bQuery;
    if (bErr) throw bErr;

    // 2. Fetch ALL profiles in a separate query (for base_population)
    const { data: profiles, error: pErr } = await supabase
      .from('block_reporting_profiles')
      .select('block_id, base_population, initial_hpv_target');
    if (pErr) throw pErr;

    // 3. Fetch cumulative reports up to this date (latest per block)
    const { data: reports, error: rErr } = await supabase
      .from('daily_reports')
      .select('block_id, line_list_count, beneficiaries_vaccinated, sessions_held, reporting_date')
      .lte('reporting_date', reportDate)
      .order('reporting_date', { ascending: false });
    if (rErr) throw rErr;

    // 4. Fetch today's exact date records for sessions_held_today and vaccinated_today
    const { data: todayReports, error: tErr } = await supabase
      .from('daily_reports')
      .select('block_id, beneficiaries_vaccinated, sessions_held, reporting_date')
      .eq('reporting_date', reportDate);
    if (tErr) throw tErr;

    // Build lookup maps
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.block_id] = p; });

    // Cumulative: latest and previous reports per block
    const reportsMap = {};
    const prevReportsMap = {};
    (reports || []).forEach(r => { 
      if (!reportsMap[r.block_id]) {
        reportsMap[r.block_id] = r; 
      } else if (!prevReportsMap[r.block_id]) {
        prevReportsMap[r.block_id] = r;
      }
    });

    // Today's exact records
    const todayMap = {};
    (todayReports || []).forEach(r => { todayMap[r.block_id] = r; });

    // Map to block-level data
    const blockData = blocks.map(b => {
      const rep = reportsMap[b.id];
      const prevRep = prevReportsMap[b.id];
      const todayRep = todayMap[b.id];
      const prof = profileMap[b.id];
      const pop = prof?.base_population || 0;
      // hpv_target from blocks table directly; fallback to profile initial_hpv_target or 1% pop
      const target = b.hpv_target || prof?.initial_hpv_target || (pop > 0 ? Math.round(pop * 0.01) : 0);
      
      const sessToday = todayRep ? (todayRep.sessions_held - (prevRep ? prevRep.sessions_held : 0)) : 0;
      const vaccToday = todayRep ? (todayRep.beneficiaries_vaccinated - (prevRep ? prevRep.beneficiaries_vaccinated : 0)) : 0;

      return {
        id: b.id,
        name: b.health_block_name || b.name,
        is_urban: b.is_urban,
        lgd_code: b.lgd_code,
        district_id: b.district_id,
        district_name: b.districts?.name,
        district_lgd_code: b.districts?.lgd_code,
        population: pop,
        hpv_target: target,
        last_reporting_date: rep ? rep.reporting_date : '—',
        line_list_received: rep ? (rep.line_list_count || 0) : 0,
        beneficiaries_vaccinated: rep ? (rep.beneficiaries_vaccinated || 0) : 0,
        sessions_held_cumulative: rep ? (rep.sessions_held || 0) : 0,
        sessions_held_today: sessToday > 0 ? sessToday : 0,
        vaccinated_today: vaccToday > 0 ? vaccToday : 0,
        has_report: !!rep,
        has_today_report: !!todayRep
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
            sessions_held_cumulative: 0,
            sessions_held_today: 0,
            vaccinated_today: 0,
            last_reporting_date: '—',
            has_report: false,
            has_today_report: false
          };
        }
        const g = distGroup[b.district_id];
        g.population += b.population;
        g.hpv_target += b.hpv_target;
        if (b.has_report) {
          g.line_list_received += b.line_list_received;
          g.beneficiaries_vaccinated += b.beneficiaries_vaccinated;
          g.sessions_held_cumulative += b.sessions_held_cumulative;
          g.has_report = true;
          g.last_reporting_date = reportDate;
        }
        if (b.has_today_report) {
          g.sessions_held_today += b.sessions_held_today;
          g.vaccinated_today += b.vaccinated_today;
          g.has_today_report = true;
        }
      });
      finalRows = Object.values(distGroup);
        } else if (level === 'DIVISION') {
      const divGroup = {};
      blockData.forEach(b => {
        const divId = b.districts?.division_id || 'unknown';
        const divName = b.districts?.divisions?.name || 'Unknown';
        if (!divGroup[divId]) {
          divGroup[divId] = {
            id: divId,
            name: `${divName} Division`,
            lgd_code: '-',
            population: 0,
            hpv_target: 0,
            line_list_received: 0,
            beneficiaries_vaccinated: 0,
            sessions_held_cumulative: 0,
            sessions_held_today: 0,
            vaccinated_today: 0,
            last_reporting_date: '—',
            has_report: false,
            has_today_report: false
          };
        }
        const g = divGroup[divId];
        g.population += b.population;
        g.hpv_target += b.hpv_target;
        if (b.has_report) {
          g.line_list_received += b.line_list_received;
          g.beneficiaries_vaccinated += b.beneficiaries_vaccinated;
          g.sessions_held_cumulative += b.sessions_held_cumulative;
          g.has_report = true;
          g.last_reporting_date = reportDate;
        }
        if (b.has_today_report) {
          g.sessions_held_today += b.sessions_held_today;
          g.vaccinated_today += b.vaccinated_today;
          g.has_today_report = true;
        }
      });
      finalRows = Object.values(divGroup);
    } else if (level === 'STATE') {
      const stateObj = {
        id: 'uttarakhand',
        name: 'Uttarakhand State',
        lgd_code: 5,
        population: 0,
        hpv_target: 0,
        line_list_received: 0,
        beneficiaries_vaccinated: 0,
        sessions_held_cumulative: 0,
        sessions_held_today: 0,
        vaccinated_today: 0,
        last_reporting_date: '—',
        has_report: false,
        has_today_report: false
      };
      blockData.forEach(b => {
        stateObj.population += b.population;
        stateObj.hpv_target += b.hpv_target;
        if (b.has_report) {
          stateObj.line_list_received += b.line_list_received;
          stateObj.beneficiaries_vaccinated += b.beneficiaries_vaccinated;
          stateObj.sessions_held_cumulative += b.sessions_held_cumulative;
          stateObj.has_report = true;
          stateObj.last_reporting_date = reportDate;
        }
        if (b.has_today_report) {
          stateObj.sessions_held_today += b.sessions_held_today;
          stateObj.vaccinated_today += b.vaccinated_today;
          stateObj.has_today_report = true;
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
          : null,
        vaccinations_per_session: r.has_report && r.sessions_held_cumulative > 0
          ? parseFloat((r.beneficiaries_vaccinated / r.sessions_held_cumulative).toFixed(2))
          : null
      };
    });

    res.json({ rows });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.get('/api/admin/reports/stock-monitoring', authenticateToken, async (req, res) => {
  try {
    const { reportingMonth, districtId, blockId, divisionId, level = 'BLOCK', debug } = req.query;
    
    // Parse Dates
    const todayStr = new Date().toISOString().split('T')[0];
    const currentMonthStr = todayStr.slice(0, 7);
    const targetMonthStr = reportingMonth || currentMonthStr;

    if (!useSupabase) return res.json({ rows: [], kpis: { totalDvs: 0, totalCcp: 0 } });

    const selectedStateId = req.query.state_id || req.query.stateId;
    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (selectedStateId && selectedStateId !== 'ALL' ? selectedStateId : null);

    // 1. Fetch Blocks & Targets
    let bQuery = supabase
      .from('blocks')
      .select(`
        id, name, health_block_name, is_urban, lgd_code, district_id, hpv_target, population,
        districts!inner(id, name, lgd_code, state_id, division_id, divisions(name))
      `)
      .eq('is_active', true)
      .order('name');

    if (targetStateId) bQuery = bQuery.eq('districts.state_id', targetStateId);
    if (districtId && districtId !== 'ALL') bQuery = bQuery.eq('district_id', districtId);
    if (divisionId && divisionId !== 'ALL') bQuery = bQuery.eq('districts.division_id', divisionId);
    if (blockId && blockId !== 'ALL') bQuery = bQuery.eq('id', blockId);

    const { data: blocks, error: bErr } = await bQuery;
    if (bErr) throw bErr;

    const blockIds = blocks.map(b => b.id);
    const finalDistrictIds = [...new Set(blocks.map(b => b.district_id))];

    const { data: profiles } = await supabase
      .from('block_reporting_profiles')
      .select('block_id, base_population, initial_hpv_target')
      .in('block_id', blockIds);
      
    const profileMap = {};
    (profiles || []).forEach(p => { profileMap[p.block_id] = p; });

    // 2. Fetch CCPs for District and Block logic
    const { data: allCcps } = await supabase
      .from('vaccine_ccp')
      .select('id, ccl_id, unit_level, district_id, block_id')
      .in('unit_level', ['2', '3'])
      .in('district_id', finalDistrictIds);
      
    const districtStores = allCcps.filter(c => c.unit_level === '2');
    const blockCcps = allCcps.filter(c => c.unit_level === '3');
    
    const ccpCclIdMap = {};
    allCcps.forEach(c => { if(c.ccl_id) ccpCclIdMap[c.id] = c.ccl_id; });
    const districtStoreMap = {}; 
    districtStores.forEach(c => {
      if (!districtStoreMap[c.district_id]) districtStoreMap[c.district_id] = [];
      districtStoreMap[c.district_id].push(c.id);
    });

    const blockCcpMap = {}; 
    blockCcps.forEach(c => {
      if (!blockCcpMap[c.block_id]) blockCcpMap[c.block_id] = [];
      blockCcpMap[c.block_id].push(c.id);
    });

    const reset = req.query.reset === 'true';

    // Fetch existing ledger records if available
    let ledgerRecords = null;
    if (finalDistrictIds.length > 0 && !reset) {
        try {
            const { data: records } = await supabase
                .from('vaccine_stock_ledger')
                .select('*')
                .eq('reporting_month', targetMonthStr)
                .in('district_id', finalDistrictIds);
            if (records && records.length > 0) {
                ledgerRecords = records;
            }
        } catch (e) {
            console.warn('Could not read vaccine_stock_ledger:', e);
        }
    }

    const blockData = [];
    const districtStoreData = [];

    if (ledgerRecords && ledgerRecords.length > 0) {
        (ledgerRecords || []).forEach(r => {
            if (r.entity_type === 'BLOCK' && blockIds.includes(r.block_id)) {
                const b = blocks.find(x => x.id === r.block_id);
                if (!b) return;
                blockData.push({
                    id: b.id,
                    name: b.health_block_name || b.name,
                    is_urban: b.is_urban,
                    population: b.population || 0,
                    district: b.districts?.name,
                    district_id: b.district_id,
                    division_id: b.districts?.division_id,
                    division_name: b.districts?.divisions?.name,
                    annual_requirement: r.annual_requirement,
                    opening_stock: r.opening_stock,
                    vaccine_received: r.vaccine_received_current_month,
                    vaccinations: r.vaccinations_current_month,
                    estimated_stock_balance: r.closing_stock_estimated,
                    month_end_reporting_pct: r.pre_month_reporting_percentage,
                    month_end_reporting_count: r.pre_month_reporting_count,
                    month_end_total_ccp: r.pre_month_total_ccp,
                    month_end_stock_reported: r.pre_month_end_stock_reported,
                    opening_stock_crude_method: r.opening_stock_crude_method,
                    estimation_model: r.estimation_model === 'Reported Value Method' || r.estimation_model === 'Reported Stock' ? 'Reported Stock' : 'Crude Method',
                    stock_availability_pct: r.stock_availability_percentage,
                    action_required: r.action,
                    vaccine_received_last_12_months: r.vaccine_received_last_12_months,
                    vaccinations_last_12_months: r.vaccinations_last_12_months,
                    entity_type: 'BLOCK'
                });
            } else if (r.entity_type === 'CCL_LEVEL_2_DISTRICT_STORE' && finalDistrictIds.includes(r.district_id)) {
                const d = blocks.find(x => x.district_id === r.district_id)?.districts;
                if (!d) return;
                districtStoreData.push({
                    id: r.district_id + '-ccl2',
                    name: d.name + ' District Store',
                    population: 0,
                    is_urban: false,
                    district: d.name,
                    district_id: r.district_id,
                    division_id: d.division_id,
                    division_name: d.divisions?.name,
                    annual_requirement: r.annual_requirement,
                    opening_stock: r.opening_stock,
                    vaccine_received: r.vaccine_received_current_month,
                    vaccinations: r.vaccine_consumed_wastage_factor,
                    estimated_stock_balance: r.closing_stock_estimated,
                    month_end_reporting_pct: r.pre_month_reporting_percentage,
                    month_end_reporting_count: r.pre_month_reporting_count,
                    month_end_total_ccp: r.pre_month_total_ccp,
                    month_end_stock_reported: r.pre_month_end_stock_reported,
                    opening_stock_crude_method: r.opening_stock_crude_method,
                    estimation_model: r.estimation_model === 'Reported Value Method' || r.estimation_model === 'Reported Stock' ? 'Reported Stock' : 'Crude Method',
                    stock_availability_pct: r.stock_availability_percentage,
                    action_required: r.action,
                    vaccine_received_last_12_months: r.vaccine_received_last_12_months,
                    vaccinations_last_12_months: r.vaccinations_last_12_months,
                    entity_type: 'CCL_LEVEL_2_DISTRICT_STORE'
                });
            }
        });
    } else {
        // Dynamic In-Memory Calculation (Fail-safe for Serverless Vercel environment)
        const targetMonthDate = new Date(targetMonthStr + '-01');
        const prevMonthDate = new Date(targetMonthDate);
        prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
        const prevMonthStr = prevMonthDate.toISOString().split('T')[0].slice(0, 7);
        const twelveMonthsPriorDate = new Date(prevMonthDate);
        twelveMonthsPriorDate.setMonth(twelveMonthsPriorDate.getMonth() - 11);
        const twelveMonthsPriorStr = twelveMonthsPriorDate.toISOString().split('T')[0].slice(0, 7);
        const thirteenMonthsPriorDate = new Date(twelveMonthsPriorDate);
        thirteenMonthsPriorDate.setMonth(thirteenMonthsPriorDate.getMonth() - 1);

        const targetMonthStart = targetMonthStr + '-01';
        const nextMonthDate = new Date(targetMonthDate);
        nextMonthDate.setMonth(nextMonthDate.getMonth() + 1);
        const targetMonthEnd = new Date(nextMonthDate - 1).toISOString().split('T')[0];
        const prevMonthEnd = new Date(targetMonthDate - 1).toISOString().split('T')[0];
        const twelveMonthsPriorStart = twelveMonthsPriorStr + '-01';
        const thirteenMonthsPriorEnd = new Date(twelveMonthsPriorDate - 1).toISOString().split('T')[0];

        const [
            { data: monthlyBalances },
            { data: transactionsHistorical },
            { data: transactionsCurrent },
            { data: dailyReports }
        ] = await Promise.all([
            supabase.from('monthly_balance').select('facility_id, qty_doses, transaction_date').gte('transaction_date', prevMonthStr + '-01').lte('transaction_date', prevMonthEnd).limit(50000),
            supabase.from('vaccine_stock_transactions').select('level, district_id, block_id, facility_id, transaction_type, quantity_doses, source_ccl_id, destination_ccl_id').lte('transaction_date', prevMonthEnd).limit(100000),
            supabase.from('vaccine_stock_transactions').select('level, district_id, block_id, facility_id, transaction_type, quantity_doses, source_ccl_id, destination_ccl_id').gte('transaction_date', targetMonthStart).lte('transaction_date', targetMonthEnd).limit(50000),
            supabase.from('daily_reports').select('block_id, reporting_date, beneficiaries_vaccinated').lte('reporting_date', targetMonthEnd).order('reporting_date', { ascending: false }).limit(50000)
        ]);

        const maxVaxPrevMonth = {};
        const maxVaxCurrentMonth = {};

        (dailyReports || []).forEach(r => {
            const b = r.block_id;
            if (r.reporting_date <= prevMonthEnd && maxVaxPrevMonth[b] === undefined) {
                maxVaxPrevMonth[b] = r.beneficiaries_vaccinated || 0;
            }
            if (r.reporting_date <= targetMonthEnd && maxVaxCurrentMonth[b] === undefined) {
                maxVaxCurrentMonth[b] = r.beneficiaries_vaccinated || 0;
            }
        });

        // Helper for transaction grouping
        const calculateFlows = (facs, txList) => {
            let inflow = 0;
            let outflow = 0;
            const facCclIds = facs.map(f => ccpCclIdMap[f]).filter(Boolean);
            
            (txList || []).forEach(t => {
                const qty = Number(t.quantity_doses || 0);
                if (t.transaction_type === 'RECEIVED') {
                    if (facs.includes(t.facility_id) && !t.source_ccl_id) inflow += qty;
                } else if (t.transaction_type === 'ISSUED') {
                    if (t.destination_ccl_id && facCclIds.includes(t.destination_ccl_id) && !facs.includes(t.facility_id)) {
                        inflow += qty;
                    }
                    if (facs.includes(t.facility_id) && (!t.destination_ccl_id || !facCclIds.includes(t.destination_ccl_id))) {
                        outflow += qty;
                    }
                }
            });
            return { inflow, outflow };
        };

        // 1. Process Blocks
        blocks.forEach(block => {
            const prof = profileMap[block.id];
            const baseTarget = prof?.initial_hpv_target || (prof?.base_population ? Math.round(prof.base_population * 0.01) : (block.population ? Math.round(block.population * 0.01) : 0));
            const annualReq = Math.round(baseTarget * 1.01);
            const facs = blockCcpMap[block.id] || [];

            let preMonthReportingCount = 0;
            let preMonthEndStockReported = 0;
            facs.forEach(f => {
                const bal = (monthlyBalances || []).find(x => String(x.facility_id) === String(f));
                if (bal) {
                    preMonthReportingCount++;
                    preMonthEndStockReported += bal.qty_doses;
                }
            });

            const preMonthTotalCcp = facs.length;
            const preMonthReportingPct = preMonthTotalCcp > 0 ? (preMonthReportingCount / preMonthTotalCcp) * 100 : 0;

            const vaxHistorical = maxVaxPrevMonth[block.id] || 0;
            const vaxCurrentMonth = Math.max(0, (maxVaxCurrentMonth[block.id] || 0) - vaxHistorical);

            const histFlows = calculateFlows(facs, transactionsHistorical);
            const currFlows = calculateFlows(facs, transactionsCurrent);

            // True opening stock using crude method is historical inflow - historical outflow - historical vaccinations
            const openingStockCrudeMethod = Math.max(0, histFlows.inflow - histFlows.outflow - vaxHistorical);
            const estimationModel = preMonthReportingPct === 100 ? 'Reported Stock' : 'Crude Method';
            const openingStock = estimationModel === 'Reported Stock' ? preMonthEndStockReported : openingStockCrudeMethod;

            const closingStockEstimated = Math.max(0, openingStock + currFlows.inflow - currFlows.outflow - vaxCurrentMonth);
            const stockAvailabilityPercentage = annualReq > 0 ? Math.round((closingStockEstimated / annualReq) * 100) : 0;
            
            let action = '—';
            if (annualReq > 0) {
                if (stockAvailabilityPercentage < 10) action = 'Critical';
                else if (stockAvailabilityPercentage < 25) action = 'Replenish';
                else if (stockAvailabilityPercentage < 50) action = 'Monitor';
                else action = 'Adequate';
            }

            blockData.push({
                id: block.id,
                name: block.health_block_name || block.name,
                is_urban: block.is_urban,
                population: block.population || 0,
                district: block.districts?.name,
                district_id: block.district_id,
                division_id: block.districts?.division_id,
                division_name: block.districts?.divisions?.name,
                annual_requirement: annualReq,
                opening_stock: openingStock,
                vaccine_received: currFlows.inflow,
                vaccinations: vaxCurrentMonth,
                estimated_stock_balance: closingStockEstimated,
                month_end_reporting_pct: preMonthReportingPct,
                month_end_reporting_count: preMonthReportingCount,
                month_end_total_ccp: preMonthTotalCcp,
                month_end_stock_reported: preMonthReportingPct === 100 ? preMonthEndStockReported : null,
                opening_stock_crude_method: openingStockCrudeMethod,
                estimation_model: estimationModel,
                stock_availability_pct: stockAvailabilityPercentage,
                action_required: action,
                vaccine_received_last_12_months: histFlows.inflow,
                vaccinations_last_12_months: vaxHistorical,
                entity_type: 'BLOCK'
            });
        });

        // 2. Process District Stores
        const processedDistrictStores = new Set();
        for (const ccl of districtStores) {
            if (processedDistrictStores.has(ccl.district_id)) continue;
            processedDistrictStores.add(ccl.district_id);

            const districtId = ccl.district_id;
            const facs = districtStoreMap[districtId] || [];

            let preMonthReportingCount = 0;
            let preMonthEndStockReported = 0;

            facs.forEach(f => {
                const bal = (monthlyBalances || []).find(x => String(x.facility_id) === String(f));
                if (bal) {
                    preMonthReportingCount++;
                    preMonthEndStockReported += bal.qty_doses;
                }
            });

            const preMonthTotalCcp = facs.length;
            const preMonthReportingPct = preMonthTotalCcp > 0 ? (preMonthReportingCount / preMonthTotalCcp) * 100 : 0;

            let districtTotalVaxHistorical = 0;
            let districtTotalVaxCurrent = 0;
            blocks.forEach(b => {
                if (b && String(b.district_id) === String(districtId)) {
                    const hist = maxVaxPrevMonth[b.id] || 0;
                    districtTotalVaxHistorical += hist;
                    districtTotalVaxCurrent += Math.max(0, (maxVaxCurrentMonth[b.id] || 0) - hist);
                }
            });

            const histFlows = calculateFlows(facs, transactionsHistorical);
            const currFlows = calculateFlows(facs, transactionsCurrent);

            // District store vaccinations are technically its issues, but if we track crude method:
            // Since vaccinations happen at blocks, the district store outflow is effectively its issues to blocks.
            // Opening crude = histFlows.inflow - histFlows.outflow. (District stores don't directly vaccinate)
            const openingStockCrudeMethod = Math.max(0, histFlows.inflow - histFlows.outflow);

            const estimationModel = preMonthReportingPct === 100 ? 'Reported Stock' : 'Crude Method';
            const openingStock = estimationModel === 'Reported Stock' ? preMonthEndStockReported : openingStockCrudeMethod;

            const closingStockEstimated = Math.max(0, openingStock + currFlows.inflow - currFlows.outflow);
            const d = blocks.find(x => x.district_id === districtId)?.districts;

            districtStoreData.push({
                id: districtId + '-ccl2',
                name: (d?.name || '') + ' District Store',
                population: 0,
                is_urban: false,
                district: d?.name || '',
                district_id: districtId,
                division_id: d?.division_id,
                division_name: d?.divisions?.name,
                annual_requirement: 0,
                opening_stock: openingStock,
                vaccine_received: currFlows.inflow,
                vaccinations: currFlows.outflow, 
                estimated_stock_balance: closingStockEstimated,
                month_end_reporting_pct: preMonthReportingPct,
                month_end_reporting_count: preMonthReportingCount,
                month_end_total_ccp: preMonthTotalCcp,
                month_end_stock_reported: preMonthReportingPct === 100 ? preMonthEndStockReported : null,
                opening_stock_crude_method: openingStockCrudeMethod,
                estimation_model: estimationModel,
                stock_availability_pct: 0,
                action_required: '—',
                vaccine_received_last_12_months: histFlows.inflow,
                vaccinations_last_12_months: districtTotalVaxHistorical,
                entity_type: 'CCL_LEVEL_2_DISTRICT_STORE'
            });
        }

        // Asynchronously update ledger table without blocking response
        // ensureMonthlyLedger is disabled as it was removed
        // ensureMonthlyLedger(targetMonthStr, blocks, districtStores, districtStoreMap, blockCcpMap, profileMap).catch(e => console.warn('Background ledger update notice:', e));
    }

    let finalRows = [];
    if (level === 'DISTRICT') {
        const distGroup = {};
        [...blockData, ...districtStoreData].forEach(d => {
            const distId = d.district_id;
            if (!distGroup[distId]) {
                distGroup[distId] = {
                    id: distId,
                    name: d.district,
                    district: d.district,
                    district_id: distId,
                    division_id: d.division_id,
                    division_name: d.division_name,
                    annual_requirement: 0,
                    opening_stock: 0,
                    vaccine_received: 0,
                    vaccinations: 0,
                    estimated_stock_balance: 0,
                    stock_availability_pct: 0,
                    action_required: '—',
                    month_end_reporting_count_sum: 0,
                    month_end_total_ccp_sum: 0,
                    month_end_stock_reported_sum: 0,
                    opening_stock_crude_method_sum: 0,
                    vaccine_received_last_12_months_sum: 0,
                    vaccinations_last_12_months_sum: 0,
                    valid_reporting_count: 0,
                    total_entities: 0,
                    entity_type: 'DISTRICT_AGGREGATE',
                    population: 0
                };
            }
            const g = distGroup[distId];
            g.annual_requirement += d.annual_requirement;
            g.population += (d.population || 0);
            
            if (d.entity_type === 'CCL_LEVEL_2_DISTRICT_STORE') {
                // District Store ONLY contributes to "Received"
                g.vaccine_received += d.vaccine_received;
                g.vaccine_received_last_12_months_sum += d.vaccine_received_last_12_months;
            } else {
                // Blocks ONLY contribute to "Vaccinations"
                g.vaccinations += d.vaccinations;
                g.vaccinations_last_12_months_sum += d.vaccinations_last_12_months;
            }
            
            g.month_end_reporting_count_sum += (d.month_end_reporting_count || 0);
            g.month_end_total_ccp_sum += (d.month_end_total_ccp || 0);
            
            if (d.month_end_stock_reported != null) {
                g.month_end_stock_reported_sum += d.month_end_stock_reported;
                g.valid_reporting_count++;
            }
            g.total_entities++;
        });
        
        finalRows = Object.values(distGroup).map(g => {
            // Recalculate Crude Method at the District Level
            const consumed12M = Math.round(g.vaccinations_last_12_months_sum * 1.01);
            g.opening_stock_crude_method = Math.max(0, g.vaccine_received_last_12_months_sum - consumed12M);
            
            g.month_end_reporting_pct = g.month_end_total_ccp_sum > 0 ? (g.month_end_reporting_count_sum / g.month_end_total_ccp_sum) * 100 : 0;
            g.month_end_reporting_count = g.month_end_reporting_count_sum;
            g.month_end_total_ccp = g.month_end_total_ccp_sum;
            
            g.month_end_stock_reported = g.valid_reporting_count > 0 ? g.month_end_stock_reported_sum : null;
            
            g.estimation_model = g.month_end_reporting_pct >= 100 ? 'Reported Stock' : 'Crude Method';
            g.opening_stock = g.estimation_model === 'Reported Stock' ? (g.month_end_stock_reported ?? g.opening_stock_crude_method) : g.opening_stock_crude_method;
            
            const consumedCurrent = Math.round(g.vaccinations * 1.01);
            g.estimated_stock_balance = Math.max(0, g.opening_stock + g.vaccine_received - consumedCurrent);
            
            g.stock_availability_pct = g.annual_requirement > 0 ? (g.estimated_stock_balance / g.annual_requirement) * 100 : 0;
            g.action_required = '—';
            if (g.annual_requirement > 0) {
                if (g.stock_availability_pct < 10) g.action_required = 'Critical';
                else if (g.stock_availability_pct < 25) g.action_required = 'Replenish';
                else if (g.stock_availability_pct < 50) g.action_required = 'Monitor';
                else g.action_required = 'Adequate';
            }
            
            g.vaccine_received_last_12_months = g.vaccine_received_last_12_months_sum;
            g.vaccinations_last_12_months = g.vaccinations_last_12_months_sum;
            
            return g;
        });
    } else {
        finalRows = [...districtStoreData, ...blockData];
    }
    
    let totalDvs = districtStores.length;
    let totalCcp = blockCcps.length;
    
    res.json({ rows: finalRows, kpis: { totalDvs, totalCcp } });
  } catch (err) {
    console.error('Stock Monitoring API error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/reports/stock-ledger', authenticateToken, async (req, res) => {
  try {
    const { dateFrom, dateTo, state, district, cclName, cclLevel, cclUnitType, transactionType, manufacturer, batchNo } = req.query;

    if (useSupabase) {
      let txQuery = supabase.from('vaccine_stock_transactions').select('*');
      let ccpQuery = supabase.from('vaccine_ccp').select('id, ccl_id, to_ccl, unit_level, unit_type, district_id, block_id, districts(name)');
      let distQuery = supabase.from('districts').select('id, name, state_id');

      if (dateFrom) {
        txQuery = txQuery.gte('transaction_date', dateFrom);
      }
      if (dateTo) {
        txQuery = txQuery.lte('transaction_date', dateTo);
      }
      if (batchNo && batchNo.trim()) {
        txQuery = txQuery.ilike('batch_no', `%${batchNo.trim()}%`);
      }

      const [
        { data: txData, error: txErr },
        { data: ccpData },
        { data: distData }
      ] = await Promise.all([
        txQuery.order('transaction_date', { ascending: true }),
        ccpQuery,
        distQuery
      ]);

      const distMap = {};
      (distData || []).forEach(d => { distMap[d.id] = d.name; });

      const ccpMap = {};
      (ccpData || []).forEach(c => {
        ccpMap[c.id] = c;
        if (c.ccl_id) ccpMap[c.ccl_id] = c;
      });

      // ── Step 1: Initialize CCL Summary Map ──
      const cclSummaryMap = {};
      const initCcl = (id, fallbackName, fallbackLevel) => {
         if (!id) return null;
         const key = String(id);
         if (!cclSummaryMap[key]) {
            const fac = ccpMap[key] || {};
            const level = String(fac.unit_level || fallbackLevel || '2');
            let levelLabel = 'Block/CCP (L3)';
            if (level === '1') levelLabel = 'State (L1)';
            if (level === '2') levelLabel = 'District (L2)';

            cclSummaryMap[key] = {
               ccl_id: key,
               ccl_name: fac.to_ccl || fallbackName || 'Unknown CCL',
               level,
               level_label: levelLabel,
               unit_type: fac.unit_type || (level === '1' ? 'SVS' : (level === '2' ? 'DVS' : 'CCP-B')),
               total_in: 0,
               total_out: 0,
               balance: 0
            };
         }
         return cclSummaryMap[key];
      };

      // ── Step 2: Process Transactions Exactly as Requested ──
      txData.forEach(t => {
         const qty = Number(t.quantity_doses || 0);
         
         if (t.transaction_type === 'RECEIVED') {
            // External Receipt: Adds to Destination (State)
            const destId = t.facility_id || t.destination_ccl_id;
            const dest = initCcl(destId, t.destination_ccl_name, t.level);
            if (dest) {
               dest.total_in += qty;
               dest.balance += qty;
            }
         } else if (t.transaction_type === 'ISSUED') {
            // Internal Transfer: Reduces Source, Increases Destination
            const srcId = t.source_ccl_id || t.facility_id;
            const srcName = t.source_ccl_name || ccpMap[srcId]?.to_ccl;
            const src = initCcl(srcId, srcName, t.level);
            if (src) {
               src.total_out += qty;
               src.balance -= qty;
            }

            const destId = t.destination_ccl_id;
            const dest = initCcl(destId, t.destination_ccl_name, t.destination_level);
            if (dest) {
               dest.total_in += qty;
               dest.balance += qty;
            }
         }
      });

      // ── Step 3: Build Raw Transaction Log ──
      const rawRows = (txData || []).map(t => {
         const isRecv = t.transaction_type === 'RECEIVED';
         const srcId = isRecv ? null : (t.source_ccl_id || t.facility_id);
         const srcCcp = ccpMap[srcId] || {};
         const srcName = isRecv ? 'External Supplier' : (t.source_ccl_name || srcCcp.to_ccl || 'Source CCL');
         const srcDist = isRecv ? '—' : (srcCcp.districts?.name || '—');
         
         const destId = isRecv ? (t.facility_id || t.destination_ccl_id) : t.destination_ccl_id;
         const destCcp = ccpMap[destId] || {};
         const destName = t.destination_ccl_name || destCcp.to_ccl || 'Destination CCL';
         const destDist = destCcp.districts?.name || '—';
         
         return {
            id: t.id,
            transaction_date: t.transaction_date || t.created_at,
            transaction_type: isRecv ? 'Receive' : 'Issue',
            batch_no: t.batch_no || '—',
            manufacturer_name: t.manufacture_name || '—',
            expiry_date: t.batch_expiry_date || '—',
            transaction_quantity: Number(t.quantity_doses || 0),
            from_ccl: srcName,
            from_ccl_id: srcId,
            from_district: srcDist,
            to_ccl: destName,
            to_ccl_id: destId,
            to_district: destDist,
            remarks: t.remarks || (isRecv ? 'Receipt from supplier' : 'Internal transfer')
         };
      });

      // Sort by date ascending (chronological)
      rawRows.sort((a, b) => new Date(a.transaction_date).getTime() - new Date(b.transaction_date).getTime());

      // ── Step 4: Apply Filters to Transaction Log ──
      let filteredRows = rawRows.filter(r => {
         let match = true;
         if (district && district !== 'All Districts') {
            const fromFac = ccpMap[r.from_ccl_id] || {};
            const toFac = ccpMap[r.to_ccl_id] || {};
            const fromDist = distMap[fromFac.district_id] || '';
            const toDist = distMap[toFac.district_id] || '';
            match = match && (fromDist.toLowerCase().includes(district.toLowerCase()) || toDist.toLowerCase().includes(district.toLowerCase()));
         }
         if (cclName && cclName.trim() !== '') {
            match = match && (r.from_ccl.toLowerCase().includes(cclName.toLowerCase()) || r.to_ccl.toLowerCase().includes(cclName.toLowerCase()));
         }
         if (transactionType && transactionType !== 'All') {
            match = match && (r.transaction_type.toLowerCase() === transactionType.toLowerCase());
         }
         return match;
      });

      // ── Step 5: Compute System-Wide KPIs ──
      const kpis = {
         totalExternalReceived: 0,
         totalStateBalance: 0,
         totalDistrictBalance: 0,
         totalIssuedToBlocks: 0
      };

      const cclSummary = Object.values(cclSummaryMap);
      cclSummary.forEach(c => {
         if (c.level === '1') {
            kpis.totalExternalReceived += c.total_in;
            kpis.totalStateBalance += c.balance;
         } else if (c.level === '2') {
            kpis.totalDistrictBalance += c.balance;
         } else if (c.level === '3') {
            kpis.totalIssuedToBlocks += c.total_in;
         }
      });
      
      // Sort Summary by Level then Name
      cclSummary.sort((a, b) => {
         if (a.level !== b.level) return Number(a.level) - Number(b.level);
         return a.ccl_name.localeCompare(b.ccl_name);
      });

      return res.json({
         rows: filteredRows,
         cclSummary,
         kpis,
         isLive: true
      });
    } // <-- Added missing brace for if (useSupabase)

    // Reference fallback rows when DB table is freshly initialized or empty
    const rows = [
      {
        id: 1,
        ccl_name: 'District Vaccine Store Lucknow (L2)',
        transaction_date: '01/05/2025',
        transaction_type: 'Receive',
        batch_no: 'HPV250401',
        manufacturer_name: 'Merck/MSD',
        expiry_date: '31/03/2027',
        transaction_quantity: 1000,
        to_ccl: 'State Vaccine Store Lucknow (L1)',
        physical_stock_count: null,
        wastage_adjustment: null,
        closing_balance: 2250,
        remarks: 'Initial receipt',
        ccl_level: 'L2',
        unit_type: 'DVS'
      },
      {
        id: 2,
        ccl_name: 'District Vaccine Store Lucknow (L2)',
        transaction_date: '05/05/2025',
        transaction_type: 'Issue',
        batch_no: 'HPV250401',
        manufacturer_name: 'Merck/MSD',
        expiry_date: '31/03/2027',
        transaction_quantity: -600,
        to_ccl: 'CHC Alambagh (L3)',
        physical_stock_count: null,
        wastage_adjustment: null,
        closing_balance: 1650,
        remarks: 'Routine issue',
        ccl_level: 'L2',
        unit_type: 'DVS'
      },
      {
        id: 3,
        ccl_name: 'District Vaccine Store Lucknow (L2)',
        transaction_date: '10/05/2025',
        transaction_type: 'Receive',
        batch_no: 'HPV250410',
        manufacturer_name: 'Merck/MSD',
        expiry_date: '30/04/2027',
        transaction_quantity: 1000,
        to_ccl: 'State Vaccine Store Lucknow (L1)',
        physical_stock_count: null,
        wastage_adjustment: null,
        closing_balance: 2650,
        remarks: 'Additional receipt',
        ccl_level: 'L2',
        unit_type: 'DVS'
      },
      {
        id: 4,
        ccl_name: 'District Vaccine Store Lucknow (L2)',
        transaction_date: '15/05/2025',
        transaction_type: 'Issue',
        batch_no: 'HPV250401',
        manufacturer_name: 'Merck/MSD',
        expiry_date: '31/03/2027',
        transaction_quantity: -800,
        to_ccl: 'PHC Mohan Road (L3)',
        physical_stock_count: null,
        wastage_adjustment: null,
        closing_balance: 1850,
        remarks: 'Routine issue',
        ccl_level: 'L2',
        unit_type: 'DVS'
      },
      {
        id: 5,
        ccl_name: 'District Vaccine Store Lucknow (L2)',
        transaction_date: '20/05/2025',
        transaction_type: 'Issue',
        batch_no: 'HPV250410',
        manufacturer_name: 'Merck/MSD',
        expiry_date: '30/04/2027',
        transaction_quantity: -600,
        to_ccl: 'PHC Kakori (L3)',
        physical_stock_count: null,
        wastage_adjustment: null,
        closing_balance: 1250,
        remarks: 'Routine issue',
        ccl_level: 'L2',
        unit_type: 'DVS'
      },
      {
        id: 6,
        ccl_name: 'District Vaccine Store Lucknow (L2)',
        transaction_date: '31/05/2025',
        transaction_type: 'Month-end Reconciliation',
        batch_no: '-',
        manufacturer_name: '-',
        expiry_date: '-',
        transaction_quantity: null,
        from_ccl: 'District Vaccine Store Lucknow (L2)',
        to_ccl: 'District Vaccine Store Lucknow (L2)',
        from_ccl_id: 'dvs1',
        to_ccl_id: 'dvs1',
        from_district: 'Lucknow',
        to_district: 'Lucknow',
        physical_stock_count: 1175,
        wastage_adjustment: 75,
        closing_balance: 1175,
        remarks: 'Physical verification at month end',
        ccl_level: 'L2',
        unit_type: 'DVS'
      }
    ];

    res.json({
      rows,
      kpis: { openingStock: 1250, totalReceived: 2000, totalIssued: 2750, totalAdjustment: 75, closingStock: 425, wastagePct: '2.73' },
      isLive: false
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Super Admin CSV Uploads ──────────────────────────────────────────────────

function buildLocationMap(blocks, districts, states) {
  const map = new Map();
  blocks.forEach(b => {
    const dist = districts.find(d => d.id === b.district_id);
    if (!dist) return;
    const st = states.find(s => s.id === dist.state_id);
    if (!st) return;
    const key = `${st.name.trim().toLowerCase()}|${dist.name.trim().toLowerCase()}|${b.name.trim().toLowerCase()}`;
    map.set(key, b.id);
  });
  return map;
}

app.get('/api/superadmin/export-table/:table', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { table } = req.params;
    
    if (table === 'locations') {
      if (!useSupabase) {
        return res.json({
          countries: store.countries || [],
          states: store.states || [],
          divisions: store.divisions || [],
          districts: store.districts || [],
          blocks: store.blocks || []
        });
      }
      const [countries, states, divisions, districts, blocks] = await Promise.all([
        supabase.from('countries').select('*').limit(10000),
        supabase.from('states').select('*').limit(10000),
        supabase.from('divisions').select('*').limit(10000),
        supabase.from('districts').select('*').limit(100000),
        supabase.from('blocks').select('*').limit(100000)
      ]);
      return res.json({
        countries: countries.data || [],
        states: states.data || [],
        divisions: divisions.data || [],
        districts: districts.data || [],
        blocks: blocks.data || []
      });
    }

    let tableName = '';
    if (table === 'population') tableName = 'block_reporting_profiles';
    else if (table === 'livedata') tableName = 'daily_reports';
    else if (table === 'vaccine_ccp') tableName = 'vaccine_ccp';
    else if (table === 'stock_receive' || table === 'stock_issue') tableName = 'vaccine_stock_transactions';
    else return res.status(400).json({ error: 'Invalid table type' });

    if (!useSupabase) {
       return res.json(store[tableName] || []);
    }

    let query = supabase.from(tableName).select('*').limit(100000);
    if (table === 'population') {
      query = supabase.from('block_reporting_profiles').select('*, blocks(name, lgd_code, districts(name, states(name)))').limit(100000);
    } else if (table === 'stock_receive') {
      query = supabase.from('vaccine_stock_transactions').select('*').eq('transaction_type', 'RECEIVED').limit(100000);
    } else if (table === 'stock_issue') {
      query = supabase.from('vaccine_stock_transactions').select('*').eq('transaction_type', 'ISSUED').limit(100000);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    
    if (table === 'population') {
      const formattedData = data.map(row => {
        return {
          id: row.id,
          state_name: row.blocks?.districts?.states?.name || '',
          district_name: row.blocks?.districts?.name || '',
          block_name: row.blocks?.name || '',
          block_lgd_code: row.blocks?.lgd_code || '',
          block_id: row.block_id,
          base_population: row.base_population,
          population_base_date: row.population_base_date,
          initial_hpv_target: row.initial_hpv_target,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      });
      return res.json(formattedData);
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/superadmin/export-custom-table/:tableName', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { tableName } = req.params;
    
    const allowedTables = [
      'admin_users', 'audit_logs', 'block_population_targets', 'block_reporting_profiles', 
      'blocks', 'countries', 'daily_reports', 'districts', 'divisions', 'states', 
      'vaccine_ccp', 'vaccine_stock_transactions', 'monthly_balance', 'hpv_vaccinations'
    ];
    
    if (!allowedTables.includes(tableName)) {
      return res.status(400).json({ error: 'Invalid or unsupported table name' });
    }
    
    if (!useSupabase) {
       return res.json(store[tableName] || []);
    }
    
    const { data, error } = await supabase.from(tableName).select('*').limit(100000);
    if (error) throw error;
    
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/superadmin/upload-population', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });

    let blocks = store.blocks, districts = store.districts, states = store.states, profiles = store.block_reporting_profiles;
    if (useSupabase) {
      blocks = (await supabase.from('blocks').select('*').limit(100000)).data || [];
      districts = (await supabase.from('districts').select('*').limit(100000)).data || [];
      states = (await supabase.from('states').select('*').limit(10000)).data || [];
      profiles = (await supabase.from('block_reporting_profiles').select('*').limit(100000)).data || [];
    }

    const locMap = buildLocationMap(blocks, districts, states);
    let successCount = 0;
    let errors = [];
    let details = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const stateName = (row.State || row.state || '').trim().toLowerCase();
      const distName = (row.District || row.district || '').trim().toLowerCase();
      const blockName = (row.BlockOrCity || row.blockorcity || row.Block || row.block || row.City || row.city || '').trim().toLowerCase();
      const popStr = row.population || row.Population;
      const basePop = parseInt(popStr, 10);

      if (!stateName || !distName || !blockName || isNaN(basePop)) {
        errors.push(`Row ${i + 1}: Missing or invalid fields.`);
        continue;
      }

      const blockId = locMap.get(`${stateName}|${distName}|${blockName}`);
      if (!blockId) {
        errors.push(`Row ${i + 1}: Location not found (${stateName} > ${distName} > ${blockName}).`);
        continue;
      }

      const target = Math.round(basePop * 0.01);
      
      if (useSupabase) {
        const existing = profiles.find(p => p.block_id === blockId);
        let sError = null;
        if (existing) {
          const { error } = await supabase.from('block_reporting_profiles').update({ base_population: basePop, initial_hpv_target: target }).eq('id', existing.id);
          sError = error;
        } else {
          const profId = `prof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const { error } = await supabase.from('block_reporting_profiles').insert([{ id: profId, block_id: blockId, base_population: basePop, population_base_date: new Date().toISOString().split('T')[0], initial_hpv_target: target }]);
          sError = error;
        }
        if (sError) {
          errors.push(`Row ${i + 1}: DB Error for ${blockName} - ${sError.message || JSON.stringify(sError)}`);
          continue;
        }
        
        // Update the block table population column
        const { error: bError } = await supabase.from('blocks').update({ population: basePop }).eq('id', blockId);
        if (bError) console.error('Error updating block population column:', bError);
        
      } else {
        const existingIdx = store.block_reporting_profiles.findIndex(p => p.block_id === blockId);
        if (existingIdx >= 0) {
          store.block_reporting_profiles[existingIdx].base_population = basePop;
          store.block_reporting_profiles[existingIdx].initial_hpv_target = target;
        } else {
          store.block_reporting_profiles.push({
            id: `prof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            block_id: blockId,
            base_population: basePop,
            population_base_date: new Date().toISOString().split('T')[0],
            initial_hpv_target: target
          });
        }
      }
      
      const actualBlock = blocks.find(b => b.id === blockId);
      const distId = actualBlock ? actualBlock.district_id : 'N/A';
      const bName = actualBlock ? actualBlock.name : blockName;
      details.push(`Added population: ${basePop} to ${bName} (Block ID: ${blockId}, District ID: ${distId})`);
      
      successCount++;
    }
    
    if (!useSupabase) saveStore();
    await logAudit(req.user.id, 'UPLOAD_POPULATION', 'bulk', null);
    res.json({ message: 'Upload completed', successCount, errors, details });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/superadmin/upload-livedata', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });

    let blocks = store.blocks, districts = store.districts, states = store.states, dailyReports = store.daily_reports;
    if (useSupabase) {
      blocks = (await supabase.from('blocks').select('*').limit(100000)).data || [];
      districts = (await supabase.from('districts').select('*').limit(100000)).data || [];
      states = (await supabase.from('states').select('*').limit(10000)).data || [];
      dailyReports = (await supabase.from('daily_reports').select('*').limit(100000)).data || [];
    }

    const locMap = buildLocationMap(blocks, districts, states);
    const today = new Date().toISOString().split('T')[0];
    let successCount = 0;
    let errors = [];
    let details = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const stateName = (row.statename || row.State || row.state || '').trim().toLowerCase();
      const distName = (row.districtname || row.District || row.district || '').trim().toLowerCase();
      const distLgd = String(row.districtlgdcode || row.district_lgd_code || '').trim();
      const blockName = (row.blockname || row.BlockName || row.BlockOrCity || row.blockorcity || '').trim().toLowerCase();
      const blockLgd = String(row.blocklgdcode || row.block_lgd_code || row['blockorcity lgd code'] || row.blockorcity_lgd_code || '').trim();
      
      const llStr = row.linelisted || row.LineListed || row.linelist || row.LineList || '0';
      const vaccStr = row.vaccinated || row.Vaccinated || '0';
      
      let rawDate = (row['Date(DD-MM-YYYY)'] || row['Date(YYYY-MM-DD)'] || row.Date || row.date || today).trim();
      let reportingDate = rawDate;
      if (rawDate !== today) {
        const parts = rawDate.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[2].length === 4) {
            // Format is DD-MM-YYYY or MM-DD-YYYY. Since template says DD-MM-YYYY, assume DD is first
            reportingDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          } else if (parts[0].length === 4) {
            // Format is YYYY-MM-DD
            reportingDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
          }
        }
      }

      let lineList = parseInt(llStr, 10);
      let vaccinated = parseInt(vaccStr, 10);
      
      if (!isNaN(lineList) && !isNaN(vaccinated) && vaccinated > lineList) {
        lineList = vaccinated;
      }

      if (isNaN(lineList) || isNaN(vaccinated)) {
        errors.push(`Row ${i + 1}: Invalid linelisted or vaccinated numbers.`);
        continue;
      }

      let blockId = null;
      if (blockLgd) {
        const b = blocks.find(b => String(b.lgd_code) === blockLgd);
        if (b) blockId = b.id;
      }
      
      if (!blockId && blockName && distLgd) {
        const d = districts.find(d => String(d.lgd_code) === distLgd);
        if (d) {
          const b = blocks.find(b => b.district_id === d.id && b.name.toLowerCase() === blockName);
          if (b) blockId = b.id;
        }
      }
      
      if (!blockId && blockName && distName && stateName) {
        blockId = locMap.get(`${stateName}|${distName}|${blockName}`);
      }

      if (!blockId) {
        errors.push(`Row ${i + 1}: Location not found (Block LGD: ${blockLgd}, or Block Name: ${blockName}).`);
        continue;
      }

      if (useSupabase) {
        const existing = dailyReports.find(r => r.block_id === blockId && r.reporting_date === reportingDate);
        let sError = null;
        if (existing) {
          const { error } = await supabase.from('daily_reports').update({ line_list_count: lineList, beneficiaries_vaccinated: vaccinated }).eq('id', existing.id);
          sError = error;
        } else {
          const reportId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const { error } = await supabase.from('daily_reports').insert([{ id: reportId, block_id: blockId, reporting_date: reportingDate, line_list_count: lineList, beneficiaries_vaccinated: vaccinated, submitted_by: 'Super Admin CSV' }]);
          sError = error;
        }
        if (sError) {
          errors.push(`Row ${i + 1}: DB Error for ${blockName} - ${sError.message || JSON.stringify(sError)}`);
          continue;
        }
      } else {
        const existingIdx = store.daily_reports.findIndex(r => r.block_id === blockId && r.reporting_date === reportingDate);
        if (existingIdx >= 0) {
          store.daily_reports[existingIdx].line_list_count = lineList;
          store.daily_reports[existingIdx].beneficiaries_vaccinated = vaccinated;
        } else {
          store.daily_reports.push({
            id: `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            block_id: blockId,
            reporting_date: reportingDate,
            line_list_count: lineList,
            beneficiaries_vaccinated: vaccinated,
            submitted_by: 'Super Admin CSV'
          });
        }
      }
      
      const actualBlock = blocks.find(b => b.id === blockId);
      const distId = actualBlock ? actualBlock.district_id : 'N/A';
      const bName = actualBlock ? actualBlock.name : blockName;
      details.push(`Added live data (Line list: ${lineList}, Vaccinated: ${vaccinated}, Date: ${reportingDate}) to ${bName} (Block ID: ${blockId}, District ID: ${distId})`);
      
      successCount++;
    }

    if (!useSupabase) saveStore();
    await logAudit(req.user.id, 'UPLOAD_LIVEDATA', 'bulk', null);
    res.json({ message: 'Upload completed', successCount, errors, details });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Super Admin CSV Uploads: Locations ──────────────────────────────────────────

app.post('/api/superadmin/upload-locations', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });
    if (!useSupabase) return res.status(500).json({ error: 'Supabase required for this complex operation' });

    let allCountries = (await supabase.from('countries').select('*').limit(10000)).data || [];
    let allStates = (await supabase.from('states').select('*').limit(10000)).data || [];
    let allDivisions = (await supabase.from('divisions').select('*').limit(10000)).data || [];
    let allDistricts = (await supabase.from('districts').select('*').limit(100000)).data || [];
    let allBlocks = (await supabase.from('blocks').select('*').limit(100000)).data || [];
    let allProfiles = (await supabase.from('block_reporting_profiles').select('*').limit(100000)).data || [];

    let successCount = 0;
    let errors = [];
    let details = [];

    const today = new Date().toISOString().split('T')[0];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (!row.countryname || !row.statename || !row.districtname || !row.blockorcityname) {
        errors.push(`Row ${i + 1}: Missing mandatory names`);
        continue;
      }

      // Country
      let countryCode = String(row.countrycode || '').trim();
      let country = allCountries.find(c => (c.code === countryCode || c.lgd_code === countryCode) && countryCode) || allCountries.find(c => c.name.toLowerCase() === row.countryname.trim().toLowerCase());
      if (!country) {
        const { data: nC, error: eC } = await supabase.from('countries').insert({ lgd_code: countryCode, code: countryCode, name: row.countryname.trim() }).select().single();
        if (eC) { errors.push(`Row ${i + 1}: Error creating Country - ${eC.message}`); continue; }
        country = nC; allCountries.push(country);
      }

      // State
      let stateLgd = String(row.statelgdcode || '').trim();
      let state = allStates.find(s => String(s.lgd_code) === stateLgd && stateLgd) || allStates.find(s => s.name.toLowerCase() === row.statename.trim().toLowerCase() && s.country_id === country.id);
      if (!state) {
        const { data: nS, error: eS } = await supabase.from('states').insert({ country_id: country.id, lgd_code: stateLgd, code: stateLgd, name: row.statename.trim() }).select().single();
        if (eS) { errors.push(`Row ${i + 1}: Error creating State - ${eS.message}`); continue; }
        state = nS; allStates.push(state);
      }

      // Division
      let divisionCode = String(row.divisioncode || '').trim();
      let division = allDivisions.find(r => String(r.system_code) === divisionCode && divisionCode) || allDivisions.find(r => r.name.toLowerCase() === row.divisionname?.trim().toLowerCase() && r.state_id === state.id);
      if (!division) {
        const { data: nR, error: eR } = await supabase.from('divisions').insert({ state_id: state.id, system_code: divisionCode, code: divisionCode, name: row.divisionname?.trim() || 'Default Division' }).select().single();
        if (eR) { errors.push(`Row ${i + 1}: Error creating Division - ${eR.message}`); continue; }
        division = nR; allDivisions.push(division);
      }

      // District
      let distLgd = String(row.districtlgdcode || '').trim();
      let district = allDistricts.find(d => String(d.lgd_code) === distLgd && distLgd) || allDistricts.find(d => d.name.toLowerCase() === row.districtname.trim().toLowerCase() && d.division_id === division.id);
      if (!district) {
        const { data: nD, error: eD } = await supabase.from('districts').insert({ division_id: division.id, state_id: state.id, lgd_code: distLgd, name: row.districtname.trim() }).select().single();
        if (eD) { errors.push(`Row ${i + 1}: Error creating District - ${eD.message}`); continue; }
        district = nD; allDistricts.push(district);
      }

      // Block
      let blockLgd = String(row.blockorcitylgdcode || '').trim();
      let block = null;
      if (blockLgd) {
        block = allBlocks.find(b => String(b.lgd_code) === blockLgd);
      }
      if (!block) {
        const nameMatch = allBlocks.find(b => b.name.toLowerCase() === row.blockorcityname.trim().toLowerCase() && b.district_id === district.id);
        if (nameMatch) {
          if (!nameMatch.lgd_code || !blockLgd || String(nameMatch.lgd_code) === blockLgd) {
            block = nameMatch;
          }
        }
      }
      
      const areaTypeVal = row['urbanorrural'] || row['areatype(blockorcity)'] || '';
      const isUrban = areaTypeVal.toLowerCase() === 'city' || areaTypeVal.toLowerCase() === 'urban';
      
      const rawUrban = row['Urbantype'] || row['urbantype'] || '';
      const urbanType = rawUrban.trim() ? rawUrban : null;
      
      const rawHq = row['HQ(Y/N)'] || row['hq(y/n)'] || row['HQ'] || '';
      const isHq = rawHq.trim().toUpperCase() === 'Y';
      
      const rawDvs = row['DVS(Y/N)'] || row['dvs(y/n)'] || '';
      const isDvs = rawDvs.trim().toUpperCase() === 'Y';
      
      const rawHealthBlock = row['Healthblockname'] || row['healthblockname'] || '';
      const healthBlockName = rawHealthBlock.trim() ? rawHealthBlock : null;
      
      const rawTarget = row['districtthpvtarget'] || row['district_hpv_target'] || '';
      const hpvTarget = rawTarget.trim() ? parseInt(rawTarget, 10) : null;

      if (!block) {
        const { data: nB, error: eB } = await supabase.from('blocks').insert({ 
          district_id: district.id, 
          lgd_code: blockLgd, 
          name: row.blockorcityname.trim(), 
          is_urban: isUrban, 
          area_type: areaTypeVal,
          urban_type: urbanType,
          is_hq: isHq,
          is_dvs: isDvs,
          health_block_name: healthBlockName,
          hpv_target: hpvTarget
        }).select().single();
        if (eB) { errors.push(`Row ${i + 1}: Error creating Block - ${eB.message}`); continue; }
        block = nB; allBlocks.push(block);
      } else {
        // Update existing block with new fields if they are provided
        const updates = {};
        let needsUpdate = false;
        if (areaTypeVal && block.area_type !== areaTypeVal) { updates.area_type = areaTypeVal; updates.is_urban = isUrban; needsUpdate = true; }
        if (urbanType !== null && block.urban_type !== urbanType) { updates.urban_type = urbanType; needsUpdate = true; }
        if (rawHq.trim() !== '' && block.is_hq !== isHq) { updates.is_hq = isHq; needsUpdate = true; }
        if (rawDvs.trim() !== '' && block.is_dvs !== isDvs) { updates.is_dvs = isDvs; needsUpdate = true; }
        if (healthBlockName !== null && block.health_block_name !== healthBlockName) { updates.health_block_name = healthBlockName; needsUpdate = true; }
        if (hpvTarget !== null && block.hpv_target !== hpvTarget) { updates.hpv_target = hpvTarget; needsUpdate = true; }
        
        if (needsUpdate) {
          const { error: updErr } = await supabase.from('blocks').update(updates).eq('id', block.id);
          if (!updErr) {
            Object.assign(block, updates);
            details.push(`Updated block info for ${block.name}`);
          }
        }
      }

      // Population / Profile
      const popStr = row.population || row.Population || '';
      const basePop = popStr.trim() ? parseInt(popStr, 10) : NaN;
      let profile = allProfiles.find(p => p.block_id === block.id);
      
      if (!isNaN(basePop) && basePop > 0) {
        const target = Math.round(basePop * 0.01);
        let updatedProfile = false;
        
        if (profile) {
          if (profile.base_population !== basePop) {
            await supabase.from('block_reporting_profiles').update({ base_population: basePop, initial_hpv_target: target }).eq('id', profile.id);
            profile.base_population = basePop;
            updatedProfile = true;
          }
        } else {
          const profId = `prof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const { data: nP } = await supabase.from('block_reporting_profiles').insert([{ id: profId, block_id: block.id, base_population: basePop, population_base_date: today, initial_hpv_target: target }]).select().single();
          if (nP) { profile = nP; allProfiles.push(profile); updatedProfile = true; }
        }
        
        // Always ensure the block table is also synced with the new population
        if (block.population !== basePop) {
          const { error: bErr } = await supabase.from('blocks').update({ population: basePop }).eq('id', block.id);
          if (!bErr) {
            block.population = basePop;
            if (!updatedProfile) details.push(`Updated block population for ${block.name}`);
          }
        }
        
        if (updatedProfile) {
          details.push(`Updated population for ${block.name}`);
        }
      }

      // Daily Reports
      const llStr = row.linelisted || row.LineListed || row.linelist || '0';
      const vaccStr = row.vaccinated || row.Vaccinated || '0';
      const lineList = parseInt(llStr, 10);
      const vaccinated = parseInt(vaccStr, 10);
      
      let rawDate = (row['Date(DD-MM-YYYY)'] || row['Date(YYYY-MM-DD)'] || row.Date || row.date || '').trim();
      let reportingDate = rawDate;
      if (rawDate) {
        const parts = rawDate.split(/[-/]/);
        if (parts.length === 3) {
          if (parts[2].length === 4) reportingDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
          else if (parts[0].length === 4) reportingDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        }
      }

      if (reportingDate && (!isNaN(lineList) || !isNaN(vaccinated))) {
        // Find existing report for this block & date
        const { data: existingReports } = await supabase.from('daily_reports').select('*').eq('block_id', block.id).eq('reporting_date', reportingDate);
        const existingReport = existingReports && existingReports[0];
        
        if (existingReport) {
          // Only update if greater
          const currentLL = existingReport.line_list_count;
          const currentVac = existingReport.beneficiaries_vaccinated;
          
          let updateData = {};
          if (!isNaN(lineList) && lineList > currentLL) updateData.line_list_count = lineList;
          if (!isNaN(vaccinated) && vaccinated > currentVac) updateData.beneficiaries_vaccinated = vaccinated;
          
          if (Object.keys(updateData).length > 0) {
            await supabase.from('daily_reports').update(updateData).eq('id', existingReport.id);
            details.push(`Updated report for ${block.name} on ${reportingDate}`);
          }
        } else if (lineList > 0 || vaccinated > 0) {
          // Insert new
          const reportId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          await supabase.from('daily_reports').insert([{ id: reportId, block_id: block.id, reporting_date: reportingDate, line_list_count: isNaN(lineList) ? 0 : lineList, beneficiaries_vaccinated: isNaN(vaccinated) ? 0 : vaccinated, submitted_by: 'Super Admin Location CSV' }]);
          details.push(`Created report for ${block.name} on ${reportingDate}`);
        }
      }

      successCount++;
    }

    await logAudit(req.user.id, 'UPLOAD_LOCATIONS', 'bulk', null);
    res.json({ message: 'Location upload completed', successCount, errors, details });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Location Master CRUD ──────────────────────────────────────────────────

app.get('/api/admin/locations-master-data', authenticateToken, async (req, res) => {
  try {
    if (!useSupabase) return res.status(500).json({ error: 'Requires Supabase' });
    
    // Fetch full hierarchy
    const { data: blocks, error: bErr } = await supabase.from('blocks').select('*, districts(name, lgd_code, divisions(name, system_code, states(name, lgd_code, countries(name, lgd_code))))').eq('is_active', true);
    if (bErr) throw bErr;
    
    // Fetch profiles
    const { data: profiles } = await supabase.from('block_reporting_profiles').select('*').limit(100000);
    
    // Fetch reports
    const { data: reports } = await supabase.from('daily_reports').select('*').limit(100000);
    
    // Map data
    const result = blocks.map(b => {
      const flat = flattenBlock(b);
      const prof = profiles.find(p => p.block_id === b.id) || {};
      
      // Get all reports for this block
      const bReports = reports.filter(r => r.block_id === b.id).sort((x, y) => new Date(y.reporting_date) - new Date(x.reporting_date));
      const latestReport = bReports[0] || {};
      
      const pop = prof.base_population || b.population || 0;
      const annualTarget = Math.round(pop * 0.01);
      const hpvTarget = b.hpv_target || 0;
      const totalSessions = bReports.reduce((sum, r) => sum + (r.sessions_held || 0), 0);

      return {
        ...flat,
        population: pop,
        annual_target: annualTarget,
        hpv_target: hpvTarget,
        sessions: latestReport.sessions_held || totalSessions || 0,
        linelisted: latestReport.line_list_count || 0,
        vaccinated: latestReport.beneficiaries_vaccinated || 0,
        reports_count: bReports.length,
        last_reported_date: latestReport.reporting_date || 'N/A'
      };
    });
    
    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

// ─── Super Admin CSV Uploads: Vaccine CCP ──────────────────────────────────────────

app.post('/api/superadmin/upload-vaccine-ccp', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { data, overrideConflicts } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });
    if (!useSupabase) return res.status(500).json({ error: 'Supabase required' });

    let allStates = (await supabase.from('states').select('id, lgd_code')).data || [];
    let allDistricts = (await supabase.from('districts').select('id, lgd_code')).data || [];
    let allBlocks = (await supabase.from('blocks').select('id, lgd_code')).data || [];

    let successCount = 0;
    let errors = [];
    let details = [];
    let conflicts = [];

    const CHUNK_SIZE = 50;
    
    const { data: existingRecords } = await supabase.from('vaccine_ccp').select('*');
    const existingCclIds = new Set((existingRecords || []).map(r => r.ccl_id).filter(Boolean));
    const existingFacilityNames = new Set((existingRecords || []).filter(r => r.to_ccl && r.block_id).map(r => `${r.block_id}-${r.to_ccl}`));
    const existingMap = {};
    (existingRecords || []).forEach(r => { if (r.ccl_id) existingMap[r.ccl_id] = r; });

    let toUpdate = [];
    let toInsert = [];

    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      
      for (const row of chunk) {
        const stateLgd = Number(row['State Code']);
        const districtLgd = Number(row['District Code']);
        const blockLgd = Number(row['Block / City Code']);

        const stateId = allStates.find(s => s.lgd_code === stateLgd)?.id || null;
        const districtId = allDistricts.find(d => d.lgd_code === districtLgd)?.id || null;
        const blockId = allBlocks.find(b => b.lgd_code === blockLgd)?.id || null;

        const facilityName = row['Facility Name'] ? String(row['Facility Name']).trim() : null;
        const cclId = row['CCL ID'] ? String(row['CCL ID']).trim() : null;

        if (!facilityName) {
           errors.push(`Row missing Facility Name`);
           continue;
        }

        const newObj = {
          state_id: stateId,
          district_id: districtId,
          block_id: blockId,
          lgd_state_code: stateLgd || null,
          lgd_district_code: districtLgd || null,
          lgd_block_code: blockLgd || null,
          to_ccl: facilityName,
          sub_district_name: row['Sub District Name'] || null,
          facility_acronym: row['Facility acronym'] || null,
          hospital_facility_id: row['Hospital Facility ID'] || null,
          abdm_org_facility_id: row['ABDM Org Facility ID'] || null,
          pin_code: row['Pin Code'] || null,
          address: row['Address'] || null,
          latitude: parseFloat(row['Latitude']) || null,
          longitude: parseFloat(row['Longitude']) || null,
          altitude: parseFloat(row['Alt.']) || null,
          contact_number: row['Contact Number'] || null,
          health_facility_group: row['Health Facility Group'] || null,
          health_facility_type: row['Health Facility  Type'] || null,
          setting: row['Setting'] || null,
          ulb_code: row['ULB Code'] || null,
          ulb_type: row['ULB Type'] || null,
          ownership: row['Ownership'] || null,
          parent_organization: row['Parent organization'] || null,
          department_name: row['Department Name'] || null,
          department_type: row['Department Type'] || null,
          service_domain: row['Service Domain'] || null,
          service_category: row['Service Catgeory'] || null,
          service: row['Service'] || null,
          service_unit: row['Service Unit'] || null,
          unit_level: String(row['UNIT Level'] || ''),
          unit_sub_level: row['UNIT Sub Level'] || null,
          unit_type: row['UNIT TYPE'] || null,
          ccl_id: cclId || null,
          ccl_block_hq_yes: row['CCLBlock HQ (Yes)'] || null,
          name_of_unit_incharge: row['Name of UNIT Incharge'] || null,
          status: row['Status'] || 'Active'
        };

        if (cclId && existingMap[cclId]) {
          const existing = existingMap[cclId];
          const diffs = [];
          
          if (newObj.to_ccl !== existing.to_ccl) diffs.push({ field: 'Facility Name', old: existing.to_ccl, new: newObj.to_ccl });
          if (newObj.contact_number !== existing.contact_number) diffs.push({ field: 'Contact Number', old: existing.contact_number, new: newObj.contact_number });
          if (newObj.name_of_unit_incharge !== existing.name_of_unit_incharge) diffs.push({ field: 'Incharge Name', old: existing.name_of_unit_incharge, new: newObj.name_of_unit_incharge });
          if (newObj.unit_level !== existing.unit_level) diffs.push({ field: 'Unit Level', old: existing.unit_level, new: newObj.unit_level });
          if (newObj.status !== existing.status) diffs.push({ field: 'Status', old: existing.status, new: newObj.status });
          
          if (diffs.length > 0) {
            if (!overrideConflicts) {
              conflicts.push({ ccl_id: cclId, to_ccl: facilityName, differences: diffs });
            } else {
              toUpdate.push({ id: existing.id, ...newObj });
            }
          } else {
            errors.push(`Skipped exact duplicate: ${cclId}`);
          }
          continue;
        } else if (blockId) {
          const comboKey = `${blockId}-${facilityName}`;
          if (existingFacilityNames.has(comboKey) && !overrideConflicts) {
            errors.push(`Skipped duplicate (Facility already exists in Block): ${facilityName}`);
            continue;
          }
        }

        if (cclId) existingCclIds.add(cclId);
        if (blockId) existingFacilityNames.add(`${blockId}-${facilityName}`);
        
        toInsert.push(newObj);
      }
    }

    if (conflicts.length > 0) {
       return res.status(409).json({ error: 'Conflicts found', conflicts });
    }

    // Process Updates
    if (toUpdate.length > 0) {
       for (const u of toUpdate) {
          const { id, ...updateData } = u;
          const { error } = await supabase.from('vaccine_ccp').update(updateData).eq('id', id);
          if (!error) successCount++;
       }
       details.push(`Updated ${toUpdate.length} existing records.`);
    }

    // Process Inserts in chunks
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
       const chunkInsert = toInsert.slice(i, i + CHUNK_SIZE);
       const { error } = await supabase.from('vaccine_ccp').insert(chunkInsert);
       if (error) {
          errors.push(`Error inserting batch: ${error.message}`);
       } else {
          successCount += chunkInsert.length;
       }
    }
    if (toInsert.length > 0) details.push(`Inserted ${toInsert.length} new records.`);

    res.json({ successCount, errors, details });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

app.post('/api/locations/:type', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { type } = req.params;
    const tableMap = { country: 'countries', state: 'states', division: 'divisions', district: 'districts', block: 'blocks' };
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Invalid location type' });
    
    if (!useSupabase) return res.status(500).json({ error: 'Requires Supabase' });

    const { data, error } = await supabase.from(table).insert([req.body]).select().single();
    if (error) throw error;
    
    await logAudit(req.user.id, `CREATE_LOCATION_${type.toUpperCase()}`, table, data.id);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.put('/api/locations/:type/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { type, id } = req.params;
    const tableMap = { country: 'countries', state: 'states', division: 'divisions', district: 'districts', block: 'blocks' };
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Invalid location type' });
    
    if (!useSupabase) return res.status(500).json({ error: 'Requires Supabase' });

    // Separate profile and report data if editing a block's stats
    let { base_population, initial_hpv_target, linelisted, vaccinated, reporting_date, ...locationData } = req.body;

    const { data, error } = await supabase.from(table).update(locationData).eq('id', id).select().single();
    if (error) throw error;
    
    if (type === 'block') {
      if (base_population !== undefined) {
        const { data: existingProf } = await supabase.from('block_reporting_profiles').select('*').eq('block_id', id);
        if (existingProf && existingProf.length > 0) {
          await supabase.from('block_reporting_profiles').update({ base_population, initial_hpv_target: initial_hpv_target || Math.round(base_population * 0.01) }).eq('id', existingProf[0].id);
        } else {
          const profId = `prof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          await supabase.from('block_reporting_profiles').insert([{ id: profId, block_id: id, base_population, population_base_date: new Date().toISOString().split('T')[0], initial_hpv_target: initial_hpv_target || Math.round(base_population * 0.01) }]);
        }
      }
      
      if (reporting_date && (linelisted !== undefined || vaccinated !== undefined)) {
        const { data: existingReps } = await supabase.from('daily_reports').select('*').eq('block_id', id).eq('reporting_date', reporting_date);
        if (existingReps && existingReps.length > 0) {
          let updateData = {};
          if (linelisted !== undefined) updateData.line_list_count = linelisted;
          if (vaccinated !== undefined) updateData.beneficiaries_vaccinated = vaccinated;
          await supabase.from('daily_reports').update(updateData).eq('id', existingReps[0].id);
        } else {
          const repId = `rep-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          await supabase.from('daily_reports').insert([{ id: repId, block_id: id, reporting_date, line_list_count: linelisted || 0, beneficiaries_vaccinated: vaccinated || 0, submitted_by: 'Super Admin Location Master' }]);
        }
      }
    }

    await logAudit(req.user.id, `UPDATE_LOCATION_${type.toUpperCase()}`, table, id);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});


// ─── Activity Tracking ────────────────────────────────────────────────────────

app.post('/api/track-activity', async (req, res) => {
  try {
    const { page } = req.body;
    let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();

    if (!useSupabase) return res.json({ success: true, local: true });

    // Check if IP exists
    const { data: existing } = await supabase.from('visitor_activity').select('*').eq('ip_address', ip).single();

    if (existing) {
      await supabase.from('visitor_activity').update({
        last_page_visited: page,
        updated_at: new Date().toISOString()
      }).eq('id', existing.id);
    } else {
      // Fetch Location
      let location = 'Unknown';
      try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(`http://ip-api.com/json/${ip}`);
        const geo = await response.json();
        if (geo.status === 'success') {
          location = `${geo.city}, ${geo.regionName}, ${geo.country}`;
        }
      } catch (err) {
        console.error('GeoIP fetch failed:', err.message);
      }

      await supabase.from('visitor_activity').insert([{
        ip_address: ip,
        location,
        last_page_visited: page
      }]);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('Track activity error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/activity', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') {
      return res.status(403).json({ error: 'Only SuperAdmin can view activity' });
    }
    if (!useSupabase) return res.json([]);

    const { data, error } = await supabase
      .from('visitor_activity')
      .select('*')
      .order('updated_at', { ascending: false });
      
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Super Admin CSV Uploads: Stock Receive & Issue ─────────────────────────────────

app.post('/api/superadmin/upload-stock-receive', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });
    if (!useSupabase) return res.status(500).json({ error: 'Supabase required for this complex operation' });

    let successCount = 0;
    let errors = [];
    let details = [];
    
    // Fetch all vaccine CCPs to map CCL IDs to state_id, district_id, block_id, facility_id
    const { data: allCcps } = await supabase.from('vaccine_ccp').select('id, ccl_id, state_id, district_id, block_id');

    const CHUNK_SIZE = 50;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const toInsert = [];

      for (const row of chunk) {
        if (!row['Batch No'] || !row['Quantity'] || (!row['Date (YYYY-MM-DD)'] && !row['Date'])) {
           errors.push(`Row missing required fields`);
           continue;
        }

        const destCcp = allCcps?.find(c => c.ccl_id === row['Destination CCL ID']);
        const sId = destCcp?.state_id || req.user.state_id || 5;
        const dId = destCcp?.district_id || null;
        
        toInsert.push({
          vaccine_type: 'HPV Vaccine',
          transaction_type: 'RECEIVED',
          transaction_date: row['Date (YYYY-MM-DD)'] || row['Date'],
          quantity_doses: Number(row['Quantity']) || 0,
          batch_no: row['Batch No'],
          batch_expiry_date: row['Batch Expiry'] || null,
          manufacture_name: row['Manufacturer'] || null,
          level: row['Destination Level'] || '1',
          destination_level: row['Destination Level'] || '1',
          source_level: row['Source Level'] || null,
          source_ccl_id: row['Source CCL ID'] || null,
          source_ccl_name: row['Source CCL Name'] || null,
          destination_ccl_id: row['Destination CCL ID'] || null,
          destination_ccl_name: row['Destination CCL Name'] || null,
          remarks: row['Remarks'] || null,
          created_by: getValidUuid(req.user.id),
          state_id: sId,
          district_id: dId
        });
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('vaccine_stock_transactions').insert(toInsert);
        if (error) {
          errors.push(`Error inserting batch: ${error.message}`);
        } else {
          successCount += toInsert.length;
          details.push(`Inserted ${toInsert.length} receive transactions`);
        }
      }
    }
    res.json({ successCount, errors, details });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack }); }
});

app.post('/api/superadmin/upload-stock-issue', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });
    if (!useSupabase) return res.status(500).json({ error: 'Supabase required for this complex operation' });

    let successCount = 0;
    let errors = [];
    let details = [];
    
    const { data: allCcps } = await supabase.from('vaccine_ccp').select('id, ccl_id, state_id, district_id, block_id');

    const CHUNK_SIZE = 50;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const toInsertIssue = [];
      const toInsertReceive = [];

      for (const row of chunk) {
        if (!row['Batch No'] || !row['Quantity'] || (!row['Date (YYYY-MM-DD)'] && !row['Date'])) {
           errors.push(`Row missing required fields`);
           continue;
        }
        
        let qty = Number(row['Quantity']) || 0;
        let batch_no = row['Batch No'];
        
        const srcCcp = allCcps?.find(c => c.ccl_id === row['Source CCL ID']);
        const sId = srcCcp?.state_id || req.user.state_id || 5;
        const dId = srcCcp?.district_id || null;
        
        toInsertIssue.push({
          vaccine_type: 'HPV Vaccine',
          transaction_type: 'ISSUED',
          transaction_date: row['Date (YYYY-MM-DD)'] || row['Date'],
          quantity_doses: qty,
          batch_no: batch_no,
          manufacture_name: row['Manufacturer'] || null,
          level: row['Source Level'] || '1',
          source_level: row['Source Level'] || '1',
          source_ccl_id: row['Source CCL ID'] || null,
          source_ccl_name: row['Source CCL Name'] || null,
          destination_level: row['Destination Level'] || null,
          destination_ccl_id: row['Destination CCL ID'] || null,
          destination_ccl_name: row['Destination CCL Name'] || null,
          remarks: row['Remarks'] || null,
          created_by: getValidUuid(req.user.id),
          state_id: sId,
          district_id: dId
        });
        
        const destCcp = allCcps?.find(c => c.ccl_id === row['Destination CCL ID']);
        const dsId = destCcp?.state_id || req.user.state_id || 5;
        const ddId = destCcp?.district_id || null;
        
        toInsertReceive.push({
          vaccine_type: 'HPV Vaccine',
          transaction_type: 'RECEIVED',
          transaction_date: row['Date (YYYY-MM-DD)'] || row['Date'],
          quantity_doses: qty,
          batch_no: batch_no,
          manufacture_name: row['Manufacturer'] || null,
          level: row['Destination Level'] || null,
          source_level: row['Source Level'] || '1',
          source_ccl_id: row['Source CCL ID'] || null,
          source_ccl_name: row['Source CCL Name'] || null,
          destination_level: row['Destination Level'] || null,
          destination_ccl_id: row['Destination CCL ID'] || null,
          destination_ccl_name: row['Destination CCL Name'] || null,
          remarks: row['Remarks'] || null,
          created_by: getValidUuid(req.user.id),
          state_id: dsId,
          district_id: ddId
        });
      }

      if (toInsertIssue.length > 0) {
        const { error: err1 } = await supabase.from('vaccine_stock_transactions').insert(toInsertIssue);
        const { error: err2 } = await supabase.from('vaccine_stock_transactions').insert(toInsertReceive);
        
        if (err1 || err2) {
          errors.push(`Error inserting batch: ${err1?.message || err2?.message}`);
        } else {
          successCount += toInsertIssue.length;
          details.push(`Inserted ${toInsertIssue.length} issue transactions`);
        }
      }
    }
    res.json({ successCount, errors, details });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack }); }
});

// ─── Block Monthly Report (CCPs) ────────────────────────────────────────────────



app.get('/api/superadmin/dump-batches', async (req, res) => {
  const { data } = await supabase.from('vaccine_stock_transactions').select('*');
  res.json(data);
});

app.get('/api/superadmin/dump-ccp', async (req, res) => {
  const { data } = await supabase.from('vaccine_ccp').select('to_ccl, unit_level').ilike('to_ccl', '%Haldwani%');
  res.json(data);
});

app.get('/api/vaccine/monthly-report/status', async (req, res) => {
  try {
    const { month, blockId } = req.query; // YYYY-MM
    if (!month || !blockId) return res.status(400).json({ error: 'Month and blockId are required' });

    // Fetch the block's LGD code first
    const { data: blockInfo } = await supabase.from('blocks').select('lgd_code').eq('id', blockId).maybeSingle();
    const lgdCode = blockInfo?.lgd_code;

    // 1. Fetch all CCPs for this block
    let ccpsQuery = supabase.from('vaccine_ccp')
      .select('id, to_ccl, name_of_unit_incharge, contact_number, block_id, lgd_block_code')
      .eq('unit_level', '3')
      .order('to_ccl');

    if (lgdCode) {
      ccpsQuery = ccpsQuery.or(`block_id.eq.${blockId},lgd_block_code.eq.${lgdCode}`);
    } else {
      ccpsQuery = ccpsQuery.eq('block_id', blockId);
    }
    
    const { data: ccps, error: ccpsErr } = await ccpsQuery;
    if (ccpsErr) { console.error('CCP Query Error:', ccpsErr); return res.status(500).json({ error: ccpsErr.message }); }

    if (!ccps || ccps.length === 0) return res.json({ ccps: [] });

    // 2. Fetch monthly balances for this block and month
    const monthStart = month + '-01';
    const { data: balances } = await supabase.from('monthly_balance')
      .select('facility_id')
      .eq('block_id', blockId)
      .eq('transaction_date', monthStart);

    const enteredFacilityIds = new Set((balances || []).map(b => b.facility_id));

    const result = ccps.map(ccp => ({
       ...ccp,
       status: enteredFacilityIds.has(ccp.id) ? 'Entered' : 'Pending'
    }));

    res.json({ ccps: result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/vaccine/monthly-report/submit', authenticateToken, async (req, res) => {
  try {
    const { month, facility_id, to_ccl, batch_no, quantity, handler_name, handler_mobile, remarks, blockId } = req.body;
    if (!month || !facility_id || !batch_no || isNaN(Number(quantity)) || Number(quantity) < 0 || !blockId) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    const qty = Number(quantity);
    const monthStart = month + '-01';
    
    // Check if already submitted
    const { data: existing } = await supabase.from('monthly_balance')
      .select('id')
      .eq('facility_id', facility_id)
      .eq('transaction_date', monthStart)
      .eq('batch_no', batch_no)
      .limit(1);

    if (existing && existing.length > 0) {
      return res.status(400).json({ error: 'Balance already submitted for this CCP and Batch for the selected month.' });
    }

    // Fetch state_id and district_id from the block info
    const { data: blockInfo } = await supabase.from('blocks').select('state_id, district_id').eq('id', blockId).maybeSingle();

    // Insert into monthly_balance
    const { data, error } = await supabase.from('monthly_balance').insert([{
      vaccine_type: 'HPV Vaccine',
      transaction_type: 'MONTH_END_BALANCE',
      transaction_date: monthStart,
      qty_doses: qty,
      batch_no: batch_no,
      state_id: blockInfo?.state_id,
      district_id: blockInfo?.district_id,
      block_id: blockId,
      facility_id: facility_id,
      ccl_name: to_ccl,
      ccl_manager_handler_name: handler_name,
      ccl_manager_handler_mobile_no: handler_mobile,
      remarks: [remarks, `Recorded by: ${req.user.name || req.user.username}`].filter(Boolean).join(' | '),
      created_by: getValidUuid(req.user.id)
    }]).select();

    if (error) throw error;
    
    const currentBal = await getBatchInventory(batch_no, '3', req.user.state_id, req.user.district_id, facility_id);
    const diff = qty - currentBal;
    
    if (diff !== 0) {
      await supabase.from('vaccine_stock_transactions').insert([{
        vaccine_type: 'HPV Vaccine',
        transaction_type: diff > 0 ? 'RECEIVED' : 'ISSUED',
        transaction_date: monthStart,
        quantity_doses: Math.abs(diff),
        batch_no: batch_no,
        level: '3',
        remarks: ['Auto-adjustment from Monthly CCP Report: ' + (remarks || ''), `Recorded by: ${req.user.name || req.user.username}`].filter(Boolean).join(' | '),
        state_id: blockInfo?.state_id,
        district_id: blockInfo?.district_id,
        block_id: blockId,
        facility_id: facility_id,
        created_by: getValidUuid(req.user.id)
      }]);
    }

    res.json({ success: true, transaction: data[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});



app.put('/api/superadmin/ccl/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { id } = req.params;
    const allowedFields = ['state_id', 'district_id', 'block_id', 'lgd_state_code', 'lgd_district_code', 'lgd_block_code', 'to_ccl', 'sub_district_name', 'facility_acronym', 'hospital_facility_id', 'abdm_org_facility_id', 'pin_code', 'address', 'latitude', 'longitude', 'altitude', 'contact_number', 'health_facility_group', 'health_facility_type', 'setting', 'ulb_code', 'ulb_type', 'ownership', 'parent_organization', 'department_name', 'department_type', 'service_domain', 'service_category', 'service', 'service_unit', 'unit_level', 'unit_sub_level', 'unit_type', 'ccl_id', 'ccl_block_hq_yes', 'name_of_unit_incharge', 'status'];
    
    let updateData = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) {
         updateData[key] = req.body[key];
      }
    }
    
    const { error } = await supabase.from('vaccine_ccp').update(updateData).eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/superadmin/ccl/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { id } = req.params;
    const { error } = await supabase.from('vaccine_ccp').delete().eq('id', id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/admin/ccl-locations', authenticateToken, async (req, res) => {
  try {
    const { state_id, level, districtId, unit_level, unit_type, search } = req.query;
    if (!useSupabase) return res.json({ ccps: [], kpis: { total: 0, l1: 0, l2: 0, l3: 0 } });

    let userDistrictId = req.user.district_id || (req.user.role === 'DISTRICT_ADMIN' ? req.user.district_id : null);
    if (req.user.role === 'VACCINE_MANAGER' && req.user.ccl_id && !userDistrictId) {
      const { data: mgrCcp } = await supabase.from('vaccine_ccp').select('district_id').eq('ccl_id', req.user.ccl_id).maybeSingle();
      if (mgrCcp && mgrCcp.district_id) userDistrictId = mgrCcp.district_id;
    }

    let query = supabase.from('vaccine_ccp')
      .select('*, states(id, name), districts(id, name, division_id, divisions(name)), blocks(id, name, health_block_name)')
      .order('unit_level', { ascending: true })
      .order('to_ccl', { ascending: true });

    if (userDistrictId) {
      query = query.eq('district_id', userDistrictId);
    } else if (districtId && districtId !== 'ALL') {
      if (districtId.toUpperCase() === 'KUMAON' || districtId.toUpperCase() === 'GARHWAL') {
        const { data: divDists } = await supabase.from('districts').select('id, name, divisions!inner(name)');
        const filteredDistIds = (divDists || [])
          .filter(d => d.divisions?.name?.toUpperCase() === districtId.toUpperCase())
          .map(d => d.id);
        if (filteredDistIds.length > 0) query = query.in('district_id', filteredDistIds);
      } else {
        query = query.eq('district_id', districtId);
      }
    }

    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (state_id && state_id !== 'ALL' ? state_id : null);
    if (targetStateId) query = query.eq('state_id', targetStateId);

    if (unit_level && unit_level !== 'ALL') query = query.eq('unit_level', String(unit_level));
    if (unit_type && unit_type !== 'ALL') query = query.eq('unit_type', unit_type);

    const { data: ccps, error } = await query;
    if (error) throw error;

    let filtered = ccps || [];
    if (search && search.trim()) {
      const s = search.toLowerCase().trim();
      filtered = filtered.filter(c => 
        (c.to_ccl && c.to_ccl.toLowerCase().includes(s)) ||
        (c.ccl_id && c.ccl_id.toLowerCase().includes(s)) ||
        (c.name_of_unit_incharge && c.name_of_unit_incharge.toLowerCase().includes(s))
      );
    }

    const total = filtered.length;
    const l1 = filtered.filter(c => String(c.unit_level) === '1').length;
    const l2 = filtered.filter(c => String(c.unit_level) === '2').length;
    const l3 = filtered.filter(c => String(c.unit_level) === '3').length;

    res.json({
      ccps: filtered,
      kpis: { total, l1, l2, l3 }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/superadmin/ccl-list', authenticateToken, async (req, res) => {
  try {
    let query = supabase
      .from('vaccine_ccp')
      .select('*, states(name), districts(name), blocks(name)')
      .in('unit_level', ['1', '2', '3'])
      .order('unit_level', { ascending: true })
      .order('to_ccl', { ascending: true });

    let effectiveDistrictId = req.user.district_id || (req.user.role === 'DISTRICT_ADMIN' ? req.user.district_id : null);
    if (effectiveDistrictId) query = query.eq('district_id', effectiveDistrictId);

    const { data: ccps, error } = await query;
    if (error) throw error;
    res.json(ccps || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/vaccine/batches', authenticateToken, async (req, res) => {
  try {
    const { level, facility_id } = req.query;
    let query = supabase.from('vaccine_stock_transactions').select('*');
    
    let effectiveDistrictId = req.user.district_id;
    if (req.user.role === 'VACCINE_MANAGER' && req.user.ccl_id && !effectiveDistrictId) {
       const { data: mgrCcp } = await supabase.from('vaccine_ccp').select('district_id').eq('ccl_id', req.user.ccl_id).maybeSingle();
       if (mgrCcp && mgrCcp.district_id) effectiveDistrictId = mgrCcp.district_id;
    }

    if (level) query = query.eq('level', level);
    if (req.user.role === 'BLOCK' || req.user.block_id) {
       query = query.eq('block_id', req.user.block_id);
    } else if (effectiveDistrictId) {
       query = query.eq('district_id', effectiveDistrictId);
    } else if (req.user.state_id) {
       query = query.eq('state_id', req.user.state_id);
    }
    
    if (facility_id) query = query.eq('facility_id', facility_id);

    const { data, error } = await query;
    if (error) throw error;
    
    // Aggregate transactions into batches
    const batchMap = {};
    for (const tx of data || []) {
      if (!batchMap[tx.batch_no]) {
        batchMap[tx.batch_no] = {
          batch_no: tx.batch_no,
          batch_expiry_date: tx.batch_expiry_date,
          manufacture_name: tx.manufacture_name,
          quantity: 0
        };
      }
      if (tx.batch_expiry_date) batchMap[tx.batch_no].batch_expiry_date = tx.batch_expiry_date;
      if (tx.manufacture_name) batchMap[tx.batch_no].manufacture_name = tx.manufacture_name;
      
      if (tx.transaction_type === 'RECEIVED') {
        batchMap[tx.batch_no].quantity += Number(tx.quantity_doses || 0);
      } else if (tx.transaction_type === 'ISSUED') {
        batchMap[tx.batch_no].quantity -= Number(tx.quantity_doses || 0);
      }
    }
    
    // Fetch global metadata for these batches if missing
    const batchNos = Object.keys(batchMap);
    if (batchNos.length > 0) {
      const { data: globalBatches } = await supabase.from('vaccine_stock_transactions')
        .select('batch_no, batch_expiry_date, manufacture_name')
        .in('batch_no', batchNos)
        .not('batch_expiry_date', 'is', null);
        
      if (globalBatches) {
        for (const gb of globalBatches) {
          if (batchMap[gb.batch_no]) {
            if (gb.batch_expiry_date) batchMap[gb.batch_no].batch_expiry_date = gb.batch_expiry_date;
            if (gb.manufacture_name) batchMap[gb.batch_no].manufacture_name = gb.manufacture_name;
          }
        }
      }
    }
    
    const batches = Object.values(batchMap).filter(b => b.quantity > 0);
    res.json(batches);
  } catch (err) { res.status(500).json({ error: err.message }); }
});


// TEMPORARY SCRIPT TO FIX BROKEN BATCHES (Deprecated)
app.get('/api/superadmin/fix-batches', async (req, res) => {
  res.json({ message: 'Deprecated route. Batches are now handled via stock transactions.' });
});

// ─── Monthly Due List Report ──────────────────────────────────────────────────

// GET meta (auto-populated persistent fields) for a block
app.get('/api/due-list/meta/:blockId', async (req, res) => {
  try {
    const { blockId } = req.params;
    if (useSupabase) {
      const { data, error } = await supabase
        .from('monthly_due_list_meta')
        .select('*')
        .eq('block_id', Number(blockId))
        .maybeSingle();
      if (error) throw error;
      return res.json(data || {});
    }
    res.json({});
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT meta (save/update persistent auto-populated fields)
app.put('/api/due-list/meta/:blockId', async (req, res) => {
  try {
    const { blockId } = req.params;
    const { block_incharge_name, block_incharge_mobile, facilities_manager_name, facilities_manager_mobile, total_afs, total_ashas } = req.body;
    if (useSupabase) {
      const { error } = await supabase.from('monthly_due_list_meta').upsert(
        [{ block_id: Number(blockId), block_incharge_name, block_incharge_mobile, facilities_manager_name, facilities_manager_mobile, total_afs: Number(total_afs) || 0, total_ashas: Number(total_ashas) || 0, updated_at: new Date().toISOString() }],
        { onConflict: 'block_id', ignoreDuplicates: false }
      );
      if (error) throw error;
    }
    res.json({ message: 'Meta saved' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET list of submitted months for a block
app.get('/api/due-list/list/:blockId', async (req, res) => {
  try {
    const { blockId } = req.params;
    if (useSupabase) {
      const { data, error } = await supabase
        .from('monthly_due_list_reports')
        .select('id, reporting_month, submitted_at, asha_reporting_pct, hpv_coverage_pct')
        .eq('block_id', Number(blockId))
        .order('reporting_month', { ascending: false });
      if (error) throw error;
      return res.json(data || []);
    }
    res.json([]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET a specific month's report
app.get('/api/due-list/:blockId', async (req, res) => {
  try {
    const { blockId } = req.params;
    const { month } = req.query;
    if (!month) return res.status(400).json({ error: 'month query param required (YYYY-MM)' });
    if (useSupabase) {
      const { data, error } = await supabase
        .from('monthly_due_list_reports')
        .select('*')
        .eq('block_id', Number(blockId))
        .eq('reporting_month', month)
        .maybeSingle();
      if (error) throw error;
      return res.json(data || null);
    }
    res.json(null);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST / PUT submit a monthly due list report
app.post('/api/due-list/:blockId', async (req, res) => {
  try {
    const { blockId } = req.params;
    const {
      reporting_month,
      // Section A
      block_incharge_name, block_incharge_mobile,
      facilities_manager_name, facilities_manager_mobile,
      total_afs, total_ashas, ashas_reporting,
      // Section B.1
      new_girls_registered, girls_turned_14, total_eligible_girls,
      eligible_girls_vaccinated,
      // Section B.2
      hesitancy_count, distance_count,
      // Section B.3
      girls_turning_15_next_month, girls_turning_15_yet_to_vaccinate
    } = req.body;

    if (!reporting_month) return res.status(400).json({ error: 'reporting_month required (YYYY-MM)' });

    // Data freeze check: reports for a given month are frozen on the 9th of the FOLLOWING month
    const [yr, mo] = reporting_month.split('-').map(Number);
    const freezeDate = new Date(yr, mo, 9); // mo is already next month index (0-based +1)
    const nowIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    
    // Check if this is an edit of existing data (frozen after 9th of following month)
    if (useSupabase) {
      const { data: existing } = await supabase.from('monthly_due_list_reports').select('id, submitted_at').eq('block_id', Number(blockId)).eq('reporting_month', reporting_month).maybeSingle();
      if (existing && nowIST >= freezeDate) {
        return res.status(403).json({ error: 'Data for this month is frozen. Corrections after the 9th require authorization.' });
      }
    }

    // Calculate derived fields
    const ashaReportingPct = total_ashas > 0 ? Math.round((ashas_reporting / total_ashas) * 100 * 100) / 100 : 0;
    const eligibleGirlsPending = Math.max(0, (total_eligible_girls || 0) - (eligible_girls_vaccinated || 0));
    const othersCount = Math.max(0, eligibleGirlsPending - (hesitancy_count || 0) - (distance_count || 0));
    const hpvCoveragePct = total_eligible_girls > 0 ? Math.round((eligible_girls_vaccinated / total_eligible_girls) * 100 * 100) / 100 : 0;
    const ageOutRiskPct = girls_turning_15_next_month > 0 ? Math.round((girls_turning_15_yet_to_vaccinate / girls_turning_15_next_month) * 100 * 100) / 100 : 0;
    const hesitancyPct = total_eligible_girls > 0 ? Math.round(((hesitancy_count || 0) / total_eligible_girls) * 100 * 100) / 100 : 0;

    const reportId = `dlr-${blockId}-${reporting_month}`;
    const payload = {
      id: reportId, block_id: Number(blockId), reporting_month,
      block_incharge_name, block_incharge_mobile,
      facilities_manager_name, facilities_manager_mobile,
      total_afs: Number(total_afs) || 0, total_ashas: Number(total_ashas) || 0,
      ashas_reporting: Number(ashas_reporting) || 0,
      asha_reporting_pct: ashaReportingPct,
      new_girls_registered: Number(new_girls_registered) || 0,
      girls_turned_14: Number(girls_turned_14) || 0,
      total_eligible_girls: Number(total_eligible_girls) || 0,
      eligible_girls_vaccinated: Number(eligible_girls_vaccinated) || 0,
      eligible_girls_pending: eligibleGirlsPending,
      hesitancy_count: Number(hesitancy_count) || 0,
      distance_count: Number(distance_count) || 0,
      others_count: othersCount,
      girls_turning_15_next_month: Number(girls_turning_15_next_month) || 0,
      girls_turning_15_yet_to_vaccinate: Number(girls_turning_15_yet_to_vaccinate) || 0,
      hpv_coverage_pct: hpvCoveragePct,
      age_out_risk_pct: ageOutRiskPct,
      hesitancy_pct: hesitancyPct,
      submitted_at: new Date().toISOString()
    };

    if (useSupabase) {
      const { error } = await supabase.from('monthly_due_list_reports').upsert(
        [payload], { onConflict: 'block_id,reporting_month', ignoreDuplicates: false }
      );
      if (error) throw error;
      // Also update meta with latest persistent fields
      await supabase.from('monthly_due_list_meta').upsert(
        [{ block_id: Number(blockId), block_incharge_name, block_incharge_mobile, facilities_manager_name, facilities_manager_mobile, total_afs: Number(total_afs) || 0, total_ashas: Number(total_ashas) || 0, updated_at: new Date().toISOString() }],
        { onConflict: 'block_id', ignoreDuplicates: false }
      );

      // Sync line listing count to the latest daily report
      const { data: latestDaily } = await supabase.from('daily_reports')
        .select('id, beneficiaries_vaccinated')
        .eq('block_id', Number(blockId))
        .order('reporting_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      const newEligible = Number(total_eligible_girls) || 0;
      const todayStr = new Date().toLocaleDateString('en-CA');
      const dailyReportId = `rep-${blockId}-${todayStr}`;

      if (latestDaily) {
        let finalLineList = newEligible;
        if (latestDaily.beneficiaries_vaccinated > finalLineList) {
          finalLineList = latestDaily.beneficiaries_vaccinated;
        }
        await supabase.from('daily_reports').update({ line_list_count: finalLineList }).eq('id', latestDaily.id);
      } else {
        await supabase.from('daily_reports').insert([{
          id: dailyReportId,
          block_id: Number(blockId),
          reporting_date: todayStr,
          sessions_held: 0,
          beneficiaries_vaccinated: 0,
          line_list_count: newEligible,
          submitted_by: 'System (Monthly Sync)'
        }]);
      }
    }

    await logAudit('BLOCK_OPERATOR', 'SUBMIT_DUE_LIST_REPORT', 'monthly_due_list_reports', reportId);
    res.json({ message: 'Due list report saved', id: reportId });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Feedback ─────────────────────────────────────────────────────────────────

app.post('/api/feedback', async (req, res) => {
  try {
    const { block_id, reporter_name, role_designation, mobile_number, feedback_type, brief_description } = req.body;
    if (!feedback_type || !brief_description) return res.status(400).json({ error: 'Feedback type and description required' });

    // Auto-determine priority
    let priority = 'Low';
    if (feedback_type === 'Issue / Challenge / Bug') priority = 'High';
    else if (feedback_type === 'Other') priority = 'Medium';

    const feedbackId = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const payload = {
      id: feedbackId,
      block_id: block_id ? Number(block_id) : null,
      reporter_name, role_designation, mobile_number,
      feedback_type, brief_description, priority,
      submitted_at: new Date().toISOString()
    };

    if (useSupabase) {
      const { error } = await supabase.from('feedback_submissions').insert([payload]);
      if (error) throw error;
    }

    res.json({ message: 'Feedback submitted successfully', id: feedbackId });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 HPV Reporting Portal API on port ${PORT}`);
  console.log(`📊 DB: ${useSupabase ? 'Supabase JS (HTTPS)' : 'JSON fallback'}`);
});


export default app;
