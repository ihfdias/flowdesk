import prisma from '../prisma/client'

export async function createFlow(name: string, description: string | undefined, createdById: string) {
  const flow = await prisma.flow.create({
    data: { name, description, createdById },
    include: { stages: { orderBy: { order: 'asc' } } }
  })
  return flow
}

export async function listFlows(userId: string) {
  const flows = await prisma.flow.findMany({
    where: { createdById: userId },
    include: { stages: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' }
  })
  return flows
}

export async function getFlowById(id: string) {
  const flow = await prisma.flow.findUnique({
    where: { id },
    include: { stages: { orderBy: { order: 'asc' } } }
  })
  if (!flow) {
    throw new Error('Fluxo não encontrado')
  }
  return flow
}

export async function updateFlow(id: string, userId: string, data: { name?: string; description?: string }) {
  const flow = await prisma.flow.findUnique({ where: { id } })
  if (!flow) {
    throw new Error('Fluxo não encontrado')
  }
  if (flow.createdById !== userId) {
    throw new Error('Sem permissão para editar este fluxo')
  }
  return prisma.flow.update({
    where: { id },
    data,
    include: { stages: { orderBy: { order: 'asc' } } }
  })
}

export async function deleteFlow(id: string, userId: string) {
  const flow = await prisma.flow.findUnique({
    where: { id },
    include: { demands: { take: 1 } }
  })
  if (!flow) {
    throw new Error('Fluxo não encontrado')
  }
  if (flow.createdById !== userId) {
    throw new Error('Sem permissão para deletar este fluxo')
  }
  if (flow.demands.length > 0) {
    throw new Error('Não é possível deletar um fluxo com demandas ativas')
  }
  await prisma.flow.delete({ where: { id } })
}

export async function createStage(flowId: string, userId: string, data: { name: string; color: string; order: number }) {
  const flow = await prisma.flow.findUnique({ where: { id: flowId } })
  if (!flow) {
    throw new Error('Fluxo não encontrado')
  }
  if (flow.createdById !== userId) {
    throw new Error('Sem permissão para adicionar etapas neste fluxo')
  }
  return prisma.stage.create({
    data: { ...data, flowId }
  })
}

export async function updateStage(stageId: string, userId: string, data: { name?: string; color?: string; order?: number }) {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: { flow: true }
  })
  if (!stage) {
    throw new Error('Etapa não encontrada')
  }
  if (stage.flow.createdById !== userId) {
    throw new Error('Sem permissão para editar esta etapa')
  }
  return prisma.stage.update({ where: { id: stageId }, data })
}

export async function deleteStage(stageId: string, userId: string) {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: { flow: true, demands: { take: 1 } }
  })
  if (!stage) {
    throw new Error('Etapa não encontrada')
  }
  if (stage.flow.createdById !== userId) {
    throw new Error('Sem permissão para deletar esta etapa')
  }
  if (stage.demands.length > 0) {
    throw new Error('Não é possível deletar uma etapa com demandas ativas')
  }
  await prisma.stage.delete({ where: { id: stageId } })
}
