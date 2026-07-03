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

// ─── Escopo por escola ────────────────────────────────────────────────────────
// Fonte canônica: User.schoolId (relação no banco). Escolas são identificadas
// pelo código INEP (School.inepCode). O fallback por domínio de email cobre
// bancos ainda não re-seedados e será removido depois da migração.

const LEGACY_EMAIL_SCHOOL_PATTERNS: [string, string][] = [
  ['eeteixeira', 'Anísio Teixeira'],
  ['eemlobato', 'Monteiro Lobato'],
]

// Resolve a escola do usuário. Retorna null = sem restrição (visão de rede:
// ADMIN, DIRETOR e usuários sem vínculo de escola com papel de secretaria).
export async function resolveSchoolId(
  userId: string,
  role: string,
  email?: string | null
): Promise<string | null> {
  if (role === 'ADMIN' || role === 'DIRETOR') return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { schoolId: true },
  })
  if (user?.schoolId) return user.schoolId

  // Fallback legado por email — remove quando todos os bancos tiverem schoolId
  const pattern = LEGACY_EMAIL_SCHOOL_PATTERNS.find(([domain]) => email?.includes(domain))
  if (pattern) {
    const school = await prisma.school.findFirst({
      where: { name: { contains: pattern[1] } },
      select: { id: true },
    })
    if (school) return school.id
  }

  return null
}

export async function getSchoolScope(session: Session): Promise<string | null> {
  const userId = (session.user as any).id
  const role = (session.user as any).role
  return resolveSchoolId(userId, role, session.user?.email)
}

// Formas de `where` por entidade — todas colapsam para {} quando schoolId é null
export const schoolWhere = {
  school:      (sid: string | null) => (sid ? { id: sid } : {}),
  class:       (sid: string | null) => (sid ? { schoolId: sid } : {}),
  student:     (sid: string | null) => (sid ? { class: { schoolId: sid } } : {}),
  lesson:      (sid: string | null) => (sid ? { lessonClasses: { some: { class: { schoolId: sid } } } } : {}),
  teacher:     (sid: string | null) => (sid ? { user: { schoolId: sid } } : {}),
  user:        (sid: string | null) => (sid ? { schoolId: sid } : {}),
  classRecord: (sid: string | null) => (sid ? { class: { schoolId: sid } } : {}),
  pedagogical: (sid: string | null) => (sid ? { student: { class: { schoolId: sid } } } : {}),
  homework:    (sid: string | null) => (sid ? { class: { schoolId: sid } } : {}),
  assessment:  (sid: string | null) => (sid ? { class: { schoolId: sid } } : {}),
  attendance:  (sid: string | null) => (sid ? { class: { schoolId: sid } } : {}),
}

export async function buildUserContext(session: Session): Promise<UserContext> {
  const userId = (session.user as any).id
  const role = (session.user as any).role

  let allowedClassIds: string[] | null = null
  let allowedSubjectIds: string[] | null = null

  if (role !== 'ADMIN' && role !== 'DIRETOR') {
    const schoolId = await resolveSchoolId(userId, role, session.user?.email)

    if (schoolId) {
      const schoolClasses = await prisma.class.findMany({
        where: { active: true, schoolId },
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
