'use client'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Textarea } from '@/components/ui/textarea'
import { makeMentionToken, type MentionType } from '@/lib/mentions'
import { GraduationCap, User } from 'lucide-react'

interface Candidate {
  id: string
  name: string
  type: MentionType
}

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  classId?: string
  rows?: number
  placeholder?: string
  autoFocus?: boolean
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Textarea com menção estruturada: digite @ e escolha a pessoa. O texto passa
// a guardar o token @[Nome|tipo:id] — vínculo exato, sem depender de grafia.
export function MentionTextarea({ value, onChange, classId, rows = 3, placeholder, autoFocus }: MentionTextareaProps) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [query, setQuery] = useState<string | null>(null) // null = dropdown fechado
  const [highlight, setHighlight] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const triggerStart = useRef(0)

  const loadCandidates = useCallback(async () => {
    if (candidates) return
    const qs = classId ? `?classId=${classId}` : ''
    const res = await fetch(`/api/mentions/candidates${qs}`)
    if (res.ok) setCandidates((await res.json()).candidates)
  }, [candidates, classId])

  // Turma mudou → recarrega na próxima abertura
  useEffect(() => { setCandidates(null) }, [classId])

  const matches = useMemo(() => {
    if (query === null || !candidates) return []
    const q = normalize(query)
    return candidates
      .filter(c => normalize(c.name).includes(q))
      .slice(0, 6)
  }, [query, candidates])

  const detectTrigger = (text: string, caret: number) => {
    const before = text.slice(0, caret)
    const m = before.match(/(^|[\s(])@([A-Za-zÀ-ÖØ-öø-ÿ ]{0,30})$/)
    if (m) {
      triggerStart.current = caret - m[2].length - 1 // posição do '@'
      setQuery(m[2])
      setHighlight(0)
      void loadCandidates()
    } else {
      setQuery(null)
    }
  }

  const pick = (c: Candidate) => {
    const el = textareaRef.current
    const caret = el?.selectionStart ?? value.length
    const token = makeMentionToken(c.name, c.type, c.id)
    const next = value.slice(0, triggerStart.current) + token + ' ' + value.slice(caret)
    onChange(next)
    setQuery(null)
    requestAnimationFrame(() => {
      const pos = triggerStart.current + token.length + 1
      el?.focus()
      el?.setSelectionRange(pos, pos)
    })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query === null || matches.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlight(h => (h + 1) % matches.length) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlight(h => (h - 1 + matches.length) % matches.length) }
    else if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); pick(matches[highlight]) }
    else if (e.key === 'Escape') { setQuery(null) }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        rows={rows}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={e => {
          onChange(e.target.value)
          detectTrigger(e.target.value, e.target.selectionStart)
        }}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
      />
      {query !== null && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-lg border border-border bg-popover shadow-md overflow-hidden">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Mencionar — vincula a pessoa ao registro
          </p>
          {matches.map((c, i) => (
            <button
              key={`${c.type}-${c.id}`}
              type="button"
              onMouseDown={e => { e.preventDefault(); pick(c) }}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left ${
                i === highlight ? 'bg-accent' : ''
              }`}
            >
              {c.type === 'aluno'
                ? <GraduationCap className="h-3.5 w-3.5 text-primary shrink-0" />
                : <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
              <span className="truncate">{c.name}</span>
              <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                {c.type === 'aluno' ? 'Aluno' : c.type === 'professor' ? 'Professor' : 'Equipe'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
