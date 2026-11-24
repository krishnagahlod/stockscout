import Link from 'next/link'
import { login } from '../actions'
import { AuthShell, Field, Submit } from '../auth-shell'

export const metadata = { title: 'Log in | StockScout' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const { error, message } = await searchParams
  return (
    <AuthShell
      title="Log in"
      intro="Welcome back. Your portfolio and ideas are waiting."
      error={error}
      message={message}
      footer={<>New here? <Link href="/auth/signup" className="font-medium text-indigo-600 underline">Create an account</Link></>}
    >
      <form action={login} className="grid gap-4">
        <Field id="email" name="email" type="email" label="Email" autoComplete="email" required />
        <Field id="password" name="password" type="password" label="Password" autoComplete="current-password" required />
        <Submit>Log in</Submit>
        <Link href="/auth/forgot" className="text-center text-sm text-slate-500 underline hover:text-indigo-600">Forgot your password?</Link>
      </form>
    </AuthShell>
  )
}
