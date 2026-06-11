'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Search, BookOpen, Eye, Link as LinkIcon, Video, FileText, ClipboardList, Calendar, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { formatDate, getEmbedUrl } from '@/lib/utils'

interface Material {
  id?: string
  type: string
  title: string
  url?: string
  description?: string
}

interface Lesson {
  id: string
  title: string
  description?: string
  startDate?: string
  endDate?: string
  subject?: { name: string }
  subjects?: { id: string; name: string }[]
  lessonClasses: { class: { id: string; name: string } }[]
  materials: Material[]
  _count?: { classRecords: number; homework: number }
}

const MATERIAL_TYPES = [
  { value: 'LINK', label: 'Link', icon: LinkIcon },
  { value: 'VIDEO', label: 'Vídeo', icon: Video },
  { value: 'DOCUMENTO', label: 'Documento', icon: FileText },
]

const materialIcon = (type: string) => {
  if (type === 'VIDEO') return <Video className="h-3.5 w-3.5 text-red-500" />
  if (type === 'DOCUMENTO') return <FileText className="h-3.5 w-3.5 text-blue-500" />
  return <LinkIcon className="h-3.5 w-3.5 text-green-500" />
}

function formatSchoolName(name: string) {
  if (!name) return ''
  return name
    .replace(/Escola\s+Estadual\s+(?:Prof\.\s+)?/gi, '')
    .replace(/Colégio\s+Estadual\s+(?:Prof\.\s+)?/gi, '')
    .replace(/Escola\s+Estadual\s+/gi, '')
    .replace(/Colégio\s+Estadual\s+/gi, '')
    .replace(/E\.\s*E\.\s*/gi, '')
    .replace(/C\.\s*E\.\s*/gi, '')
}

