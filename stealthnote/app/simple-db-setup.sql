-- Simple Database Setup for StealthNote
-- Copy and paste this into your Supabase SQL Editor

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

-- Create memberships table
CREATE TABLE IF NOT EXISTS public.memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    anon_group_id TEXT NOT NULL,
    anon_group_provider TEXT NOT NULL,
    ephemeral_pubkey TEXT NOT NULL,
    ephemeral_pubkey_expiry TIMESTAMPTZ NOT NULL,
    proof BYTEA DEFAULT NULL,
    proof_args JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, anon_group_id, anon_group_provider)
);

-- Create likes table
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id TEXT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
    user_ephemeral_pubkey TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(message_id, user_ephemeral_pubkey)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON public.messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_anon_group ON public.messages(anon_group_id, anon_group_provider);
CREATE INDEX IF NOT EXISTS idx_messages_internal ON public.messages(internal);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON public.memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_memberships_group ON public.memberships(anon_group_id, anon_group_provider);
CREATE INDEX IF NOT EXISTS idx_likes_message ON public.likes(message_id);

-- Enable Row Level Security
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Allow all operations on messages" ON public.messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on memberships" ON public.memberships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations on likes" ON public.likes FOR ALL USING (true) WITH CHECK (true);
