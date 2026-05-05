import { Request, Response } from 'express'
import { z } from 'zod'
import { createDemand, listDemands, getDemandById, advanceDemand, moveDemand } from '../services/demand-service'

const createDemandSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  flowId: z.string().uuid(),
  assignedToId: z.string().uuid().optional(),
  dueDate: z.coerce.date().optional()
})

const advanceSchema = z.object({
  comment: z.string().optional()
})

const moveSchema = z.object({
  toStageId: z.string().uuid(),
  comment: z.string().optional()
})

function handleError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Erro interno'
  if (message === 'Demanda não encontrada' || message === 'Fluxo não encontrado') {
    res.status(404).json({ error: message })
  } else if (message === 'O fluxo não tem etapas cadastradas') {
    res.status(422).json({ error: message })
  } else if (message === 'A demanda já está na última etapa do fluxo' || message === 'A demanda já está nesta etapa') {
    res.status(409).json({ error: message })
  } else if (message === 'Etapa não pertence ao fluxo desta demanda') {
    res.status(400).json({ error: message })
  } else {
    res.status(500).json({ error: message })
  }
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const demands = await listDemands()
    res.status(200).json(demands)
  } catch (err) {
    handleError(res, err)
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  const result = createDemandSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten().fieldErrors })
    return
  }
  try {
    const demand = await createDemand({ ...result.data, requestedById: req.user.id })
    res.status(201).json(demand)
  } catch (err) {
    handleError(res, err)
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const demand = await getDemandById(req.params.id)
    res.status(200).json(demand)
  } catch (err) {
    handleError(res, err)
  }
}

export async function advance(req: Request, res: Response): Promise<void> {
  const result = advanceSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten().fieldErrors })
    return
  }
  try {
    const demand = await advanceDemand(req.params.id, req.user.id, result.data.comment)
    res.status(200).json(demand)
  } catch (err) {
    handleError(res, err)
  }
}

export async function move(req: Request, res: Response): Promise<void> {
  const result = moveSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten().fieldErrors })
    return
  }
  try {
    const demand = await moveDemand({ demandId: req.params.id, movedById: req.user.id, ...result.data })
    res.status(200).json(demand)
  } catch (err) {
    handleError(res, err)
  }
}