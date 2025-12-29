-- Add unique constraints to prevent duplicates at database level
-- This provides a safety net even if application logic fails

-- Option 1: Unique constraint on phone (if available)
-- Businesses are uniquely identified by their phone number
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_phone_unique 
ON contacts(phone) 
WHERE phone IS NOT NULL;

-- Option 2: Unique constraint on name + address combination
-- For businesses without phone numbers
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_name_address_unique 
ON contacts(name, address) 
WHERE name IS NOT NULL AND address IS NOT NULL;

-- Note: These are partial unique indexes that only apply when the fields are NOT NULL
-- This allows multiple contacts with NULL phones or addresses while preventing duplicates
-- when those fields have values.
