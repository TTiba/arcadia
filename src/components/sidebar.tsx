'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { cn } from '@/lib/utils'
import {
  GraduationCap, LayoutDashboard, Users, BookOpen, School,
  ClipboardList, FileText, CheckSquare, Star, Heart,
  LogOut, ChevronLeft, ChevronRight, UserCheck, Sparkles,
} from 'lucide-react'
import { Avatar, AvatarFallback } from './ui/avatar'
import { ROLE_LABELS } from '@/lib/utils'

interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles?: string[]
  group: string
}

const navItems: NavItem[] = [
  // GESTÃO
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'GESTÃO' },
  { href: '/admin/turmas', label: 'Turmas', icon: School, roles: ['ADMIN', 'COORDENACAO'], group: 'GESTÃO' },
  { href: '/admin/professores', label: 'Professores', icon: Users, roles: ['ADMIN', 'COORDENACAO'], group: 'GESTÃO' },
  { href: '/admin/alunos', label: 'Alunos', icon: UserCheck, roles: ['ADMIN', 'COORDENACAO'], group: 'GESTÃO' },
  { href: '/admin/aulas', label: 'Aulas', icon: BookOpen, roles: ['ADMIN', 'COORDENACAO'], group: 'GESTÃO' },
  { href: '/admin/avaliacoes', label: 'Avaliações', icon: Star, roles: ['ADMIN', 'COORDENACAO'], group: 'GESTÃO' },
  // Professor portal items go in GESTÃO too
  { href: '/professor/portal', label: 'Portal do Professor', icon: BookOpen, roles: ['PROFESSOR'], group: 'GESTÃO' },
  { href: '/professor/registro-aula', label: 'Registro de Aula', icon: ClipboardList, roles: ['PROFESSOR'], group: 'GESTÃO' },
  { href: '/professor/tarefas', label: 'Tarefas de Casa', icon: CheckSquare, roles: ['PROFESSOR'], group: 'GESTÃO' },
  { href: '/professor/notas', label: 'Notas', icon: Star, roles: ['PROFESSOR'], group: 'GESTÃO' },
  { href: '/admin/alunos', label: 'Alunos', icon: UserCheck, roles: ['PEDAGOGO'], group: 'GESTÃO' },
  // PEDAGÓGICO
  { href: '/pedagogo/registros', label: 'Registros Pedagógicos', icon: Heart, roles: ['PEDAGOGO', 'COORDENACAO'], group: 'PEDAGÓGICO' },
  // INTELIGÊNCIA
  { href: '/meu-arcadia', label: 'Meu Arcadia', icon: Sparkles, group: 'INTELIGÊNCIA' },
  { href: '/ai/assistente', label: 'Assistente IA', icon: Sparkles, group: 'INTELIGÊNCIA' },
]

const GROUP_ORDER = ['GESTÃO', 'PEDAGÓGICO', 'INTELIGÊNCIA']

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as any)?.role || ''

  const visibleItems = navItems.filter(item => !item.roles || item.roles.includes(role))

  // Deduplicate by href+label
  const seen = new Set<string>()
  const dedupedItems = visibleItems.filter(item => {
    const key = `${item.href}-${item.label}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  const grouped = GROUP_ORDER.reduce<Record<string, NavItem[]>>((acc, group) => {
    const items = dedupedItems.filter(item => item.group === group)
    if (items.length > 0) acc[group] = items
    return acc
  }, {})

  const initials = session?.user?.name
    ?.split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase() || '?'

  return (
    <aside
      className={cn(
        'flex flex-col h-screen bg-sidebar-bg border-r border-sidebar-border transition-all duration-300 sticky top-0 shrink-0',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* Logo area */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="bg-teal rounded-lg p-1.5 shrink-0">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
            <span
              className="font-serif text-lg font-semibold tracking-wide"
              style={{ color: 'hsl(45 20% 92%)' }}
            >
              Arcadia
            </span>
          </div>
        )}
        {collapsed && (
          <div className="mx-auto">
            <div className="bg-teal rounded-lg p-1.5">
              <GraduationCap className="h-4 w-4 text-white" />
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            'flex items-center justify-center h-6 w-6 rounded-md transition-colors shrink-0',
            'text-sidebar-text hover:text-white hover:bg-sidebar-hover',
            collapsed && 'hidden'
          )}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {collapsed && (
          <button
            onClick={() => setCollapsed(false)}
            className="absolute right-0 translate-x-full top-4 flex items-center justify-center h-6 w-5 rounded-r-md bg-sidebar-border text-sidebar-text hover:text-white transition-colors z-10"
            aria-label="Expandir menu"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
        {GROUP_ORDER.map(group => {
          const items = grouped[group]
          if (!items || items.length === 0) return null
          return (
            <div key={group}>
              {!collapsed && (
                <p className="text-[10px] font-semibold tracking-widest uppercase text-sidebar-text-muted px-2 mb-1.5">
                  {group}
                </p>
              )}
              <div className="space-y-0.5">
                {items.map(item => {
                  const Icon = item.icon
                  const active =
                    pathname === item.href ||
                    (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={`${item.href}-${item.label}`}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'flex items-center gap-3 px-2.5 py-2 rounded-lg text-sm transition-colors',
                        collapsed && 'justify-center',
                        active
                          ? 'bg-sidebar-active text-white'
                          : 'text-sidebar-text hover:bg-sidebar-hover hover:text-white'
                      )}
                    >
                      <Icon className="h-[18px] w-[18px] shrink-0" />
                      {!collapsed && <span className="truncate leading-none">{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="flex items-center gap-2.5">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-teal text-white text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate leading-tight" style={{ color: 'hsl(45 20% 92%)' }}>
                {session?.user?.name}
              </p>
              <p className="text-xs truncate leading-tight text-sidebar-text-muted">
                {ROLE_LABELS[role] || role}
              </p>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center justify-center h-7 w-7 rounded-md text-sidebar-text hover:text-white hover:bg-sidebar-hover transition-colors shrink-0"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-teal text-white text-xs font-medium">
                {initials}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="flex items-center justify-center h-7 w-7 rounded-md text-sidebar-text hover:text-white hover:bg-sidebar-hover transition-colors"
              title="Sair"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>
    </aside>
  )
}
