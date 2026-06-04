import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from '@/components/ui/toaster'
import { AuthProvider } from '@/components/auth-provider'

export const metadata: Metadata = {
  title: 'Vela - Gestão Escolar',
  description: 'Sistema de gestão e distribuição de aulas para escolas',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link
          rel="stylesheet"
          href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,600,700&f[]=boska@400,500,600,700&display=swap"
        />
      </head>
      <body
        style={
          {
            '--font-sans': "'Satoshi', 'Inter', system-ui, sans-serif",
            '--font-serif': "'Boska', Georgia, serif",
          } as React.CSSProperties
        }
        className="font-sans"
      >
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  )
}
