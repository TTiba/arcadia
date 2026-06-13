import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname
    const isApi = pathname.startsWith('/api')

    // NextAuth's own endpoints must stay public (sign in/out, session, csrf).
    if (pathname.startsWith('/api/auth')) return NextResponse.next()

    // Reject unauthenticated requests: JSON 401 for APIs, redirect for pages.
    // This guarantees no API route is reachable anonymously, regardless of
    // whether the individual handler remembers to check the session.
    if (!token) {
      return isApi
        ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        : NextResponse.redirect(new URL('/login', req.url))
    }

    // Role-based protection for pages. (APIs additionally enforce their own
    // per-action role checks, since some endpoints are read across roles.)
    if (pathname.startsWith('/admin') && token.role !== 'ADMIN' && token.role !== 'COORDENACAO') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    if (pathname.startsWith('/professor') && token.role !== 'PROFESSOR' && token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    if (
      pathname.startsWith('/pedagogo') &&
      token.role !== 'PEDAGOGO' &&
      token.role !== 'ADMIN' &&
      token.role !== 'COORDENACAO'
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      // Authorization is enforced inside the middleware above so we can return
      // JSON 401s for API routes instead of redirecting them to an HTML page.
      authorized: () => true,
    },
  }
)

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/admin/:path*',
    '/professor/:path*',
    '/pedagogo/:path*',
    '/meu-arcadia/:path*',
    '/ai/:path*',
    '/api/:path*',
  ],
}
