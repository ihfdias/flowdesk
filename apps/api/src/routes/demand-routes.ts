import { Router } from 'express'
import { authMiddleware } from '../middlewares/auth-middleware'
import { list, create, getById, advance, move, addComment, archive } from '../controllers/demand-controller'

const router = Router()

router.use(authMiddleware)

router.get('/', list)
router.post('/', create)
router.get('/:id', getById)
router.patch('/:id/advance', advance)
router.patch('/:id/move', move)
router.patch('/:id/archive', archive)
router.post('/:id/comments', addComment)

export default router