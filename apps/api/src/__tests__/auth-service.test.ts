import { registerUser, loginUser } from '../services/auth-service'

jest.mock('../prisma/client', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

jest.mock('bcrypt')
jest.mock('jsonwebtoken')

import prisma from '../prisma/client'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

const db = prisma as unknown as {
  user: { findUnique: jest.Mock; create: jest.Mock }
}

const bcryptMock = bcrypt as jest.Mocked<typeof bcrypt>

beforeEach(() => {
  jest.clearAllMocks()
  // jwt.sign has multiple overloads which confuse jest.Mocked, so we cast manually
  ;(jwt.sign as jest.Mock).mockReturnValue('fake-token')
})

// ─── helpers ─────────────────────────────────────────────────────────────────

const fakeUser = {
  id: 'user-1',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  passwordHash: 'hashed-pw',
  role: 'MEMBER' as const,
}

// ─── registerUser ─────────────────────────────────────────────────────────────

describe('registerUser', () => {
  const input = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'secret123' }

  it('throws "Email already registered" when the email is taken', async () => {
    db.user.findUnique.mockResolvedValue(fakeUser)

    await expect(registerUser(input)).rejects.toThrow('Email already registered')

    // should stop before ever hashing the password or creating the user
    expect(bcryptMock.hash).not.toHaveBeenCalled()
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it('hashes the password, creates the user, and returns token + user', async () => {
    db.user.findUnique.mockResolvedValue(null)
    bcryptMock.hash.mockResolvedValue('hashed-pw' as never)
    db.user.create.mockResolvedValue(fakeUser)

    const result = await registerUser(input)

    // password must be hashed before storing
    expect(bcryptMock.hash).toHaveBeenCalledWith('secret123', expect.any(Number))

    // user.create must receive the hash, not the plain password
    expect(db.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ passwordHash: 'hashed-pw' }),
      })
    )

    expect(result).toEqual({
      token: 'fake-token',
      user: { id: fakeUser.id, name: fakeUser.name, email: fakeUser.email, role: fakeUser.role },
    })
  })
})

// ─── loginUser ────────────────────────────────────────────────────────────────

describe('loginUser', () => {
  const input = { email: 'ada@example.com', password: 'secret123' }

  it('throws "Invalid credentials" when the user is not found', async () => {
    db.user.findUnique.mockResolvedValue(null)

    await expect(loginUser(input)).rejects.toThrow('Invalid credentials')

    // bcrypt should not be called — we don't even have a hash to compare
    expect(bcryptMock.compare).not.toHaveBeenCalled()
  })

  it('throws "Invalid credentials" when the password does not match', async () => {
    db.user.findUnique.mockResolvedValue(fakeUser)
    bcryptMock.compare.mockResolvedValue(false as never)

    await expect(loginUser(input)).rejects.toThrow('Invalid credentials')
  })

  it('returns token and user data on success', async () => {
    db.user.findUnique.mockResolvedValue(fakeUser)
    bcryptMock.compare.mockResolvedValue(true as never)

    const result = await loginUser(input)

    expect(result).toEqual({
      token: 'fake-token',
      user: { id: fakeUser.id, name: fakeUser.name, email: fakeUser.email, role: fakeUser.role },
    })
  })
})
