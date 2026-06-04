import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const messages = await prisma.message.findMany({
    where: { senderId: userId, parentId: null },
    select: {
      id: true, subject: true, body: true, createdAt: true,
      recipient: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(messages)
}
