-- 1. Ensure the table 'business_settings' exists with correct columns
CREATE TABLE IF NOT EXISTS business_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL,
    key TEXT NOT NULL DEFAULT 'config',
    value JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(business_id, key)
);

-- 2. If table exists but column is missing, add 'value'
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'value') THEN
        ALTER TABLE business_settings ADD COLUMN value JSONB NOT NULL DEFAULT '{}';
    END IF;

    -- Ensure 'key' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'business_settings' AND column_name = 'key') THEN
        ALTER TABLE business_settings ADD COLUMN key TEXT NOT NULL DEFAULT 'config';
    END IF;
    
    -- 3. Ensure the UNIQUE constraint (business_id, key) exists
    -- This fixes the "no unique constraint matching ON CONFLICT" error
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'business_settings_biz_key_unique' 
        OR (contype = 'u' AND conrelid = 'business_settings'::regclass)
    ) THEN
        BEGIN
            ALTER TABLE business_settings ADD CONSTRAINT business_settings_biz_key_unique UNIQUE (business_id, key);
        EXCEPTION
            WHEN duplicate_table THEN
                NULL; -- Constraint might already exist with different name
        END;
    END IF;
END $$;

-- 4. Set RLS (Row Level Security) - Optional but recommended
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;

-- Allow users to see only their own business settings
DROP POLICY IF EXISTS "Settings Isolation" ON business_settings;
CREATE POLICY "Settings Isolation" ON business_settings
    FOR ALL
    USING (business_id = (auth.jwt() -> 'user_metadata' ->> 'business_id')::uuid);

-- Refresh PostgREST cache
NOTIFY pgrst, 'reload schema';
