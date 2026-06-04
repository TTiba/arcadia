import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json([])
  const userId = (session.user as any).id

  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000)

  const messages = await prisma.message.findMany({
    where: {
      recipientId: userId,
      readAt: null,
      replyDeadline: { not: null, lte: in24h },
    },
    select: {
      id: true,
      subject: true,
      replyDeadline: true,
      sender: { select: { name: true } },
    },
    orderBy: { replyDeadline: 'asc' },
  })

  return NextResponse.json(
    messages.map(m => ({
      id: m.id,
      subject: m.subject,
      replyDeadline: m.replyDeadline,
      senderName: m.sender.name,
    }))
  )
}
