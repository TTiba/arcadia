import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveSchoolId, schoolWhere } from '@/lib/user-context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, BookOpen, School, ClipboardList,
  Star, CheckSquare, AlertTriangle, TrendingUp, TrendingDown,
  Link as LinkIcon, UserCheck, FileText, Sparkles, ArrowRight, CalendarCheck,
} from 'lucide-react'
import { ROLE_LABELS } from '@/lib/utils'
import Link from 'next/link'

interface AttentionItem {
  severity: 'CRITICO' | 'ATENCAO'
  title: string
  detail: string
  href?: string
}

async function getMetrics(role: string, userId: string, userEmail: string) {
  const schoolId = await resolveSchoolId(userId, role, userEmail)

  const now = new Date()
  const d30 = new Date(now); d30.setDate(d30.getDate() - 30); d30.setHours(0, 0, 0, 0)
  const d60 = new Date(now); d60.setDate(d60.getDate() - 60); d60.setHours(0, 0, 0, 0)

  const [
    totalStudents,
    newStudents30,
    totalClasses,
    teachersWithoutRecordCount,
    pedagogicalAlerts,
    recentRecords,
    school,
  ] = await Promise.all([
    prisma.student.count({ where: { status: 'ATIVO', ...schoolWhere.student(schoolId) } }),
    prisma.student.count({ where: { status: 'ATIVO', createdAt: { gte: d30 }, ...schoolWhere.student(schoolId) } }),
    prisma.class.count({ where: { active: true, ...schoolWhere.class(schoolId) } }),
    prisma.teacher.count({ where: { classRecords: { none: {} }, ...schoolWhere.teacher(schoolId) } }),
    prisma.pedagogicalRecord.count({ where: { resolved: false, ...schoolWhere.pedagogical(schoolId) } }),
    prisma.classRecord.findMany({
      take: 5,
      where: schoolWhere.classRecord(schoolId),
      orderBy: { createdAt: 'desc' },
      include: {
        teacher: { include: { user: true } },
        class: true,
        subject: true,
      },
    }),
    schoolId ? prisma.school.findUnique({ where: { id: schoolId }, select: { name: true, inepCode: true } }) : null,
  ])

  // Frequência: % de presenças nos últimos 30 dias e variação vs 30 dias anteriores
  const [attCurrent, attPrevious] = await Promise.all([
    prisma.studentAttendance.groupBy({
      by: ['status'],
      where: { date: { gte: d30 }, ...schoolWhere.attendance(schoolId) },
      _count: { id: true },
    }),
    prisma.studentAttendance.groupBy({
      by: ['status'],
      where: { date: { gte: d60, lt: d30 }, ...schoolWhere.attendance(schoolId) },
      _count: { id: true },
    }),
  ])
  const attRate = (rows: typeof attCurrent) => {
    const total = rows.reduce((a, r) => a + r._count.id, 0)
    if (!total) return null
    const present = rows.find(r => r.status === 'PRESENTE')?._count.id ?? 0
    return (present / total) * 100
  }
  const freqNow = attRate(attCurrent)
  const freqPrev = attRate(attPrevious)
  const freqDelta = freqNow !== null && freqPrev !== null ? freqNow - freqPrev : null

  // ─── Itens de "Requer atenção" ────────────────────────────────────────────────

  const attention: AttentionItem[] = []

  // Alunos com faltas acumuladas nos últimos 30 dias
  const faltasPorAluno = await prisma.studentAttendance.groupBy({
    by: ['studentId'],
    where: { status: 'FALTA', date: { gte: d30 }, ...schoolWhere.attendance(schoolId) },
    _count: { id: true },
    having: { id: { _count: { gte: 5 } } },
    orderBy: { _count: { id: 'desc' } },
    take: 3,
  })
  if (faltasPorAluno.length > 0) {
    const students = await prisma.student.findMany({
      where: { id: { in: faltasPorAluno.map(f => f.studentId) } },
      select: { id: true, name: true, class: { select: { name: true } } },
    })
    const byId = new Map(students.map(s => [s.id, s]))
    for (const f of faltasPorAluno) {
      const s = byId.get(f.studentId)
      if (!s) continue
      attention.push({
        severity: f._count.id >= 8 ? 'CRITICO' : 'ATENCAO',
        title: `${s.name}${s.class ? ` — ${s.class.name}` : ''}`,
        detail: `${f._count.id} faltas nos últimos 30 dias`,
        href: ['ADMIN', 'COORDENACAO', 'PEDAGOGO', 'DIRETOR'].includes(role) ? '/frequencia' : undefined,
      })
    }
  }

  // Registros pedagógicos abertos há mais tempo sem plano de ação
  const stalledRecords = await prisma.pedagogicalRecord.findMany({
    where: {
      resolved: false,
      actionPlan: null,
      confidentiality: { not: 'CONFIDENCIAL' },
      ...schoolWhere.pedagogical(schoolId),
    },
    orderBy: { date: 'asc' },
    take: 2,
    select: { title: true, date: true, student: { select: { name: true } } },
  })
  for (const r of stalledRecords) {
    const days = Math.floor((now.getTime() - new Date(r.date).getTime()) / 86400000)
    attention.push({
      severity: days >= 14 ? 'CRITICO' : 'ATENCAO',
      title: r.student.name,
      detail: `"${r.title}" aberto há ${days} dia${days === 1 ? '' : 's'} sem plano de ação`,
      href: ['ADMIN', 'COORDENACAO', 'PEDAGOGO'].includes(role) ? '/pedagogo/registros?filter=abertos' : undefined,
    })
  }

  // Professores sem nenhum registro de aula
  if (teachersWithoutRecordCount > 0 && ['ADMIN', 'COORDENACAO', 'DIRETOR'].includes(role)) {
    const teachersWithoutRecord = await prisma.teacher.findMany({
      where: { classRecords: { none: {} }, ...schoolWhere.teacher(schoolId) },
      take: 2,
      select: { user: { select: { name: true } } },
    })
    for (const t of teachersWithoutRecord) {
      attention.push({
        severity: 'ATENCAO',
        title: t.user.name,
        detail: 'Nenhum registro de aula no diário',
        href: '/admin/corpo-docente',
      })
    }
  }

  // Críticos primeiro
  attention.sort((a, b) => (b.severity === 'CRITICO' ? 1 : 0) - (a.severity === 'CRITICO' ? 1 : 0))

  return {
    schoolName: school?.name ?? null,
    totalStudents, newStudents30, totalClasses,
    freqNow, freqDelta,
    pedagogicalAlerts, teachersWithoutRecordCount,
    recentRecords,
    attention: attention.slice(0, 6),
  }
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Bom dia'
  if (hour < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const userEmail = session.user?.email || ''
  const metrics = await getMetrics(role, userId, userEmail)

  const firstName = session.user.name?.split(' ').find(p => p.length > 2 && !p.startsWith('Prof')) || session.user.name
  const now = new Date()
  const dateLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Frase de contexto: o que aguarda o usuário hoje
  const pendings: string[] = []
  if (metrics.pedagogicalAlerts > 0) pendings.push(`${metrics.pedagogicalAlerts} registro${metrics.pedagogicalAlerts === 1 ? '' : 's'} pedagógico${metrics.pedagogicalAlerts === 1 ? '' : 's'} aberto${metrics.pedagogicalAlerts === 1 ? '' : 's'}`)
  if (metrics.attention.some(a => a.severity === 'CRITICO')) pendings.push('alunos com faltas críticas')
  const contextLine = pendings.length
    ? `${dateLabel} · ${pendings.join(' e ')} aguardando sua atenção`
    : `${dateLabel} · nenhuma pendência crítica no momento`

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Saudação contextual */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {greetingForHour(now.getHours())}, {firstName}
          </h1>
          <p className="text-muted-foreground mt-1 first-letter:uppercase">{contextLine}</p>
          {metrics.schoolName && (
            <p className="text-xs text-muted-foreground mt-1">
              {metrics.schoolName} · {ROLE_LABELS[role] || role}
            </p>
          )}
        </div>

        {/* Métricas orientadas a insight */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Alunos ativos"
            value={metrics.totalStudents}
            icon={<Users className="h-5 w-5 text-primary" />}
            note={metrics.newStudents30 > 0 ? `+${metrics.newStudents30} nos últimos 30 dias` : 'Total matriculados'}
            href={['ADMIN', 'COORDENACAO', 'PEDAGOGO', 'DIRETOR'].includes(role) ? '/admin/alunos' : undefined}
          />
          <MetricCard
            title="Frequência (30 dias)"
            value={metrics.freqNow !== null ? `${metrics.freqNow.toFixed(1)}%` : '—'}
            icon={<CalendarCheck className="h-5 w-5 text-primary" />}
            delta={metrics.freqDelta}
            deltaSuffix=" p.p."
            note={metrics.freqNow === null ? 'Sem chamadas registradas' : undefined}
            href={['ADMIN', 'COORDENACAO', 'PEDAGOGO', 'DIRETOR'].includes(role) ? '/frequencia' : undefined}
          />
          <MetricCard
            title="Registros pedagógicos abertos"
            value={metrics.pedagogicalAlerts}
            icon={<AlertTriangle className="h-5 w-5 text-primary" />}
            note="Aguardando resolução"
            href={['ADMIN', 'COORDENACAO', 'PEDAGOGO'].includes(role) ? '/pedagogo/registros?filter=abertos' : undefined}
          />
          <MetricCard
            title="Professores sem diário"
            value={metrics.teachersWithoutRecordCount}
            icon={<ClipboardList className="h-5 w-5 text-primary" />}
            note="Sem registro de aula"
            href={['ADMIN', 'COORDENACAO', 'DIRETOR'].includes(role) ? '/admin/corpo-docente' : undefined}
          />
        </div>

        {/* Requer atenção + Registros recentes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="rounded-2xl border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-primary" />
                Requer atenção
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-4">
              {metrics.attention.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Tudo em dia — nenhum item crítico agora.
                </p>
              ) : (
                <div>
                  {metrics.attention.map((item, index) => {
                    const inner = (
                      <div
                        className={`flex items-center gap-3 py-3 ${
                          index < metrics.attention.length - 1 ? 'border-b border-border' : ''
                        } ${item.href ? 'group cursor-pointer' : ''}`}
                      >
                        <span
                          className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            item.severity === 'CRITICO'
                              ? 'bg-destructive/10 text-destructive'
                              : 'bg-warning/15 text-foreground'
                          }`}
                        >
                          {item.severity === 'CRITICO' ? 'Crítico' : 'Atenção'}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate leading-tight">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
                        </div>
                        {item.href && (
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0 group-hover:text-primary transition-colors" />
                        )}
                      </div>
                    )
                    return item.href
                      ? <Link key={index} href={item.href} className="block">{inner}</Link>
                      : <div key={index}>{inner}</div>
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="rounded-2xl border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                Registros de Aula Recentes
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-4">
              {metrics.recentRecords.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  Nenhum registro ainda.
                </p>
              ) : (
                <div>
                  {metrics.recentRecords.map((record, index) => (
                    <div
                      key={record.id}
                      className={`flex items-start gap-3 py-3 ${
                        index < metrics.recentRecords.length - 1 ? 'border-b border-border' : ''
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <ClipboardList className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate leading-tight">{record.teacher.user.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {record.class.name}{record.subject ? ` · ${record.subject.name}` : ''}
                        </p>
                        {record.contentDeveloped && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {record.contentDeveloped}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
                        {new Date(record.date).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Acesso rápido */}
        <Card className="rounded-2xl border border-border shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              Acesso Rápido
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {['ADMIN', 'COORDENACAO'].includes(role) && <>
                <QuickLink href="/admin/turmas" label="Gerenciar Turmas" icon={<School className="h-5 w-5 text-primary" />} />
                <QuickLink href="/admin/alunos" label="Ver Alunos" icon={<UserCheck className="h-5 w-5 text-primary" />} />
                <QuickLink href="/admin/corpo-docente" label="Corpo Docente" icon={<Users className="h-5 w-5 text-primary" />} />
                <QuickLink href="/admin/avaliacoes" label="Avaliações" icon={<Star className="h-5 w-5 text-primary" />} />
              </>}
              {['PEDAGOGO', 'COORDENACAO'].includes(role) &&
                <QuickLink href="/pedagogo/registros" label="Registros Pedag." icon={<FileText className="h-5 w-5 text-primary" />} />
              }
              {['PROFESSOR'].includes(role) && <>
                <QuickLink href="/professor/portal" label="Portal do Professor" icon={<BookOpen className="h-5 w-5 text-primary" />} />
                <QuickLink href="/professor/registro-aula" label="Registro de Aula" icon={<ClipboardList className="h-5 w-5 text-primary" />} />
                <QuickLink href="/professor/chamada" label="Fazer Chamada" icon={<CalendarCheck className="h-5 w-5 text-primary" />} />
                <QuickLink href="/professor/notas" label="Lançar Notas" icon={<Star className="h-5 w-5 text-primary" />} />
              </>}
              <QuickLink href="/mensagens" label="Mensagens" icon={<FileText className="h-5 w-5 text-primary" />} />
              <QuickLink href="/ai/assistente" label="Assistente IA" icon={<Sparkles className="h-5 w-5 text-primary" />} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({
  title, value, icon, note, delta, deltaSuffix = '', href,
}: {
  title: string
  value: number | string
  icon: React.ReactNode
  note?: string
  delta?: number | null
  deltaSuffix?: string
  href?: string
}) {
  const showDelta = delta !== undefined && delta !== null && Math.abs(delta) >= 0.05
  const deltaUp = showDelta && delta! > 0
  const inner = (
    <Card className={`rounded-2xl border border-border shadow-none transition-colors h-full ${href ? 'hover:border-ring hover:bg-accent/40 cursor-pointer' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-4xl font-bold tracking-tight font-serif mt-1">{value}</p>
            {showDelta ? (
              <p className={`text-xs mt-1 flex items-center gap-1 font-medium ${deltaUp ? 'text-success' : 'text-destructive'}`}>
                {deltaUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {deltaUp ? '+' : ''}{delta!.toFixed(1)}{deltaSuffix} vs. 30 dias anteriores
              </p>
            ) : note ? (
              <p className="text-xs text-muted-foreground mt-1">{note}</p>
            ) : null}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="p-2.5 rounded-xl bg-muted/60 shrink-0">{icon}</div>
            {href && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />}
          </div>
        </div>
      </CardContent>
    </Card>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

function QuickLink({
  href,
  label,
  icon,
}: {
  href: string
  label: string
  icon: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 p-3 rounded-xl border border-border hover:border-ring hover:bg-accent transition-colors group"
    >
      <div className="shrink-0">{icon}</div>
      <span className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
        {label}
      </span>
    </Link>
  )
}
