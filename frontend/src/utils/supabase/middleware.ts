import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/auth', '/disclaimer']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Exchange ?code= from email verification links for a session
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    const url = request.nextUrl.clone()
    url.searchParams.delete('code')
    if (error) {
      url.pathname = '/auth/login'
      url.search = '?error=' + encodeURIComponent('That link has expired or was already used. Request a new one.')
    }
    const redirect = NextResponse.redirect(url)
    // carry the new session cookies onto the redirect, or the user arrives signed out
    supabaseResponse.cookies.getAll().forEach((c) => redirect.cookies.set(c))
    return redirect
  }

  let user = null
  try {
    const { data } = await supabase.auth.getUser()
    user = data.user
  } catch {
    user = null
  }

  const path = request.nextUrl.pathname
  const isAuthRoute = path.startsWith('/auth')
  const isPublic = path === '/' || PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + '/'))
  // reachable while signed in: the email link signs you in, then you set the new password
  const signedInAuthPages = ['/auth/confirm', '/auth/reset']

  if (user && (path === '/' || (isAuthRoute && !signedInAuthPages.some((p) => path.startsWith(p))))) {
    const url = request.nextUrl.clone()
    url.pathname = '/home'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
