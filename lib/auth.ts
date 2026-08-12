import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

const JWT_SECRET_STRING = process.env.JWT_SECRET || 'neoprospector_super_secret_jwt_key_2026_diabolical'
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_STRING)

export interface JWTPayload {
  userId: string
  email: string
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ userId: payload.userId, email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const verified = await jwtVerify(token, JWT_SECRET)
    const payload = verified.payload as unknown as JWTPayload
    if (payload && payload.userId && payload.email) {
      return payload
    }
    return null
  } catch {
    return null
  }
}

export function getTokenFromRequest(req: NextRequest): string | null {
  // 1. Check HTTP-Only Cookie 'auth_token'
  const cookieToken = req.cookies.get('auth_token')?.value
  if (cookieToken) return cookieToken

  // 2. Check Authorization Header Bearer
  const authHeader = req.headers.get('Authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  return null
}
