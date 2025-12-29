# Database Migrations

This directory contains SQL scripts for database schema and migrations.

## Files

### schema.sql
Initial database schema - creates the `contacts` table with all necessary columns, indexes, and triggers.

### add_unique_constraints.sql
Migration to add unique constraints for duplicate prevention.

## How to Apply Migrations

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open `add_unique_constraints.sql`
4. Copy and paste the SQL into the editor
5. Click **Run** to execute

### Option 2: Via Supabase CLI
```bash
# If you have Supabase CLI installed
supabase db push
```

### Option 3: Manually via psql
```bash
# Connect to your Supabase database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# Run the migration
\i backend/database/add_unique_constraints.sql
```

## What the Constraints Do

The unique constraints prevent duplicate contacts from being inserted:

1. **Phone-based uniqueness**: If a contact has a phone number, it must be unique
2. **Name+Address uniqueness**: If a contact has both name and address, this combination must be unique

These are **partial unique indexes**, meaning:
- They only enforce uniqueness when the fields are NOT NULL
- Multiple contacts can have NULL phones or addresses
- This is perfect for business data where not all fields are always available

## Testing the Constraints

After applying the migration, try scraping the same location twice:

```bash
# First scrape
POST /api/scrape
{
  "keyword": "hvac",
  "location": "London"
}
# Response: "Added 20 new contact(s)"

# Second scrape (same query)
POST /api/scrape
{
  "keyword": "hvac",
  "location": "London"
}
# Response: "Updated 20 existing contact(s) with latest data"
```

## How Deduplication Works

### Three Layers:

1. **Apify (Automatic)**
   - Deduplicates within each scrape run
   - No configuration needed

2. **Backend (Smart Upsert)**
   - `upsert_contacts_batch()` in `database.py`
   - Checks existing contacts before inserting
   - Updates if exists, inserts if new
   - Keeps data fresh (ratings, reviews, etc.)

3. **Database (Safety Net)**
   - Unique constraints (this migration)
   - Prevents duplicates even if app logic fails
   - Production-ready data integrity

## Rollback

If you need to remove the constraints:

```sql
DROP INDEX IF EXISTS idx_contacts_phone_unique;
DROP INDEX IF EXISTS idx_contacts_name_address_unique;
```

## Notes

- The backend application uses **upsert logic** and doesn't rely solely on database constraints
- Constraints provide an extra layer of safety
- The application handles constraint violations gracefully
- No downtime required for this migration
