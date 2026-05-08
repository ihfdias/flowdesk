import { Request, Response } from 'express'
import { z } from 'zod'
import { suggestStages, summarizeDemand, searchDemands } from '../services/ai-service'

const suggestSchema = z.object({
  description: z.string().min(3),
})

export async function suggestStagesHandler(req: Request, res: Response): Promise<void> {
  const result = suggestSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  try {
    const stages = await suggestStages(result.data.description)
    res.status(200).json({ stages })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    res.status(502).json({ error: message })
  }
}

const searchSchema = z.object({
  query: z.string().min(2),
})

export async function searchDemandsHandler(req: Request, res: Response): Promise<void> {
  const result = searchSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  try {
    const data = await searchDemands(result.data.query, req.user.id)
    res.status(200).json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    res.status(502).json({ error: message })
  }
}

export async function summarizeDemandHandler(req: Request, res: Response): Promise<void> {
  try {
    const summary = await summarizeDemand(String(req.params.demandId), req.user.id)
    res.status(200).json({ summary })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    const status = message === 'Demanda não encontrada' ? 404 : 502
    res.status(status).json({ error: message })
  }
}
