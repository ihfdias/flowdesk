import prisma from '../prisma/client'
import { AppError } from '../errors/app-error'

export async function createNotification(userId: string, message: string) {
  return prisma.notification.create({ data: { userId, message } })
}

export async function listUnread(userId: string) {
  return prisma.notification.findMany({
    where: { userId, read: false },
    orderBy: { createdAt: 'desc' },
  })
}

export async function markAsRead(id: string, userId: string) {
  const notification = await prisma.notification.findUnique({ where: { id } })
  if (!notification || notification.userId !== userId) {
    throw new AppError(404, 'Notification not found')
  }
  await prisma.notification.update({ where: { id }, data: { read: true } })
}
