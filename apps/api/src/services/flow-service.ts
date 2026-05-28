import prisma from '../prisma/client'
import { AppError } from '../errors/app-error'

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
  if (!flow) throw new AppError(404, 'Flow not found')
  return flow
}

export async function updateFlow(id: string, userId: string, data: { name?: string; description?: string }) {
  const flow = await prisma.flow.findUnique({ where: { id } })
  if (!flow) throw new AppError(404, 'Flow not found')
  if (flow.createdById !== userId) throw new AppError(403, 'Not authorized to edit this flow')
  return prisma.flow.update({
    where: { id },
    data,
    include: { stages: { orderBy: { order: 'asc' } } }
  })
}

export async function deleteFlow(id: string, userId: string) {
  const flow = await prisma.flow.findUnique({ where: { id } })
  if (!flow) throw new AppError(404, 'Flow not found')
  if (flow.createdById !== userId) throw new AppError(403, 'Not authorized to delete this flow')

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
  if (!flow) throw new AppError(404, 'Flow not found')
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
  if (!user) throw new AppError(404, 'User not found')
  if (!flow) throw new AppError(404, 'Flow not found')
  if (flow.createdById !== requesterId) throw new AppError(403, 'Not authorized to invite members to this flow')

  const existing = await prisma.flowMember.findUnique({
    where: { flowId_userId: { flowId, userId: user.id } },
  })
  if (existing) throw new AppError(409, 'User is already a member of this flow')

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
  if (!flow) throw new AppError(404, 'Flow not found')
  if (flow.createdById !== requesterId) throw new AppError(403, 'Not authorized to remove members from this flow')

  const member = await prisma.flowMember.findUnique({
    where: { flowId_userId: { flowId, userId } },
  })
  if (!member) throw new AppError(404, 'Member not found in this flow')

  await prisma.flowMember.delete({
    where: { flowId_userId: { flowId, userId } },
  })
}

export async function createStage(flowId: string, userId: string, data: { name: string; color: string; order: number }) {
  const flow = await prisma.flow.findUnique({ where: { id: flowId } })
  if (!flow) throw new AppError(404, 'Flow not found')
  if (flow.createdById !== userId) throw new AppError(403, 'Not authorized to add stages to this flow')
  return prisma.stage.create({ data: { ...data, flowId } })
}

export async function updateStage(stageId: string, userId: string, data: { name?: string; color?: string; order?: number }) {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: { flow: true }
  })
  if (!stage) throw new AppError(404, 'Stage not found')
  if (stage.flow.createdById !== userId) throw new AppError(403, 'Not authorized to edit this stage')
  return prisma.stage.update({ where: { id: stageId }, data })
}

export async function deleteStage(stageId: string, userId: string) {
  const stage = await prisma.stage.findUnique({
    where: { id: stageId },
    include: { flow: true, demands: { take: 1 } }
  })
  if (!stage) throw new AppError(404, 'Stage not found')
  if (stage.flow.createdById !== userId) throw new AppError(403, 'Not authorized to delete this stage')
  if (stage.demands.length > 0) throw new AppError(409, 'Cannot delete a stage with active demands')
  await prisma.stage.delete({ where: { id: stageId } })
}

