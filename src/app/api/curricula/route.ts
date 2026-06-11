import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const curricula = await prisma.curriculum.findMany({
      where: { active: true },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(curricula)
  } catch (error: any) {
    console.error('[API Curricula] GET error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['ADMIN', 'COORDENACAO'].includes((session.user as any).role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { name, description, saebDescriptorIds } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'Nome do currículo é obrigatório' }, { status: 400 })

    const created = await prisma.$transaction(async (tx) => {
      const curr = await tx.curriculum.create({
        data: { name: name.trim(), description: description?.trim() },
      })

      if (Array.isArray(saebDescriptorIds) && saebDescriptorIds.length > 0) {
        await tx.curriculumSaebDescriptor.createMany({
          data: saebDescriptorIds.map((sdId: string) => ({
            curriculumId: curr.id,
            saebDescriptorId: sdId,
          })),
        })
      }

      return curr
    })

    return NextResponse.json(created, { status: 201 })
  } catch (error: any) {
    console.error('[API Curricula] POST error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
