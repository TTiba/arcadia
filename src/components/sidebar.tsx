'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  GraduationCap, LayoutDashboard, Users, BookOpen, School,
  ClipboardList, FileText, CheckSquare, Star, Heart,
  LogOut, ChevronLeft, ChevronRight, Menu, Settings, UserCheck
} from 'lucide-react'
import { Button } from './ui/button'
import { Avatar, AvatarFallback } from './ui/avatar'
import { ROLE_LABELS } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  // Admin
  { href: '/admin/turmas', label: 'Turmas', icon: School, roles: ['ADMIN', 'COORDENACAO'] },
  { href: '/admin/professores', label: 'Professores', icon: Users, roles: ['ADMIN', 'COORDENACAO'] },
  { href: '/admin/alunos', label: 'Alunos', icon: UserCheck, roles: ['ADMIN', 'COORDENACAO'] },
  { href: '/admin/aulas', label: 'Aulas', icon: BookOpen, roles: ['ADMIN', 'COORDENACAO'] },
  { href: '/admin/avaliacoes', label: 'Avaliações', icon: Star, roles: ['ADMIN', 'COORDENACAO'] },
  // Professor
  { href: '/professor/portal', label: 'Portal do Professor', icon: BookOpen, roles: ['PROFESSOR'] },
  { href: '/professor/registro-aula', label: 'Registro de Aula', icon: ClipboardList, roles: ['PROFESSOR'] },
  { href: '/professor/tarefas', label: 'Tarefas de Casa', icon: CheckSquare, roles: ['PROFESSOR'] },
  { href: '/professor/notas', label: 'Notas', icon: Star, roles: ['PROFESSOR'] },
  // Pedagogo
  { href: '/pedagogo/registros', label: 'Registros Pedagógicos', icon: Heart, roles: ['PEDAGOGO', 'COORDENACAO'] },
  // Shared
  { href: '/admin/alunos', label: 'Alunos', icon: UserCheck, roles: ['PEDAGOGO'] },
]

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ''

  const visibleItems = navItems.filter(item => !item.roles || item.roles.includes(role))

  const initials = session?.user?.name
    ?.split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?'

  return (
    <aside className={cn(
      'flex flex-col h-screen bg-gray-900 text-white transition-all duration-300 sticky top-0',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="bg-primary rounded-lg p-1.5">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-lg">Arcadia</span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto">
            <div className="bg-primary rounded-lg p-1.5">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="text-gray-400 hover:text-white hover:bg-gray-700 h-8 w-8"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-2">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                active
                  ? 'bg-primary text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-gray-700 p-4">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-white text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{session?.user?.name}</p>
              <p className="text-xs text-gray-400 truncate">{ROLE_LABELS[role] || role}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-gray-400 hover:text-white hover:bg-gray-700 h-8 w-8"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-white text-xs">{initials}</AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="text-gray-400 hover:text-white hover:bg-gray-700 h-7 w-7"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
