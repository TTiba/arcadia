import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// PATCH /api/attendance/[id]
// Body: { status, justification }
// Allows coordinator/pedagogo/admin to justify or correct an absence
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO', 'PEDAGOGO'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden — only coordinator/pedagogue/admin can justify absences' }, { status: 403 })
  }

  const { id } = params
  const body = await req.json()
  const { status, justification } = body

  const validStatuses = ['FALTA', 'FALTA_JUSTIFICADA', 'PRESENTE']
  if (status && !validStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const record = await prisma.studentAttendance.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(justification !== undefined ? { justification } : {}),
      justifiedBy: (session.user as any).id,
    },
  })

  return NextResponse.json(record)
}

// DELETE /api/attendance/[id]
// Removes a FALTA record (marks student as present retroactively)
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = (session.user as any).role
  if (!['ADMIN', 'COORDENACAO', 'PEDAGOGO'].includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  await prisma.studentAttendance.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
