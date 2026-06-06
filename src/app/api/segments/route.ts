import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const segments = await prisma.segment.findMany({
    include: {
      grades: {
        include: {
          gradeSubjects: { include: { subject: true }, orderBy: { order: 'asc' } },
        },
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json(segments)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'COORDENACAO', 'DIRETOR'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nome obrigatório' }, { status: 400 })

  const segment = await prisma.segment.create({ data: { name: name.trim() } })
  return NextResponse.json(segment, { status: 201 })
}
