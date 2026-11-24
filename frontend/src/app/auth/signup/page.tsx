import Link from 'next/link'
import { signup } from '../actions'
import { AuthShell, Field, Submit } from '../auth-shell'

export const metadata = { title: 'Create account | StockScout' }

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return (
    <AuthShell
      title="Create your account"
      intro="Free. We'll email you a link to confirm it's you."
      error={error}
      footer={<>Already have an account? <Link href="/auth/login" className="font-medium text-indigo-600 underline">Log in</Link></>}
    >
      <form action={signup} className="grid gap-4">
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" required />
        <Field id="password" name="password" type="password" label="Password (8+ characters)" autoComplete="new-password" minLength={8} required />
        <Submit>Create account</Submit>
        <p className="text-xs text-slate-400">By continuing you agree that StockScout shares information, not investment advice. <Link href="/disclaimer" className="underline">Read the disclaimer</Link>.</p>
      </form>
    </AuthShell>
  )
}
