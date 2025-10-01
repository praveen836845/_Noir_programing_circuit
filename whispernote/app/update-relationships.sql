-- Add foreign key constraint to messages table
ALTER TABLE public.messages
ADD CONSTRAINT fk_messages_memberships
FOREIGN KEY (ephemeral_pubkey, anon_group_id, anon_group_provider)
REFERENCES public.memberships(ephemeral_pubkey, anon_group_id, anon_group_provider)
ON DELETE CASCADE;

-- Add index to improve join performance
CREATE INDEX IF NOT EXISTS idx_messages_membership ON public.messages(ephemeral_pubkey, anon_group_id, anon_group_provider);

-- Update the messages table to include a reference to the membership
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS membership_id UUID REFERENCES public.memberships(id) ON DELETE SET NULL;
