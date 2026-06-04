import { NextRequest, NextResponse } from 'next/server'
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

const MSG_SELECT = {
  id: true, subject: true, body: true, readAt: true, createdAt: true, parentId: true, replyDeadline: true,
  sender:    { select: { id: true, name: true, role: true } },
  recipient: { select: { id: true, name: true, role: true } },
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id

  const messages = await prisma.message.findMany({
    where: { recipientId: userId, parentId: null },
    select: MSG_SELECT,
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(messages)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = (session.user as any).id
  const role   = (session.user as any).role

  const { recipientId, subject, body, parentId, replyDeadline } = await req.json()
  if (!recipientId || !subject?.trim() || !body?.trim())
    return NextResponse.json({ error: 'recipientId, subject and body required' }, { status: 400 })

  const recipient = await prisma.user.findUnique({ where: { id: recipientId }, select: { role: true } })
  if (!recipient) return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })

  const allowed = ALLOW_SEND[role] ?? []
  if (!allowed.includes(recipient.role) && !parentId)
    return NextResponse.json({ error: 'Not allowed to send to this role' }, { status: 403 })

  const message = await prisma.message.create({
    data: {
      senderId: userId, recipientId, subject, body,
      parentId: parentId ?? null,
      replyDeadline: replyDeadline ? new Date(replyDeadline) : null,
    },
    select: MSG_SELECT,
  })
  return NextResponse.json(message, { status: 201 })
}
