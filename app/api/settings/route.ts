import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'

export async function GET(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { apifyApiKey: true, maxLeads: true },
    })

    if (!user) {
      // User ID from JWT token not found in current DB (e.g. after DB reset/migration)
      return NextResponse.json({ error: 'Usuario no encontrado en la base de datos. Por favor vuelve a iniciar sesión.' }, { status: 401 })
    }

    const effectiveKey = user?.apifyApiKey || process.env.APIFY_API_KEY || ''
    const maxLeads = user?.maxLeads || 100

    return NextResponse.json({
      apiKey: effectiveKey,
      maxLeads,
      hasSavedKey: Boolean(effectiveKey && effectiveKey.trim().length > 0),
    })
  } catch (error) {
    console.error('Error fetching settings:', error)
    return NextResponse.json({ error: `Error al obtener la configuración: ${String(error)}` }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = getTokenFromRequest(req)
    if (!token) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
    }

    const payload = await verifyToken(token)
    if (!payload || !payload.userId) {
      return NextResponse.json({ error: 'Sesión inválida' }, { status: 401 })
    }

    const { apiKey, maxLeads } = await req.json()

    if (typeof apiKey !== 'string' || !apiKey.trim()) {
      return NextResponse.json(
        { error: 'Por favor ingresa una API Key de Apify válida' },
        { status: 400 }
      )
    }

    const cleanKey = apiKey.trim()
    const cleanMaxLeads = Math.max(1, Number(maxLeads) || 100)

    // Check if user exists first
    const existingUser = await prisma.user.findUnique({
      where: { id: payload.userId },
    })

    if (!existingUser) {
      return NextResponse.json(
        { error: 'Tu sesión expiró o tu usuario no existe en esta base de datos. Por favor cierra sesión y vuelve a ingresar.' },
        { status: 401 }
      )
    }

    const updatedUser = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        apifyApiKey: cleanKey,
        maxLeads: cleanMaxLeads,
      },
      select: {
        apifyApiKey: true,
        maxLeads: true,
      },
    })

    return NextResponse.json({
      success: true,
      apiKey: updatedUser.apifyApiKey,
      maxLeads: updatedUser.maxLeads,
      hasSavedKey: true,
    })
  } catch (error) {
    console.error('Error saving settings:', error)
    return NextResponse.json({ error: `Error al guardar la configuración: ${String(error)}` }, { status: 500 })
  }
}
