import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth-middleware'
import { suggestStagesHandler, summarizeDemandHandler, searchDemandsHandler } from '../controllers/ai-controller'

const router = Router()

router.use(authMiddleware)

router.post('/suggest-stages', suggestStagesHandler)
router.post('/summarize/:demandId', summarizeDemandHandler)
router.post('/search', searchDemandsHandler)

export default router
