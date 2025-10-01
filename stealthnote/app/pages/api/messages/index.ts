import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { verifyMessageSignature } from "../../../lib/ephemeral-key";
import { SignedMessage } from "../../../lib/types";

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
    return fetchMessages(req, res);
  } else if (req.method === "POST") {
    return postMessage(req, res);
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}

export async function postMessage(
  request: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const body = (await request.body);

    const signedMessage: SignedMessage = {
      id: body.id,
      anonGroupId: body.anonGroupId,
      anonGroupProvider: body.anonGroupProvider,
      text: body.text,
      timestamp: new Date(body.timestamp),
      internal: body.internal,
      signature: BigInt(body.signature),
      ephemeralPubkey: BigInt(body.ephemeralPubkey),
      ephemeralPubkeyExpiry: new Date(body.ephemeralPubkeyExpiry),
      likes: 0,
    }

    // Verify pubkey is registered
    const { data, error } = await supabase
      .from("memberships")
      .select("*")
      .eq("ephemeral_pubkey", signedMessage.ephemeralPubkey.toString())
      .eq("anon_group_id", signedMessage.anonGroupId)
      .eq("anon_group_provider", signedMessage.anonGroupProvider)
      .single();

    if (error) {
      console.error("Membership verification error:", error);
      // For now, allow messages without membership verification
      // throw error;
    }

    if (data && !data.ephemeral_pubkey) {
      throw new Error("Pubkey not registered");
    }

    if (signedMessage.ephemeralPubkeyExpiry < new Date()) {
      throw new Error("Ephemeral pubkey expired");
    }

    const isValid = await verifyMessageSignature(signedMessage);
    if (!isValid) {
      throw new Error("Message signature check failed");
    }

    const { error: insertError } = await supabase.from("messages").insert([
      {
        id: signedMessage.id,
        anon_group_id: signedMessage.anonGroupId,
        anon_group_provider: signedMessage.anonGroupProvider,
        text: signedMessage.text,
        timestamp: signedMessage.timestamp.toISOString(),
        signature: signedMessage.signature.toString(),
        ephemeral_pubkey: signedMessage.ephemeralPubkey.toString(),
        ephemeral_pubkey_expiry: signedMessage.ephemeralPubkeyExpiry.toISOString(),
        internal: signedMessage.internal,
        proof: Buffer.from([]), // Placeholder for now
        proof_args: {},
      },
    ]);

    if (insertError) {
      throw insertError;
    }

    return res.status(201).json({ message: "Message saved successfully" });
  } catch (error) {
    console.error("Error in postMessage:", error);
    return res.status(500).json({ error: (error as Error).message });
  }
}

export async function fetchMessages(
  request: NextApiRequest,
  res: NextApiResponse
) {
  const groupId = request.query?.groupId as string;
  const isInternal = request.query?.isInternal === "true";
  const limit = parseInt(request.query?.limit as string) || 50;
  const afterTimestamp = request.query?.afterTimestamp as string;
  const beforeTimestamp = request.query?.beforeTimestamp as string;

  let query = supabase
    .from("messages")
    .select(
      "id, text, timestamp, signature, ephemeral_pubkey, internal, likes, anon_group_id, anon_group_provider"
    )
    .order("timestamp", { ascending: false })
    .limit(limit);

  query = query.eq("internal", !!isInternal);

  if (groupId) {
    query = query.eq("anon_group_id", groupId);
  }

  if (afterTimestamp) {
    query = query.gt(
      "timestamp",
      new Date(Number(afterTimestamp)).toISOString()
    );
  }

  if (beforeTimestamp) {
    query = query.lt(
      "timestamp",
      new Date(Number(beforeTimestamp)).toISOString()
    );
  }

  // Internal messages require a valid pubkey from the same group (as Authorization header)
  if (isInternal) {
    if (!groupId) {
      return res
        .status(400)
        .json({ error: "Group ID is required for internal messages" });
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Authorization required for internal messages" });
    }

    const pubkey = authHeader.split(" ")[1];
    const { data: membershipData, error: membershipError } = await supabase
      .from("memberships")
      .select("*")
      .eq("ephemeral_pubkey", pubkey)
      .eq("anon_group_id", groupId)
      .single();

    if (membershipError || !membershipData) {
      return res.status(401).json({ error: "Invalid public key for this group" });
    }
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching messages:", error);
    return res.status(500).json({ error: error.message });
  }

  const messages: Partial<SignedMessage>[] = (data || []).map((message) => ({
    id: message.id,
    anonGroupId: message.anon_group_id,
    anonGroupProvider: message.anon_group_provider,
    text: message.text,
    timestamp: new Date(message.timestamp),
    signature: message.signature,
    ephemeralPubkey: message.ephemeral_pubkey,
    internal: message.internal,
    likes: message.likes || 0,
  }));

  return res.status(200).json(messages);
}
