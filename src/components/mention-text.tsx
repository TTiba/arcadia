'use client'
import { segmentMentions } from '@/lib/mentions'

// Renderiza texto com tokens @[Nome|tipo:id] como chips discretos.
// Em contextos server-side / texto puro, use mentionsToPlainText de lib/mentions.
export function MentionText({ text, className }: { text: string; className?: string }) {
  if (!text) return null
  const segments = segmentMentions(text)
  return (
    <span className={className}>
      {segments.map((seg, i) =>
        seg.kind === 'text' ? (
          <span key={i}>{seg.value}</span>
        ) : (
          <span
            key={i}
            className="inline-flex items-center rounded bg-primary/10 text-primary px-1 font-medium"
            title={seg.mention.type === 'aluno' ? 'Aluno vinculado' : 'Pessoa vinculada'}
          >
            {seg.mention.name}
          </span>
        )
      )}
    </span>
  )
}
