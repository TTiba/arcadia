'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Sparkles, LayoutDashboard, Pin, Trash2, Loader2, ChevronRight, Clock } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDateTime } from '@/lib/utils'
import { CompactDashboardConfig, BLOCK_LIBRARY } from '@/lib/dashboard-blocks'

interface DashboardMeta {
  id: string
  name: string
  description?: string
  prompt?: string
  pinned: boolean
  createdAt: string
  updatedAt: string
}

const INSPIRATIONS = [
  'Visão geral de risco dos alunos do 5º Ano A',
  'Desempenho SAEB de Língua Portuguesa com distribuição de níveis',
  'Ranking ENEM dos alunos do 9º Ano B',
  'Adesão às tarefas de casa por disciplina',
  'Dashboard executivo: comparativo entre turmas',
  'Alunos com baixo desempenho em notas e SAEB combinados',
]

export default function MeuVelaPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [dashboards, setDashboards] = useState<DashboardMeta[]>([])
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [preview, setPreview] = useState<{ config: CompactDashboardConfig } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { fetchDashboards() }, [])

  const fetchDashboards = async () => {
    const res = await fetch('/api/dashboards')
    if (res.ok) setDashboards(await res.json())
  }

  const generate = async () => {
    if (!prompt.trim()) return
    setGenerating(true)
    setPreview(null)
    try {
      const res = await fetch('/api/ai/dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPreview({ config: data.config })
    } catch (e: any) {
      toast({ title: e.message || 'Erro ao gerar dashboard', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const saveDashboard = async () => {
    if (!preview) return
    setSaving(true)
    try {
      const res = await fetch('/api/dashboards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: preview.config.title,
          description: preview.config.description,
          prompt,
          config: preview.config,
        }),
      })
      const text = await res.text()
      let data: any
      try { data = JSON.parse(text) } catch { throw new Error(text.slice(0, 120) || 'Resposta inválida do servidor') }
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      toast({ title: 'Dashboard salvo!' })
      setPreview(null)
      setPrompt('')
      fetchDashboards()
      router.push(`/meu-vela/${data.id}`)
    } catch (e: any) {
      toast({ title: e.message || 'Erro ao salvar', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const togglePin = async (id: string, pinned: boolean) => {
    await fetch(`/api/dashboards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !pinned }),
    })
    fetchDashboards()
  }

  const deleteDashboard = async (id: string) => {
    if (!confirm('Excluir este dashboard?')) return
    await fetch(`/api/dashboards/${id}`, { method: 'DELETE' })
    fetchDashboards()
  }

  const firstName = session?.user?.name?.split(' ')[0] || 'você'
  const pinned = dashboards.filter(d => d.pinned)
  const rest = dashboards.filter(d => !d.pinned)

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-violet-600" />
          Meu Vela
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Descreva o que quer ver e a IA cria um dashboard personalizado só para {firstName}.
        </p>
      </div>

      {/* Create section */}
      <div className="border rounded-xl p-5 bg-gradient-to-br from-violet-50 to-white space-y-4">
        <h2 className="font-semibold text-gray-800">Criar novo dashboard</h2>
        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="Ex: Quero ver o desempenho SAEB dos alunos com distribuição por nível e os alunos em risco..."
          className="resize-none bg-white"
          rows={3}
        />
        <div className="flex flex-wrap gap-2">
          {INSPIRATIONS.map(i => (
            <button
              key={i}
              onClick={() => setPrompt(i)}
              className="text-xs px-3 py-1 rounded-full border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
            >
              {i}
            </button>
          ))}
        </div>
        <Button
          onClick={generate}
          disabled={!prompt.trim() || generating}
          className="bg-violet-600 hover:bg-violet-700"
        >
          {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" /> Gerar Dashboard</>}
        </Button>
      </div>

      {/* Preview */}
      {preview && (
        <div className="border-2 border-violet-300 rounded-xl p-5 bg-white space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <Badge className="mb-2 bg-violet-100 text-violet-700 hover:bg-violet-100">Prévia gerada pela IA</Badge>
              <h3 className="text-lg font-bold">{preview.config.title}</h3>
              {preview.config.description && <p className="text-sm text-muted-foreground">{preview.config.description}</p>}
            </div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs font-medium text-gray-500 mb-2">Blocos que serão combinados:</p>
            <div className="flex flex-wrap gap-2">
              {preview.config.blocks.map(b => (
                <span key={b.blockId} className="text-xs px-2.5 py-1 bg-white border rounded-full text-gray-700">
                  {BLOCK_LIBRARY[b.blockId]?.name || b.blockId}
                  {b.params && Object.values(b.params).length > 0 && (
                    <span className="text-gray-400 ml-1">({Object.values(b.params).join(', ')})</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className="flex gap-3">
            <Button onClick={saveDashboard} disabled={saving} className="bg-violet-600 hover:bg-violet-700">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Salvar e Abrir Dashboard
            </Button>
            <Button variant="outline" onClick={() => setPreview(null)}>Descartar</Button>
          </div>
        </div>
      )}

      {/* Pinned dashboards */}
      {pinned.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Pin className="h-3.5 w-3.5" /> Fixados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {pinned.map(d => <DashboardCard key={d.id} d={d} onPin={togglePin} onDelete={deleteDashboard} router={router} />)}
          </div>
        </div>
      )}

      {/* All dashboards */}
      {rest.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <LayoutDashboard className="h-3.5 w-3.5" /> Meus Dashboards
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rest.map(d => <DashboardCard key={d.id} d={d} onPin={togglePin} onDelete={deleteDashboard} router={router} />)}
          </div>
        </div>
      )}

      {dashboards.length === 0 && !preview && (
        <div className="text-center py-16 text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 text-violet-200" />
          <p className="font-medium">Nenhum dashboard criado ainda.</p>
          <p className="text-sm">Descreva o que quer ver acima e a IA cria para você.</p>
        </div>
      )}
    </div>
  )
}

function DashboardCard({ d, onPin, onDelete, router }: {
  d: DashboardMeta
  onPin: (id: string, pinned: boolean) => void
  onDelete: (id: string) => void
  router: ReturnType<typeof useRouter>
}) {
  return (
    <Card
      className="cursor-pointer hover:border-violet-300 hover:shadow-md transition-all group"
      onClick={() => router.push(`/meu-vela/${d.id}`)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {d.pinned && <Pin className="h-3 w-3 text-violet-500 shrink-0" />}
              <h3 className="font-semibold text-sm truncate">{d.name}</h3>
            </div>
            {d.description && <p className="text-xs text-muted-foreground truncate">{d.description}</p>}
            {d.prompt && <p className="text-xs text-gray-400 mt-1 italic truncate">"{d.prompt}"</p>}
            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              {formatDateTime(d.updatedAt)}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onPin(d.id, d.pinned) }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-violet-600 transition-colors"
              title={d.pinned ? 'Desafixar' : 'Fixar'}
            >
              <Pin className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); onDelete(d.id) }}
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-red-500 transition-colors"
              title="Excluir"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
            <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-violet-500 transition-colors" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
