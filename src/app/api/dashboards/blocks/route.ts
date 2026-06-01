import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { BLOCK_LIBRARY } from '@/lib/dashboard-blocks'

// Returns the full catalog: static blocks + user-generated blocks from the DB
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const dynamic = await prisma.dashboardBlock.findMany({
    orderBy: { usageCount: 'desc' },
    select: { blockId: true, name: true, description: true, usageCount: true, createdAt: true },
  })

  const staticBlocks = Object.entries(BLOCK_LIBRARY).map(([id, b]) => ({
    blockId: id, name: b.name, description: b.description, usageCount: null, createdAt: null, source: 'static',
  }))

  const dynamicBlocks = dynamic.map(b => ({ ...b, source: 'dynamic' }))

  return NextResponse.json({ static: staticBlocks, dynamic: dynamicBlocks })
}
