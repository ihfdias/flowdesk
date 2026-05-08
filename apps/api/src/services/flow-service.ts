import prisma from '../prisma/client'

export async function createFlow(name: string, description: string | undefined, createdById: string) {
  return prisma.$transaction(async (tx) => {
    const flow = await tx.flow.create({
      data: { name, description, createdById },
      include: { stages: { orderBy: { order: 'asc' } } },
    })
    await tx.flowMember.create({ data: { flowId: flow.id, userId: createdById } })
    return flow
  })
}

export async function listFlows(userId: string) {
  return prisma.flow.findMany({
    where: {
      OR: [
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    },
    include: { stages: { orderBy: { order: 'asc' } } },
    orderBy: { createdAt: 'desc' },
  })
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
  const flow = await prisma.flow.findUnique({ where: { id } })
  if (!flow) throw new Error('Fluxo não encontrado')
  if (flow.createdById !== userId) throw new Error('Sem permissão para deletar este fluxo')

  await prisma.$transaction([
    prisma.comment.deleteMany({ where: { demand: { flowId: id } } }),
    prisma.demandHistory.deleteMany({ where: { demand: { flowId: id } } }),
    prisma.demand.deleteMany({ where: { flowId: id } }),
    prisma.flowMember.deleteMany({ where: { flowId: id } }),
    prisma.stage.deleteMany({ where: { flowId: id } }),
    prisma.flow.delete({ where: { id } }),
  ])
}

export async function listMembers(flowId: string) {
  return prisma.flowMember.findMany({
    where: { flowId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })
}

export async function addMember(flowId: string, email: string) {
  const [user, flow] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.flow.findUnique({ where: { id: flowId }, select: { name: true } }),
  ])
  if (!user) throw new Error('Usuário não encontrado')
  if (!flow) throw new Error('Fluxo não encontrado')

  const existing = await prisma.flowMember.findUnique({
    where: { flowId_userId: { flowId, userId: user.id } },
  })
  if (existing) throw new Error('Usuário já é membro deste fluxo')

  const [member] = await prisma.$transaction([
    prisma.flowMember.create({
      data: { flowId, userId: user.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.notification.create({
      data: { userId: user.id, message: `Você foi adicionado ao fluxo "${flow.name}"`, flowId },
    }),
  ])

  return member
}

export async function removeMember(flowId: string, userId: string) {
  const member = await prisma.flowMember.findUnique({
    where: { flowId_userId: { flowId, userId } },
  })
  if (!member) throw new Error('Membro não encontrado neste fluxo')

  await prisma.flowMember.delete({
    where: { flowId_userId: { flowId, userId } },
  })
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
