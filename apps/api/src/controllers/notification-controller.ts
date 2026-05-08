import { Request, Response } from 'express'
import { listUnread, markAsRead } from '../services/notification-service'

export async function listHandler(req: Request, res: Response): Promise<void> {
  try {
    const notifications = await listUnread(req.user.id)
    res.status(200).json(notifications)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    res.status(500).json({ error: message })
  }
}

export async function markReadHandler(req: Request, res: Response): Promise<void> {
  try {
    await markAsRead(String(req.params.id), req.user.id)
    res.status(204).send()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    if (message === 'Notificação não encontrada') res.status(404).json({ error: message })
    else res.status(500).json({ error: message })
  }
}
