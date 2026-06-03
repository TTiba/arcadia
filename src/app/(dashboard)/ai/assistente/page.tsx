'use client'
import React, { useState, useRef, useEffect } from 'react'
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

function InlineMarkdown({ text }: { text: string }) {
  // Render inline bold (**text**) and inline code (`code`)
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**'))
          return <strong key={i}>{part.slice(2, -2)}</strong>
        if (part.startsWith('`') && part.endsWith('`'))
          return <code key={i} className="bg-black/10 rounded px-1 py-0.5 text-xs font-mono">{part.slice(1, -1)}</code>
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

function MessageContent({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Heading
    if (line.startsWith('# '))  { blocks.push(<h2 key={i} className="font-bold text-base mt-3 mb-1"><InlineMarkdown text={line.slice(2)} /></h2>); i++; continue }
    if (line.startsWith('## ')) { blocks.push(<h3 key={i} className="font-bold text-sm mt-3 mb-1"><InlineMarkdown text={line.slice(3)} /></h3>); i++; continue }
    if (line.startsWith('### ')) { blocks.push(<h4 key={i} className="font-semibold text-sm mt-2"><InlineMarkdown text={line.slice(4)} /></h4>); i++; continue }

    // Horizontal rule
    if (line.trim() === '---') { blocks.push(<hr key={i} className="my-2 border-border/40" />); i++; continue }

    // Blockquote — group consecutive > lines
    if (line.startsWith('> ')) {
      const quoteLines: string[] = []
      while (i < lines.length && lines[i].startsWith('> ')) {
        quoteLines.push(lines[i].slice(2))
        i++
      }
      blocks.push(
        <blockquote key={`q${i}`} className="border-l-2 border-violet-400 pl-3 my-1 text-muted-foreground italic text-xs">
          {quoteLines.map((q, j) => <p key={j}><InlineMarkdown text={q} /></p>)}
        </blockquote>
      )
      continue
    }

    // List — group consecutive - or * lines
    if (line.startsWith('- ') || line.startsWith('* ')) {
      const items: string[] = []
      while (i < lines.length && (lines[i].startsWith('- ') || lines[i].startsWith('* '))) {
        items.push(lines[i].slice(2))
        i++
      }
      blocks.push(
        <ul key={`ul${i}`} className="my-1 space-y-0.5">
          {items.map((item, j) => (
            <li key={j} className="flex gap-1.5 items-start">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
              <span><InlineMarkdown text={item} /></span>
            </li>
          ))}
        </ul>
      )
      continue
    }

    // Table — group consecutive | lines, skip separator rows (---|---)
    if (line.startsWith('|')) {
      const tableLines: string[] = []
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      const isSeparator = (r: string) => r.split('|').slice(1, -1).every(c => /^[\s\-:]+$/.test(c))
      const rows = tableLines.filter(l => !isSeparator(l))
      const parseRow = (r: string) => r.split('|').slice(1, -1).map(c => c.trim())
      const [header, ...body] = rows
      blocks.push(
        <div key={`t${i}`} className="my-2 overflow-x-auto rounded-lg border border-border/50">
          <table className="w-full text-xs">
            <thead className="bg-muted/60">
              <tr>{parseRow(header).map((cell, j) => <th key={j} className="px-3 py-2 text-left font-semibold"><InlineMarkdown text={cell} /></th>)}</tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri} className="border-t border-border/30 even:bg-muted/20">
                  {parseRow(row).map((cell, j) => <td key={j} className="px-3 py-1.5"><InlineMarkdown text={cell} /></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }

    // Empty line
    if (line.trim() === '') { blocks.push(<div key={i} className="h-1" />); i++; continue }

    // Normal paragraph
    blocks.push(<p key={i} className="leading-relaxed"><InlineMarkdown text={line} /></p>)
    i++
  }

  return <div className="space-y-0.5">{blocks}</div>
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
