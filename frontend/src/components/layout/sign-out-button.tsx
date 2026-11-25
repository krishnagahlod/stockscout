import { LogOut } from "lucide-react";
import { logout } from "@/app/auth/actions";

export function SignOutButton() {
  return (
    <form action={logout}>
      <button type="submit" className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-900">
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </form>
  );
}
