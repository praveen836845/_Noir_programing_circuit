import { NextApiRequest, NextApiResponse } from "next";
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
    return toggleLike(req, res);
  } else {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}

async function toggleLike(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id: messageId } = req.query;
    const { userEphemeralPubkey, isLiked } = req.body;

    if (!messageId || !userEphemeralPubkey) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (isLiked) {
      // Add like
      const { error: insertError } = await supabase
        .from("likes")
        .insert({
          message_id: messageId,
          user_ephemeral_pubkey: userEphemeralPubkey,
        });

      if (insertError && insertError.code !== "23505") { // Ignore duplicate key error
        console.error("Error adding like:", insertError);
        return res.status(500).json({ error: "Failed to add like" });
      }
    } else {
      // Remove like
      const { error: deleteError } = await supabase
        .from("likes")
        .delete()
        .eq("message_id", messageId)
        .eq("user_ephemeral_pubkey", userEphemeralPubkey);

      if (deleteError) {
        console.error("Error removing like:", deleteError);
        return res.status(500).json({ error: "Failed to remove like" });
      }
    }

    // Update the message likes count
    const { data: likesData, error: countError } = await supabase
      .from("likes")
      .select("id", { count: "exact" })
      .eq("message_id", messageId);

    if (countError) {
      console.error("Error counting likes:", countError);
      return res.status(500).json({ error: "Failed to count likes" });
    }

    const likeCount = likesData?.length || 0;

    // Update the message with new like count
    const { error: updateError } = await supabase
      .from("messages")
      .update({ likes: likeCount })
      .eq("id", messageId);

    if (updateError) {
      console.error("Error updating message likes:", updateError);
      return res.status(500).json({ error: "Failed to update message likes" });
    }

    return res.status(200).json({ 
      success: true, 
      likes: likeCount,
      isLiked 
    });
  } catch (error) {
    console.error("Error in toggleLike:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
