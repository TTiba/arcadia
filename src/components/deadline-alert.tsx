'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, X, Bell, AlertTriangle, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

interface UrgentMessage {
  id: string
  subject: string
  senderName: string
  replyDeadline: string
}

function getUrgencyLevel(deadline: Date): 'expired' | 'critical' | 'warning' | 'soon' {
  const ms = deadline.getTime() - Date.now()
  if (ms <= 0) return 'expired'
  if (ms < 2 * 3600 * 1000) return 'critical'   // < 2h
  if (ms < 6 * 3600 * 1000) return 'warning'    // < 6h
  return 'soon'                                   // < 24h
}

function formatTimeLeft(deadline: Date): string {
  const ms = deadline.getTime() - Date.now()
  if (ms <= 0) return 'PRAZO VENCIDO'
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h restantes`
  if (h > 0) return `${h}h ${m}min restantes`
  return `${m} minutos restantes`
}

const URGENCY_STYLES = {
  expired: {
    bg: 'bg-red-600',
    border: 'border-red-700',
    text: 'text-white',
    icon: Flame,
    pulse: 'animate-pulse',
    label: 'PRAZO VENCIDO',
    labelBg: 'bg-red-800',
  },
  critical: {
    bg: 'bg-red-500',
    border: 'border-red-600',
    text: 'text-white',
    icon: AlertTriangle,
    pulse: 'animate-pulse',
    label: 'URGENTE',
    labelBg: 'bg-red-700',
  },
  warning: {
    bg: 'bg-amber-500',
    border: 'border-amber-600',
    text: 'text-white',
    icon: Clock,
    pulse: '',
    label: 'ATENÇÃO',
    labelBg: 'bg-amber-700',
  },
  soon: {
    bg: 'bg-blue-500',
    border: 'border-blue-600',
    text: 'text-white',
    icon: Bell,
    pulse: '',
    label: 'PRAZO HOJE',
    labelBg: 'bg-blue-700',
  },
}

export function DeadlineAlert() {
  const router = useRouter()
  const [messages, setMessages] = useState<UrgentMessage[]>([])
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [visible, setVisible] = useState<string | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const fetch_ = () =>
      fetch('/api/messages/urgent')
        .then(r => r.ok ? r.json() : [])
        .then((msgs: UrgentMessage[]) => {
          setMessages(msgs)
          // Show the most urgent that hasn't been dismissed
          const first = msgs.find(m => !dismissed.has(m.id))
          if (first) setVisible(first.id)
        })
    fetch_()
    const poll = setInterval(fetch_, 60_000)
    // Retick every minute to refresh countdown
    const retick = setInterval(() => setTick(t => t + 1), 60_000)
    return () => { clearInterval(poll); clearInterval(retick) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const current = messages.find(m => m.id === visible && !dismissed.has(m.id))
  if (!current) return null

  const deadline = new Date(current.replyDeadline)
  const level = getUrgencyLevel(deadline)
  const style = URGENCY_STYLES[level]
  const Icon = style.icon
  const timeLeft = formatTimeLeft(deadline)

  const dismiss = () => {
    setDismissed(prev => { const s = new Set(prev); s.add(current.id); return s })
    const next = messages.find(m => m.id !== current.id && !dismissed.has(m.id))
    setVisible(next?.id ?? null)
  }

  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 w-80 rounded-2xl shadow-2xl border-2 overflow-hidden',
      style.bg, style.border, style.pulse
    )}>
      {/* Top label bar */}
      <div className={cn('flex items-center justify-between px-4 py-2', style.labelBg)}>
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-white/90" />
          <span className="text-[11px] font-bold tracking-widest text-white/90">{style.label}</span>
        </div>
        <button onClick={dismiss} className="text-white/70 hover:text-white transition-colors">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Content */}
      <button
        onClick={() => router.push(`/mensagens/${current.id}`)}
        className="w-full text-left px-4 py-3 hover:brightness-110 transition-all"
      >
        <p className="text-xs font-semibold text-white/80 mb-0.5">
          {current.senderName} aguarda sua resposta
        </p>
        <p className="text-sm font-bold text-white leading-tight mb-2 line-clamp-2">
          {current.subject}
        </p>
        <div className="flex items-center gap-1.5 text-white">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className={cn('text-xs font-bold', level === 'expired' && 'line-through opacity-75')}>
            {timeLeft}
          </span>
        </div>
        <p className="text-[10px] text-white/60 mt-2">Clique para responder →</p>
      </button>

      {/* If multiple pending, show count */}
      {messages.filter(m => !dismissed.has(m.id)).length > 1 && (
        <div className={cn('px-4 py-2 border-t border-white/20 text-center', style.labelBg)}>
          <span className="text-[11px] text-white/70">
            +{messages.filter(m => !dismissed.has(m.id)).length - 1} outras mensagens com prazo
          </span>
        </div>
      )}
    </div>
  )
}
