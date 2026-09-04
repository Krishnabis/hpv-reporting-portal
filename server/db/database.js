import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Supabase JS Client (HTTPS — works on Vercel) ─────────────────────────────
export const SUPABASE_URL = process.env.SUPABASE_URL;
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
export const useSupabase = Boolean(SUPABASE_URL && SUPABASE_SERVICE_KEY);

export let supabase = null;
if (useSupabase) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  console.log('⚡ Using Supabase JS client (HTTPS)');
} else {
  console.warn('⚠️  SUPABASE_URL / SUPABASE_SERVICE_KEY not set — using JSON fallback');
}

// ─── JSON File Fallback (local dev) ───────────────────────────────────────────
const storePath = path.join(__dirname, '../../hpv_store.json');
export let store = {
  states: [], districts: [], blocks: [], block_reporting_profiles: [],
  daily_reports: [], admin_users: [], settings: [], audit_logs: []
};

if (!useSupabase && fs.existsSync(storePath)) {
  try { store = JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch (e) { console.error('JSON store error:', e); }
}

export function saveStore() {
  if (!useSupabase) {
    try { fs.writeFileSync(storePath, JSON.stringify(store, null, 2)); } catch (e) { console.error(e); }
  }
}

export default { supabase, useSupabase, store, saveStore };
