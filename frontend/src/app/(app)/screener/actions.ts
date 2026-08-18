"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function generateScoresAction() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const backendUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
  const secretKey = process.env.FASTAPI_SECRET || "dev_shared_secret_key";

  try {
    const res = await fetch(`${backendUrl}/compute/score?user_id=${user.id}`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${secretKey}`,
        "X-API-Key": secretKey
      }
    });

    if (!res.ok) {
      console.error("Failed to generate scores:", await res.text());
      throw new Error("Backend failed to generate scores");
    }
    
  } catch (error) {
    console.error("Error communicating with backend:", error);
    // Even if it fails, maybe we just redirect, but let's revalidate
  }

  revalidatePath("/screener");
}