export default function AulasPage() {
  const [lessons, setLessons] = useState<Lesson[]>([])
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const [viewLesson, setViewLesson] = useState<Lesson | null>(null)
  const [allClasses, setAllClasses] = useState<any[]>([])
  const [allSubjects, setAllSubjects] = useState<any[]>([])
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null)
  const [isIndefinite, setIsIndefinite] = useState(false)
  const [form, setForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    classIds: [] as string[],
    subjectIds: [] as string[],
  })
  const [materials, setMaterials] = useState<Material[]>([])
  const [newMaterial, setNewMaterial] = useState<Material>({ type: 'LINK', title: '', url: '' })
  const { toast } = useToast()

  useEffect(() => {
    fetchLessons()
    fetchClasses()
    fetchSubjects()
  }, [])

  const fetchLessons = async () => {
    const res = await fetch('/api/aulas')
    if (res.ok) setLessons(await res.json())
  }

  const fetchClasses = async () => {
    const res = await fetch('/api/turmas')
    if (res.ok) setAllClasses(await res.json())
  }

  const fetchSubjects = async () => {
    const res = await fetch('/api/subjects')
    if (res.ok) setAllSubjects(await res.json())
  }

  const addMaterial = () => {
    if (!newMaterial.title) return
    setMaterials([...materials, { ...newMaterial }])
    setNewMaterial({ type: 'LINK', title: '', url: '' })
  }

  const formatDateForInput = (dateStr?: string) => {
    if (!dateStr) return ''
    return dateStr.substring(0, 10)
  }

  const handleOpenEdit = (lesson: Lesson) => {
    setEditingLessonId(lesson.id)
    
    let subjectsArr: string[] = []
    if (lesson.subjects && lesson.subjects.length > 0) {
      subjectsArr = lesson.subjects.map(s => s.id)
    } else if ((lesson as any).subjectId) {
      subjectsArr = [(lesson as any).subjectId]
    }

    const hasDates = !!lesson.startDate || !!lesson.endDate
    setIsIndefinite(!hasDates)

    setForm({
      title: lesson.title,
      description: lesson.description || '',
      startDate: formatDateForInput(lesson.startDate),
      endDate: formatDateForInput(lesson.endDate),
      classIds: lesson.lessonClasses.map(lc => lc.class?.id || (lc as any).classId).filter(Boolean),
      subjectIds: subjectsArr,
    })
    setMaterials(lesson.materials)
    setViewLesson(null)
    setOpen(true)
  }

  const handleDelete = async (lessonId: string) => {
    if (!confirm('Deseja realmente excluir esta aula?')) return

    const res = await fetch(`/api/aulas/${lessonId}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      toast({ title: 'Aula excluída com sucesso!' })
      setViewLesson(null)
      fetchLessons()
    } else {
      toast({ title: 'Erro ao excluir aula', variant: 'destructive' })
    }
  }

  const handleSave = async () => {
    const url = editingLessonId ? `/api/aulas/${editingLessonId}` : '/api/aulas'
    const method = editingLessonId ? 'PUT' : 'POST'

    const payload = {
      ...form,
      startDate: isIndefinite || !form.startDate ? null : form.startDate,
      endDate: isIndefinite || !form.endDate ? null : form.endDate,
      materials,
    }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      toast({ title: editingLessonId ? 'Aula atualizada!' : 'Aula cadastrada!' })
      setOpen(false)
      setForm({ title: '', description: '', startDate: '', endDate: '', classIds: [], subjectIds: [] })
      setMaterials([])
      setEditingLessonId(null)
      setIsIndefinite(false)
      fetchLessons()
    } else {
      toast({ title: 'Erro ao salvar', variant: 'destructive' })
    }
  }

  const filtered = lessons.filter(l => l.title.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="h-6 w-6" /> Aulas</h1>
          <p className="text-muted-foreground text-sm">{lessons.length} aulas cadastradas</p>
        </div>
        <Button onClick={() => { setForm({ title: '', description: '', startDate: '', endDate: '', classIds: [], subjectIds: [] }); setMaterials([]); setEditingLessonId(null); setIsIndefinite(false); setOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" /> Nova Aula
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar aula..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.length === 0 ? (
          <p className="text-muted-foreground col-span-3 text-center py-8">Nenhuma aula encontrada.</p>
        ) : filtered.map(lesson => (
          <Card key={lesson.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewLesson(lesson)}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-base line-clamp-2">{lesson.title}</CardTitle>
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={e => { e.stopPropagation(); setViewLesson(lesson) }}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </div>
              {lesson.subjects && lesson.subjects.length > 1 ? (
                <Badge variant="outline" className="w-fit text-xs bg-purple-50 text-purple-700 border-purple-200">
                  Interdisciplinar ({lesson.subjects.map(s => s.name).join(', ')})
                </Badge>
              ) : lesson.subject ? (
                <Badge variant="outline" className="w-fit text-xs">{lesson.subject.name}</Badge>
              ) : lesson.subjects && lesson.subjects.length === 1 ? (
                <Badge variant="outline" className="w-fit text-xs">{lesson.subjects[0].name}</Badge>
              ) : (
                <Badge variant="outline" className="w-fit text-xs bg-gray-50 text-gray-500">Sem Componente</Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {lesson.description && <p className="text-xs text-muted-foreground line-clamp-2">{lesson.description}</p>}
              <div className="flex flex-wrap gap-1">
                {lesson.lessonClasses.map(lc => (
                  <Badge key={lc.class.name} variant="info" className="text-xs">{lc.class.name}</Badge>
                ))}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  {materialIcon('VIDEO')} {lesson.materials.filter(m => m.type === 'VIDEO').length} vídeos
                </span>
                <span className="flex items-center gap-1">
                  <LinkIcon className="h-3 w-3" /> {lesson.materials.filter(m => m.type === 'LINK').length} links
                </span>
                <span className="flex items-center gap-1">
                  <ClipboardList className="h-3 w-3" /> {lesson._count?.classRecords || 0} registros
                </span>
              </div>
              {lesson.startDate && (
                <p className="text-xs text-muted-foreground">
                  {formatDate(lesson.startDate)} {lesson.endDate ? `→ ${formatDate(lesson.endDate)}` : ''}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* New Lesson Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingLessonId ? 'Editar Aula' : 'Nova Aula'}</DialogTitle></DialogHeader>
          <Tabs defaultValue="info">
            <TabsList>
              <TabsTrigger value="info">Informações</TabsTrigger>
              <TabsTrigger value="materiais">Materiais</TabsTrigger>
            </TabsList>
            <TabsContent value="info" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Título *</Label>
                <Input placeholder="Título da aula" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea rows={3} placeholder="Descreva os objetivos e conteúdos..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data inicial</Label>
                  <Input type="date" disabled={isIndefinite} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Data final</Label>
                  <Input type="date" disabled={isIndefinite} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
                </div>
                <label className="flex items-center gap-2 text-sm select-none cursor-pointer mt-1 col-span-2">
                  <input
                    type="checkbox"
                    checked={isIndefinite}
                    onChange={e => {
                      const checked = e.target.checked
                      setIsIndefinite(checked)
                      if (checked) {
                        setForm(prev => ({ ...prev, startDate: '', endDate: '' }))
                      }
                    }}
                    className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                  />
                  Data da aula indefinida
                </label>
              </div>

              {/* Class selector */}
              <div className="space-y-2">
                <Label>Turmas *</Label>
                
                {/* Seletores rápidos por série */}
                {allClasses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/20">
                    <span className="text-[11px] text-muted-foreground w-full font-medium">Selecionar por Série:</span>
                    {Array.from(new Set(allClasses.map((c: any) => {
                      const match = c.name.match(/^(\d+º\s+Ano|\d+ºAno|\d+ª\s+Série|\d+ªSérie)/i)
                      if (match) return match[1]
                      const parts = c.name.split(' ')
                      if (parts.length >= 2 && /\d/.test(parts[0])) return `${parts[0]} ${parts[1]}`
                      return parts[0]
                    }).filter(Boolean))).map((group: any) => {
                      const groupClasses = allClasses.filter((c: any) => {
                        const match = c.name.match(/^(\d+º\s+Ano|\d+ºAno|\d+ª\s+Série|\d+ªSérie)/i)
                        const currentGroup = match ? match[1] : c.name.split(' ')[0]
                        return currentGroup === group
                      })
                      const groupClassIds = groupClasses.map((c: any) => c.id)
                      const allChecked = groupClassIds.every((id: string) => form.classIds.includes(id))
                      
                      return (
                        <button
                          key={group}
                          type="button"
                          onClick={() => {
                            if (allChecked) {
                              setForm(prev => ({
                                ...prev,
                                classIds: prev.classIds.filter(id => !groupClassIds.includes(id))
                              }))
                            } else {
                              setForm(prev => ({
                                ...prev,
                                classIds: Array.from(new Set([...prev.classIds, ...groupClassIds]))
                              }))
                            }
                          }}
                          className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors font-medium ${
                            allChecked ? 'bg-primary text-white border-primary hover:bg-primary/90' : 'bg-background hover:bg-muted text-muted-foreground'
                          }`}
                        >
                          {group}
                        </button>
                      )
                    })}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-40 overflow-y-auto bg-background">
                  {allClasses.map((c: any) => (
                    <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={form.classIds.includes(c.id)}
                        onChange={e => {
                          const checked = e.target.checked
                          setForm(prev => ({
                            ...prev,
                            classIds: checked ? [...prev.classIds, c.id] : prev.classIds.filter(id => id !== c.id)
                          }))
                        }}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      {c.name} {c.school?.name ? `(${formatSchoolName(c.school.name)})` : ''}
                    </label>
                  ))}
                </div>
              </div>

              {/* Subject selector */}
              <div className="space-y-2">
                <Label>Componentes Curriculares (Selecione 2 ou mais para Interdisciplinar) *</Label>
                <div className="grid grid-cols-2 gap-2 p-3 border rounded-md max-h-40 overflow-y-auto bg-background">
                  {allSubjects.map((s: any) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={form.subjectIds.includes(s.id)}
                        onChange={e => {
                          const checked = e.target.checked
                          setForm(prev => ({
                            ...prev,
                            subjectIds: checked ? [...prev.subjectIds, s.id] : prev.subjectIds.filter(id => id !== s.id)
                          }))
                        }}
                        className="rounded border-gray-300 text-primary focus:ring-primary h-4 w-4"
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="materiais" className="pt-4 space-y-4">
              <div className="p-4 border rounded-lg space-y-3 bg-muted/30">
                <p className="text-sm font-medium">Adicionar material</p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <select
                      className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                      value={newMaterial.type}
                      onChange={e => setNewMaterial({ ...newMaterial, type: e.target.value, url: '' })}
                    >
                      {MATERIAL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Título</Label>
                    <Input className="h-9" placeholder="Nome do material" value={newMaterial.title} onChange={e => setNewMaterial({ ...newMaterial, title: e.target.value })} />
                  </div>
                </div>

                {['VIDEO', 'DOCUMENTO'].includes(newMaterial.type) && (
                  <div className="space-y-1">
                    <Label className="text-xs">Enviar arquivo local (opcional)</Label>
                    <Input
                      type="file"
                      accept={newMaterial.type === 'VIDEO' ? 'video/*' : '*/*'}
                      className="h-9 text-xs file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                      onChange={async e => {
                        const file = e.target.files?.[0]
                        if (!file) return
                        
                        setNewMaterial(prev => ({
                          ...prev,
                          title: prev.title || file.name.split('.')[0],
                          url: 'Enviando arquivo...'
                        }))
                        
                        const formData = new FormData()
                        formData.append('file', file)
                        
                        try {
                          const res = await fetch('/api/upload', {
                            method: 'POST',
                            body: formData
                          })
                          if (res.ok) {
                            const data = await res.json()
                            setNewMaterial(prev => ({
                              ...prev,
                              url: data.url,
                              title: prev.title || file.name.split('.')[0]
                            }))
                            toast({ title: 'Arquivo enviado com sucesso!' })
                          } else {
                            toast({ title: 'Erro ao fazer upload do arquivo', variant: 'destructive' })
                            setNewMaterial(prev => ({ ...prev, url: '' }))
                          }
                        } catch (err) {
                          toast({ title: 'Erro ao enviar arquivo', variant: 'destructive' })
                          setNewMaterial(prev => ({ ...prev, url: '' }))
                        }
                      }}
                    />
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">URL / Link do Material</Label>
                  <Input className="h-9" placeholder="https://..." value={newMaterial.url || ''} onChange={e => setNewMaterial({ ...newMaterial, url: e.target.value })} disabled={newMaterial.url === 'Enviando arquivo...'} />
                </div>
                <Button size="sm" onClick={addMaterial} disabled={!newMaterial.title || !newMaterial.url || newMaterial.url === 'Enviando arquivo...'}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                </Button>
              </div>
              {materials.length > 0 && (
                <div className="space-y-2">
                  {materials.map((m, i) => (
                    <div key={i} className="flex items-center justify-between p-2 border rounded-lg text-sm">
                      <span className="flex items-center gap-2">{materialIcon(m.type)} {m.title}</span>
                      <Button variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => setMaterials(materials.filter((_, idx) => idx !== i))}>Remover</Button>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.title || form.classIds.length === 0 || form.subjectIds.length === 0}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Lesson Dialog */}
      {viewLesson && (
        <Dialog open={!!viewLesson} onOpenChange={() => setViewLesson(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden rounded-xl border">
            {/* Header Banner */}
            <div className="relative p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-background border-b select-none">
              <div className="space-y-3 pr-8">
                {/* Componentes/Subjects tags */}
                <div className="flex flex-wrap gap-2">
                  {viewLesson.subjects && viewLesson.subjects.length > 0 ? (
                    viewLesson.subjects.map(s => (
                      <Badge key={s.id} variant="secondary" className="font-semibold text-xs py-0.5 px-2 bg-secondary/80">
                        {s.name}
                      </Badge>
                    ))
                  ) : viewLesson.subject ? (
                    <Badge variant="secondary" className="font-semibold text-xs py-0.5 px-2 bg-secondary/80">
                      {viewLesson.subject.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs py-0.5 px-2 bg-gray-50 text-gray-500">
                      Sem Componente
                    </Badge>
                  )}
                  {viewLesson.subjects && viewLesson.subjects.length > 1 && (
                    <Badge variant="outline" className="font-medium text-xs bg-purple-50 text-purple-700 border-purple-200 py-0.5 px-2 shrink-0">
                      Interdisciplinar
                    </Badge>
                  )}
                </div>

                {/* Title */}
                <h2 className="text-2xl font-bold text-foreground leading-tight tracking-tight">
                  {viewLesson.title}
                </h2>

                {/* Mapped Classes */}
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-xs text-muted-foreground mr-1">Turmas:</span>
                  {viewLesson.lessonClasses.map(lc => (
                    <Badge key={lc.class.name} variant="outline" className="text-[11px] bg-primary/5 text-primary border-primary/20 font-medium py-0 px-1.5">
                      {lc.class.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Content body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-background">
              {/* Objective/Description Card */}
              {viewLesson.description && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Objetivo e Descrição</h3>
                  <div className="p-4 rounded-xl border bg-muted/20 text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap shadow-inner">
                    {viewLesson.description}
                  </div>
                </div>
              )}

              {/* Mapped Details Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date / Period */}
                {viewLesson.startDate && (
                  <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/10">
                    <Calendar className="h-5 w-5 text-primary shrink-0" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium">Período da Aula</p>
                      <p className="text-sm font-semibold text-foreground">
                        {formatDate(viewLesson.startDate)} {viewLesson.endDate ? `até ${formatDate(viewLesson.endDate)}` : ''}
                      </p>
                    </div>
                  </div>
                )}

                {/* Lesson Counters/Summary */}
                <div
                  onClick={() => {
                    if (viewLesson.materials.length > 0) {
                      const element = document.getElementById('materiais-section')
                      if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      }
                    }
                  }}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                    viewLesson.materials.length > 0
                      ? 'cursor-pointer hover:bg-primary/5 hover:border-primary/20 bg-muted/10'
                      : 'bg-muted/10'
                  }`}
                  title={viewLesson.materials.length > 0 ? "Clique para rolar até os materiais" : undefined}
                >
                  <ClipboardList className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Resumo do Conteúdo</p>
                    <div className="flex gap-4 text-sm font-semibold text-foreground mt-0.5">
                      <span>{viewLesson.materials.length} Material(ais)</span>
                      <span>•</span>
                      <span>{viewLesson._count?.classRecords || 0} Registro(s)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Materials Anchor Section */}
              {viewLesson.materials.length > 0 && (
                <div id="materiais-section" className="scroll-mt-6 space-y-6">
                  {/* Videos Section */}
                  {viewLesson.materials.filter(m => m.type === 'VIDEO').length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <Video className="h-4 w-4 text-red-500" /> Vídeos e Aulas Gravadas
                      </h3>
                      <div className="grid grid-cols-1 gap-4">
                        {viewLesson.materials.filter(m => m.type === 'VIDEO').map((m, i) => {
                          const embedUrl = m.url ? getEmbedUrl(m.url) : null
                          return (
                            <div key={i} className="p-3 border rounded-xl bg-muted/10 space-y-2">
                              <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                                <span className="bg-red-500 text-white text-[10px] uppercase font-bold py-0.5 px-1.5 rounded shrink-0">Vídeo</span>
                                {m.title}
                              </p>
                              {embedUrl ? (
                                <div className="aspect-video rounded-lg overflow-hidden border bg-black shadow-md">
                                  <iframe src={embedUrl} className="w-full h-full" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                                </div>
                              ) : (
                                <a href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-primary hover:underline font-medium p-2 border rounded-lg bg-background hover:bg-muted/50 transition-colors">
                                  <Video className="h-4 w-4 text-red-500" /> Abrir no Youtube / Player Externo
                                </a>
                              )}
                              {m.description && <p className="text-xs text-muted-foreground">{m.description}</p>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Links & Documents Section */}
                  {viewLesson.materials.filter(m => m.type !== 'VIDEO').length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
                        <FileText className="h-4 w-4 text-blue-500" /> Links e Materiais de Apoio
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {viewLesson.materials.filter(m => m.type !== 'VIDEO').map((m, i) => (
                          <a
                            key={i}
                            href={m.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-3 p-3 border rounded-xl hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 bg-background shadow-sm hover:shadow group"
                          >
                            <div className="p-2 bg-muted rounded-lg group-hover:bg-primary/10 transition-colors shrink-0">
                              {materialIcon(m.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                {m.title}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {m.type === 'DOCUMENTO' ? 'Documento PDF/Arquivo' : 'Link Web / URL'}
                              </p>
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="p-4 border-t bg-muted/10 flex justify-between items-center">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenEdit(viewLesson)}>
                  <Pencil className="h-4 w-4 mr-1.5" /> Editar Aula
                </Button>
                <Button variant="outline" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(viewLesson.id)}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Excluir Aula
                </Button>
              </div>
              <Button onClick={() => setViewLesson(null)}>
                Fechar Detalhes
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
