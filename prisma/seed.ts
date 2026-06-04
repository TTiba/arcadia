import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── Name pools ───────────────────────────────────────────────────────────────
const NM = ['Lucas','Pedro','Gabriel','Matheus','Arthur','Rafael','Felipe','Enzo','Gustavo','Bruno',
  'Thiago','Diego','Leonardo','Eduardo','Henrique','Samuel','Carlos','Daniel','André','Marcos',
  'Vinícius','Rodrigo','Alexandre','Patrick','Igor','Murilo','Caio','Hugo','Otávio','Vitor',
  'Nicolas','Cauã','Luan','Ryan','João','Miguel','Davi','Bernardo','Heitor','Théo']
const NF = ['Maria','Ana','Isabela','Sophia','Laura','Beatriz','Larissa','Camila','Amanda','Letícia',
  'Nathália','Bruna','Juliana','Fernanda','Gabriela','Yasmin','Bianca','Tatiane','Priscila','Alice',
  'Helena','Valentina','Giulia','Lívia','Clara','Luísa','Vitória','Mariana','Natália','Rebeca',
  'Júlia','Carolina','Cecília','Manuela','Isadora','Lara','Lorena','Maya','Giovanna','Sara']
const SB = ['Silva','Santos','Oliveira','Souza','Lima','Pereira','Costa','Ferreira','Rodrigues','Alves',
  'Nascimento','Carvalho','Gomes','Martins','Araújo','Barbosa','Ribeiro','Fernandes','Mendes','Castro',
  'Lopes','Teixeira','Pinto','Correia','Moreira','Nunes','Campos','Freitas','Vieira','Monteiro',
  'Cardoso','Rocha','Andrade','Cunha','Cavalcante','Pires','Azevedo','Ramos','Dias','Borges']

function sname(idx: number): string {
  const isFemale = idx % 2 === 0
  const pool = isFemale ? NF : NM
  const fi = Math.abs(Math.floor(Math.sin(idx * 7.31 + 1) * 100)) % pool.length
  const li = Math.abs(Math.floor(Math.sin(idx * 13.7 + 2) * 100)) % SB.length
  return `${pool[fi]} ${SB[li]}`
}

function getTier(idx: number, lowPct: number, medPct: number): 'L' | 'M' | 'H' {
  const v = Math.abs(Math.sin(idx * 17.31 + 3)) % 1
  if (v < lowPct) return 'L'
  if (v < lowPct + medPct) return 'M'
  return 'H'
}

function scoreForTier(t: 'L' | 'M' | 'H', seed: number): number {
  const v = Math.abs(Math.sin(seed * 3.71 + 4)) % 1
  const s = t === 'H' ? 7.0 + v * 3.0 : t === 'M' ? 5.0 + v * 2.0 : 1.5 + v * 3.0
  return Math.round(Math.min(s, 10) * 10) / 10
}

function saebScore(t: 'L' | 'M' | 'H', seed: number): number {
  const v = Math.abs(Math.sin(seed * 5.13 + 5)) % 1
  const s = t === 'H' ? 6.5 + v * 3.5 : t === 'M' ? 4.5 + v * 2.0 : 1.0 + v * 3.5
  return Math.round(Math.min(s, 10) * 10) / 10
}

const saebLevel = (s: number) => s >= 7 ? 'ADEQUADO' : s >= 5 ? 'BASICO' : 'ABAIXO_BASICO'
const hash = (p: string) => bcrypt.hashSync(p, 10)

const ABSENCE_TEXTS = [
  (n: number) => `Aluno(a) acumula ${n} faltas neste bimestre, comprometendo o aproveitamento. Professores relatam que quando presente, demonstra potencial.`,
  (n: number) => `Verificado histórico de ${n} ausências no período. Responsável não retornou contato inicial da escola.`,
  (n: number) => `Aluno(a) faltou ${n} vezes. Algumas ausências justificadas por saúde, outras sem justificativa apresentada.`,
  (n: number) => `Registro de ${n} faltas não justificadas. Professor(a) manifestou preocupação com rendimento e participação.`,
]
const MEETING_TEXTS = [
  (r: string) => `Reunião realizada com ${r}. Relata dificuldades financeiras que impactam a frequência escolar. Encaminhado ao CRAS.`,
  (r: string) => `${r} compareceu à escola. Comprometeu-se em garantir frequência. Orientações sobre importância da assiduidade.`,
  (r: string) => `Reunião com ${r}. Relatou que aluno(a) auxilia em trabalho doméstico em períodos alternados. Situação comunicada ao Conselho Tutelar.`,
  (r: string) => `${r} presente. Relatou episódio de bullying como motivo de recusa escolar. Apuração interna iniciada. Família orientada sobre rede de apoio.`,
]
const BUSCA_TEXTS = [
  'Pedagoga realizou visita domiciliar. Família em situação de vulnerabilidade. Acionados Conselho Tutelar e CRAS para acompanhamento.',
  'Busca ativa realizada. Responsável relatou que aluno(a) auxiliava em trabalho doméstico. Reforçada obrigatoriedade escolar.',
  'Visita domiciliar: aluno(a) em casa com sintomas de adoecimento não tratado. Família orientada sobre UBS do bairro.',
  'Contato por telefone (endereço desatualizado). Responsável comprometeu-se com retorno na semana seguinte.',
]
const RESP_NAMES = ['a mãe, Sra. Maria','o pai, Sr. José','a avó, Sra. Conceição','a tia, Sra. Márcia','o pai, Sr. Paulo','a mãe, Sra. Rosana','o responsável, Sr. Antônio']

