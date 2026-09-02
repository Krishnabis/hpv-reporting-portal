-- Create vaccine_stock_ledger table
CREATE TABLE IF NOT EXISTS vaccine_stock_ledger (
    id SERIAL PRIMARY KEY,
    reporting_month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    district_id INT NOT NULL REFERENCES districts(id) ON DELETE CASCADE,
    block_id INT REFERENCES blocks(id) ON DELETE CASCADE,
    ccl_id VARCHAR(50),
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('BLOCK', 'CCL_LEVEL_2_DISTRICT_STORE')),
    annual_requirement INT NOT NULL DEFAULT 0,
    pre_month_reporting_percentage FLOAT NOT NULL DEFAULT 0,
    pre_month_reporting_count INT NOT NULL DEFAULT 0,
    pre_month_total_ccp INT NOT NULL DEFAULT 0,
    pre_month_end_stock_reported INT,
    opening_stock_crude_method INT NOT NULL DEFAULT 0,
    opening_stock INT NOT NULL DEFAULT 0,
    vaccine_received_current_month INT NOT NULL DEFAULT 0,
    vaccinations_current_month INT NOT NULL DEFAULT 0,
    vaccine_consumed_wastage_factor INT NOT NULL DEFAULT 0,
    closing_stock_estimated INT NOT NULL DEFAULT 0,
    estimation_model VARCHAR(50) NOT NULL CHECK (estimation_model IN ('Reported Value Method', 'Crude Method')),
    stock_availability_percentage FLOAT NOT NULL DEFAULT 0,
    action VARCHAR(50) NOT NULL CHECK (action IN ('Replenish Now', 'Re-order Stock', '—', 'No Action', 'Critical')),
    vaccine_received_last_12_months INT NOT NULL DEFAULT 0,
    vaccinations_last_12_months INT NOT NULL DEFAULT 0,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient querying by month and location
CREATE INDEX IF NOT EXISTS idx_vsl_reporting_month ON vaccine_stock_ledger(reporting_month);
CREATE INDEX IF NOT EXISTS idx_vsl_district_id ON vaccine_stock_ledger(district_id);
CREATE INDEX IF NOT EXISTS idx_vsl_block_id ON vaccine_stock_ledger(block_id);
