import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Wayground integration endpoint
// In a real implementation, this would call the Wayground API
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { homeworkId, studentIds = [] } = body

  const homework = await prisma.homework.findUnique({
    where: { id: homeworkId },
    include: { submissions: true }
  })

  if (!homework) return NextResponse.json({ error: 'Homework not found' }, { status: 404 })

  // Simulate Wayground sync (in production, call Wayground API here)
  const synced = await Promise.all(
    studentIds.map(async (studentId: string) => {
      // Simulate: check if student has an external task ID
      const submission = homework.submissions.find(s => s.studentId === studentId)
      const simulatedStatus = submission ? 'CONCLUIDA' : 'PENDENTE'

      return prisma.waygroundSync.upsert({
        where: { homeworkId_studentId: { homeworkId, studentId } },
        update: {
          status: simulatedStatus as any,
          syncedAt: new Date(),
          result: simulatedStatus === 'CONCLUIDA' ? '8.0' : null,
        },
        create: {
          homeworkId,
          studentId,
          externalTaskId: homework.externalId ? `${homework.externalId}-${studentId}` : null,
          status: simulatedStatus as any,
          sentDate: new Date(),
          completionDate: submission?.submittedAt || null,
          syncedAt: new Date(),
        },
      })
    })
  )

  return NextResponse.json({
    message: `Synced ${synced.length} records`,
    syncedAt: new Date().toISOString(),
    records: synced,
  })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const homeworkId = searchParams.get('homeworkId')

  const syncs = await prisma.waygroundSync.findMany({
    where: homeworkId ? { homeworkId } : {},
    include: {
      student: true,
      homework: { include: { subject: true, class: true } },
    },
    orderBy: { syncedAt: 'desc' },
  })

  return NextResponse.json(syncs)
}
