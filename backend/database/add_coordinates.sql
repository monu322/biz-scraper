-- Add latitude and longitude columns to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);

-- Create index for coordinate queries
CREATE INDEX IF NOT EXISTS idx_contacts_coordinates ON contacts(latitude, longitude);
