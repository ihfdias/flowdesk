import { Request, Response } from 'express'
import { listUnread, markAsRead } from '../services/notification-service'

export async function listHandler(req: Request, res: Response): Promise<void> {
  const notifications = await listUnread(req.user.id)
  res.status(200).json(notifications)
}

export async function markReadHandler(req: Request, res: Response): Promise<void> {
  await markAsRead(String(req.params.id), req.user.id)
  res.status(204).send()
}
