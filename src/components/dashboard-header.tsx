'use client'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Search, Bell } from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

function buildBreadcrumb(pathname: string): string {
  const labelMap: Record<string, string> = {
    dashboard: 'Dashboard',
    admin: 'Admin',
    turmas: 'Turmas',
    professores: 'Professores',
    alunos: 'Alunos',
    aulas: 'Aulas',
    avaliacoes: 'Avaliações',
    professor: 'Professor',
    portal: 'Portal',
    'registro-aula': 'Registro de Aula',
    tarefas: 'Tarefas de Casa',
    notas: 'Notas',
    pedagogo: 'Pedagogo',
    registros: 'Registros',
    'meu-arcadia': 'Meu Arcadia',
    ai: 'IA',
    assistente: 'Assistente IA',
  }

  const parts = pathname
    .split('/')
    .filter(Boolean)
    .map(p => labelMap[p] || p.charAt(0).toUpperCase() + p.slice(1))

  return parts.join(' / ')
}

export function DashboardHeader() {
  const pathname = usePathname()
  const { data: session } = useSession()

  const breadcrumb = buildBreadcrumb(pathname)

  const initials = session?.user?.name
    ?.split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?'

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur flex items-center px-6 gap-4 shrink-0">
      {/* Breadcrumb */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{breadcrumb}</p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Search button */}
        <button
          className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border bg-card text-muted-foreground text-sm hover:text-foreground hover:border-ring transition-colors"
          aria-label="Buscar"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline">Buscar...</span>
        </button>

        {/* Bell */}
        <button
          className="flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:border-ring transition-colors"
          aria-label="Notificações"
        >
          <Bell className="h-4 w-4" />
        </button>

        {/* Avatar */}
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
