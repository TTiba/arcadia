import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    const uploadDir = join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadDir)) {
      await mkdir(uploadDir, { recursive: true })
    }

    const uniqueFilename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '')}`
    const filepath = join(uploadDir, uniqueFilename)
    await writeFile(filepath, buffer)

    const url = `/uploads/${uniqueFilename}`
    return NextResponse.json({ url, name: file.name })
  } catch (error: any) {
    console.error('[API Upload] error:', error)
    return NextResponse.json({ error: 'Falha ao fazer upload do arquivo' }, { status: 500 })
  }
}
