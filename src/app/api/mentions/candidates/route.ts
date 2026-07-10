import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getSchoolScope, schoolWhere } from '@/lib/user-context'

// Candidatos para o autocomplete de menção (@): alunos da turma informada
// (ou da escola, se nenhuma turma) + corpo docente da escola do usuário.
// Sempre escopado pela sessão — nunca expõe nomes de outra escola.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const schoolId = await getSchoolScope(session)
  const classId = req.nextUrl.searchParams.get('classId') || undefined

  if (classId && schoolId) {
    const cls = await prisma.class.findFirst({ where: { id: classId, schoolId }, select: { id: true } })
    if (!cls) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [students, staff] = await Promise.all([
    prisma.student.findMany({
      where: classId
        ? { classId }
        : { status: 'ATIVO', ...schoolWhere.student(schoolId) },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 1500,
    }),
    prisma.user.findMany({
      where: { active: true, ...schoolWhere.user(schoolId) },
      select: { id: true, name: true, teacher: { select: { id: true } } },
      orderBy: { name: 'asc' },
      take: 300,
    }),
  ])

  return NextResponse.json({
    candidates: [
      ...students.map(s => ({ id: s.id, name: s.name, type: 'aluno' as const })),
      ...staff.map(u =>
        u.teacher
          ? { id: u.teacher.id, name: u.name, type: 'professor' as const }
          : { id: u.id, name: u.name, type: 'usuario' as const }
      ),
    ],
  })
}
