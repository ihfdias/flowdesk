import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth-middleware'
import { suggestStagesHandler, summarizeDemandHandler } from '../controllers/ai-controller'

const router = Router()

router.use(authMiddleware)

router.post('/suggest-stages', suggestStagesHandler)
router.post('/summarize/:demandId', summarizeDemandHandler)

export default router
