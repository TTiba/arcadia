import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, BookOpen, School, ClipboardList, Star, CheckSquare, AlertTriangle, TrendingUp } from 'lucide-react'
import { ROLE_LABELS } from '@/lib/utils'

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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">
          Bem-vindo, {session.user.name} — {ROLE_LABELS[role] || role}
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Alunos Ativos"
          value={metrics.totalStudents}
          icon={<Users className="h-5 w-5 text-blue-600" />}
          bg="bg-blue-50"
        />
        <MetricCard
          title="Turmas Ativas"
          value={metrics.totalClasses}
          icon={<School className="h-5 w-5 text-green-600" />}
          bg="bg-green-50"
        />
        <MetricCard
          title="Aulas Cadastradas"
          value={metrics.totalLessons}
          icon={<BookOpen className="h-5 w-5 text-purple-600" />}
          bg="bg-purple-50"
        />
        <MetricCard
          title="Professores"
          value={metrics.totalTeachers}
          icon={<Star className="h-5 w-5 text-amber-600" />}
          bg="bg-amber-50"
        />
      </div>

      {/* Alert Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <AlertCard
          title="Alunos sem Tarefas"
          value={metrics.studentsWithoutHomework}
          description="Alunos sem nenhuma entrega registrada"
          icon={<CheckSquare className="h-5 w-5 text-orange-500" />}
          color="orange"
        />
        <AlertCard
          title="Profs. sem Registro"
          value={metrics.teachersWithoutRecord}
          description="Professores sem registro de aula"
          icon={<ClipboardList className="h-5 w-5 text-red-500" />}
          color="red"
        />
        <AlertCard
          title="Alertas Pedagógicos"
          value={metrics.pedagogicalAlerts}
          description="Registros pedagógicos abertos"
          icon={<AlertTriangle className="h-5 w-5 text-yellow-500" />}
          color="yellow"
        />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Registros de Aula Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.recentRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum registro ainda.</p>
            ) : (
              <div className="space-y-3">
                {metrics.recentRecords.map((record) => (
                  <div key={record.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <ClipboardList className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{record.teacher.user.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {record.class.name} {record.subject ? `· ${record.subject.name}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{record.contentDeveloped}</p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {new Date(record.date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Resumo para IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Este sistema coleta dados estruturados que permitem à IA responder:</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Quais alunos não realizaram tarefas?</li>
                <li>Quais turmas têm mais pendências?</li>
                <li>Quais professores não registraram aulas?</li>
                <li>Quais componentes têm menor desempenho?</li>
                <li>Quais alunos precisam de acompanhamento?</li>
              </ul>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-700 font-medium">
                  Dados coletados: {metrics.totalStudents} alunos · {metrics.totalClasses} turmas · {metrics.totalLessons} aulas · {metrics.totalTeachers} professores
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon, bg }: { title: string; value: number; icon: React.ReactNode; bg: string }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
          </div>
          <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function AlertCard({ title, value, description, icon, color }: {
  title: string; value: number; description: string; icon: React.ReactNode; color: string
}) {
  const borderColors: Record<string, string> = {
    orange: 'border-orange-200',
    red: 'border-red-200',
    yellow: 'border-yellow-200',
  }
  return (
    <Card className={`border-2 ${borderColors[color] || ''}`}>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          {icon}
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
