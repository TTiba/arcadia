import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ count: 0, urgent: 0 })
  const userId = (session.user as any).id

  const now = new Date()
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000)

  const [count, urgent] = await Promise.all([
    prisma.message.count({ where: { recipientId: userId, readAt: null } }),
    prisma.message.count({
      where: {
        recipientId: userId,
        readAt: null,
        replyDeadline: { not: null, lte: in24h },
      },
    }),
  ])

  return NextResponse.json({ count, urgent })
}
