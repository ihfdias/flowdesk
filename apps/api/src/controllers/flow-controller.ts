import { Request, Response } from 'express'
import { z } from 'zod'
import {
  createFlow, listFlows, getFlowById, updateFlow, deleteFlow,
  createStage, updateStage, deleteStage,
  listMembers, addMember, removeMember,
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

function handleError(res: Response, err: unknown): void {
  const message = err instanceof Error ? err.message : 'Erro interno'
  if (message === 'Fluxo não encontrado' || message === 'Etapa não encontrada') {
    res.status(404).json({ error: message })
  } else if (message.startsWith('Sem permissão')) {
    res.status(403).json({ error: message })
  } else if (message.startsWith('Não é possível deletar')) {
    res.status(409).json({ error: message })
  } else {
    res.status(500).json({ error: message })
  }
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const flows = await listFlows(req.user.id)
    res.status(200).json(flows)
  } catch (err) {
    handleError(res, err)
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  const result = createFlowSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  try {
    const flow = await createFlow(result.data.name, result.data.description, req.user.id)
    res.status(201).json(flow)
  } catch (err) {
    handleError(res, err)
  }
}

export async function getById(req: Request, res: Response): Promise<void> {
  try {
    const flow = await getFlowById(String(req.params.id), req.user.id)
    res.status(200).json(flow)
  } catch (err) {
    handleError(res, err)
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  const result = updateFlowSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  try {
    const flow = await updateFlow(String(req.params.id), req.user.id, result.data)
    res.status(200).json(flow)
  } catch (err) {
    handleError(res, err)
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await deleteFlow(String(req.params.id), req.user.id)
    res.status(204).send()
  } catch (err) {
    handleError(res, err)
  }
}

export async function getMembersHandler(req: Request, res: Response): Promise<void> {
  try {
    const members = await listMembers(String(req.params.id), req.user.id)
    res.status(200).json(members)
  } catch (err) {
    handleError(res, err)
  }
}

const addMemberSchema = z.object({ email: z.string().email() })

export async function addMemberHandler(req: Request, res: Response): Promise<void> {
  const result = addMemberSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  try {
    const member = await addMember(String(req.params.id), result.data.email, req.user.id)
    res.status(201).json(member)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    if (message === 'Usuário não encontrado') res.status(404).json({ error: message })
    else if (message === 'Usuário já é membro deste fluxo') res.status(409).json({ error: message })
    else res.status(500).json({ error: message })
  }
}

export async function removeMemberHandler(req: Request, res: Response): Promise<void> {
  try {
    await removeMember(String(req.params.id), String(req.params.userId), req.user.id)
    res.status(204).send()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    if (message === 'Membro não encontrado neste fluxo') res.status(404).json({ error: message })
    else res.status(500).json({ error: message })
  }
}

export async function addStage(req: Request, res: Response): Promise<void> {
  const result = createStageSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  try {
    const stage = await createStage(String(req.params.flowId), req.user.id, result.data)
    res.status(201).json(stage)
  } catch (err) {
    handleError(res, err)
  }
}

export async function editStage(req: Request, res: Response): Promise<void> {
  const result = updateStageSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.issues })
    return
  }
  try {
    const stage = await updateStage(String(req.params.stageId), req.user.id, result.data)
    res.status(200).json(stage)
  } catch (err) {
    handleError(res, err)
  }
}

export async function removeStage(req: Request, res: Response): Promise<void> {
  try {
    await deleteStage(String(req.params.stageId), req.user.id)
    res.status(204).send()
  } catch (err) {
    handleError(res, err)
  }
}