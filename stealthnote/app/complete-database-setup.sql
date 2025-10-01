-- Complete Database Setup for WhisperWall
-- Run this entire script in your Supabase SQL Editor

-- Drop existing tables if they exist (be careful with this in production!)
DROP TABLE IF EXISTS public.likes CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.memberships CASCADE;

-- Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    text TEXT NOT NULL,
    internal BOOLEAN NOT NULL DEFAULT FALSE,
    likes INTEGER NOT NULL DEFAULT 0,
    anon_group_id TEXT NOT NULL,
    anon_group_provider TEXT NOT NULL,
    ephemeral_pubkey TEXT NOT NULL,
    ephemeral_pubkey_expiry TIMESTAMPTZ NOT NULL,
    proof BYTEA DEFAULT NULL,
    proof_args JSONB DEFAULT '{}',
    signature TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create memberships table (for tracking user memberships)
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    anon_group_id TEXT NOT NULL,
    anon_group_provider TEXT NOT NULL,
    ephemeral_pubkey TEXT NOT NULL,
    ephemeral_pubkey_expiry TIMESTAMPTZ NOT NULL,
    proof BYTEA NOT NULL,
    proof_args JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, anon_group_id, anon_group_provider)
);

-- Create likes table (for tracking message likes)
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_ephemeral_pubkey TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_ephemeral_pubkey)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_anon_group ON public.messages(anon_group_id, anon_group_provider);
CREATE INDEX IF NOT EXISTS idx_messages_internal ON public.messages(internal);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_group ON public.memberships(anon_group_id, anon_group_provider);
CREATE INDEX IF NOT EXISTS idx_likes_message ON public.likes(message_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (adjust as needed for your security requirements)
CREATE POLICY "Messages are viewable by everyone" ON public.messages
    FOR SELECT USING (true);

CREATE POLICY "Messages can be inserted by anyone" ON public.messages
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Messages can be updated by anyone" ON public.messages
    FOR UPDATE USING (true);

CREATE POLICY "Memberships are viewable by everyone" ON public.memberships
    FOR SELECT USING (true);

CREATE POLICY "Memberships can be inserted by anyone" ON public.memberships
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Memberships can be updated by everyone" ON public.memberships
    FOR UPDATE USING (true);

CREATE POLICY "Likes are viewable by everyone" ON public.likes
    FOR SELECT USING (true);

CREATE POLICY "Likes can be inserted by anyone" ON public.likes
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Likes can be deleted by anyone" ON public.likes
    FOR DELETE USING (true);

-- Create functions for like counting
CREATE OR REPLACE FUNCTION increment_likes_count(message_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE public.messages
    SET likes = likes + 1
    WHERE id = message_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION decrement_likes_count(message_id TEXT)
RETURNS void AS $$
BEGIN
    UPDATE public.messages
    SET likes = GREATEST(likes - 1, 0)
    WHERE id = message_id;
END;
$$ LANGUAGE plpgsql;
