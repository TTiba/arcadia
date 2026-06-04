import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const ALLOW_SEND: Record<string, string[]> = {
  ADMIN:        ['ADMIN', 'COORDENACAO', 'PEDAGOGO', 'PROFESSOR', 'VISUALIZACAO'],
  COORDENACAO:  ['PEDAGOGO', 'PROFESSOR'],
  PEDAGOGO:     ['PROFESSOR', 'COORDENACAO'],
  PROFESSOR:    ['PEDAGOGO', 'COORDENACAO'],
  VISUALIZACAO: [],
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Direção', COORDENACAO: 'Coordenação',
  PEDAGOGO: 'Pedagogo(a)', PROFESSOR: 'Professor(a)', VISUALIZACAO: 'Visualização',
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json([])
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const allowedRoles = ALLOW_SEND[role] ?? []
  if (allowedRoles.length === 0) return NextResponse.json([])

  const contacts = await prisma.user.findMany({
    where: { role: { in: allowedRoles }, id: { not: userId }, active: true },
    select: { id: true, name: true, role: true, email: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

  return NextResponse.json(contacts.map(c => ({ ...c, roleLabel: ROLE_LABELS[c.role] ?? c.role })))
}
