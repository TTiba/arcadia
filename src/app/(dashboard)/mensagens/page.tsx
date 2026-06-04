'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Inbox, Send, Pencil, Loader2, Clock, Flame, AlertTriangle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

interface Msg {
  id: string; subject: string; body: string; readAt: string | null; createdAt: string; replyDeadline: string | null
  sender: { id: string; name: string; role: string }
  recipient: { id: string; name: string; role: string }
}
interface Contact { id: string; name: string; role: string; roleLabel: string }

const ROLE_LABELS: Record<string, string> = {
  ADMIN: 'Direção', COORDENACAO: 'Coordenação',
  PEDAGOGO: 'Pedagogo(a)', PROFESSOR: 'Professor(a)', VISUALIZACAO: 'Visualização',
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Ontem'
  if (days < 7) return `${days}d atrás`
  return d.toLocaleDateString('pt-BR')
}

function DeadlineBadge({ deadline }: { deadline: string }) {
  const d = new Date(deadline)
  const ms = d.getTime() - Date.now()
  const expired = ms <= 0
  const critical = ms > 0 && ms < 2 * 3600_000
  const warning  = ms > 0 && ms < 6 * 3600_000

  let label = ''
  if (expired) label = 'Prazo vencido'
  else if (ms < 3600_000) label = `${Math.floor(ms / 60000)}min`
  else if (ms < 24 * 3600_000) label = `${Math.floor(ms / 3600_000)}h`
  else label = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  const Icon = expired || critical ? Flame : AlertTriangle

  return (
    <span className={cn(
      'flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full',
      expired  ? 'bg-red-100 text-red-700 animate-pulse' :
      critical ? 'bg-red-100 text-red-600 animate-pulse' :
      warning  ? 'bg-amber-100 text-amber-700' :
                 'bg-blue-100 text-blue-700'
    )}>
      <Icon className="h-2.5 w-2.5" />
      {label}
    </span>
  )
}

export default function MensagensPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [tab, setTab] = useState<'inbox' | 'sent'>('inbox')
  const [messages, setMessages] = useState<Msg[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [form, setForm] = useState({ recipientId: '', subject: '', body: '', replyDeadline: '' })

  const role = (session?.user as any)?.role ?? ''
  const canCompose = ['ADMIN', 'COORDENACAO', 'PEDAGOGO', 'PROFESSOR'].includes(role)

  const load = useCallback(async () => {
    setLoading(true)
    const url = tab === 'inbox' ? '/api/messages' : '/api/messages/sent'
    const res = await fetch(url)
    if (res.ok) setMessages(await res.json())
    setLoading(false)
  }, [tab])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (canCompose) fetch('/api/messages/contacts').then(r => r.ok && r.json()).then(d => d && setContacts(d))
  }, [canCompose])

  const send = async () => {
    if (!form.recipientId || !form.subject.trim() || !form.body.trim()) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' }); return
    }
    setSending(true)
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        replyDeadline: form.replyDeadline || null,
      }),
    })
    setSending(false)
    if (res.ok) {
      toast({ title: 'Mensagem enviada!' })
      setOpen(false)
      setForm({ recipientId: '', subject: '', body: '', replyDeadline: '' })
      if (tab === 'sent') load()
    } else {
      toast({ title: 'Erro ao enviar mensagem', variant: 'destructive' })
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mensagens</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Comunicação interna</p>
        </div>
        {canCompose && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Pencil className="h-4 w-4" /> Nova mensagem</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Nova mensagem</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>Para</Label>
                  <Select onValueChange={v => setForm(f => ({ ...f, recipientId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Selecionar destinatário..." /></SelectTrigger>
                    <SelectContent>
                      {contacts.map(c => (
                        <SelectItem key={c.id} value={c.id}>
                          <span className="font-medium">{c.name}</span>
                          <span className="text-muted-foreground ml-2 text-xs">— {c.roleLabel}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Assunto</Label>
                  <Input placeholder="Assunto da mensagem" value={form.subject}
                    onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label>Prazo para resposta <span className="text-muted-foreground text-xs">(opcional)</span></Label>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      type="datetime-local"
                      value={form.replyDeadline}
                      onChange={e => setForm(f => ({ ...f, replyDeadline: e.target.value }))}
                      min={new Date().toISOString().slice(0, 16)}
                      className="flex-1"
                    />
                  </div>
                  {form.replyDeadline && (
                    <p className="text-xs text-amber-600 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      O destinatário receberá alertas crescentes conforme o prazo se aproximar.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Mensagem</Label>
                  <Textarea placeholder="Escreva sua mensagem..." rows={6} value={form.body}
                    onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={send} disabled={sending} className="gap-2">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Enviar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {(['inbox', 'sent'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}>
            {t === 'inbox' ? <><Inbox className="h-3.5 w-3.5 inline mr-1.5" />Recebidas</> : <><Send className="h-3.5 w-3.5 inline mr-1.5" />Enviadas</>}
          </button>
        ))}
      </div>

      {/* Message list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
        </div>
      ) : messages.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">{tab === 'inbox' ? 'Nenhuma mensagem recebida' : 'Nenhuma mensagem enviada'}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {messages.map(msg => {
            const person = tab === 'inbox' ? msg.sender : msg.recipient
            const unread = tab === 'inbox' && !msg.readAt
            const hasDeadline = tab === 'inbox' && msg.replyDeadline && !msg.readAt
            return (
              <Card key={msg.id}
                onClick={() => router.push(`/mensagens/${msg.id}`)}
                className={cn(
                  'rounded-xl border border-border shadow-none cursor-pointer transition-colors hover:bg-accent',
                  unread && 'bg-primary/5 border-primary/20',
                  hasDeadline && new Date(msg.replyDeadline!).getTime() - Date.now() < 2 * 3600_000 && 'border-red-300 bg-red-50'
                )}>
                <CardContent className="p-4 flex items-start gap-3">
                  <Avatar className="h-9 w-9 shrink-0 mt-0.5">
                    <AvatarFallback className="bg-muted text-muted-foreground text-xs font-medium">
                      {initials(person.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        {unread && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        <span className={cn('text-sm truncate', unread ? 'font-semibold' : 'font-medium')}>
                          {person.name}
                        </span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          {ROLE_LABELS[person.role] ?? person.role}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasDeadline && <DeadlineBadge deadline={msg.replyDeadline!} />}
                        <span className="text-xs text-muted-foreground">{timeAgo(msg.createdAt)}</span>
                      </div>
                    </div>
                    <p className={cn('text-sm truncate', unread ? 'font-medium text-foreground' : 'text-foreground')}>
                      {msg.subject}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {msg.body.split('\n')[0]}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
