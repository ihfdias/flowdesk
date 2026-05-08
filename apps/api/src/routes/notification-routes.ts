import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth-middleware'
import { listHandler, markReadHandler } from '../controllers/notification-controller'

const router = Router()

router.use(authMiddleware)

router.get('/', listHandler)
router.patch('/:id/read', markReadHandler)

export default router
