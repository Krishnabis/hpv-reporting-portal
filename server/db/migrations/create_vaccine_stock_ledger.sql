-- Migration: Create vaccine_stock_ledger table
-- Run this script in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.vaccine_stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporting_month VARCHAR(7) NOT NULL, -- Format: YYYY-MM
    district_id INT NOT NULL REFERENCES public.districts(id) ON DELETE CASCADE,
    block_id INT REFERENCES public.blocks(id) ON DELETE CASCADE, -- NULL if entity_type is CCL_LEVEL_2_DISTRICT_STORE
    ccl_id INT REFERENCES public.vaccine_ccp(id) ON DELETE SET NULL, -- specific CCL facility link if applicable
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN ('BLOCK', 'CCL_LEVEL_2_DISTRICT_STORE')),
    annual_requirement INT NOT NULL DEFAULT 0,
    pre_month_reporting_percentage FLOAT NOT NULL DEFAULT 0,
    pre_month_end_stock_reported INT,
    opening_stock INT NOT NULL DEFAULT 0,
    vaccine_received_current_month INT NOT NULL DEFAULT 0,
    vaccinations_current_month INT NOT NULL DEFAULT 0,
    vaccine_consumed_wastage_factor INT NOT NULL DEFAULT 0,
    closing_stock_estimated INT NOT NULL DEFAULT 0,
    estimation_model VARCHAR(50) NOT NULL CHECK (estimation_model IN ('Reported Value Method', 'Crude Method')),
    stock_availability_percentage FLOAT NOT NULL DEFAULT 0,
    action VARCHAR(50) NOT NULL CHECK (action IN ('Replenish Now', 'Re-order Stock', '—', 'No Action')),
    reported_month_end_stock_current_month INT,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint for Block
CREATE UNIQUE INDEX IF NOT EXISTS idx_vaccine_stock_ledger_block_month 
ON public.vaccine_stock_ledger (block_id, reporting_month)
WHERE entity_type = 'BLOCK';

-- Unique constraint for CCL Level-2 District Store
CREATE UNIQUE INDEX IF NOT EXISTS idx_vaccine_stock_ledger_district_month 
ON public.vaccine_stock_ledger (district_id, reporting_month)
WHERE entity_type = 'CCL_LEVEL_2_DISTRICT_STORE';

-- Enable Row Level Security if needed, or open it up for authenticated admin access
-- ALTER TABLE public.vaccine_stock_ledger ENABLE ROW LEVEL SECURITY;
