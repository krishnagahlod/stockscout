import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith('/api/')
  const requestHeaders = new Headers(request.headers)
  // Never trust identity headers coming from the browser; set them below from the verified session.
  requestHeaders.delete('X-User-Id')
  if (isApi) {
    if (!process.env.FASTAPI_SECRET) {
      return NextResponse.json({ detail: 'FASTAPI_SECRET is not configured' }, { status: 500 })
    }
    requestHeaders.set('X-API-Key', process.env.FASTAPI_SECRET)
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
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
            requestHeaders.set('cookie', request.cookies.toString())
          })
          // Keep the API key / user headers when the session cookie is refreshed.
          supabaseResponse = NextResponse.next({
            request: { headers: requestHeaders },
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

  let user = null
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser
  } catch {
    user = null
  }

  const isAuthRoute = request.nextUrl.pathname.startsWith('/auth')
  const isPublic = isAuthRoute || request.nextUrl.pathname === '/disclaimer'

  // If user is logged in and tries to access auth routes, redirect to dashboard
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/' // Dashboard
    return NextResponse.redirect(url)
  }

  if (!user && isApi) {
    return NextResponse.json({ detail: 'Not signed in' }, { status: 401 })
  }

  if (!user && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    url.search = ''
    return NextResponse.redirect(url)
  }

  if (user) {
    requestHeaders.set('X-User-Id', user.id)
    const next = NextResponse.next({ request: { headers: requestHeaders } })
    supabaseResponse.cookies.getAll().forEach((c) => next.cookies.set(c))
    return next
  }

  return supabaseResponse
}
