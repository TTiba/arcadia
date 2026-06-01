'use client'
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
          default:
            return null
        }
      })}
    </div>
  )
}
