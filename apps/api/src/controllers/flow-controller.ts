import { Request, Response } from 'express'
import { z } from 'zod'
import {
  createFlow, listFlows, getFlowById, updateFlow, deleteFlow,
  createStage, updateStage, deleteStage,
  listMembers, addMember, removeMember, getFlowAnalytics,
} from '../services/flow-service'

const createFlowSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional()
})

const updateFlowSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional()
})

const createStageSchema = z.object({
  name: z.string().min(1),
  color: z.string().min(1),
  order: z.number().int().min(0)
})

const updateStageSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().min(1).optional(),
  order: z.number().int().min(0).optional()
})

const addMemberSchema = z.object({ email: z.email() })

export async function list(req: Request, res: Response): Promise<void> {
  const flows = await listFlows(req.user.id)
  res.status(200).json(flows)
}

export async function create(req: Request, res: Response): Promise<void> {
  const result = createFlowSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  const flow = await createFlow(result.data.name, result.data.description, req.user.id)
  res.status(201).json(flow)
}

export async function getById(req: Request, res: Response): Promise<void> {
  const flow = await getFlowById(String(req.params.id), req.user.id)
  res.status(200).json(flow)
}

export async function update(req: Request, res: Response): Promise<void> {
  const result = updateFlowSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  const flow = await updateFlow(String(req.params.id), req.user.id, result.data)
  res.status(200).json(flow)
}

export async function remove(req: Request, res: Response): Promise<void> {
  await deleteFlow(String(req.params.id), req.user.id)
  res.status(204).send()
}

export async function getMembersHandler(req: Request, res: Response): Promise<void> {
  const members = await listMembers(String(req.params.id), req.user.id)
  res.status(200).json(members)
}

export async function addMemberHandler(req: Request, res: Response): Promise<void> {
  const result = addMemberSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  const member = await addMember(String(req.params.id), result.data.email, req.user.id)
  res.status(201).json(member)
}

export async function removeMemberHandler(req: Request, res: Response): Promise<void> {
  await removeMember(String(req.params.id), String(req.params.userId), req.user.id)
  res.status(204).send()
}

export async function addStage(req: Request, res: Response): Promise<void> {
  const result = createStageSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  const stage = await createStage(String(req.params.flowId), req.user.id, result.data)
  res.status(201).json(stage)
}

export async function editStage(req: Request, res: Response): Promise<void> {
  const result = updateStageSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  const stage = await updateStage(String(req.params.stageId), req.user.id, result.data)
  res.status(200).json(stage)
}

export async function removeStage(req: Request, res: Response): Promise<void> {
  await deleteStage(String(req.params.stageId), req.user.id)
  res.status(204).send()
}

export async function analytics(req: Request, res: Response): Promise<void> {
  const data = await getFlowAnalytics(String(req.params.id), req.user.id)
  res.status(200).json(data)
}
