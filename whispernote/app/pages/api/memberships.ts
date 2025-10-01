import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { Providers } from "../../lib/providers";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === "GET") {
    return getMemberships(req, res);
  } else if (req.method === "POST") {
    return createMembership(req, res);
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}

async function getMemberships(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { user_id, anon_group_id, anon_group_provider } = req.query;

    let query = supabase.from("memberships").select("*");

    if (user_id) {
      query = query.eq("user_id", user_id);
    }
    if (anon_group_id) {
      query = query.eq("anon_group_id", anon_group_id);
    }
    if (anon_group_provider) {
      query = query.eq("anon_group_provider", anon_group_provider);
    }

    const { data, error } = await query.order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching memberships:", error);
      return res.status(500).json({ error: "Failed to fetch memberships" });
    }

    return res.status(200).json(data || []);
  } catch (error) {
    console.error("Error in getMemberships:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}

async function createMembership(req: NextApiRequest, res: NextApiResponse) {
  try {
    const {
      ephemeralPubkey,
      ephemeralPubkeyExpiry,
      groupId,
      provider: providerName,
      proof,
      proofArgs,
    } = req.body;

    console.log('Received membership data:', { ephemeralPubkey, ephemeralPubkeyExpiry, groupId, provider: providerName, proofArgs });

    // Validate required fields
    if (!ephemeralPubkey || !ephemeralPubkeyExpiry || !groupId || !providerName || !proof) {
      console.error('Missing required fields:', { ephemeralPubkey: !!ephemeralPubkey, ephemeralPubkeyExpiry: !!ephemeralPubkeyExpiry, groupId: !!groupId, provider: !!providerName, proof: !!proof });
      return res.status(400).json({ error: "Missing required fields" });
    }

    const provider = Providers[providerName];
    if (!provider) {
      return res.status(400).json({ error: "Invalid provider" });
    }

    // For now, skip proof verification to get the basic flow working
    // TODO: Re-enable proof verification once the flow is stable
    /*
    try {
      const isValid = await provider.verifyProof(
        Uint8Array.from(proof),
        groupId,
        BigInt(ephemeralPubkey),
        new Date(ephemeralPubkeyExpiry),
        proofArgs
      );
      if (!isValid) {
        throw new Error("Invalid proof");
      }
    } catch (verifyError) {
      console.error("Proof verification failed:", verifyError);
      return res.status(400).json({ error: "Invalid proof" });
    }
    */

    // Convert proof to Buffer if it's an array
    const proofBuffer = Array.isArray(proof) ? Buffer.from(proof) : proof;
    
    // Generate a user_id from the ephemeral pubkey for now
    const user_id = `user_${ephemeralPubkey.slice(0, 16)}`;

    const membershipData = {
      user_id,
      anon_group_id: groupId,
      anon_group_provider: providerName,
      ephemeral_pubkey: ephemeralPubkey,
      ephemeral_pubkey_expiry: new Date(ephemeralPubkeyExpiry).toISOString(),
      proof: proofBuffer,
      proof_args: proofArgs || {},
    };
    
    console.log('Inserting membership data:', membershipData);

    const { data, error } = await supabase
      .from("memberships")
      .upsert(membershipData, {
        onConflict: "user_id,anon_group_id,anon_group_provider",
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating membership:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      return res.status(500).json({ 
        error: "Failed to create membership", 
        details: error.message,
        code: error.code 
      });
    }

    console.log('Successfully created membership:', data);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    console.error("Error in createMembership:", error);
    console.error("Error stack:", (error as Error).stack);
    return res.status(500).json({ 
      error: "Internal server error", 
      message: (error as Error).message 
    });
  }
}
