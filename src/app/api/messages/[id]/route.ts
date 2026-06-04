import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const MSG_SELECT = {
  id: true, subject: true, body: true, readAt: true, createdAt: true, parentId: true, replyDeadline: true,
  sender:    { select: { id: true, name: true, role: true } },
  recipient: { select: { id: true, name: true, role: true } },
  replies: {
    select: {
      id: true, body: true, readAt: true, createdAt: true,
      sender:    { select: { id: true, name: true, role: true } },
      recipient: { select: { id: true, name: true, role: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const message = await prisma.message.findFirst({
    where: { id: params.id, OR: [{ recipientId: userId }, { senderId: userId }] },
    select: MSG_SELECT,
  })
  if (!message) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Auto-mark as read
  if (message.recipient.id === userId && !message.readAt) {
    await prisma.message.update({ where: { id: params.id }, data: { readAt: new Date() } })
  }

  return NextResponse.json(message)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  await prisma.message.deleteMany({ where: { id: params.id, recipientId: userId } })
  return NextResponse.json({ ok: true })
}
