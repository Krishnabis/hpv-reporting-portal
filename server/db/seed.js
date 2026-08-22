import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function hashPassword(password) {
  return crypto.pbkdf2Sync(password, 'hpv_salt_2026', 1000, 64, 'sha512').toString('hex');
}

async function seed() {
  console.log('🌱 Starting HPV Reporting Portal Database Seed...');

  const csvPath = path.join(__dirname, '../../HPV Reporting Tool.xlsx - Block Data.csv');
  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV File not found at ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf8');
  const lines = csvContent.split('\n').filter(line => line.trim().length > 0);
  const dataRows = lines.slice(1);

  const insertStateStmt = db.prepare(`
    INSERT INTO states (lgd_code, name, code)
    VALUES (?, ?, ?)
  `);

  const insertDistrictStmt = db.prepare(`
    INSERT INTO districts (state_id, lgd_code, name, code)
    VALUES (?, ?, ?, ?)
  `);

  const insertBlockStmt = db.prepare(`
    INSERT INTO blocks (district_id, lgd_code, name, code)
    VALUES (?, ?, ?, ?)
  `);

  const stateMap = new Map();
  const districtMap = new Map();

  let blockCount = 0;

  db.transaction(() => {
    for (const row of dataRows) {
      const parts = row.split(',').map(s => s.trim());
      if (parts.length < 7) continue;

      const stateLgd = parseInt(parts[1], 10);
      const stateName = parts[2];
      const distLgd = parseInt(parts[3], 10);
      const distName = parts[4];
      const blockLgd = parseInt(parts[5], 10);
      const blockName = parts[6];

      // Insert/Get State
      let stateId = stateMap.get(stateLgd);
      if (!stateId) {
        insertStateStmt.run(stateLgd, stateName, 'UK');
        const stateRows = db.prepare('SELECT * FROM states WHERE lgd_code = ?').all(stateLgd);
        stateId = stateRows[0]?.id || 1;
        stateMap.set(stateLgd, stateId);
      }

      // Insert/Get District
      let districtId = districtMap.get(distLgd);
      if (!districtId) {
        insertDistrictStmt.run(stateId, distLgd, distName, distName.substring(0, 3).toUpperCase());
        const distRows = db.prepare('SELECT * FROM districts WHERE lgd_code = ?').all(distLgd);
        districtId = distRows[0]?.id || (districtMap.size + 1);
        districtMap.set(distLgd, districtId);
      }

      // Insert Block
      insertBlockStmt.run(districtId, blockLgd, blockName, blockName.substring(0, 3).toUpperCase());
      blockCount++;
    }

    // Seed Settings
    const insertSettingStmt = db.prepare(`
      INSERT INTO settings (id, key, value, description)
      VALUES (?, ?, ?, ?)
    `);

    const settingsList = [
      ['set-1', 'monthly_population_growth', '0.0008', 'Monthly population growth rate (0.08% per month)'],
      ['set-2', 'hpv_target_percentage', '0.01', 'Target HPV beneficiary percentage of total population (1.00%)'],
      ['set-3', 'reporting_enabled', 'true', 'Global flag to enable block reporting'],
      ['set-4', 'allow_previous_date_entry', 'true', 'Allow reporting for historical dates'],
      ['set-5', 'organization_name', 'HPV KAVACH', 'System organization name'],
      ['set-6', 'portal_title', 'HPV KAVACH', 'Header display title'],
      ['set-7', 'default_state', 'Uttarakhand', 'Default state selected in reports']
    ];

    for (const [id, key, val, desc] of settingsList) {
      insertSettingStmt.run(id, key, val, desc);
    }

    // Seed Admin User (UKHPV2026 / UKHPV2026)
    const hash1 = hashPassword('UKHPV2026');

    // Seed Super Admin User (superadmin / superadmin123)
    const hash2 = hashPassword('superadmin123');

    const insertAdminStmt = db.prepare(`
      INSERT INTO admin_users (id, username, password_hash, name, role)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertAdminStmt.run('usr-admin-1', 'UKHPV2026', hash1, 'State HPV Administrator', 'ADMIN');
    insertAdminStmt.run('usr-superadmin-1', 'superadmin', hash2, 'Super Administrator', 'SUPER_ADMIN');

    // Seed sample reporting profiles & daily cumulative snapshots for demo
    const blocks = db.prepare('SELECT * FROM blocks').all().slice(0, 15);
    const today = new Date().toISOString().split('T')[0];
    const prevDate = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    const insertProfile = db.prepare(`
      INSERT INTO block_reporting_profiles (id, block_id, base_population, population_base_date, initial_hpv_target)
      VALUES (?, ?, ?, ?, ?)
    `);

    const insertDaily = db.prepare(`
      INSERT INTO daily_reports (id, block_id, reporting_date, line_list_count, beneficiaries_vaccinated, submitted_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    let profileIdx = 1;
    for (const block of blocks) {
      const basePop = Math.floor(65000 + Math.random() * 70000);
      const target = Math.round(basePop * 0.01);
      const lineList = Math.round(target * (0.75 + Math.random() * 0.2));
      const vaccinated = Math.round(lineList * (0.65 + Math.random() * 0.25));

      insertProfile.run(`prof-${profileIdx}`, block.id, basePop, '2026-01-01', target);
      insertDaily.run(`rep-${profileIdx}-1`, block.id, prevDate, Math.round(lineList * 0.88), Math.round(vaccinated * 0.8), 'Block Operator');
      insertDaily.run(`rep-${profileIdx}-2`, block.id, today, lineList, vaccinated, 'Block Operator');
      profileIdx++;
    }
  })();

  console.log(`✅ Database Seed Complete!`);
  console.log(`📍 States Seeded: ${stateMap.size}`);
  console.log(`📍 Districts Seeded: ${districtMap.size}`);
  console.log(`📍 Blocks Seeded: ${blockCount}`);
  console.log(`🔑 Admin Credentials: Username=UKHPV2026, Password=UKHPV2026`);
  console.log(`🔑 Super Admin Credentials: Username=superadmin, Password=superadmin123`);
}

seed().catch(err => {
  console.error('❌ Seed Error:', err);
  process.exit(1);
});
