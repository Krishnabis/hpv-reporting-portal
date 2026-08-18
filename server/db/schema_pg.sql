-- =============================================================
-- PostgreSQL Database Schema for Supabase / Railway Deployment
-- HPV Vaccination Reporting Portal
-- =============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. States Master Table (includes State LGD Code)
CREATE TABLE IF NOT EXISTS states (
  id SERIAL PRIMARY KEY,
  lgd_code INTEGER UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. Districts Master Table (includes District LGD Code)
CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  state_id INTEGER NOT NULL REFERENCES states(id) ON DELETE CASCADE,
  lgd_code INTEGER UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. Blocks Master Table (includes Block LGD Code)
CREATE TABLE IF NOT EXISTS blocks (
  id SERIAL PRIMARY KEY,
  district_id INTEGER NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
  lgd_code INTEGER UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Block Reporting Profiles (One-Time Baseline Setup)
CREATE TABLE IF NOT EXISTS block_reporting_profiles (
  id VARCHAR(255) PRIMARY KEY,
  block_id INTEGER UNIQUE NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  base_population INTEGER NOT NULL,
  population_base_date DATE NOT NULL,
  initial_hpv_target INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. Daily Reports Table (Cumulative Daily Snapshots)
CREATE TABLE IF NOT EXISTS daily_reports (
  id VARCHAR(255) PRIMARY KEY,
  block_id INTEGER NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  reporting_date DATE NOT NULL,
  line_list_count INTEGER NOT NULL,
  beneficiaries_vaccinated INTEGER NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  submitted_by VARCHAR(255),
  CONSTRAINT unique_block_date UNIQUE (block_id, reporting_date)
);

-- 6. Admin Users Table
CREATE TABLE IF NOT EXISTS admin_users (
  id VARCHAR(255) PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(100) DEFAULT 'SUPER_ADMIN',
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. System & Program Settings Table
CREATE TABLE IF NOT EXISTS settings (
  id VARCHAR(255) PRIMARY KEY,
  key VARCHAR(255) UNIQUE NOT NULL,
  value VARCHAR(255) NOT NULL,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(255)
);

-- 8. Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id VARCHAR(255) PRIMARY KEY,
  user_id VARCHAR(255),
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(255) NOT NULL,
  entity_id VARCHAR(255),
  old_value JSONB,
  new_value JSONB,
  ip_address VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for maximum query performance
CREATE INDEX IF NOT EXISTS idx_districts_state ON districts(state_id);
CREATE INDEX IF NOT EXISTS idx_blocks_district ON blocks(district_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_block_date ON daily_reports(block_id, reporting_date);
