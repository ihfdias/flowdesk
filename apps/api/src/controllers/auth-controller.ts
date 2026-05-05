import { Request, Response } from 'express'
import { z } from 'zod'
import { registerUser, loginUser } from '../services/auth-service'

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['ADMIN', 'MEMBER']).optional()
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export async function register(req: Request, res: Response): Promise<void> {
  const result = registerSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten().fieldErrors })
    return
  }

  try {
    const data = await registerUser(result.data)
    res.status(201).json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    const status = message === 'E-mail já cadastrado' ? 409 : 500
    res.status(status).json({ error: message })
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = loginSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({ error: result.error.flatten().fieldErrors })
    return
  }

  try {
    const data = await loginUser(result.data)
    res.status(200).json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro interno'
    const status = message === 'Credenciais inválidas' ? 401 : 500
    res.status(status).json({ error: message })
  }
}
