import prisma from '../prisma/client'

interface CreateDemandInput {
  title: string
  description?: string
  tag?: string
  priority?: string
  flowId: string
  requestedById: string
  assignedToId?: string
  dueDate?: Date
}

interface MoveDemandInput {
  demandId: string
  toStageId: string
  movedById: string
  comment?: string
}

export async function createDemand({ title, description, tag, priority, flowId, requestedById, assignedToId, dueDate }: CreateDemandInput) {
  const flow = await prisma.flow.findUnique({
    where: { id: flowId },
    include: { stages: { orderBy: { order: 'asc' } } }
  })
  if (!flow) {
    throw new Error('Fluxo não encontrado')
  }
  if (flow.stages.length === 0) {
    throw new Error('O fluxo não tem etapas cadastradas')
  }

  const firstStage = flow.stages[0]

  const demand = await prisma.demand.create({
    data: { title, description, tag, priority, flowId, currentStageId: firstStage.id, requestedById, assignedToId, dueDate },
    include: {
      flow: true,
      currentStage: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } }
    }
  })

  await prisma.demandHistory.create({
    data: { demandId: demand.id, fromStageId: null, toStageId: firstStage.id, movedById: requestedById, comment: 'Demanda criada' }
  })

  return demand
}

export async function listDemands(userId: string, flowId?: string) {
  return prisma.demand.findMany({
    where: {
      flow: {
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
      ...(flowId ? { flowId } : {}),
    },
    include: {
      flow: { select: { id: true, name: true } },
      currentStage: { select: { id: true, name: true, color: true, order: true, flowId: true } },
      requestedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } }
    },
    orderBy: { createdAt: 'desc' }
  })
}

export async function getDemandById(id: string, userId: string) {
  const demand = await prisma.demand.findFirst({
    where: {
      id,
      flow: {
        OR: [
          { createdById: userId },
          { members: { some: { userId } } },
        ],
      },
    },
    include: {
      flow: { include: { stages: { orderBy: { order: 'asc' } } } },
      currentStage: true,
      requestedBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
      history: {
        include: {
          fromStage: { select: { id: true, name: true, color: true, order: true, flowId: true } },
          toStage: { select: { id: true, name: true, color: true, order: true, flowId: true } },
          movedBy: { select: { id: true, name: true } }
        },
        orderBy: { movedAt: 'asc' }
      },
      comments: {
        include: {
          author: { select: { id: true, name: true } },
          stage: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  })
  if (!demand) {
    throw new Error('Demanda não encontrada')
  }
  return demand
}

export async function advanceDemand(demandId: string, movedById: string, comment?: string) {
  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    include: { flow: { include: { stages: { orderBy: { order: 'asc' } } } } }
  })
  if (!demand) {
    throw new Error('Demanda não encontrada')
  }

  const stages = demand.flow.stages
  const currentIndex = stages.findIndex(s => s.id === demand.currentStageId)

  if (currentIndex === stages.length - 1) {
    throw new Error('A demanda já está na última etapa do fluxo')
  }

  const nextStage = stages[currentIndex + 1]

  const [updated] = await prisma.$transaction([
    prisma.demand.update({
      where: { id: demandId },
      data: { currentStageId: nextStage.id },
      include: {
        flow: true,
        currentStage: true,
        requestedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } }
      }
    }),
    prisma.demandHistory.create({
      data: { demandId, fromStageId: demand.currentStageId, toStageId: nextStage.id, movedById, comment }
    })
  ])

  return updated
}

export async function createComment(demandId: string, content: string, authorId: string) {
  const demand = await prisma.demand.findUnique({ where: { id: demandId }, select: { currentStageId: true } })
  if (!demand) throw new Error('Demanda não encontrada')
  return prisma.comment.create({
    data: { demandId, content, authorId, stageId: demand.currentStageId },
    include: {
      author: { select: { id: true, name: true } },
      stage: { select: { id: true, name: true, color: true, order: true, flowId: true } }
    }
  })
}

export async function moveDemand({ demandId, toStageId, movedById, comment }: MoveDemandInput) {
  const demand = await prisma.demand.findUnique({ where: { id: demandId } })
  if (!demand) {
    throw new Error('Demanda não encontrada')
  }

  const targetStage = await prisma.stage.findUnique({ where: { id: toStageId } })
  if (!targetStage || targetStage.flowId !== demand.flowId) {
    throw new Error('Etapa não pertence ao fluxo desta demanda')
  }
  if (demand.currentStageId === toStageId) {
    throw new Error('A demanda já está nesta etapa')
  }

  const [updated] = await prisma.$transaction([
    prisma.demand.update({
      where: { id: demandId },
      data: { currentStageId: toStageId },
      include: {
        flow: true,
        currentStage: true,
        requestedBy: { select: { id: true, name: true } },
        assignedTo: { select: { id: true, name: true } }
      }
    }),
    prisma.demandHistory.create({
      data: { demandId, fromStageId: demand.currentStageId, toStageId, movedById, comment }
    })
  ])

  return updated
}
