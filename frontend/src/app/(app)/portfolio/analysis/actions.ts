"use server";

import { createClient } from "@/utils/supabase/server";

export async function fetchPortfolioSnapshot() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const backendUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    const apiKey = process.env.FASTAPI_SECRET || "";
    
    const response = await fetch(`${backendUrl}/api/portfolio/snapshot`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "X-User-Id": userId
      },
    });

    if (!response.ok) {
      console.error(`Backend returned ${response.status}: ${await response.text()}`);
      return { success: false, error: "Backend error" };
    }

    const data = await response.json();
    return { success: true, snapshot: data };
  } catch (error) {
    console.error("Server action snapshot error:", error);
    return { success: false, error: "Network or timeout error" };
  }
}

export async function generatePortfolioReport(snapshot: any) {
  try {
    const backendUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    const apiKey = process.env.FASTAPI_SECRET || "";
    
    const response = await fetch(`${backendUrl}/api/portfolio/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: JSON.stringify({ snapshot }),
    });

    if (!response.ok) {
      console.error(`Backend returned ${response.status}: ${await response.text()}`);
      return { success: false, error: "Backend error" };
    }

    const data = await response.json();
    return { success: true, report: data };
  } catch (error) {
    console.error("Server action report error:", error);
    return { success: false, error: "Network or timeout error" };
  }
}

export async function sendPortfolioChatMessage(
  messages: { role: string; content: string }[], 
  snapshot_summary?: any
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id;

  if (!userId) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const backendUrl = process.env.FASTAPI_URL || "http://127.0.0.1:8000";
    const apiKey = process.env.FASTAPI_SECRET || "";
    
    const response = await fetch(`${backendUrl}/api/portfolio/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "X-User-Id": userId
      },
      body: JSON.stringify({
        messages,
        user_id: userId,
        snapshot_summary
      }),
    });

    if (!response.ok) {
      console.error(`Backend returned ${response.status}: ${await response.text()}`);
      return { success: false, error: "Backend error" };
    }

    const data = await response.json();
    return { success: true, message: data };
  } catch (error) {
    console.error("Server action chat error:", error);
    return { success: false, error: "Network or timeout error" };
  }
}
