import { withAuth } from 'next-auth/middleware'
import { NextResponse } from 'next/server'

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token
    const pathname = req.nextUrl.pathname
    const isApi = pathname.startsWith('/api')

    // Endpoints do próprio NextAuth precisam ficar públicos (login, sessão, csrf)
    if (pathname.startsWith('/api/auth')) return NextResponse.next()

    // Sem sessão: APIs recebem 401 JSON, páginas redirecionam para o login.
    // Garante que nenhuma rota /api fique acessível anonimamente, mesmo que o
    // handler esqueça de checar a sessão.
    if (!token) {
      return isApi
        ? NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        : NextResponse.redirect(new URL('/login', req.url))
    }

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

    // Curriculo is blocked for DIRETOR role
    if (pathname.startsWith('/admin/curriculo') && token.role === 'DIRETOR') {
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
      // A autorização é decidida no middleware acima, para que rotas /api
      // recebam 401 JSON em vez de redirect para página HTML.
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
    '/frequencia/:path*',
    '/mensagens/:path*',
    '/meu-vela/:path*',
    '/ai/:path*',
    '/api/:path*',
  ],
}
