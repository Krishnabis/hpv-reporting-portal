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
app.use(express.json({ limit: '50mb' }));

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
    name: b.name, code: b.code, is_active: b.is_active, is_urban: Boolean(b.is_urban), area_type: b.area_type || (b.is_urban ? 'City' : 'Block'),
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

app.post('/api/blocks/login', async (req, res) => {
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
      block: { id: block.id, name: block.name, lgd_code: block.lgd_code, district_name: block.district_name, district_lgd_code: block.district_lgd_code, state_name: block.state_name, state_lgd_code: block.state_lgd_code, is_urban: Boolean(block.is_urban) },
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
    let stateName = null;
    let districtName = null;
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

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name, state_id: user.state_id, state_name: stateName, district_id: user.district_id, district_name: districtName }, JWT_SECRET, { expiresIn: '24h' });
    await logAudit(user.id, 'ADMIN_LOGIN', 'admin_user', user.id, req);
    res.json({ token, user: { id: user.id, username: user.username, name: user.name, role: user.role, state_id: user.state_id, state_name: stateName, district_id: user.district_id, district_name: districtName } });
  } catch (err) { console.error(err); res.status(500).json({ error: err.message }); }
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
      let { data, error } = await supabase.from('admin_users').select('id, username, name, role, is_active, created_at, last_login_at, state_id, states(name), district_id, districts(name)').order('created_at', { ascending: false });
      if (error && (error.code === '42703' || error.code === 'PGRST204' || (error.message && error.message.includes('district')))) {
        const fallback = await supabase.from('admin_users').select('id, username, name, role, is_active, created_at, last_login_at, state_id, states(name)').order('created_at', { ascending: false });
        data = fallback.data;
        error = fallback.error;
      }
      if (error) throw error;
      return res.json(data.map(u => ({ ...u, state_name: u.states ? u.states.name : null, district_name: u.districts ? u.districts.name : null })));
    }
    res.json(store.admin_users.map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role, is_active: u.is_active, created_at: u.created_at, state_id: u.state_id, district_id: u.district_id })));
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

