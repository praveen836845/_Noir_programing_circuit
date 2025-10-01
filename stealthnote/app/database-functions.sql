-- Database functions for WhisperWall
-- Run these in your Supabase SQL Editor

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
