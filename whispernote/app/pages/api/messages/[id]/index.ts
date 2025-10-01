// pages/api/messages/[id]/index.ts
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from 'next';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id } = req.query;
    const isInternal = req.query?.isInternal === "true";

    if (!id || typeof id !== "string") {
      return res.status(400).json({ error: "Message ID is required" });
    }

    // First, get the basic message data with only the fields we know exist
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select(`
        id,
        content,
        created_at,
        is_verified,
        membership_id,
        ephemeral_pubkey,
        anon_group_id,
        anon_group_provider,
        internal,
        proof,
        signature
      `)
      .eq("id", id)
      .eq("internal", isInternal)
      .single();

    if (messageError) {
      console.error("Error fetching message:", messageError);
      return res.status(500).json({ error: messageError.message });
    }

    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Get membership data if membership_id exists
    let membership = null;
    if (message.membership_id) {
      const { data: membershipData, error: membershipError } = await supabase
        .from("memberships")
        .select(`
          id,
          user_id,
          ephemeral_pubkey,
          ephemeral_pubkey_expiry,
          anon_group_id,
          anon_group_provider,
          created_at
        `)
        .eq('id', message.membership_id)
        .single();

      if (!membershipError && membershipData) {
        membership = {
          id: membershipData.id,
          userId: membershipData.user_id,
          ephemeralPubkey: membershipData.ephemeral_pubkey,
          ephemeralPubkeyExpiry: membershipData.ephemeral_pubkey_expiry,
          anonGroupId: membershipData.anon_group_id,
          anonGroupProvider: membershipData.anon_group_provider,
          createdAt: membershipData.created_at
        };
      }
    }

    // Prepare the response data - only include fields that exist
    const responseData: any = {
      id: message.id,
      content: message.content,
      createdAt: message.created_at,
      isVerified: message.is_verified,
      membershipId: message.membership_id,
      ephemeralPubkey: message.ephemeral_pubkey,
      anonGroupId: message.anon_group_id,
      anonGroupProvider: message.anon_group_provider,
      internal: message.internal,
      proof: message.proof,
      signature: message.signature,
      membership: membership
    };

    // Remove any undefined values
    Object.keys(responseData).forEach(key => {
      if (responseData[key] === undefined) {
        delete responseData[key];
      }
    });

    return res.status(200).json(responseData);
  } catch (error) {
    console.error("Error in getMessage:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}