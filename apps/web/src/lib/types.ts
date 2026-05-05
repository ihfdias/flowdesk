export interface Stage {
  id: string
  name: string
  color: string
  order: number
  flowId: string
}

export interface User {
  id: string
  name: string
  email?: string
}

export interface Demand {
  id: string
  title: string
  description?: string
  flowId: string
  currentStageId: string
  currentStage: Stage
  requestedBy: User
  assignedTo?: User
  dueDate?: string
  createdAt: string
}

export interface HistoryEntry {
  id: string
  demandId: string
  fromStage?: Stage
  toStage: Stage
  movedBy: User
  movedAt: string
  comment?: string
}

export interface Comment {
  id: string
  demandId: string
  stage: Stage
  author: User
  content: string
  createdAt: string
}

export interface Flow {
  id: string
  name: string
  description?: string
  stages: Stage[]
}