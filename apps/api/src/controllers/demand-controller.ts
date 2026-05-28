import { Request, Response } from 'express'
import { z } from 'zod'
import { createDemand, listDemands, getDemandById, advanceDemand, moveDemand, createComment, archiveDemand } from '../services/demand-service'

export const createDemandSchema = z.object({
  title: z.string().min(2),
  description: z.string().optional(),
  tag: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  flowId: z.string(),
  assignedToId: z.string().optional(),
  dueDate: z.coerce.date().optional()
})

const advanceSchema = z.object({
  comment: z.string().optional()
})

const moveSchema = z.object({
  toStageId: z.string(),
  comment: z.string().optional()
})

const commentSchema = z.object({
  content: z.string().min(1),
})

function handleError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Internal error'
  if (message === 'Demand not found' || message === 'Flow not found') {
    res.status(404).json({ error: message })
  } else if (message === 'Flow has no stages') {
    res.status(422).json({ error: message })
  } else if (message === 'Demand is already at the last stage' || message === 'Demand is already at this stage') {
    res.status(409).json({ error: message })
  } else if (message === 'Stage does not belong to this flow') {
    res.status(400).json({ error: message })
  } else {
    res.status(500).json({ error: message })
  }
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const flowId = typeof req.query.flowId === 'string' ? req.query.flowId : undefined
    const demands = await listDemands(req.user.id, flowId)
    res.status(200).json(demands)
  } catch (err) {
    handleError(res, err)
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  const result = createDemandSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
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
    const demand = await getDemandById(String(req.params.id), req.user.id)
    res.status(200).json(demand)
  } catch (err) {
    handleError(res, err)
  }
}

export async function advance(req: Request, res: Response): Promise<void> {
  const result = advanceSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  try {
    const demand = await advanceDemand(String(req.params.id), req.user.id, result.data.comment)
    res.status(200).json(demand)
  } catch (err) {
    handleError(res, err)
  }
}

export async function move(req: Request, res: Response): Promise<void> {
  const result = moveSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  try {
    const demand = await moveDemand({ demandId: String(req.params.id), movedById: req.user.id, ...result.data })
    res.status(200).json(demand)
  } catch (err) {
    handleError(res, err)
  }
}

export async function archive(req: Request, res: Response): Promise<void> {
  try {
    await archiveDemand(String(req.params.id), req.user.id)
    res.status(204).end()
  } catch (err) {
    handleError(res, err)
  }
}

export async function addComment(req: Request, res: Response): Promise<void> {
  const result = commentSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  try {
    const comment = await createComment(String(req.params.id), result.data.content, req.user.id)
    res.status(201).json(comment)
  } catch (err) {
    handleError(res, err)
  }
}