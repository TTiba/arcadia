'use client'
import { useState } from 'react'
import { DashboardWidget, WidgetData, WidgetSize } from '@/lib/dashboard-engine'
import { cn } from '@/lib/utils'
import { Badge } from './ui/badge'
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface RenderedWidget {
  widget: DashboardWidget
  data: WidgetData | null
}

const SIZE_CLASSES: Record<WidgetSize, string> = {
  sm: 'col-span-1',
  md: 'col-span-2',
  lg: 'col-span-2 md:col-span-3',
  full: 'col-span-2 md:col-span-4',
}

const COLOR_CLASSES: Record<string, string> = {
  green: 'bg-emerald-500',
  yellow: 'bg-amber-400',
  red: 'bg-red-500',
  blue: 'bg-blue-500',
  gray: 'bg-gray-400',
}

const BADGE_COLORS: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800',
  red: 'bg-red-100 text-red-800',
  yellow: 'bg-amber-100 text-amber-800',
  gray: 'bg-gray-100 text-gray-700',
}

function WidgetCard({ children, title, size = 'md' }: { children: React.ReactNode; title: string; size?: WidgetSize }) {
  return (
    <div className={cn('bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-3', SIZE_CLASSES[size])}>
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>
      {children}
    </div>
  )
}

function MetricWidget({ data, title, size }: { data: WidgetData & { type: 'METRIC' }; title: string; size?: WidgetSize }) {
  const trend = data.data.trend
  const Icon = trend?.includes('Adequado') ? TrendingUp : trend?.includes('Abaixo') ? TrendingDown : Minus
  return (
    <WidgetCard title={title} size={size}>
      <div className="flex items-end gap-2">
        <span className="text-4xl font-bold text-gray-900">{data.data.value}</span>
        {data.data.unit && <span className="text-lg text-gray-500 mb-1">{data.data.unit}</span>}
      </div>
      {trend && (
        <div className="flex items-center gap-1.5 text-sm text-gray-600">
          <Icon className="h-4 w-4" />
          {trend}
        </div>
      )}
      {data.data.detail && <p className="text-xs text-gray-400">{data.data.detail}</p>}
    </WidgetCard>
  )
}

