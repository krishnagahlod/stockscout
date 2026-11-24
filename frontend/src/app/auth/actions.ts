'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

/** Turn Supabase auth errors into something a person can act on. */
function friendly(message: string): string {
  const m = message.toLowerCase()
  if (m.includes('invalid login credentials')) return "That email and password don't match. Check for typos, or reset your password below."
  if (m.includes('email not confirmed')) return 'Confirm your email first: open the link we sent you (check spam too), then log in.'
  if (m.includes('rate limit') || m.includes('security purposes')) return 'Too many emails were sent just now. Wait a minute, then try again.'
  if (m.includes('password should be') || m.includes('weak')) return 'Use a password with at least 8 characters.'
  if (m.includes('same as the old') || m.includes('different from the old')) return 'Choose a password different from your old one.'
  return message
}

async function siteOrigin() {
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? (host?.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

const field = (formData: FormData, name: string) => String(formData.get(name) ?? '').trim()

export async function login(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: field(formData, 'email'),
    password: String(formData.get('password') ?? ''),
  })
  if (error) redirect('/auth/login?error=' + encodeURIComponent(friendly(error.message)))

  revalidatePath('/', 'layout')
  redirect('/home')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()
  const email = field(formData, 'email')
  const password = String(formData.get('password') ?? '')
  if (password.length < 8) redirect('/auth/signup?error=' + encodeURIComponent('Use a password with at least 8 characters.'))

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm` },
  })
  if (error) redirect('/auth/signup?error=' + encodeURIComponent(friendly(error.message)))

  // Supabase answers "ok" without sending anything when the email is already registered
  if (data.user && data.user.identities?.length === 0) {
    redirect('/auth/login?message=' + encodeURIComponent('You already have an account with this email. Log in, or reset your password if you forgot it.'))
  }
  if (data.session) {
    revalidatePath('/', 'layout')
    redirect('/home')
  }
  redirect('/auth/login?message=' + encodeURIComponent(`We sent a confirmation link to ${email}. Open it (check spam too), then you're in.`))
}

export async function requestPasswordReset(formData: FormData) {
  const email = field(formData, 'email')
  if (!email) redirect('/auth/forgot?error=' + encodeURIComponent('Enter the email you signed up with.'))
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await siteOrigin()}/auth/reset` })
  if (error) redirect('/auth/forgot?error=' + encodeURIComponent(friendly(error.message)))
  // same message whether or not the account exists, so the form can't be used to discover emails
  redirect('/auth/forgot?sent=1')
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get('password') ?? '')
  const confirm = String(formData.get('confirm') ?? '')
  if (password.length < 8) redirect('/auth/reset?error=' + encodeURIComponent('Use a password with at least 8 characters.'))
  if (password !== confirm) redirect('/auth/reset?error=' + encodeURIComponent("The two passwords don't match."))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/forgot?error=' + encodeURIComponent('Your reset link has expired. Request a new one.'))

  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect('/auth/reset?error=' + encodeURIComponent(friendly(error.message)))
  revalidatePath('/', 'layout')
  redirect('/home')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/')
}
