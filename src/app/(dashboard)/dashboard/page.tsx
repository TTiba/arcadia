import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Users, BookOpen, School, ClipboardList,
  Star, CheckSquare, AlertTriangle, TrendingUp,
  Link as LinkIcon, UserCheck, FileText, Sparkles, ArrowRight,
} from 'lucide-react'
import { ROLE_LABELS } from '@/lib/utils'
import Link from 'next/link'

async function getMetrics(role: string, userId: string) {
  const [totalStudents, totalClasses, totalLessons, totalTeachers] = await Promise.all([
    prisma.student.count({ where: { status: 'ATIVO' } }),
    prisma.class.count({ where: { active: true } }),
    prisma.lesson.count({ where: { active: true } }),
    prisma.teacher.count(),
  ])

  const studentsWithoutHomework = await prisma.student.count({
    where: {
      status: 'ATIVO',
      homeworkSubmissions: { none: {} },
    }
  })

  const teachersWithoutRecord = await prisma.teacher.count({
    where: {
      classRecords: { none: {} },
    }
  })

  const pendingRecords = await prisma.classRecord.count({
    where: {
      pending: { not: null },
    }
  })

  const recentRecords = await prisma.classRecord.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
    include: {
      teacher: { include: { user: true } },
      class: true,
      subject: true,
    }
  })

  const pedagogicalAlerts = await prisma.pedagogicalRecord.count({
    where: { resolved: false }
  })

  return {
    totalStudents, totalClasses, totalLessons, totalTeachers,
    studentsWithoutHomework, teachersWithoutRecord, pendingRecords,
    recentRecords, pedagogicalAlerts,
  }
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  if (!session) return null

  const role = (session.user as any).role
  const userId = (session.user as any).id
  const metrics = await getMetrics(role, userId)

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page heading */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Bem-vindo, {session.user.name} — {ROLE_LABELS[role] || role}
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="Alunos Ativos"
            value={metrics.totalStudents}
            icon={<Users className="h-5 w-5 text-primary" />}
            note="Total matriculados"
            href={['ADMIN','COORDENACAO','PEDAGOGO'].includes(role) ? '/admin/alunos' : undefined}
          />
          <MetricCard
            title="Turmas Ativas"
            value={metrics.totalClasses}
            icon={<School className="h-5 w-5 text-primary" />}
            note="Em andamento"
            href={['ADMIN','COORDENACAO'].includes(role) ? '/admin/turmas' : undefined}
          />
          <MetricCard
            title="Aulas Cadastradas"
            value={metrics.totalLessons}
            icon={<BookOpen className="h-5 w-5 text-primary" />}
            note="No sistema"
            href={['ADMIN','COORDENACAO'].includes(role) ? '/admin/aulas' : '/professor/portal'}
          />
          <MetricCard
            title="Professores"
            value={metrics.totalTeachers}
            icon={<Star className="h-5 w-5 text-primary" />}
            note="Cadastrados"
            href={['ADMIN','COORDENACAO'].includes(role) ? '/admin/professores' : undefined}
          />
        </div>

        {/* Alert Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <AlertCard
            title="Alunos sem Tarefas"
            value={metrics.studentsWithoutHomework}
            description="Alunos sem nenhuma entrega registrada"
            icon={<CheckSquare className="h-4 w-4 text-warning" />}
            accentStyle={{ borderLeftColor: 'hsl(44 100% 41%)' }}
            href={['ADMIN','COORDENACAO','PEDAGOGO'].includes(role) ? '/admin/alunos' : undefined}
          />
          <AlertCard
            title="Profs. sem Registro"
            value={metrics.teachersWithoutRecord}
            description="Professores sem registro de aula"
            icon={<ClipboardList className="h-4 w-4 text-destructive" />}
            accentStyle={{ borderLeftColor: 'hsl(0 84% 60%)' }}
            href={['ADMIN','COORDENACAO'].includes(role) ? '/admin/professores' : undefined}
          />
          <AlertCard
            title="Alertas Pedagógicos"
            value={metrics.pedagogicalAlerts}
            description="Registros pedagógicos abertos"
            icon={<AlertTriangle className="h-4 w-4 text-warning" />}
            accentStyle={{ borderLeftColor: 'hsl(44 100% 41%)' }}
            href={['ADMIN','COORDENACAO','PEDAGOGO'].includes(role) ? '/pedagogo/registros' : undefined}
          />
        </div>

        {/* Recent Activity + Quick Access */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent records */}
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

          {/* Quick Access */}
          <Card className="rounded-2xl border border-border shadow-none">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-primary" />
                Acesso Rápido
              </CardTitle>
            </CardHeader>
            <CardContent className="px-6 pb-4">
              <div className="grid grid-cols-2 gap-3">
                {['ADMIN', 'COORDENACAO'].includes(role) && <>
                  <QuickLink href="/admin/turmas" label="Gerenciar Turmas" icon={<School className="h-5 w-5 text-primary" />} />
                  <QuickLink href="/admin/alunos" label="Ver Alunos" icon={<UserCheck className="h-5 w-5 text-primary" />} />
                  <QuickLink href="/admin/professores" label="Professores" icon={<Users className="h-5 w-5 text-primary" />} />
                  <QuickLink href="/admin/avaliacoes" label="Avaliações" icon={<Star className="h-5 w-5 text-primary" />} />
                </>}
                {['PEDAGOGO', 'COORDENACAO'].includes(role) &&
                  <QuickLink href="/pedagogo/registros" label="Registros Pedag." icon={<FileText className="h-5 w-5 text-primary" />} />
                }
                {['PROFESSOR'].includes(role) && <>
                  <QuickLink href="/professor/portal" label="Portal do Professor" icon={<BookOpen className="h-5 w-5 text-primary" />} />
                  <QuickLink href="/professor/registro-aula" label="Registro de Aula" icon={<ClipboardList className="h-5 w-5 text-primary" />} />
                  <QuickLink href="/professor/notas" label="Lançar Notas" icon={<Star className="h-5 w-5 text-primary" />} />
                </>}
                <QuickLink href="/mensagens" label="Mensagens" icon={<FileText className="h-5 w-5 text-primary" />} />
                <QuickLink href="/ai/assistente" label="Assistente IA" icon={<Sparkles className="h-5 w-5 text-primary" />} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function MetricCard({
  title, value, icon, note, href,
}: {
  title: string
  value: number
  icon: React.ReactNode
  note?: string
  href?: string
}) {
  const inner = (
    <Card className={`rounded-2xl border border-border shadow-none transition-colors ${href ? 'hover:border-ring hover:bg-accent/40 cursor-pointer' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-4xl font-bold tracking-tight font-serif mt-1">{value}</p>
            {note && <p className="text-xs text-muted-foreground mt-1">{note}</p>}
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

function AlertCard({
  title, value, description, icon, accentStyle, href,
}: {
  title: string
  value: number
  description: string
  icon: React.ReactNode
  accentStyle?: React.CSSProperties
  href?: string
}) {
  const inner = (
    <Card
      className={`rounded-2xl border border-border shadow-none border-l-4 transition-colors ${href ? 'hover:border-ring hover:bg-accent/40 cursor-pointer' : ''}`}
      style={accentStyle}
    >
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-muted/60 shrink-0">{icon}</div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold font-serif leading-tight">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
          {href && <ArrowRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
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
