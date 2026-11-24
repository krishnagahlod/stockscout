import Link from 'next/link'
import { requestPasswordReset } from '../actions'
import { AuthShell, Field, Submit } from '../auth-shell'

export const metadata = { title: 'Reset password | StockScout' }

export default async function ForgotPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const { error, sent } = await searchParams
  return (
    <AuthShell
      title="Reset your password"
      intro="Enter the email you signed up with and we'll send you a link to choose a new password."
      error={error}
      message={sent ? "If that email has an account, a reset link is on its way. It can take a minute; check spam too." : undefined}
      footer={<Link href="/auth/login" className="font-medium text-indigo-600 underline">Back to log in</Link>}
    >
      <form action={requestPasswordReset} className="grid gap-4">
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" required />
        <Submit>Send reset link</Submit>
      </form>
    </AuthShell>
  )
}