async function main() {
  console.log('🌱 Seeding Vela Demo DB (Paraná — two schools)...')

  // ─── Cleanup ──────────────────────────────────────────────────────────────────
  await prisma.waygroundQuestionStat.deleteMany()
  await prisma.waygroundStudentResult.deleteMany()
  await prisma.activitySkillLink.deleteMany()
  await prisma.waygroundActivity.deleteMany()
  await prisma.lessonComment.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.waygroundSync.deleteMany()
  await prisma.homeworkSubmission.deleteMany()
  await prisma.homeworkMaterial.deleteMany()
  await prisma.homework.deleteMany()
  await prisma.gradeRecord.deleteMany()
  await prisma.assessment.deleteMany()
  await prisma.pedagogicalRecord.deleteMany()
  await prisma.classRecord.deleteMany()
  await prisma.lessonMaterial.deleteMany()
  await prisma.lessonClass.deleteMany()
  await prisma.lesson.deleteMany()
  await prisma.academicHistory.deleteMany()
  await prisma.studentGuardian.deleteMany()
  await prisma.studentSaebPerformance.deleteMany()
  await prisma.studentEnemPerformance.deleteMany()
  await prisma.student.deleteMany()
  await prisma.teacherClass.deleteMany()
  await prisma.teacherSubject.deleteMany()
  await prisma.teacher.deleteMany()
  await prisma.user.deleteMany()
  await prisma.class.deleteMany()
  await prisma.subject.deleteMany()
  await prisma.grade.deleteMany()
  await prisma.segment.deleteMany()
  await prisma.school.deleteMany()
  await prisma.userDashboard.deleteMany()
  await prisma.dashboardBlock.deleteMany()
  await prisma.saebDescriptor.deleteMany()
  await prisma.enemCompetency.deleteMany()

  // ─── SAEB Descriptors ─────────────────────────────────────────────────────────
  const [lp9D9, lp9D10, lp9D14, mt9D22, mt9D24, mt9D26, mt9D28] = await Promise.all([
    prisma.saebDescriptor.create({ data: { code: 'LP9-D9',  description: 'Identificar a tese de um texto', area: 'Língua Portuguesa', level: '9º Ano' } }),
    prisma.saebDescriptor.create({ data: { code: 'LP9-D10', description: 'Reconhecer argumentos que sustentam a tese', area: 'Língua Portuguesa', level: '9º Ano' } }),
    prisma.saebDescriptor.create({ data: { code: 'LP9-D14', description: 'Distinguir fato de opinião em textos argumentativos', area: 'Língua Portuguesa', level: '9º Ano' } }),
    prisma.saebDescriptor.create({ data: { code: 'MT9-D22', description: 'Calcular o valor numérico de expressão algébrica', area: 'Matemática', level: '9º Ano' } }),
    prisma.saebDescriptor.create({ data: { code: 'MT9-D24', description: 'Resolver equação do 2º grau', area: 'Matemática', level: '9º Ano' } }),
    prisma.saebDescriptor.create({ data: { code: 'MT9-D26', description: 'Resolver problemas com teorema de Pitágoras', area: 'Matemática', level: '9º Ano' } }),
    prisma.saebDescriptor.create({ data: { code: 'MT9-D28', description: 'Resolver problema envolvendo noções de probabilidade', area: 'Matemática', level: '9º Ano' } }),
  ])
  const saebDescs = [lp9D9, lp9D10, lp9D14, mt9D22, mt9D24, mt9D26, mt9D28]

  // ─── ENEM Competencies ────────────────────────────────────────────────────────
  await Promise.all([
    prisma.enemCompetency.create({ data: { code: 'CN-C3', description: 'Associar intervenções com degradação ou conservação ambiental', area: 'Ciências da Natureza e suas Tecnologias', type: 'COMPETENCIA' } }),
    prisma.enemCompetency.create({ data: { code: 'CN-C4', description: 'Compreender interações entre organismos e ambiente relacionadas à saúde', area: 'Ciências da Natureza e suas Tecnologias', type: 'COMPETENCIA' } }),
    prisma.enemCompetency.create({ data: { code: 'LC-C5', description: 'Analisar, interpretar e aplicar recursos expressivos das linguagens', area: 'Linguagens, Códigos e suas Tecnologias', type: 'COMPETENCIA' } }),
    prisma.enemCompetency.create({ data: { code: 'CH-C4', description: 'Entender transformações técnicas e tecnológicas e seu impacto na produção', area: 'Ciências Humanas e suas Tecnologias', type: 'COMPETENCIA' } }),
    prisma.enemCompetency.create({ data: { code: 'MT-C2', description: 'Utilizar conhecimento geométrico para leitura e representação da realidade', area: 'Matemática e suas Tecnologias', type: 'COMPETENCIA' } }),
  ])

  // ─── Segments / Grades / Subjects ────────────────────────────────────────────
  const segFundI  = await prisma.segment.create({ data: { name: 'Ensino Fundamental I'  } })
  const segFundII = await prisma.segment.create({ data: { name: 'Ensino Fundamental II' } })

  const grades = {
    g5: await prisma.grade.create({ data: { name: '5º Ano', segmentId: segFundI.id  } }),
    g6: await prisma.grade.create({ data: { name: '6º Ano', segmentId: segFundII.id } }),
    g7: await prisma.grade.create({ data: { name: '7º Ano', segmentId: segFundII.id } }),
    g8: await prisma.grade.create({ data: { name: '8º Ano', segmentId: segFundII.id } }),
    g9: await prisma.grade.create({ data: { name: '9º Ano', segmentId: segFundII.id } }),
  }

  const [subPort, subMat, subCien, subHist, subGeo] = await Promise.all([
    prisma.subject.create({ data: { name: 'Língua Portuguesa' } }),
    prisma.subject.create({ data: { name: 'Matemática' } }),
    prisma.subject.create({ data: { name: 'Ciências' } }),
    prisma.subject.create({ data: { name: 'História' } }),
    prisma.subject.create({ data: { name: 'Geografia' } }),
  ])

  // ─── Secretaria de Educação ───────────────────────────────────────────────────
  await prisma.user.create({ data: { name: 'Secretaria de Educação do Paraná', email: 'secretaria@seduc.pr.gov.br', password: hash('seduc2024'), role: 'VISUALIZACAO' } })

  // ─── Factory: create one complete school ─────────────────────────────────────
  type TeacherCfg = { name: string; email: string; reg: string; bio: string }

  async function buildSchool(cfg: {
    name: string; address: string; email: string
    dir: { name: string; email: string }
    coord: { name: string; email: string }
    ped: { name: string; email: string }
    teachers: [TeacherCfg, TeacherCfg, TeacherCfg, TeacherCfg, TeacherCfg] // port, mat, cien, hist, geo
    spc: number   // students per class
    lowPct: number; medPct: number
    prefix: string // 'A' | 'B'
    idxOff: number // name index offset
  }) {
    const school = await prisma.school.create({ data: { name: cfg.name, address: cfg.address, email: cfg.email } })
    await prisma.user.create({ data: { name: cfg.dir.name,   email: cfg.dir.email,   password: hash('admin123'), role: 'ADMIN'       } })
    await prisma.user.create({ data: { name: cfg.coord.name, email: cfg.coord.email, password: hash('coord123'), role: 'COORDENACAO' } })
    const pedUser = await prisma.user.create({ data: { name: cfg.ped.name, email: cfg.ped.email, password: hash('ped123'), role: 'PEDAGOGO' } })

    const tUsers = await Promise.all(cfg.teachers.map(t => prisma.user.create({ data: { name: t.name, email: t.email, password: hash('prof123'), role: 'PROFESSOR' } })))
    const tchs   = await Promise.all(cfg.teachers.map((t, i) => prisma.teacher.create({ data: { userId: tUsers[i].id, registration: t.reg, bio: t.bio } })))
    const [tchPort, tchMat, tchCien, tchHist, tchGeo] = tchs
    const [tPortU, tMatU, tCienU, tHistU, tGeoU]     = tUsers

    await prisma.teacherSubject.createMany({ data: [
      { teacherId: tchPort.id, subjectId: subPort.id },
      { teacherId: tchMat.id,  subjectId: subMat.id  },
      { teacherId: tchCien.id, subjectId: subCien.id },
      { teacherId: tchHist.id, subjectId: subHist.id },
      { teacherId: tchGeo.id,  subjectId: subGeo.id  },
    ] })

    const GRADE_CFG = [
      { grade: grades.g5, code: '5', by: 2013, fundII: false },
      { grade: grades.g6, code: '6', by: 2012, fundII: true  },
      { grade: grades.g7, code: '7', by: 2011, fundII: true  },
      { grade: grades.g8, code: '8', by: 2010, fundII: true  },
      { grade: grades.g9, code: '9', by: 2009, fundII: true  },
    ]
    const LETTERS = ['A','B','C','D','E']

    type ClsInfo = { id: string; code: string; letter: string; fundII: boolean; by: number }
    const allClasses: ClsInfo[] = []

    for (const g of GRADE_CFG) {
      for (const letter of LETTERS) {
        const cls = await prisma.class.create({ data: {
          name: `${g.code}º Ano ${letter}`, gradeId: g.grade.id, schoolId: school.id,
          shift: ['A','B'].includes(letter) ? 'Manhã' : 'Tarde',
          year: 2024, curriculum: 'BNCC 2024', period: '2024',
        } })
        allClasses.push({ id: cls.id, code: g.code, letter, fundII: g.fundII, by: g.by })
      }
    }

    // TeacherClass: port+mat for all grades, cien+hist+geo for fundII only
    const tcData = allClasses.flatMap(c => {
      const base = [
        { teacherId: tchPort.id, classId: c.id, subjectId: subPort.id },
        { teacherId: tchMat.id,  classId: c.id, subjectId: subMat.id  },
      ]
      if (!c.fundII) return base
      return [...base,
        { teacherId: tchCien.id, classId: c.id, subjectId: subCien.id },
        { teacherId: tchHist.id, classId: c.id, subjectId: subHist.id },
        { teacherId: tchGeo.id,  classId: c.id, subjectId: subGeo.id  },
      ]
    })
    await prisma.teacherClass.createMany({ data: tcData })

    // Students
    let gIdx = cfg.idxOff
    type SInfo = { id: string; idx: number }
    const ninth: SInfo[] = []
    const atRisk: { id: string; name: string; idx: number }[] = []

    for (const cls of allClasses) {
      await prisma.student.createMany({ data: Array.from({ length: cfg.spc }, (_, i) => ({
        name: sname(gIdx + i),
        enrollment: `${cfg.prefix}-${cls.code}${cls.letter}-${String(i + 1).padStart(3, '0')}`,
        classId: cls.id,
        status: 'ATIVO',
        birthDate: new Date(cls.by, i % 12, (i % 28) + 1),
      })) })

      const created = await prisma.student.findMany({
        where: { classId: cls.id }, orderBy: { enrollment: 'asc' }, select: { id: true, name: true }
      })
      created.forEach((s, i) => {
        const absIdx = gIdx + i
        if (cls.code === '9') ninth.push({ id: s.id, idx: absIdx })
        if (i % 10 === 0)    atRisk.push({ id: s.id, name: s.name, idx: absIdx })
      })
      gIdx += cfg.spc
    }

    // Guardians for at-risk students
    await prisma.studentGuardian.createMany({ data: atRisk.map((s, i) => ({
      studentId: s.id,
      name: `${RESP_NAMES[i % RESP_NAMES.length].split(',')[1]?.trim() ?? 'Responsável'} de ${s.name.split(' ')[0]}`,
      relationship: i % 3 === 0 ? 'Mãe' : i % 3 === 1 ? 'Pai' : 'Avó/Avô',
      phone: `(41) 9${String(90000 + (i * 137) % 9999).substring(0,4)}-${String(1000 + (i * 91) % 8999).padStart(4,'0')}`,
      isPrimary: true,
    })) })

    // Pedagogical records — 2 per at-risk student + busca ativa for every 3rd
    const pedRecs: any[] = []
    for (let i = 0; i < atRisk.length; i++) {
      const s = atRisk[i]
      const nFaltas = 8 + (i % 7) * 2
      pedRecs.push({
        studentId: s.id, pedagogueId: pedUser.id, type: 'OBSERVACAO',
        title: `Ausências frequentes — ${nFaltas} faltas no bimestre`,
        content: ABSENCE_TEXTS[i % ABSENCE_TEXTS.length](nFaltas),
        date: new Date(2024, 2, 10 + (i % 18)),
        confidentiality: 'RESTRITO',
        actionPlan: 'Contactar família. Monitorar frequência nas próximas semanas.',
      })
      pedRecs.push({
        studentId: s.id, pedagogueId: pedUser.id, type: 'REUNIAO',
        title: 'Reunião com família — frequência escolar',
        content: MEETING_TEXTS[i % MEETING_TEXTS.length](RESP_NAMES[i % RESP_NAMES.length]),
        date: new Date(2024, 3, 2 + (i % 25)),
        confidentiality: 'RESTRITO',
        actionPlan: 'Monitorar frequência. Retornar contato em 15 dias.',
        resolved: i % 4 === 0,
      })
      if (i % 3 === 0) {
        pedRecs.push({
          studentId: s.id, pedagogueId: pedUser.id, type: 'BUSCA_ATIVA',
          title: 'Busca ativa domiciliar',
          content: BUSCA_TEXTS[i % BUSCA_TEXTS.length],
          date: new Date(2024, 3, 15 + (i % 14)),
          confidentiality: 'RESTRITO',
          actionPlan: 'Comunicar CRAS. Acompanhar retorno do aluno à escola.',
          resolved: i % 2 === 0,
        })
      }
    }
    for (let i = 0; i < pedRecs.length; i += 50)
      await prisma.pedagogicalRecord.createMany({ data: pedRecs.slice(i, i + 50) })

    // SAEB performance for 9th graders
    for (const desc of saebDescs) {
      const data = ninth.map(s => {
        const t = getTier(s.idx, cfg.lowPct, cfg.medPct)
        const sc = saebScore(t, s.idx + desc.code.charCodeAt(3))
        return { studentId: s.id, descriptorId: desc.id, score: sc, level: saebLevel(sc), year: 2024 }
      })
      for (let i = 0; i < data.length; i += 100)
        await prisma.studentSaebPerformance.createMany({ data: data.slice(i, i + 100) })
    }

    return { school, pedUser, tchPort, tchMat, tchCien, tchHist, tchGeo, tPortU, tMatU, tCienU, tHistU, tGeoU, allClasses, ninth }
  }

  // ─── School A: Curitiba — better performance ──────────────────────────────────
  console.log('  Creating School A (Curitiba)...')
  const A = await buildSchool({
    name: 'Escola Estadual Prof. Anísio Teixeira',
    address: 'Rua das Araucárias, 450 - Batel, Curitiba - PR',
    email: 'contato@eeteixeira.pr.edu.br',
    dir:   { name: 'Diretora Regina Aparecida Mendes',   email: 'diretora@eeteixeira.pr.edu.br'    },
    coord: { name: 'Coordenadora Patrícia Gonçalves',    email: 'coord@eeteixeira.pr.edu.br'        },
    ped:   { name: 'Pedagoga Marta Crisostomo',          email: 'pedagoga@eeteixeira.pr.edu.br'     },
    teachers: [
      { name: 'Profª. Ana Luíza Batista',       email: 'ana.batista@eeteixeira.pr.edu.br',    reg: 'A-PORT-001', bio: 'Mestre em Linguística pela UFPR. 15 anos de docência no Ensino Fundamental.' },
      { name: 'Prof. Carlos Roberto Zanetti',   email: 'carlos.zanetti@eeteixeira.pr.edu.br', reg: 'A-MAT-001',  bio: 'Especialista em Educação Matemática. Prepara alunos para Olimpíadas.' },
      { name: 'Prof. Felipe Augusto Braga',     email: 'felipe.braga@eeteixeira.pr.edu.br',   reg: 'A-CIEN-001', bio: 'Licenciado em Ciências Biológicas. Coordena o laboratório escolar.' },
      { name: 'Profª. Juliana Meirelles Costa', email: 'juliana.costa@eeteixeira.pr.edu.br',  reg: 'A-HIST-001', bio: 'Doutora em História pela PUC-PR. Especialista em história do Paraná.' },
      { name: 'Prof. Marcos Tadeu Fonseca',     email: 'marcos.fonseca@eeteixeira.pr.edu.br', reg: 'A-GEO-001',  bio: 'Mestre em Geografia e Meio Ambiente. Projetos de educação ambiental.' },
    ],
    spc: 35, lowPct: 0.05, medPct: 0.35, prefix: 'A', idxOff: 0,
  })

  // ─── School B: Londrina — worse performance ───────────────────────────────────
  console.log('  Creating School B (Londrina)...')
  const B = await buildSchool({
    name: 'Escola Estadual Monteiro Lobato',
    address: 'Av. Higienópolis, 1200 - Centro, Londrina - PR',
    email: 'contato@eemlobato.pr.edu.br',
    dir:   { name: 'Diretor Sérgio Luiz Magalhães',      email: 'diretor@eemlobato.pr.edu.br'      },
    coord: { name: 'Coordenador Ricardo Henrique Prado', email: 'coord@eemlobato.pr.edu.br'         },
    ped:   { name: 'Pedagoga Cláudia Aparecida Ramos',   email: 'pedagoga@eemlobato.pr.edu.br'      },
    teachers: [
      { name: 'Profª. Sandra Cristina Vieira',  email: 'sandra.vieira@eemlobato.pr.edu.br',  reg: 'B-PORT-001', bio: 'Graduada em Letras pela UEL. 20 anos de sala de aula.' },
      { name: 'Prof. Wagner Antônio Souza',     email: 'wagner.souza@eemlobato.pr.edu.br',   reg: 'B-MAT-001',  bio: 'Especialista em Matemática Aplicada.' },
      { name: 'Profª. Renata Cássia Borges',   email: 'renata.borges@eemlobato.pr.edu.br',  reg: 'B-CIEN-001', bio: 'Licenciada em Química e Ciências Naturais.' },
      { name: 'Prof. Gustavo Henrique Leal',   email: 'gustavo.leal@eemlobato.pr.edu.br',   reg: 'B-HIST-001', bio: 'Mestre em História Social pela UEL.' },
      { name: 'Profª. Adriana Cristina Matos', email: 'adriana.matos@eemlobato.pr.edu.br',  reg: 'B-GEO-001',  bio: 'Especialista em Geopolítica e Ensino.' },
    ],
    spc: 36, lowPct: 0.15, medPct: 0.45, prefix: 'B', idxOff: 1000,
  })

  // ─── Helper to find class by code+letter ──────────────────────────────────────
  const cls = (school: typeof A, code: string, letter: string) =>
    school.allClasses.find(c => c.code === code && c.letter === letter)!

  // ─── Assessments for School A 9th grade ──────────────────────────────────────
  console.log('  Creating assessments and grade records...')
  const assessA9Port = await prisma.assessment.create({ data: { name: 'Avaliação LP — 1º Bimestre (9A)', subjectId: subPort.id, classId: cls(A,'9','A').id, period: '1º Bimestre', weight: 2.0, type: 'PROVA', date: new Date(2024, 2, 28), maxScore: 10 } })
  const assessA9Mat  = await prisma.assessment.create({ data: { name: 'Avaliação MT — 1º Bimestre (9A)', subjectId: subMat.id,  classId: cls(A,'9','A').id, period: '1º Bimestre', weight: 2.0, type: 'PROVA', date: new Date(2024, 2, 28), maxScore: 10 } })
  const assessA9Hist = await prisma.assessment.create({ data: { name: 'Avaliação HI — 2º Bimestre (9A)', subjectId: subHist.id, classId: cls(A,'9','A').id, period: '2º Bimestre', weight: 2.0, type: 'PROVA', date: new Date(2024, 4, 15), maxScore: 10 } })

  // Assessments for School B 9th grade
  const assessB9Port = await prisma.assessment.create({ data: { name: 'Avaliação LP — 1º Bimestre (9A)', subjectId: subPort.id, classId: cls(B,'9','A').id, period: '1º Bimestre', weight: 2.0, type: 'PROVA', date: new Date(2024, 2, 28), maxScore: 10 } })
  const assessB9Mat  = await prisma.assessment.create({ data: { name: 'Avaliação MT — 1º Bimestre (9A)', subjectId: subMat.id,  classId: cls(B,'9','A').id, period: '1º Bimestre', weight: 2.0, type: 'PROVA', date: new Date(2024, 2, 28), maxScore: 10 } })

  const studA9A = await prisma.student.findMany({ where: { classId: cls(A,'9','A').id }, orderBy: { enrollment: 'asc' }, select: { id: true } })
  const studB9A = await prisma.student.findMany({ where: { classId: cls(B,'9','A').id }, orderBy: { enrollment: 'asc' }, select: { id: true } })

  const grA = studA9A.flatMap((s, i) => {
    const t = getTier(i, 0.05, 0.35)
    return [
      { assessmentId: assessA9Port.id, studentId: s.id, teacherId: A.tchPort.id, userId: A.tPortU.id, score: scoreForTier(t, i),       observations: t === 'L' ? 'Necessita reforço urgente' : null },
      { assessmentId: assessA9Mat.id,  studentId: s.id, teacherId: A.tchMat.id,  userId: A.tMatU.id,  score: scoreForTier(t, i + 100),  observations: t === 'L' ? 'Dificuldades com álgebra' : null  },
      { assessmentId: assessA9Hist.id, studentId: s.id, teacherId: A.tchHist.id, userId: A.tHistU.id, score: scoreForTier(t, i + 200),  observations: t === 'L' ? 'Abaixo da média da turma' : null   },
    ]
  })
  const grB = studB9A.flatMap((s, i) => {
    const t = getTier(i, 0.15, 0.45)
    return [
      { assessmentId: assessB9Port.id, studentId: s.id, teacherId: B.tchPort.id, userId: B.tPortU.id, score: scoreForTier(t, i + 300), observations: t === 'L' ? 'Intervenção pedagógica necessária' : null },
      { assessmentId: assessB9Mat.id,  studentId: s.id, teacherId: B.tchMat.id,  userId: B.tMatU.id,  score: scoreForTier(t, i + 400), observations: t === 'L' ? 'Defasagem severa em pré-requisitos' : null },
    ]
  })
  for (let i = 0; i < grA.length; i += 50) await prisma.gradeRecord.createMany({ data: grA.slice(i, i + 50) })
  for (let i = 0; i < grB.length; i += 50) await prisma.gradeRecord.createMany({ data: grB.slice(i, i + 50) })

  // ─── Interdisciplinary lesson: Crise Hídrica (School A, 9A) ──────────────────
  console.log('  Creating interdisciplinary lesson...')
  const lessonHidrica = await prisma.lesson.create({ data: {
    title: 'A Crise Hídrica: Perspectivas Integradas',
    description: 'Aula interdisciplinar integrando Matemática, Ciências e Língua Portuguesa para análise crítica da crise hídrica global e local.',
    startDate: new Date(2024, 4, 13), endDate: new Date(2024, 4, 17),
    lessonClasses: { create: [{ classId: cls(A,'9','A').id }] },
    materials: { create: [
      { type: 'LINK',  title: 'ANA — Conjuntura dos Recursos Hídricos no Brasil', order: 1 },
      { type: 'VIDEO', title: 'Documentário: Planeta Água — impactos climáticos',  order: 2 },
      { type: 'LINK',  title: 'IBGE — Saneamento básico por município',            order: 3 },
    ] },
  } })

  await prisma.classRecord.createMany({ data: [
    {
      lessonId: lessonHidrica.id, classId: cls(A,'9','A').id,
      teacherId: A.tchMat.id, subjectId: subMat.id, userId: A.tMatU.id,
      date: new Date(2024, 4, 13),
      contentDeveloped: 'Análise de dados sobre consumo hídrico no Brasil com gráficos de barras e setores: agricultura 72%, abastecimento urbano 11%, indústria 17%. Cálculo de porcentagem e proporção com dados reais. Exercício prático: estimativa do consumo mensal individual e por turma.',
      observations: 'Turma muito engajada — a contextualização real despertou interesse genuíno. Vários alunos trouxeram dados sobre o racionamento em Curitiba. Dois alunos com dificuldade em cálculo percentual; agendei reforço extracurricular. A maioria completou os exercícios com boa precisão.',
      pending: 'Parei na análise do uso agrícola. Ficou pendente: problemas de proporção com capacidade de reservatórios. Na próxima aula, Felipe (Ciências) retoma com o ciclo hidrológico — integração já combinada com ele.',
    },
    {
      lessonId: lessonHidrica.id, classId: cls(A,'9','A').id,
      teacherId: A.tchCien.id, subjectId: subCien.id, userId: A.tCienU.id,
      date: new Date(2024, 4, 14),
      contentDeveloped: 'Ciclo hidrológico: evaporação, condensação, precipitação e escoamento. Impacto do desmatamento no ciclo das chuvas no Paraná. Contaminação de aquíferos por agrotóxicos. Experimento demonstrativo: filtração de água turva com areia, brita e carvão ativado.',
      observations: 'O experimento de filtração foi o ponto alto — alunos fizeram perguntas excelentes comparando com o tratamento real de água. A conexão com os gráficos do Carlos (Matemática) funcionou perfeitamente; alunos usaram os percentuais para quantificar impacto do desmatamento. Um aluno relatou que seu bairro sofre racionamento duas vezes por semana.',
      pending: 'Parei antes de cobrir saneamento básico no Paraná e legislação de recursos hídricos. Carlos já cobriu os gráficos de consumo. Próxima aula: aquífero Guarani e Código de Águas — integrar com Geografia na semana seguinte.',
    },
    {
      lessonId: lessonHidrica.id, classId: cls(A,'9','A').id,
      teacherId: A.tchPort.id, subjectId: subPort.id, userId: A.tPortU.id,
      date: new Date(2024, 4, 15),
      contentDeveloped: 'Leitura e análise de dois textos jornalísticos: editorial sobre a crise hídrica de São Paulo (2014) e reportagem sobre o aquífero Guarani. Identificação de tese, argumentos e estratégias retóricas. Atividade de escrita: produção de carta aberta à prefeitura sobre consumo consciente de água.',
      observations: 'A interdisciplinaridade foi muito bem recebida. Alunos usaram os dados do Carlos (porcentagens) para embasar argumentos nas cartas e mencionaram o experimento de filtração do Felipe. O nível argumentativo foi superior ao habitual — o tema real fez diferença. Três alunos produziram textos excepcionais; sugeri publicação no jornal escolar. Dois alunos ainda confundem fato e opinião.',
      pending: 'Finalizamos a estrutura da carta argumentativa. Próxima aula LP: reescrita com foco em conectivos e progressão temática. As melhores cartas serão apresentadas na Semana do Meio Ambiente — evento conjunto das três disciplinas em junho.',
    },
  ] })

  // ─── Regular lessons School A ─────────────────────────────────────────────────
  console.log('  Creating regular lessons...')
  const lessonPort9A = await prisma.lesson.create({ data: {
    title: 'Gêneros Textuais: Crônica e Conto',
    description: 'Análise de crônicas e contos brasileiros contemporâneos. Elementos narrativos e estilo autoral.',
    subjectId: subPort.id, startDate: new Date(2024, 2, 4), endDate: new Date(2024, 2, 29),
    lessonClasses: { create: [{ classId: cls(A,'9','A').id }, { classId: cls(A,'9','B').id }] },
  } })
  const lessonMat9A = await prisma.lesson.create({ data: {
    title: 'Funções do 1º e 2º Grau',
    description: 'Definição, representação gráfica e aplicações de funções lineares e quadráticas.',
    subjectId: subMat.id, startDate: new Date(2024, 2, 4), endDate: new Date(2024, 3, 30),
    lessonClasses: { create: [{ classId: cls(A,'9','A').id }, { classId: cls(A,'9','B').id }] },
  } })
  const lessonHist9A = await prisma.lesson.create({ data: {
    title: 'Segunda Guerra Mundial e Ordem Mundial Pós-1945',
    description: 'Contexto, causas, fases, consequências e reconfiguração geopolítica contemporânea.',
    subjectId: subHist.id, startDate: new Date(2024, 3, 2), endDate: new Date(2024, 3, 30),
    lessonClasses: { create: [{ classId: cls(A,'9','A').id }] },
  } })
  const lessonCien7A = await prisma.lesson.create({ data: {
    title: 'Ecossistemas e Cadeias Alimentares',
    description: 'Componentes dos ecossistemas, redes tróficas e equilíbrio ecológico.',
    subjectId: subCien.id, startDate: new Date(2024, 2, 4), endDate: new Date(2024, 2, 29),
    lessonClasses: { create: [{ classId: cls(A,'7','A').id }] },
  } })

  await prisma.classRecord.createMany({ data: [
    { lessonId: lessonPort9A.id, classId: cls(A,'9','A').id, teacherId: A.tchPort.id, subjectId: subPort.id, userId: A.tPortU.id, date: new Date(2024, 2, 5), contentDeveloped: 'Leitura da crônica "A Bolsa Amarela" de Lygia Bojunga. Análise de narrador, tempo, espaço. Debate sobre identidade e expectativas.', observations: 'Alunos identificaram-se com o texto — debate animado sobre sonhos × expectativas familiares. Boa participação oral. Metade da turma com dificuldade em identificar foco narrativo no escrito.', pending: 'Retomar foco narrativo com exercícios escritos na próxima aula.' },
    { lessonId: lessonPort9A.id, classId: cls(A,'9','A').id, teacherId: A.tchPort.id, subjectId: subPort.id, userId: A.tPortU.id, date: new Date(2024, 2, 12), contentDeveloped: 'Leitura do conto "A Cartomante" de Machado de Assis. Comparação crônica × conto. Produção textual: mini-crônica sobre cotidiano escolar.', observations: 'Qualidade das mini-crônicas surpreendente — tema livre funcionou muito bem. Cinco alunos com potencial para jornal escolar. Dificuldade generalizada com pontuação do discurso direto.', pending: 'Corrigir pontuação antes de avançar. Parei no conceito de ironia machadiana.' },
    { lessonId: lessonMat9A.id, classId: cls(A,'9','A').id, teacherId: A.tchMat.id, subjectId: subMat.id, userId: A.tMatU.id, date: new Date(2024, 2, 6), contentDeveloped: 'Introdução a funções: definição, domínio, contradomínio, imagem. Exemplos do cotidiano. Representação por tabela e gráfico cartesiano.', observations: 'Conceito de domínio/imagem bem absorvido. Dificuldade com plano cartesiano em 6 alunos — provável defasagem do Fundamental I. Separei para reforço extraturnos.', pending: 'Próxima aula: f(x) = ax + b. Gráfico da reta e inclinação.' },
    { lessonId: lessonMat9A.id, classId: cls(A,'9','A').id, teacherId: A.tchMat.id, subjectId: subMat.id, userId: A.tMatU.id, date: new Date(2024, 2, 13), contentDeveloped: 'Função de 1º grau: coeficiente angular e linear. Crescimento e decrescimento. Aplicações: tarifa de energia elétrica e taxa de táxi.', observations: 'Aplicações práticas melhoraram muito o engajamento. Turma entendeu bem crescente/decrescente. Dois alunos ainda com dificuldade no plano cartesiano — encaminhei para reforço.', pending: 'Parei no zero da função. Próxima: raiz da função e interseção com eixos.' },
    { lessonId: lessonHist9A.id, classId: cls(A,'9','A').id, teacherId: A.tchHist.id, subjectId: subHist.id, userId: A.tHistU.id, date: new Date(2024, 3, 3), contentDeveloped: 'Contexto europeu pré-guerra: crise de 1929, ascensão do nazismo e fascismo, falência da Liga das Nações. Linha do tempo colaborativa no quadro.', observations: 'Alunos fizeram conexões espontâneas com polarização política atual — discussão muito madura para o nível. Monitorar para não desviar em opiniões sem embasamento histórico.', pending: 'Parei no Pacto de Não-Agressão (1939). Próxima aula: início da guerra e Blitzkrieg.' },
    { lessonId: lessonHist9A.id, classId: cls(A,'9','A').id, teacherId: A.tchHist.id, subjectId: subHist.id, userId: A.tHistU.id, date: new Date(2024, 3, 10), contentDeveloped: 'Fases da guerra: Blitzkrieg, Operação Barbarossa, Pacífico, virada em Stalingrado. Mapa das frentes de batalha.', observations: 'Mapa das frentes foi excelente recurso — alunos visualizaram a escala do conflito. Um aluno trouxe relato da família sobre descendentes de refugiados poloneses radicados no Paraná, enriquecendo muito o debate.', pending: 'Parei antes do holocausto. Próxima: genocídio, resistência e fim da guerra.' },
    { lessonId: lessonCien7A.id, classId: cls(A,'7','A').id, teacherId: A.tchCien.id, subjectId: subCien.id, userId: A.tCienU.id, date: new Date(2024, 2, 5), contentDeveloped: 'Componentes bióticos e abióticos. Produtores, consumidores primários, secundários e decompositores. Cadeia e teia alimentar com exemplos do bioma paranaense.', observations: 'Turma muito participativa. Alunos trouxeram exemplos locais (araucária, onça-parda) espontaneamente. Dificuldade em diferenciar cadeia de teia alimentar.', pending: 'Parei na teia alimentar. Próxima: fluxo de energia e pirâmides ecológicas.' },
  ] })

  // ─── Regular lessons School B ─────────────────────────────────────────────────
  const lessonPort9B = await prisma.lesson.create({ data: {
    title: 'Interpretação Textual e Inferência',
    description: 'Estratégias de leitura: localização, inferência, tema e intenção comunicativa em diferentes gêneros.',
    subjectId: subPort.id, startDate: new Date(2024, 2, 4), endDate: new Date(2024, 2, 29),
    lessonClasses: { create: [{ classId: cls(B,'9','A').id }] },
  } })
  const lessonMat8B = await prisma.lesson.create({ data: {
    title: 'Sistemas de Equações do 1º Grau',
    description: 'Resolução por substituição, adição e método gráfico. Aplicações em problemas contextualizados.',
    subjectId: subMat.id, startDate: new Date(2024, 3, 2), endDate: new Date(2024, 3, 30),
    lessonClasses: { create: [{ classId: cls(B,'8','A').id }] },
  } })
  const lessonCien9B = await prisma.lesson.create({ data: {
    title: 'Genética e Hereditariedade',
    description: 'Leis de Mendel, herança de características e aplicações em saúde humana.',
    subjectId: subCien.id, startDate: new Date(2024, 3, 2), endDate: new Date(2024, 4, 10),
    lessonClasses: { create: [{ classId: cls(B,'9','A').id }] },
  } })

  await prisma.classRecord.createMany({ data: [
    { lessonId: lessonPort9B.id, classId: cls(B,'9','A').id, teacherId: B.tchPort.id, subjectId: subPort.id, userId: B.tPortU.id, date: new Date(2024, 2, 5), contentDeveloped: 'Leitura de texto jornalístico sobre desigualdade educacional. Exercícios de localização e inferência. Identificação de tese e argumento principal.', observations: 'Turma com dificuldades significativas em inferência — 60% não conseguiu responder questões implícitas sem suporte. É necessário retomar estratégias básicas de leitura antes de avançar no conteúdo do 9º ano.', pending: 'Retomar inferência simples com textos menores e mais acessíveis. Solicitarei reunião com a pedagoga para alunos críticos.' },
    { lessonId: lessonPort9B.id, classId: cls(B,'9','A').id, teacherId: B.tchPort.id, subjectId: subPort.id, userId: B.tPortU.id, date: new Date(2024, 2, 12), contentDeveloped: 'Revisão de inferência com texto narrativo mais acessível. Exercícios graduados em dificuldade. Discussão sobre vocabulário em contexto.', observations: 'Melhora perceptível com texto adequado. Ainda há 8 alunos com dificuldades severas — possivelmente alfabetização funcional comprometida. Conversei com a pedagoga Cláudia para avaliação formal.', pending: 'Iniciar gênero dissertativo na próxima semana. Alunos críticos encaminhados para avaliação. Parei na inferência de causa e efeito.' },
    { lessonId: lessonMat8B.id, classId: cls(B,'8','A').id, teacherId: B.tchMat.id, subjectId: subMat.id, userId: B.tMatU.id, date: new Date(2024, 3, 3), contentDeveloped: 'Introdução a sistemas de equações. Interpretação de problemas com duas incógnitas. Método de substituição com equações simples.', observations: 'Pré-requisito de equações do 1º grau muito deficiente — precisei retomar o conceito básico antes de avançar. Metade da turma não consolida o método de isolamento. Aula perdeu ritmo pela revisão necessária.', pending: 'Retomar equação do 1º grau na próxima aula antes de prosseguir com sistemas. Parei no método de substituição com pares simples.' },
    { lessonId: lessonMat8B.id, classId: cls(B,'8','A').id, teacherId: B.tchMat.id, subjectId: subMat.id, userId: B.tMatU.id, date: new Date(2024, 3, 10), contentDeveloped: 'Revisão de equação do 1º grau. Retomada do método de substituição em sistemas simples. Exercícios contextualizados com preço e quantidade de produtos.', observations: 'Turma avançou após revisão dos pré-requisitos. Ainda 4 alunos com muita dificuldade. A contextualização com problemas de supermercado funcionou bem para motivar.', pending: 'Parei em sistemas com solução infinita. Próxima aula: método da adição.' },
    { lessonId: lessonCien9B.id, classId: cls(B,'9','A').id, teacherId: B.tchCien.id, subjectId: subCien.id, userId: B.tCienU.id, date: new Date(2024, 3, 3), contentDeveloped: 'Introdução à genética: conceito de gene, alelo, genótipo e fenótipo. Experimentos de Mendel com ervilhas. Dominância e recessividade.', observations: 'Conteúdo novo para todos — boa motivação inicial. Alunos adoraram os exemplos com características próprias (cor dos olhos, lóbulo da orelha). Dificuldade em construir e interpretar quadro de Punnett.', pending: 'Parei no cruzamento monohíbrido. Próxima: diíbrido e probabilidade de fenótipos.' },
  ] })

  // ─── Lesson comments (teacher feedback on lessons) ────────────────────────────
  await prisma.lessonComment.createMany({ data: [
    { lessonId: lessonHidrica.id, teacherId: A.tchMat.id,  classId: cls(A,'9','A').id, rating: 5, comment: 'A integração interdisciplinar superou minhas expectativas. Usar dados reais de consumo hídrico como contexto para porcentagem e proporção aumentou imensamente o engajamento. Os alunos chegaram com mais perguntas do que respostas — isso é o que queremos.' },
    { lessonId: lessonHidrica.id, teacherId: A.tchCien.id, classId: cls(A,'9','A').id, rating: 5, comment: 'O experimento de filtração conectou perfeitamente com os cálculos do Carlos e o texto da Ana. Quando o aluno consegue ver a mesma realidade por três lentes diferentes, o aprendizado é muito mais profundo. Recomendo fortemente repetir esse formato interdisciplinar.' },
    { lessonId: lessonHidrica.id, teacherId: A.tchPort.id, classId: cls(A,'9','A').id, rating: 5, comment: 'As cartas argumentativas produzidas foram as melhores do ano. O tema concreto + os dados de Matemática + o experimento de Ciências deram aos alunos muito mais o que dizer do que qualquer tema abstrato. Três textos merecem publicação.' },
    { lessonId: lessonPort9A.id, teacherId: A.tchPort.id, classId: cls(A,'9','A').id, rating: 4, comment: 'Boa resposta ao texto da Lygia Bojunga. Tema da identidade é muito relevante para o 9º ano. Recomendo começar com a crônica antes do conto — narrativa mais curta facilita a análise estrutural inicial.' },
    { lessonId: lessonMat9A.id, teacherId: A.tchMat.id, classId: cls(A,'9','A').id, rating: 4, comment: 'A abordagem com exemplos cotidianos (energia, táxi) foi fundamental para quebrar a resistência com funções. Dica: trazer o gráfico da conta de energia real de um aluno na primeira aula — a concretude muda tudo.' },
    { lessonId: lessonPort9B.id, teacherId: B.tchPort.id, classId: cls(B,'9','A').id, rating: 2, comment: 'Turma com defasagem maior do que o esperado para o 9º ano. Os textos precisam ser mais graduais. Sugiro iniciar com textos narrativos curtos antes de expor a textos argumentativos jornalísticos.' },
    { lessonId: lessonMat8B.id, teacherId: B.tchMat.id, classId: cls(B,'8','A').id, rating: 3, comment: 'A defasagem em pré-requisitos é o maior obstáculo. Sistemas de equações exigem segurança em equações simples, que parte da turma ainda não tem. Necessário plano de nivelamento antes de avançar no currículo.' },
  ] })

  console.log('\n✅ Demo seed complete!')
  console.log('\n📊 Summary:')
  console.log('  School A — E.E. Prof. Anísio Teixeira (Curitiba): 875 students, ~5% below avg')
  console.log('  School B — E.E. Monteiro Lobato (Londrina):        900 students, ~15% below avg')
  console.log('  ~100 at-risk students per school with family records (absence + meeting + busca ativa)')
  console.log('  9th grade SAEB performance data (LP + MT, 7 descriptors) for both schools')
  console.log('  Interdisciplinary lesson: "A Crise Hídrica" — Math + Science + Portuguese (School A, 9A)')
  console.log('  Lessons with teacher diaries for both schools')
  console.log('\n🔑 Credentials:')
  console.log('  Secretaria SEDUC:  secretaria@seduc.pr.gov.br    / seduc2024')
  console.log('  Dir. Escola A:     diretora@eeteixeira.pr.edu.br / admin123')
  console.log('  Pedagoga A:        pedagoga@eeteixeira.pr.edu.br / ped123')
  console.log('  Prof. LP (A):      ana.batista@eeteixeira.pr.edu.br / prof123')
  console.log('  Prof. MT (A):      carlos.zanetti@eeteixeira.pr.edu.br / prof123')
  console.log('  Dir. Escola B:     diretor@eemlobato.pr.edu.br   / admin123')
  console.log('  Pedagoga B:        pedagoga@eemlobato.pr.edu.br  / ped123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
