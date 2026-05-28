import { createDemand, advanceDemand, moveDemand } from '../services/demand-service'

// Replace the prisma singleton with a fake object before any test runs.
// jest.mock intercepts the import inside demand-service.ts and returns our object instead.
jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    flow: { findUnique: jest.fn() },
    demand: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    demandHistory: { create: jest.fn() },
    stage: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}))

import prisma from '../prisma/client'

// Cast to jest.Mock so TypeScript lets us call .mockResolvedValue() etc.
const db = prisma as unknown as {
  flow: { findUnique: jest.Mock }
  demand: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock }
  demandHistory: { create: jest.Mock }
  stage: { findUnique: jest.Mock }
  $transaction: jest.Mock
}

// Clear all mock history before each test so tests don't interfere with each other.
beforeEach(() => {
  jest.clearAllMocks()

  // $transaction receives an array of Promises and should resolve to an array of results.
  // Promise.all does exactly that, so we use it as the default implementation.
  db.$transaction.mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops))
})

// ─── helpers ─────────────────────────────────────────────────────────────────

const stage1 = { id: 'stage-1', name: 'Backlog', order: 0, flowId: 'flow-1', color: '#aaa' }
const stage2 = { id: 'stage-2', name: 'In Progress', order: 1, flowId: 'flow-1', color: '#bbb' }

const fakeFlow = { id: 'flow-1', name: 'Marketing', stages: [stage1, stage2] }

const fakeDemand = {
  id: 'demand-1',
  flowId: 'flow-1',
  currentStageId: 'stage-1',
  flow: { ...fakeFlow },
}

// ─── createDemand ─────────────────────────────────────────────────────────────

describe('createDemand', () => {
  const input = {
    title: 'Launch campaign',
    flowId: 'flow-1',
    requestedById: 'user-1',
  }

  it('throws "Flow not found" when the flow does not exist', async () => {
    db.flow.findUnique.mockResolvedValue(null)

    await expect(createDemand(input)).rejects.toThrow('Flow not found')
  })

  it('throws "Flow has no stages" when the flow exists but has no stages', async () => {
    db.flow.findUnique.mockResolvedValue({ ...fakeFlow, stages: [] })

    await expect(createDemand(input)).rejects.toThrow('Flow has no stages')
  })

  it('creates the demand at the first stage and records history', async () => {
    db.flow.findUnique.mockResolvedValue(fakeFlow)
    const createdDemand = { id: 'demand-1', ...input, currentStageId: stage1.id }
    db.demand.create.mockResolvedValue(createdDemand)
    db.demandHistory.create.mockResolvedValue({})

    const result = await createDemand(input)

    // demand.create must place the demand at stage1, not stage2
    expect(db.demand.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStageId: stage1.id }),
      })
    )

    // history entry must be created with toStageId = stage1
    expect(db.demandHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ toStageId: stage1.id, fromStageId: null }),
      })
    )

    expect(result).toEqual(createdDemand)
  })
})

// ─── advanceDemand ────────────────────────────────────────────────────────────

describe('advanceDemand', () => {
  it('throws "Demand not found" when the demand does not exist', async () => {
    db.demand.findFirst.mockResolvedValue(null)

    await expect(advanceDemand('demand-1', 'user-1')).rejects.toThrow('Demand not found')
  })

  it('throws "Demand is already at the last stage" when there is no next stage', async () => {
    // currentStageId points to stage2, which is the last one
    db.demand.findFirst.mockResolvedValue({
      ...fakeDemand,
      currentStageId: stage2.id,
      flow: { stages: [stage1, stage2] },
    })

    await expect(advanceDemand('demand-1', 'user-1')).rejects.toThrow(
      'Demand is already at the last stage'
    )
  })

  it('advances to the next stage on success', async () => {
    // currentStageId points to stage1 — next is stage2
    db.demand.findFirst.mockResolvedValue({
      ...fakeDemand,
      currentStageId: stage1.id,
      flow: { stages: [stage1, stage2] },
    })

    const updatedDemand = { ...fakeDemand, currentStageId: stage2.id }
    db.demand.update.mockResolvedValue(updatedDemand)
    db.demandHistory.create.mockResolvedValue({})

    const result = await advanceDemand('demand-1', 'user-1')

    // demand.update must move to stage2
    expect(db.demand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStageId: stage2.id }),
      })
    )

    expect(result).toEqual(updatedDemand)
  })
})

// ─── moveDemand ───────────────────────────────────────────────────────────────

describe('moveDemand', () => {
  const moveInput = {
    demandId: 'demand-1',
    toStageId: 'stage-2',
    movedById: 'user-1',
  }

  it('throws "Demand not found" when the demand does not exist', async () => {
    db.demand.findFirst.mockResolvedValue(null)

    await expect(moveDemand(moveInput)).rejects.toThrow('Demand not found')
  })

  it('throws "Stage does not belong to this flow" when the target stage is from a different flow', async () => {
    db.demand.findFirst.mockResolvedValue(fakeDemand)
    // stage belongs to a different flow
    db.stage.findUnique.mockResolvedValue({ id: 'stage-2', flowId: 'flow-OTHER' })

    await expect(moveDemand(moveInput)).rejects.toThrow('Stage does not belong to this flow')
  })

  it('throws "Demand is already at this stage" when toStageId equals currentStageId', async () => {
    db.demand.findFirst.mockResolvedValue({ ...fakeDemand, currentStageId: 'stage-2' })
    db.stage.findUnique.mockResolvedValue({ id: 'stage-2', flowId: 'flow-1' })

    await expect(moveDemand(moveInput)).rejects.toThrow('Demand is already at this stage')
  })

  it('moves the demand to the target stage on success', async () => {
    db.demand.findFirst.mockResolvedValue(fakeDemand) // currentStageId = stage-1
    db.stage.findUnique.mockResolvedValue({ id: 'stage-2', flowId: 'flow-1' })

    const updatedDemand = { ...fakeDemand, currentStageId: 'stage-2' }
    db.demand.update.mockResolvedValue(updatedDemand)
    db.demandHistory.create.mockResolvedValue({})

    const result = await moveDemand(moveInput)

    expect(db.demand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ currentStageId: 'stage-2' }),
      })
    )

    expect(result).toEqual(updatedDemand)
  })
})
