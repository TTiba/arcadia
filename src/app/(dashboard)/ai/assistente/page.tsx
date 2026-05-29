'use client'
import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Bot, Send, User, Loader2, Sparkles, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const QUICK_PROMPTS = [
  'Quais alunos estão com desempenho abaixo do básico no SAEB?',
  'Gere um relatório de desempenho da turma 5º Ano A',
  'Quais tarefas tiveram menor adesão dos alunos?',
  'Liste os alunos com registros pedagógicos pendentes',
  'Compare o desempenho em Português vs Matemática no SAEB',
  'Quais descritores SAEB precisam de mais atenção?',
  'Resumo geral de desempenho ENEM do 9º Ano B',
  'Professores que não registraram aula recentemente',
]

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse')}>
      <div className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
        isUser ? 'bg-primary text-white' : 'bg-violet-100 text-violet-700'
      )}>
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn(
        'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
        isUser
          ? 'bg-primary text-white rounded-tr-sm'
          : 'bg-muted text-foreground rounded-tl-sm'
      )}>
        <MessageContent content={message.content} />
      </div>
    </div>
  )
}

function MessageContent({ content }: { content: string }) {
  // Very simple markdown-ish rendering: bold, code blocks, tables
  const lines = content.split('\n')
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) return <h3 key={i} className="font-bold text-base mt-2">{line.slice(3)}</h3>
        if (line.startsWith('### ')) return <h4 key={i} className="font-semibold mt-1">{line.slice(4)}</h4>
        if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold">{line.slice(2, -2)}</p>
        if (line.startsWith('- ') || line.startsWith('* ')) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>
        if (line.startsWith('| ')) return <pre key={i} className="text-xs font-mono overflow-x-auto">{line}</pre>
        if (line.trim() === '') return <div key={i} className="h-1" />
        return <p key={i}>{line}</p>
      })}
    </div>
  )
}

export default function AssistentePage() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: `Olá, ${session?.user?.name?.split(' ')[0] || 'professor(a)'}! 👋\n\nSou o **Assistente Pedagógico Arcadia**. Posso analisar os dados da escola e gerar relatórios sobre:\n\n- Desempenho dos alunos nos descritores do **SAEB**\n- Resultados por competência do **ENEM**\n- Adesão às tarefas de casa\n- Registros pedagógicos e alertas\n- Relatórios por turma, componente ou aluno\n\nComo posso ajudar?`,
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const content = (text || input).trim()
    if (!content || loading) return

    const userMessage: Message = { role: 'user', content }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.filter(m => m.role !== 'assistant' || newMessages.indexOf(m) > 0)
            .map(m => ({ role: m.role, content: m.content }))
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Erro ao conectar com o assistente.')
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message }])
      }
    } catch {
      setError('Erro de rede. Verifique sua conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] p-6 gap-4">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="bg-violet-100 p-2 rounded-xl">
          <Sparkles className="h-5 w-5 text-violet-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Assistente Pedagógico</h1>
          <p className="text-sm text-muted-foreground">Análise de dados escolares com IA · SAEB · ENEM · Relatórios</p>
        </div>
        <Badge variant="outline" className="ml-auto text-violet-700 border-violet-300 bg-violet-50">
          Claude AI
        </Badge>
      </div>

      {/* Error banner */}
      {error && (
        <Card className="border-destructive bg-destructive/5 shrink-0">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </CardContent>
        </Card>
      )}

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto space-y-4 min-h-0">
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
              <Bot className="h-4 w-4" />
            </div>
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Analisando dados da escola...</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 1 && (
        <div className="shrink-0">
          <p className="text-xs text-muted-foreground mb-2 font-medium">Sugestões rápidas</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_PROMPTS.map(p => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                className="text-xs px-3 py-1.5 rounded-full border border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100 transition-colors"
              >
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="flex gap-2 shrink-0">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
          placeholder="Pergunte sobre desempenho dos alunos, SAEB, ENEM, relatórios..."
          className="resize-none min-h-[44px] max-h-[120px]"
          rows={1}
          disabled={loading}
        />
        <Button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className="bg-violet-600 hover:bg-violet-700 shrink-0 self-end"
          size="icon"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
