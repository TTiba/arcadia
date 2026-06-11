import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'PEDAGOGO', 'COORDENACAO'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const studentId = searchParams.get('studentId')
  const type = searchParams.get('type')

  const userEmail = session.user?.email || ''
  let schoolWhere = {}
  if (role !== 'ADMIN') {
    if (userEmail.includes('eeteixeira')) {
      schoolWhere = { student: { class: { school: { name: { contains: 'Anísio Teixeira' } } } } }
    } else if (userEmail.includes('eemlobato')) {
      schoolWhere = { student: { class: { school: { name: { contains: 'Monteiro Lobato' } } } } }
    }
  }

  const records = await prisma.pedagogicalRecord.findMany({
    where: {
      ...(studentId ? { studentId } : {}),
      ...(type ? { type: type as any } : {}),
      ...schoolWhere,
    },
    include: {
      student: { include: { class: true } },
      pedagogue: true,
    },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any).role
  if (!['ADMIN', 'PEDAGOGO', 'COORDENACAO'].includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const record = await prisma.pedagogicalRecord.create({
    data: {
      ...body,
      pedagogueId: (session.user as any).id,
      date: body.date ? new Date(body.date) : new Date(),
    },
    include: { student: true, pedagogue: true },
  })

  return NextResponse.json(record, { status: 201 })
}
