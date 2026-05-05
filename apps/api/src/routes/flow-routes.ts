import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth-middleware'
import { list, create, getById, update, remove, addStage, editStage, removeStage } from '../controllers/flow-controller'

const router = Router()

router.use(authMiddleware)

router.get('/', list)
router.post('/', create)
router.get('/:id', getById)
router.put('/:id', update)
router.delete('/:id', remove)

router.post('/:flowId/stages', addStage)
router.put('/:flowId/stages/:stageId', editStage)
router.delete('/:flowId/stages/:stageId', removeStage)

export default router
