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

export async function getFlowById(id: string, userId: string) {
  const flow = await prisma.flow.findFirst({
    where: {
      id,
      OR: [
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    },
    include: { stages: { orderBy: { order: 'asc' } } }
  })
  if (!flow) {
    throw new Error('Flow not found')
  }
  return flow
}

export async function updateFlow(id: string, userId: string, data: { name?: string; description?: string }) {
  const flow = await prisma.flow.findUnique({ where: { id } })
  if (!flow) {
    throw new Error('Flow not found')
  }
  if (flow.createdById !== userId) {
    throw new Error('Not authorized to edit this flow')
  }
  return prisma.flow.update({
    where: { id },
    data,
    include: { stages: { orderBy: { order: 'asc' } } }
  })
}

export async function deleteFlow(id: string, userId: string) {
  const flow = await prisma.flow.findUnique({ where: { id } })
  if (!flow) throw new Error('Flow not found')
  if (flow.createdById !== userId) throw new Error('Not authorized to delete this flow')

  await prisma.$transaction([
    prisma.comment.deleteMany({ where: { demand: { flowId: id } } }),
    prisma.demandHistory.deleteMany({ where: { demand: { flowId: id } } }),
    prisma.demand.deleteMany({ where: { flowId: id } }),
    prisma.flowMember.deleteMany({ where: { flowId: id } }),
    prisma.stage.deleteMany({ where: { flowId: id } }),
    prisma.flow.delete({ where: { id } }),
  ])
}

export async function listMembers(flowId: string, userId: string) {
  const flow = await prisma.flow.findFirst({
    where: {
      id: flowId,
      OR: [
        { createdById: userId },
        { members: { some: { userId } } },
      ],
    },
  })
  if (!flow) throw new Error('Flow not found')
  return prisma.flowMember.findMany({
    where: { flowId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  })
}

export async function addMember(flowId: string, email: string, requesterId: string) {
  const [user, flow] = await Promise.all([
    prisma.user.findUnique({ where: { email } }),
    prisma.flow.findUnique({ where: { id: flowId }, select: { name: true, createdById: true } }),
  ])
  if (!user) throw new Error('User not found')
  if (!flow) throw new Error('Flow not found')
  if (flow.createdById !== requesterId) throw new Error('Not authorized to invite members to this flow')

  const existing = await prisma.flowMember.findUnique({
    where: { flowId_userId: { flowId, userId: user.id } },
  })
  if (existing) throw new Error('User is already a member of this flow')

  const [member] = await prisma.$transaction([
    prisma.flowMember.create({
      data: { flowId, userId: user.id },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.notification.create({
      data: { userId: user.id, message: `You were added to flow "${flow.name}"`, flowId },
    }),
  ])

  return member
}

export async function removeMember(flowId: string, userId: string, requesterId: string) {
  const flow = await prisma.flow.findUnique({ where: { id: flowId }, select: { createdById: true } })
  if (!flow) throw new Error('Flow not found')
  if (flow.createdById !== requesterId) throw new Error('Not authorized to remove members from this flow')

  const member = await prisma.flowMember.findUnique({
    where: { flowId_userId: { flowId, userId } },
  })
  if (!member) throw new Error('Member not found in this flow')

  await prisma.flowMember.delete({
    where: { flowId_userId: { flowId, userId } },
  })
}

export async function createStage(flowId: string, userId: string, data: { name: string; color: string; order: number }) {
  const flow = await prisma.flow.findUnique({ where: { id: flowId } })
  if (!flow) {
    throw new Error('Flow not found')
  }
  if (flow.createdById !== userId) {
    throw new Error('Not authorized to add stages to this flow')
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
    throw new Error('Stage not found')
  }
  if (stage.flow.createdById !== userId) {
    throw new Error('Not authorized to edit this stage')
  }
  return prisma.stage.update({ where: { id: stageId }, data })
}

export async function deleteStage(stageId: string, userId: string) {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: { flow: true, demands: { take: 1 } }
  })
  if (!stage) {
    throw new Error('Stage not found')
  }
  if (stage.flow.createdById !== userId) {
    throw new Error('Not authorized to delete this stage')
  }
  if (stage.demands.length > 0) {
    throw new Error('Cannot delete a stage with active demands')
  }
  await prisma.stage.delete({ where: { id: stageId } })
}