export async function getFlowAnalytics(flowId: string, userId: string) {
  const flow = await prisma.flow.findFirst({
    where: {
      id: flowId,
      OR: [{ createdById: userId }, { members: { some: { userId } } }],
    },
    include: { stages: { orderBy: { order: 'asc' } } },
  })
  if (!flow) throw new AppError(404, 'Flow not found')

  const [allDemands, history] = await Promise.all([
    prisma.demand.findMany({
      where: { flowId },
      select: {
        id: true, priority: true, tag: true,
        currentStageId: true, archived: true, createdAt: true,
        assignedTo: { select: { id: true, name: true } },
      },
    }),
    prisma.demandHistory.findMany({
      where: { demand: { flowId } },
      select: { demandId: true, fromStageId: true, toStageId: true, movedAt: true },
      orderBy: { movedAt: 'asc' },
    }),
  ])

  const active = allDemands.filter(d => !d.archived)

  // demands by stage (active only)
  const stageCounts = new Map(flow.stages.map(s => [s.id, 0]))
  for (const d of active) stageCounts.set(d.currentStageId, (stageCounts.get(d.currentStageId) ?? 0) + 1)
  const demandsByStage = flow.stages.map(s => ({ stageId: s.id, stageName: s.name, color: s.color, order: s.order, count: stageCounts.get(s.id) ?? 0 }))

  // demands by priority (active)
  const priCounts: Record<string, number> = {}
  for (const d of active) { const p = d.priority ?? 'none'; priCounts[p] = (priCounts[p] ?? 0) + 1 }
  const demandsByPriority = Object.entries(priCounts).map(([priority, count]) => ({ priority, count })).sort((a, b) => b.count - a.count)

  // demands by tag (active)
  const tagCounts: Record<string, number> = {}
  for (const d of active) { if (d.tag) tagCounts[d.tag] = (tagCounts[d.tag] ?? 0) + 1 }
  const demandsByTag = Object.entries(tagCounts).map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count)

  // assignee workload (active, assigned)
  const workload = new Map<string, { name: string; count: number }>()
  for (const d of active) {
    if (!d.assignedTo) continue
    const cur = workload.get(d.assignedTo.id)
    if (cur) cur.count++; else workload.set(d.assignedTo.id, { name: d.assignedTo.name, count: 1 })
  }
  const assigneeWorkload = [...workload.values()].sort((a, b) => b.count - a.count)

  // average days per stage (from history — only completed stage visits)
  const byDemand = new Map<string, typeof history>()
  for (const h of history) {
    if (!byDemand.has(h.demandId)) byDemand.set(h.demandId, [])
    byDemand.get(h.demandId)!.push(h)
  }
  const stageTimes: Record<string, number[]> = {}
  for (const entries of byDemand.values()) {
    for (let i = 1; i < entries.length; i++) {
      const stageId = entries[i].fromStageId
      if (!stageId) continue
      const ms = entries[i].movedAt.getTime() - entries[i - 1].movedAt.getTime()
      if (ms > 0) { if (!stageTimes[stageId]) stageTimes[stageId] = []; stageTimes[stageId].push(ms) }
    }
  }
  const avgDaysPerStage = flow.stages.map(s => ({
    stageId: s.id, stageName: s.name, color: s.color, order: s.order,
    avgDays: stageTimes[s.id]
      ? Number((stageTimes[s.id].reduce((a, b) => a + b, 0) / stageTimes[s.id].length / 86400000).toFixed(1))
      : null as number | null,
  }))

  // created by week (last 8 ISO weeks, all demands including archived)
  const weekLabels = getLast8WeekLabels()
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 56)
  const weekCounts: Record<string, number> = {}
  for (const d of allDemands.filter(d => d.createdAt >= cutoff)) {
    const w = toWeekLabel(d.createdAt)
    weekCounts[w] = (weekCounts[w] ?? 0) + 1
  }
  const createdByWeek = weekLabels.map(week => ({ week, count: weekCounts[week] ?? 0 }))

  return {
    totalActive: active.length,
    totalArchived: allDemands.length - active.length,
    demandsByStage,
    demandsByPriority,
    demandsByTag,
    assigneeWorkload,
    avgDaysPerStage,
    createdByWeek,
  }
}

function toWeekLabel(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const year = d.getFullYear()
  const jan1 = new Date(year, 0, 1)
  const week = Math.ceil(((d.getTime() - jan1.getTime()) / 86400000 + 1) / 7)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function getLast8WeekLabels(): string[] {
  const labels: string[] = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    labels.push(toWeekLabel(d))
  }
  return [...new Set(labels)].slice(-8)
}
