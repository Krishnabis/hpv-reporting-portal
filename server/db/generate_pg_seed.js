import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'hpv_salt_2026', 1000, 64, 'sha512').toString('hex');
}

const csvPath = path.join(__dirname, '../../HPV Reporting Tool.xlsx - Block Data.csv');
const outputPath = path.join(__dirname, 'seed_pg.sql');

const csvContent = fs.readFileSync(csvPath, 'utf8');
const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
const dataRows = lines.slice(1);

const statesMap = new Map();
const districtsMap = new Map();
const blocksList = [];

for (const row of dataRows) {
  const parts = row.split(',').map(s => s.trim());
  if (parts.length < 7) continue;

  const stateLgd = parseInt(parts[1], 10);
  const stateName = parts[2].replace(/'/g, "''");
  const distLgd = parseInt(parts[3], 10);
  const distName = parts[4].replace(/'/g, "''");
  const blockLgd = parseInt(parts[5], 10);
  const blockName = parts[6].replace(/'/g, "''");

  if (!statesMap.has(stateLgd)) {
    statesMap.set(stateLgd, { lgd: stateLgd, name: stateName, code: 'UK' });
  }

  if (!districtsMap.has(distLgd)) {
    districtsMap.set(distLgd, { lgd: distLgd, stateLgd, name: distName, code: distName.substring(0, 3).toUpperCase() });
  }

  blocksList.push({ lgd: blockLgd, distLgd, name: blockName, code: blockName.substring(0, 3).toUpperCase() });
}

const adminPasswordHash = hashPassword('UKHPV2026');

let sql = `-- =============================================================
-- PostgreSQL Complete Seed Script for Supabase / Railway
-- HPV Vaccination Reporting Portal
-- =============================================================

-- 1. Seed States
INSERT INTO states (id, lgd_code, name, code) VALUES
(1, 5, 'Uttarakhand', 'UK')
ON CONFLICT (lgd_code) DO NOTHING;

-- 2. Seed Districts
INSERT INTO districts (state_id, lgd_code, name, code) VALUES
`;

const districtValues = Array.from(districtsMap.values()).map(d => 
  `(1, ${d.lgd}, '${d.name}', '${d.code}')`
).join(',\n');

sql += districtValues + `\nON CONFLICT (lgd_code) DO NOTHING;\n\n`;

sql += `-- 3. Seed Blocks (95 Blocks with LGD Codes)\n`;
sql += `INSERT INTO blocks (district_id, lgd_code, name, code) VALUES\n`;

const blockValues = blocksList.map(b => {
  return `((SELECT id FROM districts WHERE lgd_code = ${b.distLgd}), ${b.lgd}, '${b.name}', '${b.code}')`;
}).join(',\n');

sql += blockValues + `\nON CONFLICT (lgd_code) DO NOTHING;\n\n`;

sql += `-- 4. Seed Program Settings\n`;
sql += `INSERT INTO settings (id, key, value, description) VALUES
('set-1', 'monthly_population_growth', '0.0008', 'Monthly population growth rate (0.08% per month)'),
('set-2', 'hpv_target_percentage', '0.01', 'Target HPV beneficiary percentage of total population (1.00%)'),
('set-3', 'reporting_enabled', 'true', 'Global flag to enable block reporting'),
('set-4', 'allow_previous_date_entry', 'true', 'Allow reporting for historical dates'),
('set-5', 'organization_name', 'HPV KAVACH', 'System organization name'),
('set-6', 'portal_title', 'HPV KAVACH', 'Header display title'),
('set-7', 'default_state', 'Uttarakhand', 'Default state selected in reports')
ON CONFLICT (key) DO NOTHING;

-- 5. Seed Admin User (UKHPV2026 / UKHPV2026)
INSERT INTO admin_users (id, username, password_hash, name, role) VALUES
('usr-admin-1', 'UKHPV2026', '${adminPasswordHash}', 'State HPV Administrator', 'SUPER_ADMIN')
ON CONFLICT (username) DO NOTHING;
`;

fs.writeFileSync(outputPath, sql, 'utf8');
console.log(`✅ Generated PostgreSQL seed file at ${outputPath}`);
