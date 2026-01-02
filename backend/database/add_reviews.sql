-- Add reviews column to contacts table
-- This stores up to 50 reviews per business as JSONB

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reviews JSONB;

-- Add comment for documentation
COMMENT ON COLUMN contacts.reviews IS 'Array of reviews (first 50) with author, rating, text, date, response, likes';
