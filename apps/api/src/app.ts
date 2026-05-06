import express from 'express'
import cors from 'cors'
import authRoutes from './routes/auth-routes'
import flowRoutes from './routes/flow-routes'
import demandRoutes from './routes/demand-routes'
import aiRoutes from './routes/ai-routes'

const app = express()

app.use(cors())
app.use(express.json())

app.use('/api/auth', authRoutes)
app.use('/api/flows', flowRoutes)
app.use('/api/demands', demandRoutes)
app.use('/api/ai', aiRoutes)

export default app
