-- Add demo plan support and demo expiration to businesses table
-- Run this in your Supabase SQL Editor

-- 1. Update businesses table constraints and columns
DO $$ 
BEGIN 
    -- Update the check constraint for plan to include 'demo'
    ALTER TABLE public.businesses DROP CONSTRAINT IF EXISTS businesses_plan_check;
    ALTER TABLE public.businesses ADD CONSTRAINT businesses_plan_check CHECK (plan IN ('basic', 'premium', 'enterprise', 'demo'));
    
    -- Add demo_until column to track when the demo period ends
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'businesses' AND SCHEMA_NAME = 'public' AND COLUMN_NAME = 'demo_until') THEN
        ALTER TABLE public.businesses ADD COLUMN demo_until TIMESTAMP WITH TIME ZONE;
    END IF;

    -- Add subscription_expiry column if it doesn't exist (it seems it does but just in case)
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'businesses' AND SCHEMA_NAME = 'public' AND COLUMN_NAME = 'subscription_expiry') THEN
        ALTER TABLE public.businesses ADD COLUMN subscription_expiry TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;
