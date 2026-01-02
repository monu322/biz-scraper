-- Add additional business details columns to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS opening_hours JSONB;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS services TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS products TEXT[];
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS price_range VARCHAR(50);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS place_id VARCHAR(255);
