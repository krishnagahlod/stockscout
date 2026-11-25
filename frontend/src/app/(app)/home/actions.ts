"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function setWeeklyEmail(on: boolean): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");
  await supabase.from("user_profiles").update({ weekly_email: on === true }).eq("user_id", user.id);
  revalidatePath("/home");
}
