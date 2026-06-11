import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BookOpen, Users, Video, Link as LinkIcon, FileText, ClipboardList, CheckSquare } from 'lucide-react'
import { getEmbedUrl, formatDate } from '@/lib/utils'

export default async function ProfessorPortalPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const userId = (session.user as any).id
  const role = (session.user as any).role

  if (role !== 'PROFESSOR' && role !== 'ADMIN') redirect('/dashboard')

  const teacher = role === 'PROFESSOR' ? await prisma.teacher.findUnique({
    where: { userId },
    include: {
      teacherClasses: {
        include: { class: true, subject: true }
      },
      teacherSubjects: { include: { subject: true } }
    }
  }) : null

  // Get lessons based on teacher's assignments
  const teacherClassIds = teacher?.teacherClasses.map(tc => tc.classId) || []
  const teacherSubjectIds = teacher?.teacherSubjects.map(ts => ts.subjectId) || []

  const lessons = await prisma.lesson.findMany({
    where: role === 'PROFESSOR' ? {
      active: true,
      OR: [
        { subjectId: { in: teacherSubjectIds } },
        { subjects: { some: { id: { in: teacherSubjectIds } } } },
        {
          AND: [
            { subjectId: null },
            { subjects: { none: {} } },
            { lessonClasses: { some: { classId: { in: teacherClassIds } } } }
          ]
        }
      ]
    } : { active: true },
    include: {
      subject: true,
      subjects: true,
      lessonClasses: { include: { class: true } },
      materials: { orderBy: { order: 'asc' } },
      homework: { where: { active: true } },
      _count: { select: { classRecords: true } }
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  const myClasses = teacher?.teacherClasses.map(tc => tc.class) || []
  const uniqueClasses = Array.from(new Map(myClasses.map(c => [c.id, c])).values())

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" /> Portal do Professor</h1>
        <p className="text-muted-foreground text-sm">Olá, {session.user.name} — visualizando suas aulas e turmas</p>
      </div>

      {/* My Classes */}
      {uniqueClasses.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Minhas Turmas</h2>
          <div className="flex flex-wrap gap-2">
            {uniqueClasses.map(c => (
              <Badge key={c.id} variant="info" className="text-sm px-3 py-1">
                <Users className="h-3 w-3 mr-1" /> {c.name}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Lessons */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Aulas Disponíveis ({lessons.length})
        </h2>
        <div className="space-y-4">
          {lessons.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma aula disponível.</CardContent></Card>
          ) : lessons.map(lesson => (
            <Card key={lesson.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-base">{lesson.title}</CardTitle>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {lesson.subjects && lesson.subjects.length > 1 ? (
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                          Interdisciplinar ({lesson.subjects.map(s => s.name).join(', ')})
                        </Badge>
                      ) : lesson.subject ? (
                        <Badge variant="outline" className="text-xs">{lesson.subject.name}</Badge>
                      ) : lesson.subjects && lesson.subjects.length === 1 ? (
                        <Badge variant="outline" className="text-xs">{lesson.subjects[0].name}</Badge>
                      ) : null}
                      {lesson.lessonClasses.map(lc => (
                        <Badge key={lc.class.name} variant="info" className="text-xs">{lc.class.name}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                    <span className="flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" /> {lesson._count.classRecords} registros</span>
                    <span className="flex items-center gap-1"><CheckSquare className="h-3.5 w-3.5" /> {lesson.homework.length} tarefas</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {lesson.description && <p className="text-sm text-muted-foreground">{lesson.description}</p>}

                {/* Videos embedded */}
                {lesson.materials.filter(m => m.type === 'VIDEO').map((m, i) => {
                  const embedUrl = m.url ? getEmbedUrl(m.url) : null
                  return (
                    <div key={i}>
                      <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
                        <Video className="h-4 w-4 text-red-500" /> {m.title}
                      </p>
                      {embedUrl ? (
                        <div className="aspect-video rounded-lg overflow-hidden border">
                          <iframe
                            src={embedUrl}
                            className="w-full h-full"
                            allowFullScreen
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          />
                        </div>
                      ) : (
                        <a href={m.url || '#'} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline">{m.url}</a>
                      )}
                    </div>
                  )
                })}

                {/* Other materials */}
                {lesson.materials.filter(m => m.type !== 'VIDEO').length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {lesson.materials.filter(m => m.type !== 'VIDEO').map((m, i) => (
                      <a
                        key={i}
                        href={m.url || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm hover:bg-muted transition-colors"
                      >
                        {m.type === 'LINK' ? <LinkIcon className="h-3.5 w-3.5 text-green-500" /> : <FileText className="h-3.5 w-3.5 text-blue-500" />}
                        {m.title}
                      </a>
                    ))}
                  </div>
                )}

                {/* Homework summary */}
                {lesson.homework.length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs font-medium text-amber-800 mb-1">Tarefas vinculadas:</p>
                    {lesson.homework.map(hw => (
                      <div key={hw.id} className="text-xs text-amber-700 flex items-center justify-between">
                        <span>{hw.title}</span>
                        {hw.dueDate && <span>Prazo: {formatDate(hw.dueDate)}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
