import { Session } from 'next-auth'
import { prisma } from './prisma'

export interface UserContext {
  userId: string
  role: string
  // null = unrestricted (ADMIN, COORDENACAO, PEDAGOGO, VISUALIZACAO)
  // string[] = only these classes (PROFESSOR)
  allowedClassIds: string[] | null
  allowedSubjectIds: string[] | null
}

export async function buildUserContext(session: Session): Promise<UserContext> {
  const userId = (session.user as any).id
  const role = (session.user as any).role

  let allowedClassIds: string[] | null = null
  let allowedSubjectIds: string[] | null = null

  if (role !== 'ADMIN' && role !== 'DIRETOR') {
    const userEmail = session.user?.email || ''
    let schoolNamePattern = ''
    if (userEmail.includes('eeteixeira')) {
      schoolNamePattern = 'Anísio Teixeira'
    } else if (userEmail.includes('eemlobato')) {
      schoolNamePattern = 'Monteiro Lobato'
    }

    if (schoolNamePattern) {
      const schoolClasses = await prisma.class.findMany({
        where: {
          active: true,
          school: { name: { contains: schoolNamePattern } }
        },
        select: { id: true }
      })
      const schoolClassIds = schoolClasses.map(c => c.id)

      if (role === 'PROFESSOR') {
        const teacher = await prisma.teacher.findUnique({
          where: { userId },
          include: {
            teacherClasses: true,
            teacherSubjects: true,
          },
        })
        if (teacher) {
          allowedClassIds = teacher.teacherClasses
            .map(tc => tc.classId)
            .filter(cid => schoolClassIds.includes(cid))
          allowedSubjectIds = Array.from(new Set(teacher.teacherSubjects.map(ts => ts.subjectId)))
        } else {
          allowedClassIds = []
          allowedSubjectIds = []
        }
      } else {
        allowedClassIds = schoolClassIds
      }
    } else {
      allowedClassIds = []
    }
  } else {
    // ADMIN and DIRETOR are unrestricted globally
    allowedClassIds = null
  }

  return { userId, role, allowedClassIds, allowedSubjectIds }
}

// Apply class-level scoping to a Prisma `where` clause that contains a `classId` field
export function applyClassScope(
  where: Record<string, unknown>,
  ctx: UserContext,
  requestedClassId?: string | number
): Record<string, unknown> {
  const allowed = ctx.allowedClassIds

  if (allowed === null) {
    // Unrestricted — only apply the explicit filter if one was requested
    if (requestedClassId) where.classId = requestedClassId
    return where
  }

  if (allowed.length === 0) {
    // No access at all
    where.classId = '__no_access__'
    return where
  }

  if (requestedClassId) {
    // Honor the request only if the class is in the allowed list
    where.classId = allowed.includes(String(requestedClassId)) ? requestedClassId : '__no_access__'
  } else {
    where.classId = { in: allowed }
  }

  return where
}

// Apply student-level scoping (via their class) for queries that go through the Student model
export function applyStudentScope(
  where: Record<string, unknown>,
  ctx: UserContext,
  requestedClassId?: string | number
): Record<string, unknown> {
  const allowed = ctx.allowedClassIds

  if (allowed === null) {
    if (requestedClassId) where.student = { classId: requestedClassId }
    return where
  }

  if (allowed.length === 0) {
    where.student = { classId: '__no_access__' }
    return where
  }

  if (requestedClassId) {
    const cid = String(requestedClassId)
    where.student = { classId: allowed.includes(cid) ? cid : '__no_access__' }
  } else {
    where.student = { classId: { in: allowed } }
  }

  return where
}
