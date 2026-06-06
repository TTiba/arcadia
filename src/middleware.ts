import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname

    if (!token) return NextResponse.redirect(new URL('/login', req.url))

    // Admin-only routes (except /admin/alunos — shared with all roles)
    if (
      pathname.startsWith('/admin') &&
      !pathname.startsWith('/admin/alunos') &&
      token.role !== 'ADMIN' &&
      token.role !== 'COORDENACAO' &&
      token.role !== 'DIRETOR'
    ) {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Professor routes
    if (pathname.startsWith('/professor') && token.role !== 'PROFESSOR' && token.role !== 'ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Pedagogo routes
    if (pathname.startsWith('/pedagogo') && token.role !== 'PEDAGOGO' && token.role !== 'ADMIN' && token.role !== 'COORDENACAO') {
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    return NextResponse.next()
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  }
)

export const config = {
  matcher: ['/dashboard/:path*', '/admin/:path*', '/professor/:path*', '/pedagogo/:path*'],
}
