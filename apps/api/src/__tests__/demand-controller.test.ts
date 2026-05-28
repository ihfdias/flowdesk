import { createDemandSchema } from '../controllers/demand-controller'

// No mocks needed — Zod parsing is pure synchronous logic.

describe('createDemandSchema', () => {
  it('accepts the minimum required fields (title + flowId)', () => {
    const result = createDemandSchema.safeParse({
      title: 'Launch campaign',
      flowId: 'flow-1',
    })

    expect(result.success).toBe(true)
  })

  it('accepts priority "low"', () => {
    const result = createDemandSchema.safeParse({
      title: 'Launch campaign',
      flowId: 'flow-1',
      priority: 'low',
    })

    expect(result.success).toBe(true)
  })

  it('accepts priority "medium"', () => {
    const result = createDemandSchema.safeParse({
      title: 'Launch campaign',
      flowId: 'flow-1',
      priority: 'medium',
    })

    expect(result.success).toBe(true)
  })

  it('accepts priority "high"', () => {
    const result = createDemandSchema.safeParse({
      title: 'Launch campaign',
      flowId: 'flow-1',
      priority: 'high',
    })

    expect(result.success).toBe(true)
  })

  // Regression: these were the old Portuguese values that caused a 400 in production
  it('rejects priority "baixa" (old Portuguese value)', () => {
    const result = createDemandSchema.safeParse({
      title: 'Launch campaign',
      flowId: 'flow-1',
      priority: 'baixa',
    })

    expect(result.success).toBe(false)
  })

  it('rejects priority "média" (old Portuguese value)', () => {
    const result = createDemandSchema.safeParse({
      title: 'Launch campaign',
      flowId: 'flow-1',
      priority: 'média',
    })

    expect(result.success).toBe(false)
  })

  it('rejects priority "alta" (old Portuguese value)', () => {
    const result = createDemandSchema.safeParse({
      title: 'Launch campaign',
      flowId: 'flow-1',
      priority: 'alta',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a title shorter than 2 characters', () => {
    const result = createDemandSchema.safeParse({
      title: 'X',
      flowId: 'flow-1',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a request with no flowId', () => {
    const result = createDemandSchema.safeParse({
      title: 'Launch campaign',
    })

    expect(result.success).toBe(false)
  })
})
