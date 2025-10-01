import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

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
  if (req.method === "POST") {
    return await postLike(req, res);
  } else {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}

async function postLike(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { messageId, like } = req.body;

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ error: "Authorization required for internal messages" });
    }

    const pubkey = authHeader.split(" ")[1];

    if (!messageId || !pubkey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Check if message exists first
    const { data: messageData } = await supabase
      .from("messages")
      .select("id")
      .eq("id", messageId)
      .single();

    if (!messageData) {
      return res.status(404).json({ error: "Message not found" });
    }

    // Check if message already liked
    const { data: existingLike } = await supabase
      .from("likes")
      .select()
      .eq("message_id", messageId)
      .eq("user_ephemeral_pubkey", pubkey)
      .single();

    if (like && !existingLike) {
      // Like
      await Promise.all([
        supabase.from("likes").insert({
          message_id: messageId,
          user_ephemeral_pubkey: pubkey,
        }),
        supabase.rpc("increment_likes_count", {
          message_id: messageId,
        }),
      ]);
    }

    if (!like && existingLike) {
      // Unlike
      await Promise.all([
        supabase
          .from("likes")
          .delete()
          .eq("message_id", messageId)
          .eq("user_ephemeral_pubkey", pubkey),
        supabase.rpc("decrement_likes_count", {
          message_id: messageId,
        }),
      ]);
    }

    return res.status(200).json({ liked: like, messageId });
  } catch (error) {
    console.error("Error handling like:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
