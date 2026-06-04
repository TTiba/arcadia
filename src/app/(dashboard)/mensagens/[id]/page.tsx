'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Loader2, ArrowLeft, Send, Sparkles, X, Bot, Copy, Check, Clock, Flame, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface MsgPerson { id: string; name: string; role: string }
interface Reply { id: string; body: string; createdAt: string; sender: MsgPerson; recipient: MsgPerson }
interface FullMessage {
  id: string; subject: string; body: string; readAt: string | null; createdAt: string; parentId: string | null
  replyDeadline: string | null
  sender: MsgPerson; recipient: MsgPerson; replies: Reply[]
}

function DeadlineBar({ deadline }: { deadline: string }) {
  const d = new Date(deadline)
  const ms = d.getTime() - Date.now()
  const expired = ms <= 0
  const critical = ms > 0 && ms < 2 * 3600_000
  const warning  = ms > 0 && ms < 6 * 3600_000

  const label = expired ? 'PRAZO VENCIDO — responda imediatamente'
    : ms < 3600_000 ? `${Math.floor(ms / 60000)} minutos para o prazo`
    : ms < 24 * 3600_000 ? `${Math.floor(ms / 3600_000)}h ${Math.floor((ms % 3600_000) / 60000)}min para o prazo`
    : `Prazo: ${d.toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}`

  const Icon = expired || critical ? Flame : warning ? AlertTriangle : Clock

  return (
    <div className={cn(
      'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold mb-4',
      expired  ? 'bg-red-600 text-white animate-pulse' :
      critical ? 'bg-red-500 text-white animate-pulse' :
      warning  ? 'bg-amber-500 text-white' :
                 'bg-blue-500 text-white'
    )}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1">{label}</span>
    </div>
  )
}
interface AIMessage { role: 'user' | 'assistant'; content: string; model?: string }

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Direção', COORDENACAO: 'Coordenação',
  PEDAGOGO: 'Pedagogo(a)', PROFESSOR: 'Professor(a)', VISUALIZACAO: 'Visualização',
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function MessageBubble({ msg, currentUserId, isReply = false }: { msg: FullMessage | Reply; currentUserId: string; isReply?: boolean }) {
  const isMine = msg.sender.id === currentUserId
  return (
    <div className={cn('flex gap-3', isReply && 'mt-4 pt-4 border-t border-border')}>
      <Avatar className="h-8 w-8 shrink-0 mt-0.5">
        <AvatarFallback className={cn('text-xs font-medium', isMine ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
          {initials(msg.sender.name)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-sm font-semibold">{msg.sender.name}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{ROLE_LABELS[msg.sender.role] ?? msg.sender.role}</Badge>
          <span className="text-xs text-muted-foreground ml-auto">{formatDate(msg.createdAt)}</span>
        </div>
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.body}</p>
      </div>
    </div>
  )
}

export default function MessageViewPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: session } = useSession()
  const { toast } = useToast()
  const currentUserId = (session?.user as any)?.id ?? ''

  const [message, setMessage] = useState<FullMessage | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyBody, setReplyBody] = useState('')
  const [sending, setSending] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [aiInput, setAiInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const aiBottomRef = useRef<HTMLDivElement>(null)
  const aiInitialized = useRef(false)

  useEffect(() => {
    fetch(`/api/messages/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMessage(d); setLoading(false) })
  }, [id])

  useEffect(() => {
    if (aiOpen && aiMessages.length === 0 && message && !aiInitialized.current) {
      aiInitialized.current = true
      // Pre-load context
      const context = `Preciso responder à seguinte mensagem de ${message.sender.name} (${ROLE_LABELS[message.sender.role] ?? message.sender.role}):\n\nAssunto: "${message.subject}"\n\n"${message.body}"\n\nPode me ajudar a redigir uma resposta profissional e objetiva? Pode também levantar dados relevantes sobre alunos ou turmas se for útil para a resposta.`
      const initialMsgs: AIMessage[] = [{ role: 'user', content: context }]
      setAiMessages(initialMsgs)
      sendAiMessage(initialMsgs)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiOpen, message])

  useEffect(() => {
    aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [aiMessages])

  const sendAiMessage = async (msgs: AIMessage[]) => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      })
      if (res.ok) {
        const data = await res.json()
        setAiMessages(prev => [...prev, { role: 'assistant', content: data.message, model: data.model }])
      }
    } finally {
      setAiLoading(false)
    }
  }

  const sendAiChat = async () => {
    if (!aiInput.trim() || aiLoading) return
    const newMsgs: AIMessage[] = [...aiMessages, { role: 'user', content: aiInput }]
    setAiMessages(newMsgs)
    setAiInput('')
    await sendAiMessage(newMsgs)
  }

  const useAsDraft = (text: string, idx: number) => {
    setReplyBody(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
    toast({ title: 'Rascunho copiado para a resposta' })
  }

  const sendReply = async () => {
    if (!replyBody.trim() || !message) return
    setSending(true)
    const recipientId = message.sender.id === currentUserId ? message.recipient.id : message.sender.id
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipientId,
        subject: `Re: ${message.subject}`,
        body: replyBody,
        parentId: message.id,
      }),
    })
    setSending(false)
    if (res.ok) {
      toast({ title: 'Resposta enviada!' })
      setReplyBody('')
      // Reload
      const updated = await fetch(`/api/messages/${id}`)
      if (updated.ok) setMessage(await updated.json())
    } else {
      toast({ title: 'Erro ao enviar resposta', variant: 'destructive' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
      </div>
    )
  }
  if (!message) return <div className="p-6 text-muted-foreground">Mensagem não encontrada.</div>

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main panel */}
      <div className={cn('flex flex-col flex-1 overflow-hidden', aiOpen && 'border-r border-border')}>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl space-y-6">
            {/* Deadline bar — shown only to recipient when deadline is set */}
            {message.replyDeadline && message.recipient.id === currentUserId && (
              <DeadlineBar deadline={message.replyDeadline} />
            )}

            {/* Back + Subject */}
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" onClick={() => router.push('/mensagens')} className="shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-xl font-bold leading-tight">{message.subject}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Para: {message.recipient.name} · {ROLE_LABELS[message.recipient.role] ?? message.recipient.role}
                </p>
              </div>
            </div>

            {/* Original message */}
            <Card className="rounded-2xl border border-border shadow-none">
              <CardContent className="p-5">
                <MessageBubble msg={message} currentUserId={currentUserId} />
                {message.replies.map(r => (
                  <MessageBubble key={r.id} msg={r} currentUserId={currentUserId} isReply />
                ))}
              </CardContent>
            </Card>

            {/* Reply form */}
            <div className="space-y-3">
              <Textarea
                placeholder="Escreva sua resposta..."
                rows={5}
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                className="resize-none"
              />
              <div className="flex items-center gap-2">
                <Button onClick={sendReply} disabled={sending || !replyBody.trim()} className="gap-2">
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Responder
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setAiOpen(o => !o)}
                  className={cn('gap-2', aiOpen && 'border-primary text-primary')}
                >
                  <Sparkles className="h-4 w-4" />
                  Assistente IA
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Panel */}
      {aiOpen && (
        <div className="w-96 shrink-0 flex flex-col bg-background border-l border-border">
          {/* AI Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Assistente IA</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAiOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* AI Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {aiMessages.filter(m => m.role === 'assistant').map((m, i) => (
              <div key={i} className="space-y-2">
                <div className="flex gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-xs font-medium text-primary">Assistente Vela</span>
                      {m.model && <Badge variant="outline" className="text-[10px] px-1 py-0">{m.model}</Badge>}
                    </div>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => useAsDraft(m.content, i)}
                      className="mt-2 h-7 text-xs gap-1.5"
                    >
                      {copiedIdx === i ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
                      Usar esta resposta
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
                </div>
                <span className="text-sm text-muted-foreground">Gerando resposta...</span>
              </div>
            )}
            <div ref={aiBottomRef} />
          </div>

          {/* AI Input */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <Textarea
                placeholder="Peça ajuda ao assistente..."
                rows={2}
                className="resize-none text-sm"
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendAiChat() } }}
              />
              <Button size="icon" onClick={sendAiChat} disabled={aiLoading || !aiInput.trim()} className="shrink-0 self-end">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5">Enter para enviar · Shift+Enter para nova linha</p>
          </div>
        </div>
      )}
    </div>
  )
}