// Create new admin user
app.post('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const { username, name, password, role = 'ADMIN', state_id, district_id } = req.body;
    if (!username || !name || !password) return res.status(400).json({ error: 'Username, name and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const newId = `admin-${Date.now()}`;
    const passwordHash = hashPassword(password);

    if (useSupabase) {
      // Check if username already exists
      const { data: existing } = await supabase.from('admin_users').select('id').eq('username', username).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Username already exists' });

      let { error } = await supabase.from('admin_users').insert([{
        id: newId, username, name, password_hash: passwordHash, role, is_active: true, state_id: state_id ? Number(state_id) : null, district_id: district_id ? Number(district_id) : null
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

    // 1. Fetch all active blocks with district info
    let bq = supabase
      .from('blocks')
      .select(targetStateId ? 'id, name, is_urban, district_id, districts!inner(name, state_id, divisions(name))' : 'id, name, is_urban, district_id, districts!inner(name, divisions(name))')
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

    let totalBlocks = blocks?.length || 0;
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
      
      totalTarget += target;
      totalPopulation += pop;
      districtStats[dName].target += target;
      districtStats[dName].population += pop;

      const repData = reportMap[b.id];
      if (repData && repData.latest) {
        if (repData.latest.reporting_date === targetDateStr) reportingToday++;
        const ll = repData.latest.line_list_count || 0;
        const vacc = repData.latest.beneficiaries_vaccinated || 0;
        
        const prevLl = repData.prev?.line_list_count || 0;
        const prevVacc = repData.prev?.beneficiaries_vaccinated || 0;

        totalLineList += ll;
        totalVaccinated += vacc;
        districtStats[dName].lineList += ll;
        districtStats[dName].vaccinated += vacc;
        districtStats[dName].deltaLineList += (ll - prevLl);
        districtStats[dName].deltaVaccinated += (vacc - prevVacc);
      }
      
      // Calculate Low Stock
      const vacc = repData?.latest?.beneficiaries_vaccinated || 0;
      const received = blockStockMap[b.id] || 0;
      const stockBalance = received - vacc;
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
      const ll = repData?.latest?.line_list_count || 0;
      const vacc = repData?.latest?.beneficiaries_vaccinated || 0;
      const prevLl = repData?.prev?.line_list_count || 0;
      const prevVacc = repData?.prev?.beneficiaries_vaccinated || 0;
      
      const received = blockStockMap[b.id] || 0;
      const stockBalance = received - vacc;
      const isLowStock = target > 0 && stockBalance < (target * 0.25);
      
      return {
        block: b.name,
        block_id: b.id,
        is_urban: b.is_urban,
        district: dName,
        vaccinated: vacc,
        lineList: ll,
        target: target,
        isLowStock: isLowStock,
        deltaVaccinated: vacc - prevVacc,
        deltaLineList: ll - prevLl,
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
    if (targetStateId) txQuery = txQuery.eq('state_id', targetStateId);
    const { data: rawTransactions, error: tErr } = await txQuery;
    if (tErr) throw tErr;
    const allTransactions = rawTransactions || [];
    
    const tx = allTransactions;

    // Helper to get latest month end balance
    const getMonthEnd = (level, filterFn = () => true) => {
      const balances = tx.filter(t => t.transaction_type === 'MONTH_END_BALANCE' && String(t.level) === String(level) && filterFn(t));
      balances.sort((a, b) => new Date(b.balance_month).getTime() - new Date(a.balance_month).getTime());
      return balances.length > 0 ? Number(balances[0].quantity_doses) : 0;
    };

    // State Calculations
    const stateReceived = tx.filter(t => t.transaction_type === 'RECEIVED' && String(t.level) === '1').reduce((sum, t) => sum + Number(t.quantity_doses), 0);
    const stateIssued = tx.filter(t => t.transaction_type === 'ISSUED' && String(t.level) === '1').reduce((sum, t) => sum + Number(t.quantity_doses), 0);
    const stateStock = stateReceived - stateIssued;
    const stateMonthEnd = getMonthEnd('1');
    const stateVWF = (stateIssued + stateStock) > 0 ? (stateReceived / (stateIssued + stateStock)) : 0;

    // District Calculations
    const distReceived = tx.filter(t => t.transaction_type === 'RECEIVED' && String(t.level) === '2').reduce((sum, t) => sum + Number(t.quantity_doses), 0);
    const distIssued = tx.filter(t => t.transaction_type === 'ISSUED' && String(t.level) === '2').reduce((sum, t) => sum + Number(t.quantity_doses), 0);
    const distStock = distReceived - distIssued;
    const distMonthEnd = getMonthEnd('2');
    const distVWF = (distIssued + distStock) > 0 ? (distReceived / (distIssued + distStock)) : 0;

    // Block Calculations
    const blockReceived = tx.filter(t => t.transaction_type === 'RECEIVED' && String(t.level) === '3').reduce((sum, t) => sum + Number(t.quantity_doses), 0);
    
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

    const utilization = distIssued > 0 ? (blockVaccinated / distIssued) * 100 : 0;

    // District Utilization (for map & ranking)
    const districtStats = {};
    Object.values(latestReportsMap).forEach(m => {
      const r = m.latest;
      const prevR = m.prev;
      const dId = r.blocks?.district_id;
      if (dId) {
        if (!districtStats[dId]) districtStats[dId] = { vaccinated: 0, issued: 0, deltaVaccinated: 0 };
        const vacc = Number(r.beneficiaries_vaccinated) || 0;
        const prevVacc = Number(prevR?.beneficiaries_vaccinated) || 0;
        districtStats[dId].vaccinated += vacc;
        districtStats[dId].deltaVaccinated += (vacc - prevVacc);
      }
    });

    tx.filter(t => t.transaction_type === 'ISSUED' && String(t.level) === '2').forEach(t => {
       const dId = t.district_id;
       if (dId) {
         if (!districtStats[dId]) districtStats[dId] = { vaccinated: 0, issued: 0, deltaVaccinated: 0 };
         districtStats[dId].issued += Number(t.quantity_doses);
       }
    });

    let dq = supabase.from('districts').select('id, name, state_id').eq('is_active', true);
    if (targetStateId) dq = dq.eq('state_id', targetStateId);
    const allDistricts = (await dq).data || [];
    
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

    let bq = supabase.from('blocks').select('id, name, is_urban, district_id, districts!inner(name, state_id)').eq('is_active', true);
    if (targetStateId) bq = bq.eq('districts.state_id', targetStateId);
    const allBlocks = (await bq).data || [];

    const districtLowStock = {};

    const blockUtilization = allBlocks.map(b => {
      const bId = b.id;
      const stat = blockStats[bId] || { vaccinated: 0, received: 0, deltaVaccinated: 0 };
      const blkName = b.name || 'Unknown';
      const distName = b.districts?.name || 'Unknown';
      const utilPct = stat.received > 0 ? (stat.vaccinated / stat.received) * 100 : 0;
      
      const prof = profMap[bId];
      const target = prof?.initial_hpv_target || (prof?.base_population ? Math.round(prof.base_population * 0.01) : 0);
      const stockBalance = stat.received - stat.vaccinated;
      const isLowStock = target > 0 && stockBalance < (target * 0.25);
      
      if (isLowStock) {
        districtLowStock[b.district_id] = true;
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
        utilizationPct: parseFloat(utilPct.toFixed(1))
      };
    }).sort((a, b) => b.utilizationPct - a.utilizationPct);
    
    const districtUtilization = allDistricts.map(d => {
      const dId = d.id;
      const stat = districtStats[dId] || { vaccinated: 0, issued: 0, deltaVaccinated: 0 };
      const distName = d.name || 'Unknown';
      const utilPct = stat.issued > 0 ? (stat.vaccinated / stat.issued) * 100 : 0;
      return {
        district: distName,
        district_id: dId,
        vaccinated: stat.vaccinated,
        issued: stat.issued,
        deltaVaccinated: stat.deltaVaccinated,
        hasLowStockBlock: districtLowStock[dId] || false,
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

    const { data, error } = await query;
    if (error) throw error;
    
    const formatted = data.map(f => {
      let locationPrefix = '';
      if (String(f.unit_level) === '1') locationPrefix = f.states?.name || '';
      else if (String(f.unit_level) === '2') locationPrefix = f.districts?.name || '';
      else if (String(f.unit_level) === '3') locationPrefix = (f.districts?.name ? f.districts.name + ' - ' : '') + (f.blocks?.name || '');
      
      return {
        ...f,
        display_name: locationPrefix ? `${locationPrefix} - ${f.facility_name}` : f.facility_name
      };
    });

    res.json(formatted);
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.post('/api/vaccine/stock/receive', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN' && req.user.role !== 'ADMIN') return res.status(403).json({ error: 'Unauthorized' });
    // Assuming ADMIN means State Admin if they don't have district_id.
    // If they have district_id, they shouldn't be calling this.
    if (req.user.district_id) return res.status(403).json({ error: 'District Admin cannot manually receive stock' });

    const { date, quantity, notes } = req.body;
    if (!date || isNaN(Number(quantity)) || Number(quantity) <= 0) return res.status(400).json({ error: 'Invalid input' });

    const { data, error } = await supabase.from('vaccine_stock_transactions').insert([{
      vaccine: 'HPV Vaccine',
      level: 1,
      state_id: req.user.state_id,
      transaction_type: 'RECEIVED',
      transaction_date: date,
      quantity_doses: Number(quantity),
      notes: notes || null,
      created_by: req.user.id
    }]).select();

    if (error) throw error;
    res.json({ success: true, transaction: data[0] });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.post('/api/vaccine/stock/issue', authenticateToken, async (req, res) => {
  try {
    const { date, quantity, destination_level, destination_facility_id, notes } = req.body;
    if (!date || isNaN(Number(quantity)) || Number(quantity) <= 0 || !destination_level || !destination_facility_id) {
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

    // Check available stock at current level
    let txQuery = supabase.from('vaccine_stock_transactions').select('transaction_type, quantity_doses').eq('level', currentLevel);
    if (req.user.state_id) txQuery = txQuery.eq('state_id', req.user.state_id);
    if (isDistrictAdmin) txQuery = txQuery.eq('district_id', req.user.district_id);
    
    const { data: existingTx, error: txErr } = await txQuery;
    if (txErr) throw txErr;

    const received = existingTx.filter(t => t.transaction_type === 'RECEIVED').reduce((s, t) => s + Number(t.quantity_doses), 0);
    const issued = existingTx.filter(t => t.transaction_type === 'ISSUED').reduce((s, t) => s + Number(t.quantity_doses), 0);
    const available = received - issued;

    if (qty > available) {
      return res.status(400).json({ error: `Insufficient HPV vaccine stock available for this issue. Available: ${available}` });
    }

    // Insert ISSUE transaction
    const { data: issueTx, error: issueErr } = await supabase.from('vaccine_stock_transactions').insert([{
      vaccine: 'HPV Vaccine',
      level: currentLevel,
      state_id: req.user.state_id,
      district_id: req.user.district_id || null,
      transaction_type: 'ISSUED',
      transaction_date: date,
      quantity_doses: qty,
      destination_level: destLvl,
      destination_facility_id: destination_facility_id,
      notes: notes || null,
      created_by: req.user.id
    }]).select().single();

    if (issueErr) throw issueErr;

    // Insert downstream RECEIVED transaction
    const { error: recvErr } = await supabase.from('vaccine_stock_transactions').insert([{
      vaccine: 'HPV Vaccine',
      level: destLvl,
      state_id: destFacility.state_id,
      district_id: destFacility.district_id,
      block_id: destFacility.block_id,
      facility_id: destFacility.id,
      transaction_type: 'RECEIVED',
      transaction_date: date,
      quantity_doses: qty,
      source_level: currentLevel,
      source_transaction_id: issueTx.id,
      created_by: req.user.id
    }]);

    if (recvErr) {
       console.error("Failed to create downstream receive record:", recvErr);
       // We should ideally rollback, but since Supabase REST API doesn't support transactions easily, we log it.
       return res.status(500).json({ error: 'Issue recorded, but downstream receipt failed.' });
    }

    res.json({ success: true, transaction: issueTx });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.post('/api/vaccine/stock/month-end', authenticateToken, async (req, res) => {
  try {
    const { month, quantity, reportingPersonName, reportingPersonMobile, notes } = req.body;
    if (!month || isNaN(Number(quantity)) || Number(quantity) < 0 || !reportingPersonName || !reportingPersonMobile) {
      return res.status(400).json({ error: 'Invalid input' });
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

    const { data, error } = await supabase.from('vaccine_stock_transactions').insert([{
      vaccine: 'HPV Vaccine',
      level: currentLevel,
      state_id: req.user.state_id,
      district_id: req.user.district_id || null,
      transaction_type: 'MONTH_END_BALANCE',
      balance_month: month + '-01',
      quantity_doses: Number(quantity),
      reporting_person_name: reportingPersonName,
      reporting_person_mobile: reportingPersonMobile,
      notes: notes || null,
      created_by: req.user.id
    }]).select();

    if (error) throw error;
    res.json({ success: true, transaction: data[0] });
  } catch (err) { res.status(500).json({ error: err.message, stack: err.stack, details: JSON.stringify(err) }); }
});

app.get('/api/vaccine/stock', authenticateToken, async (req, res) => {
  try {
     const currentLevel = req.user.district_id ? 2 : 1;
     let txQuery = supabase.from('vaccine_stock_transactions').select('*, vaccine_ccp(facility_name)').eq('level', currentLevel).order('created_at', { ascending: false }).limit(50);
     if (req.user.state_id) txQuery = txQuery.eq('state_id', req.user.state_id);
     if (req.user.district_id) txQuery = txQuery.eq('district_id', req.user.district_id);

     const { data, error } = await txQuery;
     if (error) throw error;
     res.json(data);
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

app.get('/api/admin/reports/generate', authenticateToken, async (req, res) => {
  try {
        const { date, districtId, blockId, divisionId, level = 'BLOCK' } = req.query;
    const reportDate = date || new Date().toISOString().split('T')[0];
    if (!useSupabase) return res.json({ rows: [] });

    // 1. Fetch blocks (no profile join — avoids Supabase returning empty arrays)
    const targetStateId = req.user.role === 'ADMIN' ? req.user.state_id : (req.query.state_id || null);

    let bQuery = supabase
      .from('blocks')
      .select(`
        id, name, lgd_code, district_id,
        districts!inner(id, name, lgd_code, state_id, division_id, divisions(name))
      `)
      .eq('is_active', true)
      .order('name');
      
    if (targetStateId) {
      bQuery = bQuery.eq('districts.state_id', targetStateId);
    }
    
        if (districtId && districtId !== 'ALL') bQuery = bQuery.eq('district_id', districtId);
    if (divisionId && divisionId !== 'ALL') bQuery = bQuery.eq('districts.division_id', divisionId);
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
            last_reporting_date: '—',
            has_report: false
          };
        }
        const g = divGroup[divId];
        g.population += b.population;
        g.hpv_target += b.hpv_target;
        if (b.has_report) {
          g.line_list_received += b.line_list_received;
          g.beneficiaries_vaccinated += b.beneficiaries_vaccinated;
          g.has_report = true;
          g.last_reporting_date = reportDate;
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
    else return res.status(400).json({ error: 'Invalid table type' });

    if (!useSupabase) {
       return res.json(store[tableName] || []);
    }

    let query = supabase.from(tableName).select('*').limit(100000);
    if (table === 'population') {
      query = supabase.from('block_reporting_profiles').select('*, blocks(name, districts(name, states(name)))').limit(100000);
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
      const stateName = (row.State || row.state || '').trim().toLowerCase();
      const distName = (row.District || row.district || '').trim().toLowerCase();
      const blockName = (row.BlockOrCity || row.blockorcity || row.Block || row.block || row.City || row.city || '').trim().toLowerCase();
      
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

      const lineList = parseInt(llStr, 10);
      const vaccinated = parseInt(vaccStr, 10);

      if (!stateName || !distName || !blockName || isNaN(lineList) || isNaN(vaccinated)) {
        errors.push(`Row ${i + 1}: Missing or invalid fields.`);
        continue;
      }

      const blockId = locMap.get(`${stateName}|${distName}|${blockName}`);
      if (!blockId) {
        errors.push(`Row ${i + 1}: Location not found (${stateName} > ${distName} > ${blockName}).`);
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
      let block = allBlocks.find(b => String(b.lgd_code) === blockLgd && blockLgd) || allBlocks.find(b => b.name.toLowerCase() === row.blockorcityname.trim().toLowerCase() && b.district_id === district.id);
      
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
      const popStr = row.population || row.Population;
      const basePop = parseInt(popStr, 10);
      let profile = allProfiles.find(p => p.block_id === block.id);
      
      if (!isNaN(basePop) && basePop > 0) {
        if (!profile || !profile.base_population) {
          const target = Math.round(basePop * 0.01);
          if (profile) {
            await supabase.from('block_reporting_profiles').update({ base_population: basePop, initial_hpv_target: target }).eq('id', profile.id);
            profile.base_population = basePop;
            details.push(`Updated population for ${block.name}`);
          } else {
            const profId = `prof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
            const { data: nP } = await supabase.from('block_reporting_profiles').insert([{ id: profId, block_id: block.id, base_population: basePop, population_base_date: today, initial_hpv_target: target }]).select().single();
            if (nP) { profile = nP; allProfiles.push(profile); details.push(`Created population for ${block.name}`); }
          }
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
      
      return {
        ...flat,
        population: prof.base_population || 0,
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
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });
    if (!useSupabase) return res.status(500).json({ error: 'Supabase required for this complex operation' });

    let allStates = (await supabase.from('states').select('id, lgd_code')).data || [];
    let allDistricts = (await supabase.from('districts').select('id, lgd_code')).data || [];
    let allBlocks = (await supabase.from('blocks').select('id, lgd_code')).data || [];

    let successCount = 0;
    let errors = [];
    let details = [];

    const CHUNK_SIZE = 50;
    for (let i = 0; i < data.length; i += CHUNK_SIZE) {
      const chunk = data.slice(i, i + CHUNK_SIZE);
      const toInsert = [];

      for (const row of chunk) {
        const stateLgd = Number(row['State Code']);
        const districtLgd = Number(row['District Code']);
        const blockLgd = Number(row['Block / City Code']);

        const stateId = allStates.find(s => s.lgd_code === stateLgd)?.id || null;
        const districtId = allDistricts.find(d => d.lgd_code === districtLgd)?.id || null;
        const blockId = allBlocks.find(b => b.lgd_code === blockLgd)?.id || null;

        if (!row['Facility Name']) {
           errors.push(`Row missing Facility Name`);
           continue;
        }

        toInsert.push({
          state_id: stateId,
          district_id: districtId,
          block_id: blockId,
          lgd_state_code: stateLgd || null,
          lgd_district_code: districtLgd || null,
          lgd_block_code: blockLgd || null,
          facility_name: row['Facility Name'],
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
          name_of_unit_incharge: row['Name of UNIT Incharge'] || null,
          status: row['Status'] || 'Active'
        });
      }

      if (toInsert.length > 0) {
        const { error } = await supabase.from('vaccine_ccp').insert(toInsert);
        if (error) {
          errors.push(`Error inserting batch: ${error.message}`);
        } else {
          successCount += toInsert.length;
          details.push(`Inserted ${toInsert.length} facilities successfully in a batch`);
        }
      }
    }

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

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 HPV Reporting Portal API on port ${PORT}`);
  console.log(`📊 DB: ${useSupabase ? 'Supabase JS (HTTPS)' : 'JSON fallback'}`);
});


export default app;
