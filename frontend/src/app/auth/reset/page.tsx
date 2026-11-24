import Link from 'next/link'
import { createClient } from '@/utils/supabase/server'
import { updatePassword } from '../actions'
import { AuthShell, Field, Submit } from '../auth-shell'

export const metadata = { title: 'Choose a new password | StockScout' }

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return (
      <AuthShell title="This link has expired" intro="Reset links work once and only for a short time."
        footer={<Link href="/auth/login" className="font-medium text-indigo-600 underline">Back to log in</Link>}>
        <Link href="/auth/forgot" className="flex h-11 w-full items-center justify-center rounded-xl bg-indigo-600 font-semibold text-white hover:bg-indigo-700">Send a new link</Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Choose a new password" intro={`For ${user.email}`} error={error}>
      <form action={updatePassword} className="grid gap-4">
        <Field id="password" name="password" type="password" label="New password (8+ characters)" autoComplete="new-password" minLength={8} required />
        <Field id="confirm" name="confirm" type="password" label="Type it again" autoComplete="new-password" minLength={8} required />
        <Submit>Save and continue</Submit>
      </form>
    </AuthShell>
  )
}
