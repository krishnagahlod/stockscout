import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { PageTransition } from "@/components/page-transition";
import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ComplianceBanner } from "@/components/compliance-banner";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Check if profile exists and onboarding is complete
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("onboarding_completed")
    .eq("user_id", user.id)
    .single();

  if (!profile || !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  return (
    <div className="flex h-screen w-full bg-mesh-light selection:bg-indigo-100 selection:text-indigo-900 font-sans text-slate-900">
      <div className="hidden md:flex flex-col w-64 shrink-0 p-4 pb-4">
        <div className="flex-1 glass-card rounded-3xl shadow-premium overflow-hidden border-white/60">
          <Sidebar />
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-hidden relative">
        <ComplianceBanner />
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 md:pl-0">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>
    </div>
  );
}
