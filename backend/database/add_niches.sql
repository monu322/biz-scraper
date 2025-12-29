-- Create niches table
CREATE TABLE IF NOT EXISTS niches (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    locations TEXT[] DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for niches
CREATE INDEX IF NOT EXISTS idx_niches_name ON niches(name);
CREATE INDEX IF NOT EXISTS idx_niches_created_at ON niches(created_at DESC);

-- Add niche_id column to contacts table
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS niche_id BIGINT REFERENCES niches(id) ON DELETE SET NULL;

-- Create index for niche_id in contacts
CREATE INDEX IF NOT EXISTS idx_contacts_niche_id ON contacts(niche_id);

-- Create trigger for updated_at on niches
DROP TRIGGER IF EXISTS update_niches_updated_at ON niches;
CREATE TRIGGER update_niches_updated_at
    BEFORE UPDATE ON niches
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
