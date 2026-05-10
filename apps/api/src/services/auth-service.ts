import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import prisma from '../prisma/client'
import { Role } from '../generated/prisma/enums'

const JWT_SECRET = process.env.JWT_SECRET ?? 'fallback-secret'
const SALT_ROUNDS = 10

interface RegisterInput {
  name: string
  email: string
  password: string
  role?: Role
}

interface LoginInput {
  email: string
  password: string
}

interface AuthResult {
  token: string
  user: {
    id: string
    name: string
    email: string
    role: Role
  }
}

export async function registerUser({ name, email, password, role = Role.MEMBER }: RegisterInput): Promise<AuthResult> {
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new Error('Email already registered')
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

  const user = await prisma.user.create({
    data: { name, email, passwordHash, role }
  })

  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  }
}

export async function loginUser({ email, password }: LoginInput): Promise<AuthResult> {
  const user = await prisma.user.findUnique({ where: { email } })

  if (!user) {
    throw new Error('Invalid credentials')
  }

  const passwordMatch = await bcrypt.compare(password, user.passwordHash)
  if (!passwordMatch) {
    throw new Error('Invalid credentials')
  }

  const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' })

  return {
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role }
  }
}
