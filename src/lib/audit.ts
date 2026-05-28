import { prisma } from './prisma'

export async function createAuditLog({
  userId,
  action,
  entityType,
  entityId,
  previousData,
  newData,
}: {
  userId?: string
  action: string
  entityType: string
  entityId?: string
  previousData?: object
  newData?: object
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        previousData: previousData ? JSON.stringify(previousData) : undefined,
        newData: newData ? JSON.stringify(newData) : undefined,
      },
    })
  } catch {
    console.error('Failed to create audit log')
  }
}
