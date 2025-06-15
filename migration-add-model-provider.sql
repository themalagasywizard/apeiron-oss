-- Migration: Add model and provider columns to messages table
-- Run this script on your Supabase database to add the missing columns

-- Add model column to messages table
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS model TEXT;

-- Add provider column to messages table  
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS provider TEXT;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_model ON public.messages(model);
CREATE INDEX IF NOT EXISTS idx_messages_provider ON public.messages(provider);

-- Update RLS policies if needed (they should already work with the new columns)
-- No policy updates needed as the columns are nullable and don't affect security

-- Migration completed successfully
-- The application will now store and display model/provider information for all new messages 