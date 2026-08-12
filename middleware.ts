import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET_STRING = process.env.JWT_SECRET || 'neoprospector_super_secret_jwt_key_2026_diabolical'
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING)

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/favicon.ico']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow static Next.js assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    PUBLIC_PATHS.includes(pathname)
  ) {
    return NextResponse.next()
  }

  // Check auth_token cookie
  const token = req.cookies.get('auth_token')?.value

  let isAuthenticated = false
  if (token) {
    try {
      await jwtVerify(token, JWT_SECRET)
      isAuthenticated = true
    } catch {
      isAuthenticated = false
    }
  }

  if (!isAuthenticated) {
    // If request is an API call, return 401 JSON
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { error: 'No autorizado. Por favor inicia sesión.' },
        { status: 401 }
      )
    }

    // Otherwise redirect to /login
    const loginUrl = new URL('/login', req.url)
    return NextResponse.redirect(loginUrl)
  }

  // If authenticated user visits /login, redirect to /
  if (pathname === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
