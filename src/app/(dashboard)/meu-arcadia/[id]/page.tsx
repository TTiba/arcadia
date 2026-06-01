'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DashboardRenderer } from '@/components/dashboard-renderer'
import { DashboardConfig } from '@/lib/dashboard-engine'
import { ArrowLeft, Pin, Trash2, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface DashboardPayload {
  dashboard: { id: string; name: string; description?: string; prompt?: string; pinned: boolean }
  config: DashboardConfig
  widgets: { widget: any; data: any }[]
}

export default function DashboardViewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { toast } = useToast()
  const [payload, setPayload] = useState<DashboardPayload | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/dashboards/${id}`)
      if (!res.ok) { router.push('/meu-arcadia'); return }
      setPayload(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const togglePin = async () => {
    if (!payload) return
    await fetch(`/api/dashboards/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pinned: !payload.dashboard.pinned }),
    })
    load()
  }

  const deleteDashboard = async () => {
    if (!confirm('Excluir este dashboard?')) return
    await fetch(`/api/dashboards/${id}`, { method: 'DELETE' })
    toast({ title: 'Dashboard excluído.' })
    router.push('/meu-arcadia')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando dashboard...
      </div>
    )
  }

  if (!payload) return null

  const { dashboard, widgets } = payload

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/meu-arcadia')} className="shrink-0 mt-0.5">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h1 className="text-xl font-bold">{dashboard.name}</h1>
            {dashboard.pinned && <Pin className="h-4 w-4 text-violet-500" />}
            <Badge variant="outline" className="text-violet-700 border-violet-300 bg-violet-50 text-xs">
              <Sparkles className="h-3 w-3 mr-1" /> Gerado por IA
            </Badge>
          </div>
          {dashboard.description && <p className="text-sm text-muted-foreground">{dashboard.description}</p>}
          {dashboard.prompt && (
            <p className="text-xs text-gray-400 italic mt-1">"{dashboard.prompt}"</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="ghost" size="icon" onClick={load} title="Atualizar dados">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={togglePin} title={dashboard.pinned ? 'Desafixar' : 'Fixar'}>
            <Pin className={`h-4 w-4 ${dashboard.pinned ? 'text-violet-600' : 'text-gray-400'}`} />
          </Button>
          <Button variant="ghost" size="icon" onClick={deleteDashboard} title="Excluir" className="text-gray-400 hover:text-red-500">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Dashboard */}
      <DashboardRenderer widgets={widgets} />
    </div>
  )
}
