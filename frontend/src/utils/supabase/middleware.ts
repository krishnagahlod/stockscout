import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)
  if (request.nextUrl.pathname.startsWith('/api/')) {
    requestHeaders.set('X-API-Key', process.env.FASTAPI_SECRET || "dev_shared_secret_key")
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    }
  })

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
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Avoid writing any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to debug
  // issues with cross-browser cookies.
  
  // Intercept ?code= parameter from email verifications and exchange it
  const code = request.nextUrl.searchParams.get('code')
  if (code) {
    await supabase.auth.exchangeCodeForSession(code)
    // Strip the code from the URL and redirect back to the same path
    const url = request.nextUrl.clone()
    url.searchParams.delete('code')
    return NextResponse.redirect(url)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const isPublicRoute = request.nextUrl.pathname === '/' || isAuthRoute

  // If user is not logged in and it's not a public route, redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // If user is logged in and tries to access auth routes, redirect to dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/' // Dashboard
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
