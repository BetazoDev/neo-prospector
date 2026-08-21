import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { comparePassword, signToken } from '@/lib/auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { ensureAdminUser } from '@/lib/seed-admin'

export async function POST(req: NextRequest) {
  try {
    // Extract client IP for rate limiting
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const rateCheck = checkRateLimit(`login:${ip}`, 5, 60000)

    if (!rateCheck.success) {
      return NextResponse.json(
        {
          error: `Demasiados intentos fallidos. Por seguridad, inténtalo de nuevo en ${Math.ceil(
            rateCheck.resetMs / 1000
          )} segundos.`,
        },
        { status: 429 }
      )
    }

    // Ensure initial admin user exists
    await ensureAdminUser()

    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 })
    }

    const cleanEmail = String(email).trim().toLowerCase()

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    })

    if (!user) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    const validPassword = await comparePassword(password, user.passwordHash)
    if (!validPassword) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 })
    }

    // Generate JWT token
    const token = await signToken({ userId: user.id, email: user.email })

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email },
    })

    // Set secure HTTP-Only cookie
    res.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return res
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      {
        error: 'Error interno de autenticación',
        details: error?.message || String(error),
        stack: error?.stack,
      },
      { status: 500 }
    )
  }
}
