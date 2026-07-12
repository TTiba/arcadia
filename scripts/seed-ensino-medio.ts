/**
 * Seed ADITIVO — 4 colégios de Ensino Médio.
 *
 * NÃO apaga o seed existente (as 2 escolas do Paraná continuam intactas):
 * login antigo → dados antigos; login novo → dados novos. O escopo por escola
 * (schoolId) isola cada conjunto. Re-executável: limpa apenas as próprias
 * escolas (pelos códigos INEP abaixo) antes de recriar.
 *
 *   npx ts-node --transpile-only -O '{"module":"CommonJS","moduleResolution":"node"}' scripts/seed-ensino-medio.ts
 *   (ou: npm run db:seed:medio)
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()
const hash = (p: string) => bcrypt.hashSync(p, 10)

// ─── Pools de nomes ─────────────────────────────────────────────────────────
const NM = ['Lucas','Pedro','Gabriel','Matheus','Arthur','Rafael','Felipe','Enzo','Gustavo','Bruno',
  'Thiago','Diego','Leonardo','Eduardo','Henrique','Samuel','Daniel','André','Vinícius','Rodrigo',
  'Igor','Murilo','Caio','Hugo','Otávio','Vitor','Nicolas','Cauã','Ryan','Miguel','Davi','Théo']
const NF = ['Maria','Ana','Isabela','Sophia','Laura','Beatriz','Larissa','Camila','Amanda','Letícia',
  'Nathália','Bruna','Juliana','Fernanda','Gabriela','Yasmin','Bianca','Alice','Helena','Valentina',
  'Giulia','Lívia','Clara','Luísa','Vitória','Mariana','Natália','Rebeca','Júlia','Carolina','Sara','Lorena']
const SB = ['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Ferreira','Rodrigues','Alves',
  'Nascimento','Carvalho','Gomes','Martins','Araújo','Barbosa','Ribeiro','Fernandes','Mendes','Castro',
  'Lopes','Teixeira','Pinto','Moreira','Nunes','Campos','Freitas','Vieira','Monteiro','Cardoso','Rocha','Dias']

const sname = (idx: number): string => {
  const pool = idx % 2 === 0 ? NF : NM
  const fi = Math.abs(Math.floor(Math.sin(idx * 7.31 + 1) * 100)) % pool.length
  const li = Math.abs(Math.floor(Math.sin(idx * 13.7 + 2) * 100)) % SB.length
  return `${pool[fi]} ${SB[li]}`
}

type Tier = 'L' | 'M' | 'H'
const tierOf = (idx: number, lowPct: number, medPct: number): Tier => {
  const v = Math.abs(Math.sin(idx * 17.31 + 3)) % 1
  return v < lowPct ? 'L' : v < lowPct + medPct ? 'M' : 'H'
}
// Nota 0–10 por bimestre: base do tier + dificuldade do componente + leve evolução
const gradeScore = (t: Tier, subjDiff: number, bim: number, seed: number): number => {
  const v = Math.abs(Math.sin(seed * 3.71 + bim * 1.9 + 4)) % 1
  const base = t === 'H' ? 7.2 : t === 'M' ? 5.4 : 3.0
  const trend = (t === 'H' ? 0.15 : t === 'L' ? -0.15 : 0.05) * (bim - 1)
  const s = base + v * 2.4 - subjDiff + trend
  return Math.round(Math.min(Math.max(s, 0), 10) * 10) / 10
}
const enemScore = (t: Tier, seed: number): number => {
  const v = Math.abs(Math.sin(seed * 6.17 + 6)) % 1
  const s = t === 'H' ? 640 + v * 220 : t === 'M' ? 460 + v * 190 : 240 + v * 220
  return Math.round(Math.min(s, 1000))
}

// ─── Componentes (5, com Humanas acumulando História+Geografia) ─────────────
const COMPONENTES = [
  { name: 'Língua Portuguesa', code: 'LP',  diff: 0.3 },
  { name: 'Matemática',        code: 'MT',  diff: 0.9 },
  { name: 'Ciências',          code: 'CIE', diff: 0.6 },
  { name: 'História',          code: 'HIS', diff: 0.1 },
  { name: 'Geografia',         code: 'GEO', diff: 0.2 },
]
const BIMESTRES = ['1º Bimestre', '2º Bimestre', '3º Bimestre', '4º Bimestre']

// Professores: 4 por escola; o de Humanas leciona História E Geografia
const TEACHER_SPEC = [
  { key: 'PORT', subjects: ['Língua Portuguesa'] },
  { key: 'MAT',  subjects: ['Matemática'] },
  { key: 'CIEN', subjects: ['Ciências'] },
  { key: 'HUM',  subjects: ['História', 'Geografia'] },
]

// ─── Competências ENEM (desempenho por habilidades) ─────────────────────────
const ENEM = [
  { code: 'LC-H1', area: 'Linguagens, Códigos e suas Tecnologias', description: 'Identificar recursos expressivos das linguagens' },
  { code: 'LC-H5', area: 'Linguagens, Códigos e suas Tecnologias', description: 'Associar vocabulário e gramática à construção de sentido' },
  { code: 'MT-H2', area: 'Matemática e suas Tecnologias', description: 'Utilizar conhecimento geométrico para ler e representar a realidade' },
  { code: 'MT-H6', area: 'Matemática e suas Tecnologias', description: 'Interpretar informações apresentadas em tabelas e gráficos' },
  { code: 'CN-H3', area: 'Ciências da Natureza e suas Tecnologias', description: 'Relacionar intervenções humanas à conservação ambiental' },
  { code: 'CN-H7', area: 'Ciências da Natureza e suas Tecnologias', description: 'Compreender processos biológicos ligados à saúde' },
  { code: 'CH-H4', area: 'Ciências Humanas e suas Tecnologias', description: 'Compreender transformações técnicas e seu impacto social' },
  { code: 'CH-H8', area: 'Ciências Humanas e suas Tecnologias', description: 'Analisar processos históricos e territoriais brasileiros' },
]
const enemLevel = (s: number) => s >= 700 ? 'ADEQUADO' : s >= 500 ? 'BASICO' : 'ABAIXO_BASICO'

// ─── Comportamento (fichas de 10% dos alunos) ───────────────────────────────
const BEHAVIOR = {
  POSITIVO: [
    'Demonstra liderança positiva e frequentemente ajuda os colegas nas atividades em grupo.',
    'Participação exemplar nas aulas; faz perguntas pertinentes e colabora com a organização da turma.',
    'Assumiu papel de representante de turma com responsabilidade e boa mediação de conflitos.',
  ],
  ATENCAO: [
    'Conversas paralelas frequentes durante as explicações. Orientado sobre a importância do foco.',
    'Uso recorrente do celular em sala apesar de advertências verbais. Combinado novo acordo de conduta.',
    'Chega atrasado com frequência à primeira aula. Conversado sobre pontualidade e impacto na aprendizagem.',
  ],
  OCORRENCIA: [
    'Envolveu-se em desentendimento com colega no intervalo. Mediação realizada pela coordenação; ambos se comprometeram a resolver dialogando.',
    'Recusou-se a realizar a atividade proposta e alterou o tom de voz com o professor. Encaminhado à coordenação para conversa.',
    'Registro de comportamento disruptivo durante avaliação. Prova mantida; situação conversada com o responsável.',
  ],
  MELHORA: [
    'Após conversa com a coordenação e a família, apresentou melhora significativa de conduta e engajamento.',
    'Evolução positiva no comportamento ao longo do bimestre; reduziu conversas paralelas e aumentou a participação.',
    'Retomou o compromisso com as entregas e demonstra postura mais colaborativa com os colegas.',
  ],
}
const CATEGORIES: Record<keyof typeof BEHAVIOR, string> = {
  POSITIVO: 'ELOGIO', ATENCAO: 'OBSERVACAO', OCORRENCIA: 'OCORRENCIA', MELHORA: 'OBSERVACAO',
}

// ─── Escolas ─────────────────────────────────────────────────────────────────
type StaffCfg = { role: string; name: string; email: string }
type SchoolCfg = {
  name: string; inep: string; city: string; domain: string
  lowPct: number; medPct: number
  staff: { dir: StaffCfg; coord: StaffCfg; ped: StaffCfg; sec: StaffCfg }
  teachers: { key: string; name: string }[]
}

const SCHOOLS: SchoolCfg[] = [
  {
    name: 'Colégio Estadual Dom Pedro II', inep: '35081201', city: 'São Paulo - SP', domain: 'cedpedro.sp.edu.br',
    lowPct: 0.08, medPct: 0.34,
    staff: {
      dir:   { role: 'DIRETOR',     name: 'Diretora Regina Camargo',       email: 'diretoria' },
      coord: { role: 'COORDENACAO', name: 'Coordenadora Sílvia Menezes',   email: 'coordenacao' },
      ped:   { role: 'PEDAGOGO',    name: 'Pedagogo Ricardo Tavares',      email: 'pedagogia' },
      sec:   { role: 'SECRETARIO',  name: 'Secretária Beatriz Nogueira',   email: 'secretaria' },
    },
    teachers: [
      { key: 'PORT', name: 'Prof. Eduardo Vasconcelos' },
      { key: 'MAT',  name: 'Profª. Carla Antunes' },
      { key: 'CIEN', name: 'Prof. Márcio Salles' },
      { key: 'HUM',  name: 'Profª. Helena Prado' },
    ],
  },
  {
    name: 'Colégio Estadual Machado de Assis', inep: '33082202', city: 'Rio de Janeiro - RJ', domain: 'cemachado.rj.edu.br',
    lowPct: 0.16, medPct: 0.42,
    staff: {
      dir:   { role: 'DIRETOR',     name: 'Diretor Jorge Bastos',          email: 'diretoria' },
      coord: { role: 'COORDENACAO', name: 'Coordenadora Fátima Rangel',    email: 'coordenacao' },
      ped:   { role: 'PEDAGOGO',    name: 'Pedagoga Solange Peixoto',      email: 'pedagogia' },
      sec:   { role: 'SECRETARIO',  name: 'Secretário Wesley Andrade',     email: 'secretaria' },
    },
    teachers: [
      { key: 'PORT', name: 'Profª. Cláudia Bittencourt' },
      { key: 'MAT',  name: 'Prof. Anderson Rangel' },
      { key: 'CIEN', name: 'Profª. Denise Fontoura' },
      { key: 'HUM',  name: 'Prof. Rogério Maia' },
    ],
  },
  {
    name: 'Colégio Estadual Cecília Meireles', inep: '31083303', city: 'Belo Horizonte - MG', domain: 'cecilia.mg.edu.br',
    lowPct: 0.12, medPct: 0.38,
    staff: {
      dir:   { role: 'DIRETOR',     name: 'Diretora Marta Resende',        email: 'diretoria' },
      coord: { role: 'COORDENACAO', name: 'Coordenador Túlio Guimarães',   email: 'coordenacao' },
      ped:   { role: 'PEDAGOGO',    name: 'Pedagoga Lúcia Andrade',        email: 'pedagogia' },
      sec:   { role: 'SECRETARIO',  name: 'Secretária Priscila Drummond',  email: 'secretaria' },
    },
    teachers: [
      { key: 'PORT', name: 'Prof. Fábio Drummond' },
      { key: 'MAT',  name: 'Profª. Renata Guerra' },
      { key: 'CIEN', name: 'Prof. Leonardo Braga' },
      { key: 'HUM',  name: 'Profª. Adriana Villela' },
    ],
  },
  {
    name: 'Colégio Estadual Castro Alves', inep: '29084404', city: 'Salvador - BA', domain: 'ccastroalves.ba.edu.br',
    lowPct: 0.24, medPct: 0.44,
    staff: {
      dir:   { role: 'DIRETOR',     name: 'Diretor Gilberto Sampaio',      email: 'diretoria' },
      coord: { role: 'COORDENACAO', name: 'Coordenadora Neusa Barreto',    email: 'coordenacao' },
      ped:   { role: 'PEDAGOGO',    name: 'Pedagogo Jorge Menezes',        email: 'pedagogia' },
      sec:   { role: 'SECRETARIO',  name: 'Secretária Cristiane Lopes',    email: 'secretaria' },
    },
    teachers: [
      { key: 'PORT', name: 'Profª. Vanessa Cerqueira' },
      { key: 'MAT',  name: 'Prof. Ubiratan Nery' },
      { key: 'CIEN', name: 'Profª. Rita Andrade' },
      { key: 'HUM',  name: 'Prof. Everaldo Passos' },
    ],
  },
]

// ─── Utilitários de banco (find-or-create para dados compartilhados) ─────────
async function findOrCreateSubject(name: string, code: string, segmentId: string) {
  const found = await prisma.subject.findFirst({ where: { name } })
  if (found) return found
  return prisma.subject.create({ data: { name, code, segmentId, weeklyHours: 2 } })
}

async function findOrCreateGrade(name: string, segmentId: string, order: number) {
  const found = await prisma.grade.findFirst({ where: { name, segmentId } })
  if (found) return found
  return prisma.grade.create({ data: { name, segmentId, order } })
}

// Limpa apenas os dados de UMA escola (por INEP), de baixo para cima
async function cleanupSchool(inep: string) {
  const school = await prisma.school.findUnique({ where: { inepCode: inep } })
  if (!school) return
  const classes = await prisma.class.findMany({ where: { schoolId: school.id }, select: { id: true } })
  const classIds = classes.map(c => c.id)
  const students = await prisma.student.findMany({ where: { classId: { in: classIds } }, select: { id: true } })
  const studentIds = students.map(s => s.id)
  const users = await prisma.user.findMany({ where: { schoolId: school.id }, select: { id: true } })
  const userIds = users.map(u => u.id)
  const teachers = await prisma.teacher.findMany({ where: { userId: { in: userIds } }, select: { id: true } })
  const teacherIds = teachers.map(t => t.id)
  const assessments = await prisma.assessment.findMany({ where: { classId: { in: classIds } }, select: { id: true } })
  const assessmentIds = assessments.map(a => a.id)

  await prisma.gradeRecord.deleteMany({ where: { assessmentId: { in: assessmentIds } } })
  await prisma.assessment.deleteMany({ where: { classId: { in: classIds } } })
  await prisma.studentLog.deleteMany({ where: { studentId: { in: studentIds } } })
  await prisma.pedagogicalRecord.deleteMany({ where: { studentId: { in: studentIds } } })
  await prisma.studentEnemPerformance.deleteMany({ where: { studentId: { in: studentIds } } })
  await prisma.studentSaebPerformance.deleteMany({ where: { studentId: { in: studentIds } } })
  await prisma.studentAttendance.deleteMany({ where: { classId: { in: classIds } } })
  await prisma.studentGuardian.deleteMany({ where: { studentId: { in: studentIds } } })
  await prisma.classRecord.deleteMany({ where: { classId: { in: classIds } } })
  await prisma.student.deleteMany({ where: { classId: { in: classIds } } })
  await prisma.teacherClass.deleteMany({ where: { classId: { in: classIds } } })
  await prisma.teacherSubject.deleteMany({ where: { teacherId: { in: teacherIds } } })
  await prisma.teacher.deleteMany({ where: { id: { in: teacherIds } } })
  await prisma.userClass.deleteMany({ where: { userId: { in: userIds } } })
  await prisma.class.deleteMany({ where: { schoolId: school.id } })
  await prisma.user.deleteMany({ where: { schoolId: school.id } })
  await prisma.school.delete({ where: { id: school.id } })
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱 Seed aditivo — 4 colégios de Ensino Médio (não apaga o seed existente)')

  // Segmento / séries / componentes / competências (compartilhados, idempotentes)
  const segMedio = await prisma.segment.upsert({
    where: { name: 'Ensino Médio' }, update: {}, create: { name: 'Ensino Médio' },
  })
  const grade1 = await findOrCreateGrade('1º Ano', segMedio.id, 10)
  const grade3 = await findOrCreateGrade('3º Ano', segMedio.id, 12)
  const GRADES = [{ grade: grade1, code: '1' }, { grade: grade3, code: '3' }]

  const subjects: Record<string, { id: string }> = {}
  for (const c of COMPONENTES) subjects[c.name] = await findOrCreateSubject(c.name, c.code, segMedio.id)

  const enemComps: Record<string, { id: string }> = {}
  for (const e of ENEM) {
    enemComps[e.code] = await prisma.enemCompetency.upsert({
      where: { code: e.code }, update: { description: e.description, area: e.area },
      create: { code: e.code, description: e.description, area: e.area, type: 'HABILIDADE' },
    })
  }

  let globalStudentIdx = 5000 // fora da faixa do seed antigo
  const credentials: string[] = []

  for (const cfg of SCHOOLS) {
    await cleanupSchool(cfg.inep) // re-executável
    console.log(`  🏫 ${cfg.name} (${cfg.city})`)

    const school = await prisma.school.create({
      data: { name: cfg.name, inepCode: cfg.inep, address: `Av. Central, s/n — ${cfg.city}`, email: `contato@${cfg.domain}` },
    })

    // Equipe: diretor, coordenação, pedagogo, secretário
    const mkStaff = (s: StaffCfg, pwd: string) =>
      prisma.user.create({ data: { name: s.name, email: `${s.email}@${cfg.domain}`, password: hash(pwd), role: s.role, schoolId: school.id } })
    const dirU  = await mkStaff(cfg.staff.dir, 'diretor123')
    const coordU = await mkStaff(cfg.staff.coord, 'coord123')
    const pedU  = await mkStaff(cfg.staff.ped, 'ped123')
    await mkStaff(cfg.staff.sec, 'sec123')
    credentials.push(`${cfg.name}`)
    credentials.push(`   Coordenação: ${cfg.staff.coord.email}@${cfg.domain} / coord123   (login que ISOLA esta escola)`)
    credentials.push(`   Pedagogia:   ${cfg.staff.ped.email}@${cfg.domain} / ped123`)
    credentials.push(`   Direção:     ${cfg.staff.dir.email}@${cfg.domain} / diretor123`)
    credentials.push(`   Secretaria:  ${cfg.staff.sec.email}@${cfg.domain} / sec123`)

    // Professores (perfil User + Teacher) e vínculos com componentes
    const teacherByKey: Record<string, { teacherId: string; userId: string }> = {}
    for (const [ti, t] of cfg.teachers.entries()) {
      const spec = TEACHER_SPEC.find(s => s.key === t.key)!
      const login = t.name.split(' ').slice(-1)[0].toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')
      const uUser = await prisma.user.create({
        data: { name: t.name, email: `prof.${login}@${cfg.domain}`, password: hash('prof123'), role: 'PROFESSOR', schoolId: school.id },
      })
      const teacher = await prisma.teacher.create({
        data: { userId: uUser.id, registration: `EM-${cfg.inep.slice(0, 3)}-${t.key}-${ti + 1}`, bio: `Docente de ${spec.subjects.join(' e ')} no Ensino Médio.` },
      })
      teacherByKey[t.key] = { teacherId: teacher.id, userId: uUser.id }
      await prisma.teacherSubject.createMany({ data: spec.subjects.map(sn => ({ teacherId: teacher.id, subjectId: subjects[sn].id })) })
    }
    // Professor responsável por cada componente
    const subjectTeacher = (subjName: string) => {
      const spec = TEACHER_SPEC.find(s => s.subjects.includes(subjName))!
      return teacherByKey[spec.key]
    }
    credentials.push(`   Professores: prof.<sobrenome>@${cfg.domain} / prof123`)

    // Turmas: 2 séries × 2 turmas = 4
    const gradeRecordData: any[] = []
    const enemPerfData: any[] = []
    const attendanceData: any[] = []
    const behaviorStudents: { id: string; name: string; className: string; tier: Tier }[] = []

    for (const g of GRADES) {
      for (const letter of ['A', 'B']) {
        const turma = await prisma.class.create({
          data: { name: `${g.code}º Ano ${letter}`, gradeId: g.grade.id, schoolId: school.id, shift: 'Manhã', year: 2026, period: 'ANUAL' },
        })

        // Vínculos professor↔turma (cada professor leciona seus componentes nesta turma)
        for (const t of cfg.teachers) {
          const spec = TEACHER_SPEC.find(s => s.key === t.key)!
          await prisma.teacherClass.createMany({
            data: spec.subjects.map(sn => ({ teacherId: teacherByKey[t.key].teacherId, classId: turma.id, subjectId: subjects[sn].id })),
          })
        }

        // 25 alunos
        const turmaStudents: { id: string; tier: Tier; seed: number; name: string }[] = []
        for (let i = 0; i < 25; i++) {
          const gi = globalStudentIdx++
          const name = sname(gi)
          const tier = tierOf(gi, cfg.lowPct, cfg.medPct)
          const student = await prisma.student.create({
            data: {
              name, enrollment: `2026EM${gi}`, status: 'ATIVO',
              classId: turma.id,
              birthDate: new Date(g.code === '1' ? 2009 : 2007, gi % 12, (gi % 27) + 1),
              guardians: { create: [{
                name: `${gi % 2 === 0 ? 'Sra.' : 'Sr.'} ${SB[gi % SB.length]} (responsável)`,
                relationship: gi % 2 === 0 ? 'Mãe' : 'Pai', isPrimary: true,
              }] },
            },
          })
          turmaStudents.push({ id: student.id, tier, seed: gi, name })
          if (gi % 10 === 0) behaviorStudents.push({ id: student.id, name, className: turma.name, tier })
        }

        // Boletim completo: 5 componentes × 4 bimestres
        for (const comp of COMPONENTES) {
          const st = subjectTeacher(comp.name)
          for (const [bi, bim] of BIMESTRES.entries()) {
            const assessment = await prisma.assessment.create({
              data: {
                name: `Avaliação — ${comp.name} (${bim})`, subjectId: subjects[comp.name].id, classId: turma.id,
                period: bim, type: 'PROVA', weight: 1.0, maxScore: 10.0,
                date: new Date(2026, bi * 3 + 2, 15),
              },
            })
            for (const s of turmaStudents) {
              gradeRecordData.push({
                assessmentId: assessment.id, studentId: s.id, teacherId: st.teacherId, userId: st.userId,
                score: gradeScore(s.tier, comp.diff, bi + 1, s.seed + comp.name.length),
              })
            }
          }
        }

        // Desempenho por habilidades (ENEM) — 8 competências por aluno
        for (const s of turmaStudents) {
          for (const e of ENEM) {
            enemPerfData.push({ studentId: s.id, competencyId: enemComps[e.code].id, score: enemScore(s.tier, s.seed + e.code.length), year: 2026 })
          }
        }

        // Frequência dos últimos ~20 dias letivos (faltas concentradas nos de baixo desempenho)
        const today = new Date(); today.setHours(0, 0, 0, 0)
        for (const s of turmaStudents) {
          const faltaRate = s.tier === 'L' ? 0.28 : s.tier === 'M' ? 0.08 : 0.02
          let d = 0, added = 0
          while (added < 20 && d < 32) {
            const day = new Date(today); day.setDate(day.getDate() - d); d++
            if (day.getDay() === 0 || day.getDay() === 6) continue
            const r = Math.abs(Math.sin(s.seed * 2.3 + added * 1.7)) % 1
            const status = r < faltaRate ? (r < faltaRate * 0.4 ? 'FALTA_JUSTIFICADA' : 'FALTA') : 'PRESENTE'
            attendanceData.push({ studentId: s.id, classId: turma.id, date: day, status, recordedBy: teacherByKey['PORT'].userId })
            added++
          }
        }
      }
    }

    // Inserções em massa
    for (let i = 0; i < gradeRecordData.length; i += 1000) await prisma.gradeRecord.createMany({ data: gradeRecordData.slice(i, i + 1000) })
    for (let i = 0; i < enemPerfData.length; i += 1000) await prisma.studentEnemPerformance.createMany({ data: enemPerfData.slice(i, i + 1000) })
    for (let i = 0; i < attendanceData.length; i += 1000) await prisma.studentAttendance.createMany({ data: attendanceData.slice(i, i + 1000) })

    // Fichas de comportamento (10% dos alunos): StudentLog + PedagogicalRecord nos casos sérios
    for (const [bi, b] of behaviorStudents.entries()) {
      // 2 a 4 registros por aluno, coerentes com o perfil
      const kinds: (keyof typeof BEHAVIOR)[] = b.tier === 'L'
        ? ['ATENCAO', 'OCORRENCIA', 'MELHORA']
        : b.tier === 'H' ? ['POSITIVO', 'ATENCAO'] : ['ATENCAO', 'OCORRENCIA']
      for (const [ki, kind] of kinds.entries()) {
        const pool = BEHAVIOR[kind]
        await prisma.studentLog.create({
          data: {
            studentId: b.id, userId: ki === 0 ? pedU.id : teacherByKey['PORT'].userId,
            category: CATEGORIES[kind], content: pool[(bi + ki) % pool.length],
            createdAt: new Date(2026, 2 + ki * 2, ((bi + ki) % 27) + 1),
          },
        })
      }
      // Casos mais sérios também viram registro pedagógico (visível ao pedagogo)
      if (b.tier === 'L' || bi % 2 === 0) {
        await prisma.pedagogicalRecord.create({
          data: {
            studentId: b.id, pedagogueId: pedU.id, type: b.tier === 'L' ? 'ACOMPANHAMENTO' : 'OBSERVACAO',
            title: b.tier === 'L' ? 'Acompanhamento de conduta e frequência' : 'Observação de comportamento',
            content: BEHAVIOR[b.tier === 'L' ? 'OCORRENCIA' : 'ATENCAO'][bi % 3],
            confidentiality: 'RESTRITO',
            actionPlan: b.tier === 'L' ? 'Reunião com responsável e plano de recuperação de frequência.' : null,
            resolved: bi % 3 === 0,
            date: new Date(2026, 4, (bi % 27) + 1),
          },
        })
      }
    }

    const nGrades = gradeRecordData.length, nEnem = enemPerfData.length, nAtt = attendanceData.length
    console.log(`     ✓ 100 alunos · ${nGrades} notas · ${nEnem} desempenhos ENEM · ${nAtt} frequências · ${behaviorStudents.length} fichas de comportamento`)
  }

  console.log('\n════════ CREDENCIAIS DAS NOVAS ESCOLAS (Ensino Médio) ════════')
  credentials.forEach(l => console.log(l))
  console.log('\n(As 2 escolas do Paraná e seus logins continuam intactos.)')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