function ListWidget({ data, title, size }: { data: WidgetData & { type: 'LIST' }; title: string; size?: WidgetSize }) {
  return (
    <WidgetCard title={title} size={size}>
      <div className="space-y-2 overflow-y-auto max-h-60">
        {data.data.length === 0 && <p className="text-sm text-gray-400">Nenhum item encontrado.</p>}
        {data.data.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0">
            <span className="text-sm text-gray-800 truncate flex-1">{item.name}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-gray-600">{item.value}</span>
              {item.badge && (
                <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', BADGE_COLORS[item.badgeColor || 'gray'])}>
                  {item.badge}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

function ProgressBarsWidget({ data, title, size }: { data: WidgetData & { type: 'PROGRESS_BARS' }; title: string; size?: WidgetSize }) {
  return (
    <WidgetCard title={title} size={size}>
      <div className="space-y-3">
        {data.data.map((item, i) => {
          const pct = item.max > 0 ? Math.round((item.value / item.max) * 100) : 0
          return (
            <div key={i} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">{item.label}</span>
                <span className="text-gray-500">{item.detail || `${pct}%`}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', COLOR_CLASSES[item.color] || 'bg-blue-500')}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </WidgetCard>
  )
}

function TableWidget({ data, title, size }: { data: WidgetData & { type: 'TABLE' }; title: string; size?: WidgetSize }) {
  return (
    <WidgetCard title={title} size={size}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              {data.data.headers.map((h, i) => (
                <th key={i} className="text-left py-1.5 px-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.data.rows.map((row, i) => (
              <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                {row.map((cell, j) => (
                  <td key={j} className="py-2 px-2 text-gray-700">{cell}</td>
                ))}
              </tr>
            ))}
            {data.data.rows.length === 0 && (
              <tr><td colSpan={data.data.headers.length} className="py-4 text-center text-gray-400 text-xs">Sem dados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </WidgetCard>
  )
}

function AlertListWidget({ data, title, size }: { data: WidgetData & { type: 'ALERT_LIST' }; title: string; size?: WidgetSize }) {
  return (
    <WidgetCard title={title} size={size}>
      <div className="space-y-2 overflow-y-auto max-h-64">
        {data.data.length === 0 && <p className="text-sm text-emerald-600 font-medium">Nenhum aluno em situação de risco.</p>}
        {data.data.map((item, i) => (
          <div key={i} className={cn(
            'flex gap-3 p-2.5 rounded-lg',
            item.type === 'CRITICO' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'
          )}>
            <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', item.type === 'CRITICO' ? 'text-red-500' : 'text-amber-500')} />
            <div>
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-500">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </WidgetCard>
  )
}

function scoreColor(v: number | undefined): string {
  if (v == null) return 'text-gray-300'
  if (v >= 7) return 'text-emerald-600 font-medium'
  if (v >= 5) return 'text-amber-600'
  return 'text-red-600 font-semibold'
}

const ROW_CAP = 400

function SaebMatrixWidget({ data, title }: { data: WidgetData & { type: 'SAEB_MATRIX' }; title: string }) {
  const { descriptors, classes, students } = data.data
  const [selClasses, setSelClasses] = useState<Set<string>>(new Set())
  const [selDescriptors, setSelDescriptors] = useState<Set<string>>(new Set())

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string) => {
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
  }

  // No selection = all
  const activeDescriptors = selDescriptors.size
    ? descriptors.filter(d => selDescriptors.has(d.code))
    : descriptors
  const activeClassIds = selClasses.size ? selClasses : new Set(classes.map(c => c.id))

  const filteredStudents = students.filter(s => s.classId && activeClassIds.has(s.classId))

  // Average per class (over the active descriptors)
  const cardClasses = selClasses.size ? classes.filter(c => selClasses.has(c.id)) : classes
  const avgForClass = (classId: string): number | null => {
    const vals: number[] = []
    for (const s of students) {
      if (s.classId !== classId) continue
      for (const d of activeDescriptors) {
        const v = s.scores[d.code]
        if (v != null) vals.push(v)
      }
    }
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
  }

  // Overall average across the current filter
  const overallVals: number[] = []
  for (const s of filteredStudents) for (const d of activeDescriptors) {
    const v = s.scores[d.code]; if (v != null) overallVals.push(v)
  }
  const overallAvg = overallVals.length ? overallVals.reduce((a, b) => a + b, 0) / overallVals.length : null

  const shownStudents = filteredStudents.slice(0, ROW_CAP)

  return (
    <div className="col-span-2 md:col-span-4 bg-white border rounded-xl p-4 shadow-sm flex flex-col gap-4">
      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h3>

      {/* Filters */}
      <div className="space-y-3">
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Filtrar por turma {selClasses.size > 0 && `(${selClasses.size})`}</p>
          <div className="flex flex-wrap gap-1.5">
            {classes.map(c => (
              <button
                key={c.id}
                onClick={() => toggle(selClasses, setSelClasses, c.id)}
                className={cn('text-xs px-2.5 py-1 rounded-full border transition-colors',
                  selClasses.has(c.id) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-700 border-gray-200 hover:border-violet-400')}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Filtrar por descritor {selDescriptors.size > 0 && `(${selDescriptors.size})`}</p>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {descriptors.map(d => (
              <button
                key={d.code}
                title={d.description}
                onClick={() => toggle(selDescriptors, setSelDescriptors, d.code)}
                className={cn('text-xs px-2 py-1 rounded-full border transition-colors font-mono',
                  selDescriptors.has(d.code) ? 'bg-violet-600 text-white border-violet-600' : 'bg-white text-gray-600 border-gray-200 hover:border-violet-400')}
              >
                {d.code}
              </button>
            ))}
          </div>
        </div>
        {(selClasses.size > 0 || selDescriptors.size > 0) && (
          <button
            onClick={() => { setSelClasses(new Set()); setSelDescriptors(new Set()) }}
            className="text-xs text-violet-600 hover:underline"
          >
            Limpar filtros
          </button>
        )}
      </div>

      {/* Average cards */}
      <div className="flex flex-wrap gap-3">
        <div className="rounded-lg border bg-violet-50 px-4 py-2.5 min-w-[140px]">
          <p className="text-[11px] uppercase tracking-wide text-violet-500 font-medium">Média geral (filtro)</p>
          <p className="text-2xl font-bold text-violet-700">{overallAvg != null ? overallAvg.toFixed(1) : '—'}</p>
        </div>
        {cardClasses.map(c => {
          const avg = avgForClass(c.id)
          return (
            <div key={c.id} className="rounded-lg border bg-gray-50 px-4 py-2.5 min-w-[120px]">
              <p className="text-[11px] uppercase tracking-wide text-gray-500 font-medium truncate">{c.name}</p>
              <p className={cn('text-2xl font-bold', avg == null ? 'text-gray-300' : avg >= 7 ? 'text-emerald-600' : avg >= 5 ? 'text-amber-600' : 'text-red-600')}>
                {avg != null ? avg.toFixed(1) : '—'}
              </p>
            </div>
          )
        })}
      </div>

      {/* Matrix */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="text-xs border-collapse">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th className="text-left py-2 px-2 font-semibold text-gray-500 sticky left-0 bg-gray-50 z-10 min-w-[160px]">Aluno</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-500 min-w-[90px]">Turma</th>
              {activeDescriptors.map(d => (
                <th key={d.code} title={`${d.code} — ${d.description} (${d.area})`} className="py-2 px-2 font-mono font-semibold text-gray-500 whitespace-nowrap">{d.code}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shownStudents.map(s => (
              <tr key={s.id} className="border-t hover:bg-gray-50">
                <td className="py-1.5 px-2 text-gray-800 sticky left-0 bg-white whitespace-nowrap">{s.name}</td>
                <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">{s.className}</td>
                {activeDescriptors.map(d => (
                  <td key={d.code} className={cn('py-1.5 px-2 text-center tabular-nums', scoreColor(s.scores[d.code]))}>
                    {s.scores[d.code] != null ? s.scores[d.code].toFixed(1) : '—'}
                  </td>
                ))}
              </tr>
            ))}
            {shownStudents.length === 0 && (
              <tr><td colSpan={activeDescriptors.length + 2} className="py-4 text-center text-gray-400">Nenhum aluno para o filtro selecionado.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{filteredStudents.length} aluno(s) · {activeDescriptors.length} descritor(es)</span>
        {filteredStudents.length > ROW_CAP && <span>Mostrando {ROW_CAP} — filtre por turma para ver todos.</span>}
      </div>
    </div>
  )
}

export function DashboardRenderer({ widgets }: { widgets: RenderedWidget[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 auto-rows-min">
      {widgets.map(({ widget, data }) => {
        if (!data) return (
          <WidgetCard key={widget.id} title={widget.title} size={widget.size}>
            <p className="text-xs text-gray-400">Dados indisponíveis para "{widget.dataKey}".</p>
          </WidgetCard>
        )

        switch (data.type) {
          case 'METRIC':
            return <MetricWidget key={widget.id} data={data} title={widget.title} size={widget.size} />
          case 'LIST':
            return <ListWidget key={widget.id} data={data} title={widget.title} size={widget.size} />
          case 'PROGRESS_BARS':
            return <ProgressBarsWidget key={widget.id} data={data} title={widget.title} size={widget.size} />
          case 'TABLE':
            return <TableWidget key={widget.id} data={data} title={widget.title} size={widget.size} />
          case 'ALERT_LIST':
            return <AlertListWidget key={widget.id} data={data} title={widget.title} size={widget.size} />
          case 'SAEB_MATRIX':
            return <SaebMatrixWidget key={widget.id} data={data} title={widget.title} />
          default:
            return null
        }
      })}
    </div>
  )
}
