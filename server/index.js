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
  const dist = b.districts || {};
  const reg = dist.regions || {};
  const st = reg.states || dist.states || {}; // Fallback in case old relation is kept
  const c = st.countries || {};
  
  return {
    id: b.id, district_id: b.district_id, lgd_code: b.lgd_code,
    name: b.name, code: b.code, is_active: b.is_active, is_urban: Boolean(b.is_urban), area_type: b.area_type || (b.is_urban ? 'City' : 'Block'),
    district_name: dist.name ?? '',
    district_lgd_code: dist.lgd_code ?? 0,
    region_name: reg.name ?? '',
    region_lgd_code: reg.lgd_code ?? '',
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

app.get('/api/admin/population', async (req, res) => {
  try {
    let blockData = [];
    if (useSupabase) {
      const { data: blocks } = await supabase.from('blocks').select('*');
      const { data: districts } = await supabase.from('districts').select('*');
      const { data: states } = await supabase.from('states').select('*');
      const { data: profiles } = await supabase.from('block_reporting_profiles').select('*');
      blockData = blocks.map(b => {
        const dist = districts.find(d => d.id === b.district_id) || {};
        const st = states.find(s => s.id === dist.state_id) || {};
        const prof = profiles.find(p => p.block_id === b.id) || null;
        return {
          id: b.id,
          name: b.name,
          is_urban: Boolean(b.is_urban),
          district_name: dist.name,
          state_name: st.name,
          profile: prof
        };
      });
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
          state_name: st.name,
          profile: prof
        };
      });
    }
    res.json(blockData);
  } catch (err) { res.status(500).json({ error: err.message }); }
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/locations/regions', async (req, res) => {
  try {
    if (useSupabase) {
      const { data, error } = await supabase.from('regions').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      return res.json(data);
    }
    res.json([]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

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
        .select('*, districts(name, lgd_code, regions(name, lgd_code, states(name, lgd_code, countries(name, lgd_code))))')
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
      const { data, error } = await supabase.from('admin_users').select('id, username, name, role, is_active, created_at, last_login_at').order('created_at', { ascending: false });
      if (error) throw error;
      return res.json(data);
    }
    res.json(store.admin_users.map(u => ({ id: u.id, username: u.username, name: u.name, role: u.role, is_active: u.is_active, created_at: u.created_at })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create new admin user
app.post('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const { username, name, password, role = 'ADMIN' } = req.body;
    if (!username || !name || !password) return res.status(400).json({ error: 'Username, name and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

    const newId = `admin-${Date.now()}`;
    const passwordHash = hashPassword(password);

    if (useSupabase) {
      // Check if username already exists
      const { data: existing } = await supabase.from('admin_users').select('id').eq('username', username).maybeSingle();
      if (existing) return res.status(409).json({ error: 'Username already exists' });

      const { error } = await supabase.from('admin_users').insert([{
        id: newId, username, name, password_hash: passwordHash, role, is_active: true
      }]);
      if (error) throw error;
    } else {
      if (store.admin_users.find(u => u.username === username)) return res.status(409).json({ error: 'Username already exists' });
      store.admin_users.push({ id: newId, username, name, password_hash: passwordHash, role, is_active: true, created_at: new Date().toISOString() });
      saveStore();
    }

    await logAudit(req.user.id, 'CREATE_ADMIN', 'admin_user', newId);
    res.json({ message: 'Admin user created successfully', id: newId });
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
    if (!useSupabase) return res.json({ total_blocks: 0, reporting_today: 0, total_line_list: 0, total_vaccinated: 0, overall_coverage_pct: 0, overall_linelist_pct: 0, district_chart_data: [], latest_reporting_date: null });

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
    let totalPopulation = 0;

    const districtStats = {};

    (blocks || []).forEach(b => {
      const dName = b.districts?.name || 'Unknown';
      if (!districtStats[dName]) districtStats[dName] = { name: dName, vaccinated: 0, lineList: 0, target: 0 };

      const prof = profileMap[b.id];
      // Target is stored directly OR calculated as 1% of base_population
      const target = prof?.initial_hpv_target || (prof?.base_population ? Math.round(prof.base_population * 0.01) : 0);
      const pop = prof?.base_population || 0;
      
      totalTarget += target;
      totalPopulation += pop;
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
      total_population: totalPopulation,
      overall_coverage_pct: totalTarget > 0 ? parseFloat(((totalVaccinated / totalTarget) * 100).toFixed(1)) : 0,
      overall_linelist_pct: totalTarget > 0 ? parseFloat(((totalLineList / totalTarget) * 100).toFixed(1)) : 0,
      district_chart_data,
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

app.get('/api/admin/trend', authenticateToken, async (req, res) => {
  try {
    const { level = 'STATE', districtId, blockId } = req.query;
    if (!useSupabase) return res.json({ profile: { base_population: 0 }, reports: [] });

    // 1. Fetch blocks
    let bQuery = supabase.from('blocks').select('id, name').eq('is_active', true);
    if (level === 'DISTRICT' && districtId && districtId !== 'ALL') {
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

app.post('/api/superadmin/upload-population', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });

    let blocks = store.blocks, districts = store.districts, states = store.states, profiles = store.block_reporting_profiles;
    if (useSupabase) {
      blocks = (await supabase.from('blocks').select('*')).data || [];
      districts = (await supabase.from('districts').select('*')).data || [];
      states = (await supabase.from('states').select('*')).data || [];
      profiles = (await supabase.from('block_reporting_profiles').select('*')).data || [];
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
      blocks = (await supabase.from('blocks').select('*')).data || [];
      districts = (await supabase.from('districts').select('*')).data || [];
      states = (await supabase.from('states').select('*')).data || [];
      dailyReports = (await supabase.from('daily_reports').select('*')).data || [];
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
// ─── Super Admin CSV Uploads: Locations ──────────────────────────────────────────

app.post('/api/superadmin/upload-locations', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { data } = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Expected an array of records' });
    if (!useSupabase) return res.status(500).json({ error: 'Supabase required for this complex operation' });

    let allCountries = (await supabase.from('countries').select('*')).data || [];
    let allStates = (await supabase.from('states').select('*')).data || [];
    let allRegions = (await supabase.from('regions').select('*')).data || [];
    let allDistricts = (await supabase.from('districts').select('*')).data || [];
    let allBlocks = (await supabase.from('blocks').select('*')).data || [];
    let allProfiles = (await supabase.from('block_reporting_profiles').select('*')).data || [];

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
      let state = allStates.find(s => s.lgd_code === stateLgd && stateLgd) || allStates.find(s => s.name.toLowerCase() === row.statename.trim().toLowerCase() && s.country_id === country.id);
      if (!state) {
        const { data: nS, error: eS } = await supabase.from('states').insert({ country_id: country.id, lgd_code: stateLgd, code: stateLgd, name: row.statename.trim() }).select().single();
        if (eS) { errors.push(`Row ${i + 1}: Error creating State - ${eS.message}`); continue; }
        state = nS; allStates.push(state);
      }

      // Region
      let regionCode = String(row.regioncode || '').trim();
      let region = allRegions.find(r => r.lgd_code === regionCode && regionCode) || allRegions.find(r => r.name.toLowerCase() === row.regionname?.trim().toLowerCase() && r.state_id === state.id);
      if (!region) {
        const { data: nR, error: eR } = await supabase.from('regions').insert({ state_id: state.id, lgd_code: regionCode, code: regionCode, name: row.regionname?.trim() || 'Default Region' }).select().single();
        if (eR) { errors.push(`Row ${i + 1}: Error creating Region - ${eR.message}`); continue; }
        region = nR; allRegions.push(region);
      }

      // District
      let distLgd = String(row.districtlgdcode || '').trim();
      let district = allDistricts.find(d => d.lgd_code === distLgd && distLgd) || allDistricts.find(d => d.name.toLowerCase() === row.districtname.trim().toLowerCase() && d.region_id === region.id);
      if (!district) {
        const { data: nD, error: eD } = await supabase.from('districts').insert({ region_id: region.id, state_id: state.id, lgd_code: distLgd, name: row.districtname.trim() }).select().single();
        if (eD) { errors.push(`Row ${i + 1}: Error creating District - ${eD.message}`); continue; }
        district = nD; allDistricts.push(district);
      }

      // Block
      let blockLgd = String(row.blockorcitylgdcode || '').trim();
      let block = allBlocks.find(b => b.lgd_code === blockLgd && blockLgd) || allBlocks.find(b => b.name.toLowerCase() === row.blockorcityname.trim().toLowerCase() && b.district_id === district.id);
      if (!block) {
        const isUrban = row['areatype(blockorcity)']?.toLowerCase() === 'city';
        const { data: nB, error: eB } = await supabase.from('blocks').insert({ district_id: district.id, lgd_code: blockLgd, name: row.blockorcityname.trim(), is_urban: isUrban, area_type: row['areatype(blockorcity)'] }).select().single();
        if (eB) { errors.push(`Row ${i + 1}: Error creating Block - ${eB.message}`); continue; }
        block = nB; allBlocks.push(block);
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
    const { data: blocks, error: bErr } = await supabase.from('blocks').select('*, districts(name, lgd_code, regions(name, lgd_code, states(name, lgd_code, countries(name, lgd_code))))').eq('is_active', true);
    if (bErr) throw bErr;
    
    // Fetch profiles
    const { data: profiles } = await supabase.from('block_reporting_profiles').select('*');
    
    // Fetch reports
    const { data: reports } = await supabase.from('daily_reports').select('*');
    
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/locations/:type', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { type } = req.params;
    const tableMap = { country: 'countries', state: 'states', region: 'regions', district: 'districts', block: 'blocks' };
    const table = tableMap[type];
    if (!table) return res.status(400).json({ error: 'Invalid location type' });
    
    if (!useSupabase) return res.status(500).json({ error: 'Requires Supabase' });

    const { data, error } = await supabase.from(table).insert([req.body]).select().single();
    if (error) throw error;
    
    await logAudit(req.user.id, `CREATE_LOCATION_${type.toUpperCase()}`, table, data.id);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/locations/:type/:id', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'Super Admin only' });
    const { type, id } = req.params;
    const tableMap = { country: 'countries', state: 'states', region: 'regions', district: 'districts', block: 'blocks' };
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`🚀 HPV Reporting Portal API on port ${PORT}`);
  console.log(`📊 DB: ${useSupabase ? 'Supabase JS (HTTPS)' : 'JSON fallback'}`);
});

export default app;
