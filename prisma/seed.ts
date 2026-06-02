import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// Deterministic question results: studentIdx 0-9, numQ questions, basePct base accuracy
function genQuestionResults(numQ: number, basePct: number, studentIdx: number): { results: string; correct: number } {
  const pattern = [true, true, false, true, false, true, true, false, true, true]
  const offset = studentIdx % 3
  const arr = []
  let correct = 0
  for (let q = 1; q <= numQ; q++) {
    const idx = (q - 1 + offset) % pattern.length
    const isCorrect = basePct >= 0.8 ? true
      : basePct >= 0.6 ? pattern[idx]
      : basePct >= 0.4 ? !pattern[idx]
      : q % 3 !== 0
    if (isCorrect) correct++
    arr.push({ q, correct: isCorrect })
  }
  return { results: JSON.stringify(arr), correct }
}

async function main() {
  console.log('🌱 Seeding database...')

  // Clean up in dependency order
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

  // ── School ──────────────────────────────────────────────────────────────────
  const school = await prisma.school.create({
    data: {
      name: 'Escola Municipal Arcadia',
      address: 'Rua das Flores, 123 - Centro',
      phone: '(11) 3456-7890',
      email: 'contato@arcadia.edu.br',
    }
  })

  // ── Segments ─────────────────────────────────────────────────────────────────
  const segFundI  = await prisma.segment.create({ data: { name: 'Ensino Fundamental I'  } })
  const segFundII = await prisma.segment.create({ data: { name: 'Ensino Fundamental II' } })

  // ── Grades ────────────────────────────────────────────────────────────────────
  const grade5 = await prisma.grade.create({ data: { name: '5º Ano', segmentId: segFundI.id  } })
  const grade7 = await prisma.grade.create({ data: { name: '7º Ano', segmentId: segFundII.id } })
  const grade9 = await prisma.grade.create({ data: { name: '9º Ano', segmentId: segFundII.id } })

  // ── Subjects ──────────────────────────────────────────────────────────────────
  const subPortugues  = await prisma.subject.create({ data: { name: 'Língua Portuguesa', segmentId: segFundI.id  } })
  const subMatematica = await prisma.subject.create({ data: { name: 'Matemática',         segmentId: segFundI.id  } })
  const subCiencias   = await prisma.subject.create({ data: { name: 'Ciências',           segmentId: segFundII.id } })
  const subHistoria   = await prisma.subject.create({ data: { name: 'História',           segmentId: segFundII.id } })
  const subGeografia  = await prisma.subject.create({ data: { name: 'Geografia',          segmentId: segFundII.id } })

  // ── Classes ───────────────────────────────────────────────────────────────────
  const class5A = await prisma.class.create({ data: { name: '5º Ano A', curriculum: 'BNCC 2024', gradeId: grade5.id, period: '2024', schoolId: school.id, shift: 'Manhã', year: 2024 } })
  const class5B = await prisma.class.create({ data: { name: '5º Ano B', curriculum: 'BNCC 2024', gradeId: grade5.id, period: '2024', schoolId: school.id, shift: 'Tarde', year: 2024 } })
  const class7A = await prisma.class.create({ data: { name: '7º Ano A', curriculum: 'BNCC 2024', gradeId: grade7.id, period: '2024', schoolId: school.id, shift: 'Manhã', year: 2024 } })
  const class9B = await prisma.class.create({ data: { name: '9º Ano B', curriculum: 'BNCC 2024', gradeId: grade9.id, period: '2024', schoolId: school.id, shift: 'Tarde', year: 2024 } })

  // ── Users ─────────────────────────────────────────────────────────────────────
  const hash = (p: string) => bcrypt.hashSync(p, 10)

  const adminUser    = await prisma.user.create({ data: { name: 'Administrador Arcadia', email: 'admin@arcadia.edu.br',    password: hash('admin123'), role: 'ADMIN'        } })
  const teacherUser1 = await prisma.user.create({ data: { name: 'Ana Paula Silva',       email: 'ana@arcadia.edu.br',      password: hash('prof123'),  role: 'PROFESSOR'    } })
  const teacherUser2 = await prisma.user.create({ data: { name: 'Carlos Eduardo Santos', email: 'carlos@arcadia.edu.br',   password: hash('prof123'),  role: 'PROFESSOR'    } })
  const teacherUser3 = await prisma.user.create({ data: { name: 'Mariana Costa',         email: 'mariana@arcadia.edu.br',  password: hash('prof123'),  role: 'PROFESSOR'    } })
  const teacherUser4 = await prisma.user.create({ data: { name: 'Felipe Andrade',        email: 'felipe@arcadia.edu.br',   password: hash('prof123'),  role: 'PROFESSOR'    } })
  const pedagogoUser = await prisma.user.create({ data: { name: 'Fernanda Oliveira',     email: 'pedagoga@arcadia.edu.br', password: hash('ped123'),   role: 'PEDAGOGO'     } })
  await prisma.user.create(                       { data: { name: 'Roberto Alves',        email: 'coord@arcadia.edu.br',    password: hash('coord123'), role: 'COORDENACAO'  } })

  // ── Teachers ──────────────────────────────────────────────────────────────────
  const teacher1 = await prisma.teacher.create({ data: { userId: teacherUser1.id, registration: 'PROF-001', bio: 'Especialista em Língua Portuguesa e Literatura Infantil.' } })
  const teacher2 = await prisma.teacher.create({ data: { userId: teacherUser2.id, registration: 'PROF-002', bio: 'Mestre em Matemática Aplicada, 12 anos de experiência.' } })
  const teacher3 = await prisma.teacher.create({ data: { userId: teacherUser3.id, registration: 'PROF-003', bio: 'Graduada em História e Geografia pela USP.' } })
  const teacher4 = await prisma.teacher.create({ data: { userId: teacherUser4.id, registration: 'PROF-004', bio: 'Licenciado em Ciências Biológicas com ênfase em Ciências Naturais.' } })

  // Teacher-Subject
  await prisma.teacherSubject.createMany({ data: [
    { teacherId: teacher1.id, subjectId: subPortugues.id  },
    { teacherId: teacher2.id, subjectId: subMatematica.id },
    { teacherId: teacher3.id, subjectId: subHistoria.id   },
    { teacherId: teacher3.id, subjectId: subGeografia.id  },
    { teacherId: teacher4.id, subjectId: subCiencias.id   },
  ] })

  // Teacher-Class-Subject
  await prisma.teacherClass.createMany({ data: [
    { teacherId: teacher1.id, classId: class5A.id, subjectId: subPortugues.id  },
    { teacherId: teacher1.id, classId: class5B.id, subjectId: subPortugues.id  },
    { teacherId: teacher2.id, classId: class5A.id, subjectId: subMatematica.id },
    { teacherId: teacher2.id, classId: class5B.id, subjectId: subMatematica.id },
    { teacherId: teacher2.id, classId: class7A.id, subjectId: subMatematica.id },
    { teacherId: teacher3.id, classId: class7A.id, subjectId: subHistoria.id   },
    { teacherId: teacher3.id, classId: class9B.id, subjectId: subHistoria.id   },
    { teacherId: teacher3.id, classId: class9B.id, subjectId: subGeografia.id  },
    { teacherId: teacher4.id, classId: class7A.id, subjectId: subCiencias.id   },
    { teacherId: teacher4.id, classId: class9B.id, subjectId: subCiencias.id   },
  ] })

  // ── Students ──────────────────────────────────────────────────────────────────
  const names5A = ['Lucas Ferreira','Maria Eduarda Lima','Pedro Henrique Costa','Isabela Santos',
    'Gabriel Alves','Sophia Rodrigues','Matheus Oliveira','Laura Pereira','Arthur Souza','Beatriz Nunes']
  const names5B = ['Thiago Carvalho','Camila Fernandes','Bruno Nascimento','Amanda Teixeira',
    'Vitor Hugo Lopes','Letícia Moreira','Cauã Barbosa','Nathalia Pinto','Diego Correia','Bruna Souza']
  const names7A = ['Leonardo Castro','Yasmin Ribeiro','Eduardo Gomes','Larissa Mendes',
    'Henrique Araújo','Bianca Monteiro','Samuel Freitas','Tatiane Vieira','Otávio Lima','Priscila Campos']
  const names9B = ['Enzo Gabriel Silva','Valentina Costa','Nicolas Barbosa','Giulia Martins',
    'Rafael Carvalho','Alice Ferreira','Gustavo Santos','Lívia Rodrigues','Felipe Almeida','Helena Nascimento']

  const makeStudents = (names: string[], classId: string, prefix: string, birthYear: number, transferIdx?: number) =>
    Promise.all(names.map((name, i) => prisma.student.create({ data: {
      name, enrollment: `2024-${prefix}-${String(i + 1).padStart(3, '0')}`,
      classId, status: i === transferIdx ? 'TRANSFERIDO' : 'ATIVO',
      birthDate: new Date(birthYear, i % 12, (i % 28) + 1),
    }})))

  const students5A = await makeStudents(names5A, class5A.id, '5A', 2013, 7)
  const students5B = await makeStudents(names5B, class5B.id, '5B', 2013, 9)
  const students7A = await makeStudents(names7A, class7A.id, '7A', 2011)
  const students9B = await makeStudents(names9B, class9B.id, '9B', 2009, 8)

  // ── Guardians ─────────────────────────────────────────────────────────────────
  const guardianData = [
    { studentId: students5A[0].id, name: 'José Ferreira',      relationship: 'Pai',  phone: '(11) 91234-5678', email: 'jose.ferreira@email.com',   isPrimary: true  },
    { studentId: students5A[0].id, name: 'Cláudia Ferreira',   relationship: 'Mãe',  phone: '(11) 91234-5679',                                      isPrimary: false },
    { studentId: students5A[1].id, name: 'Ana Lima',           relationship: 'Mãe',  phone: '(11) 97654-3210', email: 'ana.lima@email.com',         isPrimary: true  },
    { studentId: students5A[3].id, name: 'Roberto Santos',     relationship: 'Pai',  phone: '(11) 98888-1111', email: 'roberto.santos@email.com',   isPrimary: true  },
    { studentId: students5A[5].id, name: 'Patrícia Rodrigues', relationship: 'Mãe',  phone: '(11) 97777-2222',                                      isPrimary: true  },
    { studentId: students5B[0].id, name: 'Marcos Carvalho',    relationship: 'Pai',  phone: '(11) 96666-3333', email: 'marcos.carvalho@email.com',  isPrimary: true  },
    { studentId: students5B[2].id, name: 'Sônia Nascimento',   relationship: 'Mãe',  phone: '(11) 95555-4444',                                      isPrimary: true  },
    { studentId: students7A[0].id, name: 'Renato Castro',      relationship: 'Pai',  phone: '(11) 94444-5555', email: 'renato.castro@email.com',    isPrimary: true  },
    { studentId: students7A[2].id, name: 'Viviane Gomes',      relationship: 'Mãe',  phone: '(11) 93333-6666',                                      isPrimary: true  },
    { studentId: students9B[0].id, name: 'Ricardo Silva',      relationship: 'Pai',  phone: '(11) 98765-4321', email: 'ricardo.silva@email.com',    isPrimary: true  },
    { studentId: students9B[1].id, name: 'Cristina Costa',     relationship: 'Mãe',  phone: '(11) 92222-7777', email: 'cristina.costa@email.com',   isPrimary: true  },
    { studentId: students9B[4].id, name: 'Fábio Carvalho',     relationship: 'Pai',  phone: '(11) 91111-8888',                                      isPrimary: true  },
  ]
  await prisma.studentGuardian.createMany({ data: guardianData })

  // ── Academic History ──────────────────────────────────────────────────────────
  await prisma.academicHistory.createMany({ data: [
    { studentId: students9B[0].id, year: 2023, className: '8º Ano B', schoolName: 'Escola Municipal Arcadia',   observations: 'Aprovado com média 7.8'    },
    { studentId: students9B[0].id, year: 2022, className: '7º Ano B', schoolName: 'Escola Municipal Arcadia',   observations: 'Aprovado com média 8.1'    },
    { studentId: students9B[1].id, year: 2023, className: '8º Ano A', schoolName: 'Escola Municipal Arcadia',   observations: 'Aprovado com média 8.5'    },
    { studentId: students9B[2].id, year: 2023, className: '8º Ano B', schoolName: 'Escola Particular Luminar', observations: 'Transferido para Arcadia'  },
    { studentId: students5A[0].id, year: 2023, className: '4º Ano A', schoolName: 'Escola Municipal Arcadia',   observations: 'Aprovado com média 8.0'    },
    { studentId: students5A[3].id, year: 2023, className: '4º Ano B', schoolName: 'Escola Municipal Arcadia',   observations: 'Aprovado com baixo desempenho, 5.5' },
    { studentId: students7A[0].id, year: 2023, className: '6º Ano A', schoolName: 'Escola Municipal Arcadia',   observations: 'Aprovado com média 7.2'    },
    { studentId: students7A[1].id, year: 2023, className: '6º Ano A', schoolName: 'Escola Municipal Arcadia',   observations: 'Aprovado com média 8.9'    },
    { studentId: students5B[8].id, year: 2023, className: '4º Ano A', schoolName: 'Escola Municipal Arcadia',   observations: 'Transferido durante o ano' },
  ] })

  // ── Lessons ───────────────────────────────────────────────────────────────────
  const lesson1 = await prisma.lesson.create({ data: {
    title: 'Interpretação de Texto - Narrativas',
    description: 'Estudo de narrativas clássicas e contemporâneas com foco em interpretação e análise crítica.',
    subjectId: subPortugues.id, startDate: new Date(2024, 2, 1), endDate: new Date(2024, 2, 31), createdById: teacherUser1.id,
    lessonClasses: { create: [{ classId: class5A.id }, { classId: class5B.id }] },
    materials: { create: [
      { type: 'LINK',      title: 'Texto: O Pequeno Príncipe',       url: 'https://dominio-publico.gov.br/pequeno-principe',   description: 'Texto base para leitura'           },
      { type: 'VIDEO',     title: 'Vídeo explicativo - Interpretação', url: 'https://www.youtube.com/watch?v=ZbZSe6N_BXs',     description: 'Assistir antes da aula'           },
      { type: 'DOCUMENTO', title: 'Atividade impressa',               url: '/docs/atividade-narrativa.pdf',                    description: 'Atividade para fixação em sala'    },
    ] }
  } })

  const lesson2 = await prisma.lesson.create({ data: {
    title: 'Frações e Porcentagem',
    description: 'Conceito de fração, frações equivalentes, simplificação e cálculo de porcentagem.',
    subjectId: subMatematica.id, startDate: new Date(2024, 2, 4), endDate: new Date(2024, 2, 22), createdById: teacherUser2.id,
    lessonClasses: { create: [{ classId: class5A.id }, { classId: class5B.id }] },
    materials: { create: [
      { type: 'VIDEO', title: 'Khan Academy - Frações',    url: 'https://www.youtube.com/watch?v=l3RuKFMBJ9o', description: 'Vídeo introdutório'       },
      { type: 'LINK',  title: 'Exercícios interativos',    url: 'https://www.matematica.pt/util/fracoes.php',   description: 'Praticar frações online'  },
    ] }
  } })

  const lesson3 = await prisma.lesson.create({ data: {
    title: 'Sistema Solar e Planetas',
    description: 'Exploração do sistema solar, características dos planetas e movimentos terrestres.',
    subjectId: subCiencias.id, startDate: new Date(2024, 3, 1), endDate: new Date(2024, 3, 30), createdById: teacherUser4.id,
    lessonClasses: { create: [{ classId: class7A.id }, { classId: class9B.id }] },
    materials: { create: [
      { type: 'VIDEO', title: 'NASA - Sistema Solar',   url: 'https://www.youtube.com/watch?v=libKVRa01L8', description: 'Documentário NASA'           },
      { type: 'LINK',  title: 'Simulador Solar',        url: 'https://solarsystem.nasa.gov',                description: 'Explore interativamente'     },
    ] }
  } })

  const lesson4 = await prisma.lesson.create({ data: {
    title: 'Revolução Industrial',
    description: 'Contexto histórico, causas e consequências da Revolução Industrial.',
    subjectId: subHistoria.id, startDate: new Date(2024, 3, 8), endDate: new Date(2024, 4, 10), createdById: teacherUser3.id,
    lessonClasses: { create: [{ classId: class7A.id }, { classId: class9B.id }] },
    materials: { create: [
      { type: 'VIDEO', title: 'Revolução Industrial - Resumo', url: 'https://www.youtube.com/watch?v=zhL5DCizj5c', description: 'Vídeo resumo' },
    ] }
  } })

  const lesson5 = await prisma.lesson.create({ data: {
    title: 'Biomas Brasileiros',
    description: 'Características e importância dos principais biomas do Brasil.',
    subjectId: subGeografia.id, startDate: new Date(2024, 4, 6), endDate: new Date(2024, 4, 31), createdById: teacherUser3.id,
    lessonClasses: { create: [{ classId: class9B.id }] },
    materials: { create: [
      { type: 'VIDEO', title: 'Biomas do Brasil', url: 'https://www.youtube.com/watch?v=BIJRhexTCZI' },
      { type: 'LINK',  title: 'IBGE - Biomas',    url: 'https://www.ibge.gov.br/geociencias/biomas'  },
    ] }
  } })

  const lesson6 = await prisma.lesson.create({ data: {
    title: 'Equações do 1º Grau',
    description: 'Resolução de equações de primeiro grau, problemas e aplicações.',
    subjectId: subMatematica.id, startDate: new Date(2024, 4, 6), endDate: new Date(2024, 4, 31), createdById: teacherUser2.id,
    lessonClasses: { create: [{ classId: class7A.id }] },
    materials: { create: [
      { type: 'VIDEO', title: 'Equações 1º Grau', url: 'https://www.youtube.com/watch?v=Qk6enHKHyNM' },
    ] }
  } })

  // ── Lesson Comments (professores que aplicaram a aula) ────────────────────────
  await prisma.lessonComment.createMany({ data: [
    // lesson1 - Interpretação de Texto
    { lessonId: lesson1.id, teacherId: teacher1.id, classId: class5A.id, rating: 5,
      comment: 'Excelente aula! A turma 5ºA se engajou muito bem com O Pequeno Príncipe. Os alunos trouxeram reflexões surpreendentes sobre amizade e responsabilidade. Recomendo começar com a leitura em voz alta coletiva antes das questões.' },
    { lessonId: lesson1.id, teacherId: teacher1.id, classId: class5B.id, rating: 4,
      comment: 'A turma 5ºB teve mais dificuldade com as inferências. Precisei adaptar algumas questões para o nível deles. Sugiro incluir um glossário das palavras mais difíceis do texto antes de aplicar.' },
    // lesson2 - Frações e Porcentagem
    { lessonId: lesson2.id, teacherId: teacher2.id, classId: class5A.id, rating: 4,
      comment: 'O material concreto de pizza e barras funcionou muito bem para o 5ºA. A maioria entendeu frações equivalentes após a atividade prática. O vídeo do Khan Academy deve ser passado como tarefa antes da aula.' },
    { lessonId: lesson2.id, teacherId: teacher2.id, classId: class5B.id, rating: 3,
      comment: 'Turma 5ºB apresentou muita dificuldade com porcentagem. Precisei de duas aulas extras. Recomendo tratar frações e porcentagem em aulas separadas para essa faixa etária.' },
    // lesson3 - Sistema Solar
    { lessonId: lesson3.id, teacherId: teacher4.id, classId: class9B.id, rating: 5,
      comment: 'Aula muito dinâmica para o 9ºB! O simulador da NASA foi o destaque — os alunos ficaram fascinados com as escalas do sistema solar. A maquete 3D feita em grupo foi sensacional para fixar o conteúdo.' },
    { lessonId: lesson3.id, teacherId: teacher4.id, classId: class7A.id, rating: 4,
      comment: 'Para o 7ºA funcionou bem como revisão do fundamental II. Precisei simplificar a parte de gravitação. Os alunos com dificuldades visual utilizaram o modelo tátil com ótimo resultado.' },
    // lesson4 - Revolução Industrial
    { lessonId: lesson4.id, teacherId: teacher3.id, classId: class9B.id, rating: 5,
      comment: 'O 9ºB mostrou excelente senso crítico ao comparar a Revolução Industrial com a era digital atual. A linha do tempo colaborativa no quadro funcionou perfeitamente. Sugiro incluir análise de fonte primária (carta de trabalhador da época).' },
    { lessonId: lesson4.id, teacherId: teacher3.id, classId: class7A.id, rating: 3,
      comment: 'Para o 7ºA o conteúdo ficou denso. Reduzi para causas e consequências principais. Os alunos tiveram dificuldade em contextualizar o século XVIII. Próxima vez vou começar com comparação com a realidade atual.' },
    // lesson5 - Biomas Brasileiros
    { lessonId: lesson5.id, teacherId: teacher3.id, classId: class9B.id, rating: 4,
      comment: 'A turma de 9ºB trouxe muita informação extra sobre desmatamento do Cerrado e Amazônia. Debate muito rico sobre sustentabilidade. O mapa colorido foi a atividade mais eficiente para fixação.' },
    // lesson6 - Equações
    { lessonId: lesson6.id, teacherId: teacher2.id, classId: class7A.id, rating: 4,
      comment: 'Boa aula para o 7ºA. A maioria entendeu o método de isolamento da incógnita. Alguns alunos confundiram com expressões algébricas — recomendo revisar antes de avançar para equações com duas incógnitas.' },
  ] })

  // ── Class Records (Diário) ────────────────────────────────────────────────────
  await prisma.classRecord.createMany({ data: [
    { lessonId: lesson1.id, classId: class5A.id, teacherId: teacher1.id, subjectId: subPortugues.id,  userId: teacherUser1.id, date: new Date(2024, 2, 5),  contentDeveloped: 'Leitura coletiva do cap. 1 de O Pequeno Príncipe. Discussão sobre personagens e cenário.',          observations: 'Turma muito participativa. Bom engajamento.',           pending: 'Alguns alunos precisam terminar a leitura em casa.'  },
    { lessonId: lesson1.id, classId: class5A.id, teacherId: teacher1.id, subjectId: subPortugues.id,  userId: teacherUser1.id, date: new Date(2024, 2, 12), contentDeveloped: 'Questões de interpretação caps. 2-3. Identificação de inferências e informações explícitas.',        observations: 'Dificuldade nas questões de inferência. Retomar na próxima aula.' },
    { lessonId: lesson1.id, classId: class5B.id, teacherId: teacher1.id, subjectId: subPortugues.id,  userId: teacherUser1.id, date: new Date(2024, 2, 6),  contentDeveloped: 'Leitura em voz alta e discussão do cap. 1. Atividade de vocabulário.',                             observations: 'Turma mais tímida para participar oralmente.'                                                            },
    { lessonId: lesson2.id, classId: class5A.id, teacherId: teacher2.id, subjectId: subMatematica.id, userId: teacherUser2.id, date: new Date(2024, 2, 7),  contentDeveloped: 'Introdução a frações com material concreto. Exercícios de identificação de numerador e denominador.', observations: 'Dificuldade inicial, boa evolução ao final.'                                                           },
    { lessonId: lesson2.id, classId: class5A.id, teacherId: teacher2.id, subjectId: subMatematica.id, userId: teacherUser2.id, date: new Date(2024, 2, 14), contentDeveloped: 'Frações equivalentes e simplificação. Lista de exercícios.',                                          observations: 'Aluno Arthur (9) com grande dificuldade de abstração.'                                                  },
    { lessonId: lesson2.id, classId: class5B.id, teacherId: teacher2.id, subjectId: subMatematica.id, userId: teacherUser2.id, date: new Date(2024, 2, 8),  contentDeveloped: 'Frações com pizza. Conceito de parte e todo.',                                                        observations: 'Alunos muito animados com o material concreto.'                                                         },
    { lessonId: lesson3.id, classId: class9B.id, teacherId: teacher4.id, subjectId: subCiencias.id,   userId: teacherUser4.id, date: new Date(2024, 3, 3),  contentDeveloped: 'Vídeo NASA + mapa mental coletivo do sistema solar.',                                                  observations: 'Turma muito interessada. Muitas perguntas.',                adaptations: 'Material em relevo para aluno com DV.'             },
    { lessonId: lesson3.id, classId: class9B.id, teacherId: teacher4.id, subjectId: subCiencias.id,   userId: teacherUser4.id, date: new Date(2024, 3, 10), contentDeveloped: 'Características dos planetas. Cálculo de distâncias e comparação de tamanhos.',                       observations: 'Excelente participação. Discussão sobre exoplanetas.'                                                   },
    { lessonId: lesson3.id, classId: class7A.id, teacherId: teacher4.id, subjectId: subCiencias.id,   userId: teacherUser4.id, date: new Date(2024, 3, 4),  contentDeveloped: 'Introdução ao sistema solar. Movimentos de rotação e translação.',                                   observations: 'Alunos confundiram rotação e translação inicialmente.'                                                  },
    { lessonId: lesson4.id, classId: class9B.id, teacherId: teacher3.id, subjectId: subHistoria.id,   userId: teacherUser3.id, date: new Date(2024, 3, 15), contentDeveloped: 'Causas da Rev. Industrial: feudalismo → capitalismo mercantil → industrial.',                          observations: 'Alunos fizeram ótimas conexões com o mundo atual.'                                                     },
    { lessonId: lesson4.id, classId: class9B.id, teacherId: teacher3.id, subjectId: subHistoria.id,   userId: teacherUser3.id, date: new Date(2024, 3, 22), contentDeveloped: 'Consequências: urbanização, proletariado, condições de trabalho.',                                     observations: 'Debate rico sobre trabalho infantil ontem e hoje.'                                                     },
    { lessonId: lesson4.id, classId: class7A.id, teacherId: teacher3.id, subjectId: subHistoria.id,   userId: teacherUser3.id, date: new Date(2024, 3, 16), contentDeveloped: 'Revolução Industrial: causas e invenções principais.',                                                 observations: 'Conteúdo simplificado. Foco nas máquinas a vapor.'                                                     },
    { lessonId: lesson5.id, classId: class9B.id, teacherId: teacher3.id, subjectId: subGeografia.id,  userId: teacherUser3.id, date: new Date(2024, 4, 8),  contentDeveloped: 'Amazônia e Cerrado: características, fauna e flora. Debate sobre desmatamento.',                      observations: 'Alunos trouxeram notícias recentes sobre queimadas.'                                                   },
    { lessonId: lesson5.id, classId: class9B.id, teacherId: teacher3.id, subjectId: subGeografia.id,  userId: teacherUser3.id, date: new Date(2024, 4, 15), contentDeveloped: 'Pantanal, Mata Atlântica, Caatinga e Pampa. Mapa colorido.',                                           observations: 'Excelente engajamento na atividade cartográfica.'                                                      },
    { lessonId: lesson6.id, classId: class7A.id, teacherId: teacher2.id, subjectId: subMatematica.id, userId: teacherUser2.id, date: new Date(2024, 4, 8),  contentDeveloped: 'Equação do 1º grau: conceito de incógnita e resolução por isolamento.',                               observations: '5 alunos precisam de reforço. Agendado contraturno.'                                                   },
  ] })

  // ── Homework ──────────────────────────────────────────────────────────────────
  const hw1 = await prisma.homework.create({ data: { title: 'Interpretação - O Pequeno Príncipe', instructions: 'Responda às questões 1-8 sobre os caps. 1-3 de O Pequeno Príncipe.', lessonId: lesson1.id, classId: class5A.id, subjectId: subPortugues.id,  dueDate: new Date(2024, 2, 12), externalId: 'WAY-PORT-001' } })
  const hw2 = await prisma.homework.create({ data: { title: 'Lista de Frações e Porcentagem',    instructions: 'Resolver os exercícios 1-10 da lista de frações e porcentagem.', lessonId: lesson2.id, classId: class5A.id, subjectId: subMatematica.id, dueDate: new Date(2024, 2, 14), externalId: 'WAY-MAT-002' } })
  const hw3 = await prisma.homework.create({ data: { title: 'Pesquisa sobre Planetas',           instructions: 'Escolha um planeta e faça pesquisa de 1 página.',                 lessonId: lesson3.id, classId: class9B.id, subjectId: subCiencias.id,   dueDate: new Date(2024, 3, 10), externalId: 'WAY-CIE-003' } })
  const hw4 = await prisma.homework.create({ data: { title: 'Linha do Tempo - Rev. Industrial',  instructions: 'Linha do tempo com eventos principais 1760-1840.',                lessonId: lesson4.id, classId: class9B.id, subjectId: subHistoria.id,   dueDate: new Date(2024, 3, 17), externalId: 'WAY-HIS-004' } })
  const hw5 = await prisma.homework.create({ data: { title: 'Mapa dos Biomas Brasileiros',       instructions: 'Identificar e colorir os biomas no mapa mudo do Brasil.',          lessonId: lesson5.id, classId: class9B.id, subjectId: subGeografia.id,  dueDate: new Date(2024, 4, 13), externalId: 'WAY-GEO-005' } })

  // Homework Submissions
  await prisma.homeworkSubmission.createMany({ data: [
    ...students5A.slice(0, 8).map(s => ({ homeworkId: hw1.id, studentId: s.id, submittedAt: new Date(2024, 2, 11), waygroundStatus: 'CONCLUIDA' })),
    ...students5A.slice(0, 6).map(s => ({ homeworkId: hw2.id, studentId: s.id, submittedAt: new Date(2024, 2, 13), waygroundStatus: 'CONCLUIDA' })),
    ...students9B.slice(0, 8).map(s => ({ homeworkId: hw3.id, studentId: s.id, submittedAt: new Date(2024, 3, 9),  waygroundStatus: 'CONCLUIDA' })),
    ...students9B.slice(0, 9).map(s => ({ homeworkId: hw4.id, studentId: s.id, submittedAt: new Date(2024, 3, 16), waygroundStatus: 'CONCLUIDA' })),
    ...students9B.slice(0, 7).map(s => ({ homeworkId: hw5.id, studentId: s.id, submittedAt: new Date(2024, 4, 12), waygroundStatus: 'CONCLUIDA' })),
  ] })

  // ── Assessments ───────────────────────────────────────────────────────────────
  const assess1  = await prisma.assessment.create({ data: { name: 'Avaliação Bimestral - Português 1B',  subjectId: subPortugues.id,  classId: class5A.id, period: '1º Bimestre', weight: 2.0, type: 'PROVA',    date: new Date(2024, 2, 28), maxScore: 10 } })
  const assess2  = await prisma.assessment.create({ data: { name: 'Trabalho de Frações',                 subjectId: subMatematica.id, classId: class5A.id, period: '1º Bimestre', weight: 1.0, type: 'TRABALHO', date: new Date(2024, 2, 22), maxScore: 10 } })
  const assess3  = await prisma.assessment.create({ data: { name: 'Avaliação - Português 1B',            subjectId: subPortugues.id,  classId: class5B.id, period: '1º Bimestre', weight: 2.0, type: 'PROVA',    date: new Date(2024, 2, 28), maxScore: 10 } })
  const assess4  = await prisma.assessment.create({ data: { name: 'Prova de Frações - 5B',               subjectId: subMatematica.id, classId: class5B.id, period: '1º Bimestre', weight: 2.0, type: 'PROVA',    date: new Date(2024, 2, 22), maxScore: 10 } })
  const assess5  = await prisma.assessment.create({ data: { name: 'Seminário - Revolução Industrial',    subjectId: subHistoria.id,   classId: class9B.id, period: '2º Bimestre', weight: 1.5, type: 'SEMINARIO', date: new Date(2024, 3, 26), maxScore: 10 } })
  const assess6  = await prisma.assessment.create({ data: { name: 'Avaliação Ciências - Sistema Solar',  subjectId: subCiencias.id,   classId: class9B.id, period: '2º Bimestre', weight: 2.0, type: 'PROVA',    date: new Date(2024, 3, 25), maxScore: 10 } })
  const assess7  = await prisma.assessment.create({ data: { name: 'Avaliação Ciências - 7A',             subjectId: subCiencias.id,   classId: class7A.id, period: '2º Bimestre', weight: 2.0, type: 'PROVA',    date: new Date(2024, 3, 24), maxScore: 10 } })
  const assess8  = await prisma.assessment.create({ data: { name: 'Prova de Equações - 7A',              subjectId: subMatematica.id, classId: class7A.id, period: '2º Bimestre', weight: 2.0, type: 'PROVA',    date: new Date(2024, 4, 20), maxScore: 10 } })

  // Grade Records
  const makeGrades = async (assessmentId: string, students: typeof students5A, teacherId: string, userId: string, scores: number[]) => {
    await Promise.all(students.map((s, i) => prisma.gradeRecord.create({
      data: { assessmentId, studentId: s.id, teacherId, userId, score: scores[i] ?? 6.0, observations: scores[i] < 5 ? 'Necessita reforço' : null }
    })))
  }

  await makeGrades(assess1.id,  students5A, teacher1.id, teacherUser1.id, [8.5, 7.0, 9.0, 6.5, 8.0, 7.5, 9.5, 4.5, 8.5, 7.0])
  await makeGrades(assess2.id,  students5A, teacher2.id, teacherUser2.id, [7.0, 8.5, 9.0, 5.5, 7.5, 8.0, 6.0, 4.0, 7.0, 8.0])
  await makeGrades(assess3.id,  students5B, teacher1.id, teacherUser1.id, [7.5, 6.0, 8.5, 7.0, 9.0, 5.5, 6.5, 8.0, 3.5, 7.5])
  await makeGrades(assess4.id,  students5B, teacher2.id, teacherUser2.id, [6.5, 7.0, 8.0, 6.0, 7.5, 5.0, 7.0, 8.5, 4.0, 6.0])
  await makeGrades(assess5.id,  students9B, teacher3.id, teacherUser3.id, [9.0, 8.5, 7.5, 8.0, 6.5, 9.0, 7.0, 8.5, 6.0, 9.5])
  await makeGrades(assess6.id,  students9B, teacher4.id, teacherUser4.id, [8.0, 9.0, 7.0, 8.5, 6.0, 9.5, 7.5, 8.0, 5.5, 9.0])
  await makeGrades(assess7.id,  students7A, teacher4.id, teacherUser4.id, [7.0, 9.0, 6.5, 8.0, 7.5, 8.5, 6.0, 7.0, 8.0, 7.5])
  await makeGrades(assess8.id,  students7A, teacher2.id, teacherUser2.id, [6.0, 8.5, 5.5, 7.5, 7.0, 8.0, 5.0, 6.5, 7.5, 7.0])

  // ── Pedagogical Records ───────────────────────────────────────────────────────
  await prisma.pedagogicalRecord.createMany({ data: [
    { studentId: students5A[3].id, pedagogueId: pedagogoUser.id, type: 'OBSERVACAO', title: 'Dificuldades de concentração', content: 'Aluna apresenta dificuldades de concentração, especialmente nas tardes. Professores relatam agitação frequente.', date: new Date(2024, 2, 15), confidentiality: 'RESTRITO',     actionPlan: 'Conversar com a família. Solicitar avaliação neuropsicológica.' },
    { studentId: students5A[3].id, pedagogueId: pedagogoUser.id, type: 'REUNIAO',    title: 'Reunião com família',          content: 'Pais relataram que aluna dorme tarde por causa de jogos eletrônicos.',                                             date: new Date(2024, 2, 22), confidentiality: 'RESTRITO',     actionPlan: 'Família comprometeu-se com rotina de sono.' },
    { studentId: students5A[7].id, pedagogueId: pedagogoUser.id, type: 'OBSERVACAO', title: 'Baixo rendimento em Matemática', content: 'Aluno com dificuldade severa em operações básicas. Score abaixo da média em todas as avaliações.',               date: new Date(2024, 2, 28), confidentiality: 'RESTRITO',     actionPlan: 'Encaminhar para reforço no contraturno.' },
    { studentId: students5B[8].id, pedagogueId: pedagogoUser.id, type: 'OBSERVACAO', title: 'Processo de transferência',    content: 'Aluno em processo de transferência para outra escola. Documentação em andamento.',                                   date: new Date(2024, 4, 10), confidentiality: 'RESTRITO',     actionPlan: 'Emitir histórico escolar. Confirmar nova escola.' },
    { studentId: students7A[0].id, pedagogueId: pedagogoUser.id, type: 'ATENDIMENTO', title: 'Suporte emocional',           content: 'Aluno relatou dificuldades de adaptação à nova turma após transferência de escola no ano anterior.',                date: new Date(2024, 1, 20), confidentiality: 'CONFIDENCIAL', actionPlan: 'Acompanhamento quinzenal. Integrar em atividades em grupo.' },
    { studentId: students9B[1].id, pedagogueId: pedagogoUser.id, type: 'ATENDIMENTO', title: 'Atendimento individual',      content: 'Aluna relatou dificuldades de relacionamento com colegas. Episódio de conflito no intervalo.',                       date: new Date(2024, 3, 5),  confidentiality: 'CONFIDENCIAL', actionPlan: 'Mediar situação em grupo. Acompanhar por 30 dias.' },
    { studentId: students9B[4].id, pedagogueId: pedagogoUser.id, type: 'ADVERTENCIA', title: 'Advertência - Comportamento', content: 'Aluno recebeu advertência verbal por comportamento inadequado durante aula de Ciências.',                           date: new Date(2024, 3, 8),  confidentiality: 'RESTRITO'                                                                    },
    { studentId: students9B[4].id, pedagogueId: pedagogoUser.id, type: 'REUNIAO',    title: 'Reunião pós-advertência',      content: 'Reunião com responsável. Pai comprometeu-se em conversar com o filho. Situação encaminhada.',                       date: new Date(2024, 3, 15), confidentiality: 'RESTRITO',     actionPlan: 'Monitorar comportamento nas próximas semanas.', resolved: true },
    { studentId: students9B[6].id, pedagogueId: pedagogoUser.id, type: 'OBSERVACAO', title: 'Excelência acadêmica',         content: 'Aluno com desempenho destacado em todas as disciplinas. Candidato a representar a escola na Olimpíada de Matemática.', date: new Date(2024, 4, 5), confidentiality: 'PUBLICO'                                                                     },
    { studentId: students7A[1].id, pedagogueId: pedagogoUser.id, type: 'OBSERVACAO', title: 'Aluna destaque',               content: 'Aluna demonstra liderança natural e excelente desempenho. Indicada para monitoria de Ciências.',                    date: new Date(2024, 3, 20), confidentiality: 'PUBLICO'                                                                     },
    { studentId: students5A[1].id, pedagogueId: pedagogoUser.id, type: 'OBSERVACAO', title: 'Talento em escrita criativa',  content: 'Aluna demonstrou talento excepcional em produção textual. Textos com vocabulário e criatividade acima da média.',   date: new Date(2024, 2, 20), confidentiality: 'PUBLICO'                                                                     },
    { studentId: students5B[4].id, pedagogueId: pedagogoUser.id, type: 'ATENDIMENTO', title: 'Dificuldade de leitura',      content: 'Aluno com indicativo de dislexia. Leitura muito lenta e troca de letras frequente.',                                date: new Date(2024, 3, 12), confidentiality: 'RESTRITO',     actionPlan: 'Encaminhar para avaliação fonoaudiológica. Adaptações curriculares.' },
  ] })

  // ── SAEB Descriptors ──────────────────────────────────────────────────────────
  // 5º Ano - LP
  const lpD1  = await prisma.saebDescriptor.create({ data: { code: 'LP-D1',  description: 'Localizar informações explícitas em um texto',                                    area: 'Língua Portuguesa', level: '5º Ano' } })
  const lpD3  = await prisma.saebDescriptor.create({ data: { code: 'LP-D3',  description: 'Inferir o sentido de uma palavra ou expressão',                                   area: 'Língua Portuguesa', level: '5º Ano' } })
  const lpD4  = await prisma.saebDescriptor.create({ data: { code: 'LP-D4',  description: 'Inferir uma informação implícita em um texto',                                    area: 'Língua Portuguesa', level: '5º Ano' } })
  const lpD6  = await prisma.saebDescriptor.create({ data: { code: 'LP-D6',  description: 'Identificar o tema de um texto',                                                  area: 'Língua Portuguesa', level: '5º Ano' } })
  const lpD11 = await prisma.saebDescriptor.create({ data: { code: 'LP-D11', description: 'Identificar o conflito gerador do enredo e os elementos que constroem a narrativa', area: 'Língua Portuguesa', level: '5º Ano' } })
  const lpD13 = await prisma.saebDescriptor.create({ data: { code: 'LP-D13', description: 'Distinguir um fato da opinião relativa a esse fato',                               area: 'Língua Portuguesa', level: '5º Ano' } })
  // 5º Ano - MT
  const mtD3  = await prisma.saebDescriptor.create({ data: { code: 'MT-D3',  description: 'Resolver problemas com números naturais envolvendo operações',                    area: 'Matemática', level: '5º Ano' } })
  const mtD7  = await prisma.saebDescriptor.create({ data: { code: 'MT-D7',  description: 'Calcular a porcentagem de um número',                                             area: 'Matemática', level: '5º Ano' } })
  const mtD14 = await prisma.saebDescriptor.create({ data: { code: 'MT-D14', description: 'Resolver problemas envolvendo medidas de comprimento',                            area: 'Matemática', level: '5º Ano' } })
  const mtD17 = await prisma.saebDescriptor.create({ data: { code: 'MT-D17', description: 'Resolver problemas envolvendo cálculo de área de figuras planas',                 area: 'Matemática', level: '5º Ano' } })
  const mtD27 = await prisma.saebDescriptor.create({ data: { code: 'MT-D27', description: 'Analisar informações expressas em gráficos ou tabelas',                           area: 'Matemática', level: '5º Ano' } })
  // 9º Ano - LP
  const lp9D9  = await prisma.saebDescriptor.create({ data: { code: 'LP9-D9',  description: 'Identificar a tese de um texto',                                               area: 'Língua Portuguesa', level: '9º Ano' } })
  const lp9D10 = await prisma.saebDescriptor.create({ data: { code: 'LP9-D10', description: 'Reconhecer os argumentos que sustentam a tese do texto',                       area: 'Língua Portuguesa', level: '9º Ano' } })
  const lp9D14 = await prisma.saebDescriptor.create({ data: { code: 'LP9-D14', description: 'Distinguir fato de opinião em textos argumentativos',                          area: 'Língua Portuguesa', level: '9º Ano' } })
  const lp9D15 = await prisma.saebDescriptor.create({ data: { code: 'LP9-D15', description: 'Reconhecer recursos linguísticos que compõem um texto argumentativo',          area: 'Língua Portuguesa', level: '9º Ano' } })
  // 9º Ano - MT
  const mt9D22 = await prisma.saebDescriptor.create({ data: { code: 'MT9-D22', description: 'Calcular o valor numérico de uma expressão algébrica',                         area: 'Matemática', level: '9º Ano' } })
  const mt9D24 = await prisma.saebDescriptor.create({ data: { code: 'MT9-D24', description: 'Resolver equação do 2º grau',                                                  area: 'Matemática', level: '9º Ano' } })
  const mt9D26 = await prisma.saebDescriptor.create({ data: { code: 'MT9-D26', description: 'Resolver problemas envolvendo o teorema de Pitágoras',                         area: 'Matemática', level: '9º Ano' } })
  const mt9D28 = await prisma.saebDescriptor.create({ data: { code: 'MT9-D28', description: 'Resolver problema envolvendo noções de probabilidade',                         area: 'Matemática', level: '9º Ano' } })
  const mt9D30 = await prisma.saebDescriptor.create({ data: { code: 'MT9-D30', description: 'Aplicar relações métricas para a resolução de problemas que envolvam figuras planas', area: 'Matemática', level: '9º Ano' } })

  // ── ENEM Competencies ─────────────────────────────────────────────────────────
  const mtC1 = await prisma.enemCompetency.create({ data: { code: 'MT-C1', description: 'Construir significados para os números naturais, inteiros, racionais e reais',       area: 'Matemática e suas Tecnologias',          type: 'COMPETENCIA' } })
  const mtC2 = await prisma.enemCompetency.create({ data: { code: 'MT-C2', description: 'Utilizar o conhecimento geométrico para leitura e representação da realidade',       area: 'Matemática e suas Tecnologias',          type: 'COMPETENCIA' } })
  const mtC3 = await prisma.enemCompetency.create({ data: { code: 'MT-C3', description: 'Construir noções de grandezas e medidas para a compreensão da realidade',            area: 'Matemática e suas Tecnologias',          type: 'COMPETENCIA' } })
  const lcC1 = await prisma.enemCompetency.create({ data: { code: 'LC-C1', description: 'Aplicar as tecnologias da comunicação e da informação na escola, no trabalho',       area: 'Linguagens, Códigos e suas Tecnologias', type: 'COMPETENCIA' } })
  const lcC5 = await prisma.enemCompetency.create({ data: { code: 'LC-C5', description: 'Analisar, interpretar e aplicar recursos expressivos das linguagens',                area: 'Linguagens, Códigos e suas Tecnologias', type: 'COMPETENCIA' } })
  const cnC1 = await prisma.enemCompetency.create({ data: { code: 'CN-C1', description: 'Compreender as ciências naturais e tecnologias como construções humanas históricas', area: 'Ciências da Natureza e suas Tecnologias', type: 'COMPETENCIA' } })
  const cnC3 = await prisma.enemCompetency.create({ data: { code: 'CN-C3', description: 'Associar intervenções que resultam em degradação ou conservação ambiental',          area: 'Ciências da Natureza e suas Tecnologias', type: 'COMPETENCIA' } })
  const cnC4 = await prisma.enemCompetency.create({ data: { code: 'CN-C4', description: 'Compreender interações entre organismos e ambiente relacionadas à saúde humana',     area: 'Ciências da Natureza e suas Tecnologias', type: 'COMPETENCIA' } })
  const chC1 = await prisma.enemCompetency.create({ data: { code: 'CH-C1', description: 'Compreender os elementos culturais que constituem as identidades',                   area: 'Ciências Humanas e suas Tecnologias',     type: 'COMPETENCIA' } })
  const chC2 = await prisma.enemCompetency.create({ data: { code: 'CH-C2', description: 'Compreender as transformações dos espaços geográficos como produto das relações socioeconômicas', area: 'Ciências Humanas e suas Tecnologias', type: 'COMPETENCIA' } })
  const chC3 = await prisma.enemCompetency.create({ data: { code: 'CH-C3', description: 'Compreender a produção e o papel histórico das instituições sociais, políticas e econômicas', area: 'Ciências Humanas e suas Tecnologias', type: 'COMPETENCIA' } })
  const chC4 = await prisma.enemCompetency.create({ data: { code: 'CH-C4', description: 'Entender as transformações técnicas e tecnológicas e seu impacto nos processos de produção', area: 'Ciências Humanas e suas Tecnologias', type: 'COMPETENCIA' } })
  const chC5 = await prisma.enemCompetency.create({ data: { code: 'CH-C5', description: 'Utilizar os conhecimentos históricos para compreender e valorizar os fundamentos da cidadania', area: 'Ciências Humanas e suas Tecnologias', type: 'COMPETENCIA' } })

  // ── Student SAEB Performance (5ºA + 5ºB + 9ºB) ───────────────────────────────
  const saebLevel = (s: number) => s >= 7 ? 'ADEQUADO' : s >= 5 ? 'BASICO' : 'ABAIXO_BASICO'

  const saebDataLP5A = [ // [descriptor, scores per student]
    [lpD1,  [8, 7, 9, 5, 8, 7, 9, 4, 8, 6]],
    [lpD3,  [7, 6, 8, 4, 7, 8, 9, 5, 7, 6]],
    [lpD4,  [6, 5, 7, 3, 6, 7, 8, 4, 6, 5]],
    [lpD6,  [9, 8, 9, 6, 8, 8, 10, 5, 9, 7]],
    [lpD11, [7, 6, 8, 4, 7, 7, 8, 4, 7, 6]],
    [lpD13, [6, 5, 7, 3, 6, 6, 7, 4, 6, 5]],
  ] as [typeof lpD1, number[]][]

  const saebDataMT5A = [
    [mtD3,  [8, 7, 9, 5, 7, 8, 9, 5, 8, 7]],
    [mtD7,  [6, 7, 8, 4, 6, 7, 8, 4, 7, 6]],
    [mtD14, [7, 6, 8, 4, 7, 7, 8, 4, 7, 6]],
    [mtD17, [5, 6, 7, 3, 6, 6, 7, 3, 6, 5]],
    [mtD27, [8, 7, 9, 5, 7, 8, 9, 5, 8, 6]],
  ] as [typeof mtD3, number[]][]

  for (const [desc, scores] of saebDataLP5A) {
    for (let i = 0; i < students5A.length; i++) {
      await prisma.studentSaebPerformance.create({ data: { studentId: students5A[i].id, descriptorId: desc.id, score: scores[i], level: saebLevel(scores[i]), year: 2024 } })
    }
  }
  for (const [desc, scores] of saebDataMT5A) {
    for (let i = 0; i < students5A.length; i++) {
      await prisma.studentSaebPerformance.create({ data: { studentId: students5A[i].id, descriptorId: desc.id, score: scores[i], level: saebLevel(scores[i]), year: 2024 } })
    }
  }

  // 5ºB SAEB
  const saebDataLP5B = [
    [lpD1,  [7, 5, 8, 6, 9, 4, 6, 8, 3, 7]],
    [lpD4,  [6, 4, 7, 5, 8, 3, 5, 7, 2, 6]],
    [lpD6,  [8, 6, 9, 7, 9, 5, 7, 9, 4, 8]],
    [lpD11, [6, 5, 7, 6, 8, 4, 5, 7, 3, 6]],
  ] as [typeof lpD1, number[]][]
  for (const [desc, scores] of saebDataLP5B) {
    for (let i = 0; i < students5B.length; i++) {
      await prisma.studentSaebPerformance.create({ data: { studentId: students5B[i].id, descriptorId: desc.id, score: scores[i], level: saebLevel(scores[i]), year: 2024 } })
    }
  }

  // 9ºB SAEB
  const saebData9B = [
    [lp9D9,  [7, 8, 6, 8, 5, 9, 7, 8, 4, 9]],
    [lp9D10, [6, 8, 5, 7, 4, 8, 6, 7, 3, 8]],
    [lp9D14, [7, 7, 6, 8, 5, 9, 6, 8, 4, 9]],
    [lp9D15, [6, 7, 5, 7, 4, 8, 6, 7, 3, 8]],
    [mt9D22, [8, 7, 7, 8, 5, 9, 8, 7, 3, 9]],
    [mt9D24, [7, 6, 6, 7, 4, 8, 7, 6, 2, 8]],
    [mt9D26, [6, 6, 5, 7, 4, 8, 6, 6, 2, 8]],
    [mt9D28, [7, 7, 6, 8, 5, 9, 7, 7, 3, 9]],
    [mt9D30, [6, 6, 5, 7, 4, 8, 6, 6, 2, 8]],
  ] as [typeof lp9D9, number[]][]
  for (const [desc, scores] of saebData9B) {
    for (let i = 0; i < students9B.length; i++) {
      await prisma.studentSaebPerformance.create({ data: { studentId: students9B[i].id, descriptorId: desc.id, score: scores[i], level: saebLevel(scores[i]), year: 2024 } })
    }
  }

  // ── Student ENEM Performance (9ºB) ───────────────────────────────────────────
  const enemData9B: [typeof mtC1, number[]][] = [
    [mtC1,  [620, 580, 710, 540, 480, 690, 650, 520, 430, 720]],
    [mtC2,  [590, 560, 680, 510, 460, 670, 620, 490, 400, 700]],
    [mtC3,  [610, 570, 700, 530, 470, 680, 640, 510, 420, 710]],
    [lcC1,  [650, 610, 720, 560, 500, 710, 670, 540, 460, 730]],
    [lcC5,  [670, 630, 740, 580, 520, 730, 690, 560, 480, 750]],
    [cnC1,  [600, 575, 695, 525, 465, 685, 635, 505, 415, 705]],
    [cnC3,  [585, 560, 680, 510, 450, 670, 620, 490, 400, 690]],
    [cnC4,  [595, 570, 690, 520, 460, 680, 630, 500, 410, 700]],
    [chC1,  [630, 600, 720, 550, 490, 710, 660, 530, 440, 720]],
    [chC2,  [620, 590, 710, 540, 480, 700, 650, 520, 430, 710]],
    [chC3,  [610, 580, 700, 530, 470, 690, 640, 510, 420, 700]],
    [chC4,  [600, 570, 690, 520, 460, 680, 630, 500, 410, 690]],
    [chC5,  [640, 610, 730, 560, 500, 720, 670, 540, 450, 730]],
  ]
  for (const [comp, scores] of enemData9B) {
    for (let i = 0; i < students9B.length; i++) {
      await prisma.studentEnemPerformance.create({ data: { studentId: students9B[i].id, competencyId: comp.id, score: scores[i], year: 2024 } })
    }
  }

  // ── Wayground Activities ──────────────────────────────────────────────────────
  const act1 = await prisma.waygroundActivity.create({ data: { externalId: 'ACT-001', homeworkId: hw1.id, title: 'Interpretação de Texto - O Pequeno Príncipe', totalQuestions: 8  } })
  const act2 = await prisma.waygroundActivity.create({ data: { externalId: 'ACT-002', homeworkId: hw2.id, title: 'Frações e Porcentagem',                        totalQuestions: 10 } })
  const act3 = await prisma.waygroundActivity.create({ data: { externalId: 'ACT-003', homeworkId: hw3.id, title: 'Sistema Solar',                                totalQuestions: 6  } })
  const act4 = await prisma.waygroundActivity.create({ data: { externalId: 'ACT-004', homeworkId: hw4.id, title: 'Revolução Industrial',                         totalQuestions: 8  } })
  const act5 = await prisma.waygroundActivity.create({ data: { externalId: 'ACT-005', homeworkId: hw5.id, title: 'Biomas Brasileiros',                           totalQuestions: 7  } })

  // Activity → Skill Links
  await prisma.activitySkillLink.createMany({ data: [
    // ACT-001: Interpretação LP
    { activityId: act1.id, saebDescriptorId: lpD1.id  },
    { activityId: act1.id, saebDescriptorId: lpD4.id  },
    { activityId: act1.id, saebDescriptorId: lpD6.id  },
    { activityId: act1.id, saebDescriptorId: lpD11.id },
    // per-question links for ACT-001
    { activityId: act1.id, questionNumber: 1, saebDescriptorId: lpD1.id  },
    { activityId: act1.id, questionNumber: 3, saebDescriptorId: lpD4.id  },
    { activityId: act1.id, questionNumber: 5, saebDescriptorId: lpD6.id  },
    { activityId: act1.id, questionNumber: 7, saebDescriptorId: lpD11.id },
    // ACT-002: Frações MT
    { activityId: act2.id, saebDescriptorId: mtD3.id  },
    { activityId: act2.id, saebDescriptorId: mtD7.id  },
    { activityId: act2.id, saebDescriptorId: mtD14.id },
    { activityId: act2.id, saebDescriptorId: mtD27.id },
    { activityId: act2.id, questionNumber: 1, saebDescriptorId: mtD3.id  },
    { activityId: act2.id, questionNumber: 4, saebDescriptorId: mtD7.id  },
    { activityId: act2.id, questionNumber: 7, saebDescriptorId: mtD14.id },
    { activityId: act2.id, questionNumber: 9, saebDescriptorId: mtD27.id },
    // ACT-003: Sistema Solar CN/MT
    { activityId: act3.id, enemCompetencyId: cnC1.id },
    { activityId: act3.id, enemCompetencyId: cnC4.id },
    { activityId: act3.id, enemCompetencyId: mtC3.id },
    { activityId: act3.id, questionNumber: 1, enemCompetencyId: cnC1.id },
    { activityId: act3.id, questionNumber: 3, enemCompetencyId: cnC4.id },
    { activityId: act3.id, questionNumber: 5, enemCompetencyId: mtC3.id },
    // ACT-004: Rev. Industrial CH
    { activityId: act4.id, enemCompetencyId: chC3.id },
    { activityId: act4.id, enemCompetencyId: chC4.id },
    { activityId: act4.id, enemCompetencyId: chC1.id },
    { activityId: act4.id, questionNumber: 2, enemCompetencyId: chC3.id },
    { activityId: act4.id, questionNumber: 4, enemCompetencyId: chC4.id },
    { activityId: act4.id, questionNumber: 6, enemCompetencyId: chC1.id },
    // ACT-005: Biomas CN/LC
    { activityId: act5.id, enemCompetencyId: cnC3.id },
    { activityId: act5.id, enemCompetencyId: cnC4.id },
    { activityId: act5.id, enemCompetencyId: lcC5.id },
    { activityId: act5.id, questionNumber: 2, enemCompetencyId: cnC3.id },
    { activityId: act5.id, questionNumber: 4, enemCompetencyId: cnC4.id },
    { activityId: act5.id, questionNumber: 6, enemCompetencyId: lcC5.id },
  ] })

  // ── Wayground Student Results ─────────────────────────────────────────────────
  // ACT-001: 5ºA students (8 questions)
  // accuracy per student: [0.88, 0.75, 0.88, 0.63, 0.75, 0.75, 1.0, 0.5, 0.75, 0.63]
  const act1Pct = [0.88, 0.75, 0.88, 0.63, 0.75, 0.75, 1.0, 0.5, 0.75, 0.63]
  for (let i = 0; i < students5A.length; i++) {
    const { results, correct } = genQuestionResults(8, act1Pct[i], i)
    await prisma.waygroundStudentResult.create({ data: {
      activityId: act1.id, studentId: students5A[i].id,
      correctAnswers: correct, totalQuestions: 8,
      accuracy: Math.round((correct / 8) * 100),
      score: parseFloat(((correct / 8) * 10).toFixed(1)),
      completedAt: new Date(2024, 2, 11),
      timeSpentSeconds: 600 + i * 45,
      questionResults: results,
    } })
  }

  // ACT-002: 5ºA students (10 questions)
  const act2Pct = [0.7, 0.8, 0.9, 0.5, 0.7, 0.8, 0.6, 0.4, 0.7, 0.8]
  for (let i = 0; i < students5A.length; i++) {
    const { results, correct } = genQuestionResults(10, act2Pct[i], i)
    await prisma.waygroundStudentResult.create({ data: {
      activityId: act2.id, studentId: students5A[i].id,
      correctAnswers: correct, totalQuestions: 10,
      accuracy: Math.round((correct / 10) * 100),
      score: parseFloat(((correct / 10) * 10).toFixed(1)),
      completedAt: new Date(2024, 2, 13),
      timeSpentSeconds: 720 + i * 30,
      questionResults: results,
    } })
  }

  // ACT-003: 9ºB students (6 questions)
  const act3Pct = [0.83, 1.0, 0.67, 0.83, 0.5, 1.0, 0.83, 0.83, 0.33, 1.0]
  for (let i = 0; i < students9B.length; i++) {
    const { results, correct } = genQuestionResults(6, act3Pct[i], i)
    await prisma.waygroundStudentResult.create({ data: {
      activityId: act3.id, studentId: students9B[i].id,
      correctAnswers: correct, totalQuestions: 6,
      accuracy: Math.round((correct / 6) * 100),
      score: parseFloat(((correct / 6) * 10).toFixed(1)),
      completedAt: new Date(2024, 3, 9),
      timeSpentSeconds: 480 + i * 25,
      questionResults: results,
    } })
  }

  // ACT-004: 9ºB students (8 questions)
  const act4Pct = [0.88, 0.75, 0.63, 0.75, 0.5, 1.0, 0.75, 0.88, 0.5, 1.0]
  for (let i = 0; i < students9B.length; i++) {
    const { results, correct } = genQuestionResults(8, act4Pct[i], i)
    await prisma.waygroundStudentResult.create({ data: {
      activityId: act4.id, studentId: students9B[i].id,
      correctAnswers: correct, totalQuestions: 8,
      accuracy: Math.round((correct / 8) * 100),
      score: parseFloat(((correct / 8) * 10).toFixed(1)),
      completedAt: new Date(2024, 3, 16),
      timeSpentSeconds: 600 + i * 35,
      questionResults: results,
    } })
  }

  // ACT-005: 9ºB students (7 questions)
  const act5Pct = [0.86, 0.71, 0.57, 0.86, 0.43, 1.0, 0.71, 0.86, 0.43, 1.0]
  for (let i = 0; i < students9B.length; i++) {
    const { results, correct } = genQuestionResults(7, act5Pct[i], i)
    await prisma.waygroundStudentResult.create({ data: {
      activityId: act5.id, studentId: students9B[i].id,
      correctAnswers: correct, totalQuestions: 7,
      accuracy: Math.round((correct / 7) * 100),
      score: parseFloat(((correct / 7) * 10).toFixed(1)),
      completedAt: new Date(2024, 4, 12),
      timeSpentSeconds: 560 + i * 20,
      questionResults: results,
    } })
  }

  // ── Wayground Question Stats (aggregated from student results) ────────────────
  // ACT-001: 8 questions — compute from act1Pct over 10 students
  // Q: correctCount = sum of students who got q correct
  // Per question accuracy pattern based on genQuestionResults logic
  const computeQuestionStats = (numQ: number, pcts: number[], numStudents: number) => {
    const stats: { q: number; correct: number; total: number }[] = Array.from({ length: numQ }, (_, q) => ({ q: q + 1, correct: 0, total: numStudents }))
    for (let si = 0; si < numStudents; si++) {
      const offset = si % 3
      const pattern = [true, true, false, true, false, true, true, false, true, true]
      const pct = pcts[si]
      for (let q = 0; q < numQ; q++) {
        const idx = (q + offset) % pattern.length
        const isCorrect = pct >= 0.8 ? true : pct >= 0.6 ? pattern[idx] : pct >= 0.4 ? !pattern[idx] : (q + 1) % 3 !== 0
        if (isCorrect) stats[q].correct++
      }
    }
    return stats
  }

  const act1Stats = computeQuestionStats(8, act1Pct, 10)
  const act2Stats = computeQuestionStats(10, act2Pct, 10)
  const act3Stats = computeQuestionStats(6, act3Pct, 10)
  const act4Stats = computeQuestionStats(8, act4Pct, 10)
  const act5Stats = computeQuestionStats(7, act5Pct, 10)

  // ACT-001 question descriptions and skill links
  const act1QDesc = ['Identificar o personagem principal',   'Localizar informação explícita',       'Inferir sentimento do personagem',
                     'Identificar o tema central',          'Analisar comportamento da raposa',      'Inferir moralidade do texto',
                     'Identificar conflito narrativo',       'Distinguir fato e fantasia']
  const act1QSkill: (string | null)[] = [lpD1.id, lpD1.id, lpD4.id, lpD6.id, lpD4.id, lpD6.id, lpD11.id, lpD13.id]

  for (let q = 0; q < 8; q++) {
    const s = act1Stats[q]
    await prisma.waygroundQuestionStat.create({ data: {
      activityId: act1.id, questionNumber: q + 1,
      description: act1QDesc[q], correctCount: s.correct, totalAttempts: s.total,
      accuracy: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
      saebDescriptorId: act1QSkill[q],
    } })
  }

  const act2QDesc = ['Identificar fração de uma figura',    'Simplificar fração',                   'Comparar frações',
                     'Calcular porcentagem simples',         'Resolver problema com frações',         'Frações equivalentes',
                     'Medida de comprimento em fração',      'Problema contextualizado porcentagem',  'Leitura de gráfico de setores',
                     'Calcular desconto percentual']
  const act2QSkill: (string | null)[] = [mtD3.id, mtD3.id, mtD3.id, mtD7.id, mtD3.id, mtD3.id, mtD14.id, mtD7.id, mtD27.id, mtD7.id]
  for (let q = 0; q < 10; q++) {
    const s = act2Stats[q]
    await prisma.waygroundQuestionStat.create({ data: {
      activityId: act2.id, questionNumber: q + 1,
      description: act2QDesc[q], correctCount: s.correct, totalAttempts: s.total,
      accuracy: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
      saebDescriptorId: act2QSkill[q],
    } })
  }

  const act3QDesc = ['Identificar planetas do sistema solar', 'Comparar tamanhos dos planetas',    'Movimentos de rotação e translação',
                     'Características da Lua',                'Distâncias astronômicas em escala',   'Gravidade e força centrípeta']
  const act3Enem = [cnC1.id, cnC1.id, cnC1.id, cnC4.id, mtC3.id, cnC4.id]
  for (let q = 0; q < 6; q++) {
    const s = act3Stats[q]
    await prisma.waygroundQuestionStat.create({ data: {
      activityId: act3.id, questionNumber: q + 1,
      description: act3QDesc[q], correctCount: s.correct, totalAttempts: s.total,
      accuracy: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
      enemCompetencyId: act3Enem[q],
    } })
  }

  const act4QDesc = ['Causas da Rev. Industrial na Inglaterra', 'Papel das instituições políticas', 'Máquina a vapor e suas implicações',
                     'Impacto tecnológico na produção',          'Surgimento do proletariado',       'Formação do Estado moderno europeu',
                     'Trabalho infantil nas fábricas',           'Movimentos operários e sindicais']
  const act4Enem = [chC4.id, chC3.id, chC4.id, chC4.id, chC3.id, chC3.id, chC1.id, chC5.id]
  for (let q = 0; q < 8; q++) {
    const s = act4Stats[q]
    await prisma.waygroundQuestionStat.create({ data: {
      activityId: act4.id, questionNumber: q + 1,
      description: act4QDesc[q], correctCount: s.correct, totalAttempts: s.total,
      accuracy: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
      enemCompetencyId: act4Enem[q],
    } })
  }

  const act5QDesc = ['Caracterizar a Amazônia',           'Ameaças ao Cerrado',                    'Fauna da Caatinga',
                     'Biodiversidade e saúde humana',      'Pantanal e ciclos hídricos',            'Mata Atlântica e fragmentação',
                     'Linguagem de mapas de biomas']
  const act5Enem = [cnC3.id, cnC3.id, cnC3.id, cnC4.id, cnC3.id, cnC3.id, lcC5.id]
  for (let q = 0; q < 7; q++) {
    const s = act5Stats[q]
    await prisma.waygroundQuestionStat.create({ data: {
      activityId: act5.id, questionNumber: q + 1,
      description: act5QDesc[q], correctCount: s.correct, totalAttempts: s.total,
      accuracy: parseFloat(((s.correct / s.total) * 100).toFixed(1)),
      enemCompetencyId: act5Enem[q],
    } })
  }

  // ── Audit Logs ────────────────────────────────────────────────────────────────
  await prisma.auditLog.createMany({ data: [
    { userId: adminUser.id, action: 'CREATE', entityType: 'School', entityId: school.id,   newData: JSON.stringify({ name: school.name })   },
    { userId: adminUser.id, action: 'CREATE', entityType: 'Class',  entityId: class5A.id,  newData: JSON.stringify({ name: class5A.name })  },
    { userId: adminUser.id, action: 'CREATE', entityType: 'Class',  entityId: class5B.id,  newData: JSON.stringify({ name: class5B.name })  },
    { userId: adminUser.id, action: 'CREATE', entityType: 'Class',  entityId: class7A.id,  newData: JSON.stringify({ name: class7A.name })  },
    { userId: adminUser.id, action: 'CREATE', entityType: 'Class',  entityId: class9B.id,  newData: JSON.stringify({ name: class9B.name })  },
  ] })

  console.log('\n✅ Seed complete!')
  console.log('\n📋 Summary:')
  console.log('  4 classes: 5ºA, 5ºB, 7ºA, 9ºB')
  console.log('  40 students (10 per class), 2 transferred')
  console.log('  4 teachers + admin + coord + pedagogo')
  console.log('  6 lessons with comments from teachers')
  console.log('  5 Wayground activities with student results + question stats')
  console.log('  SAEB descriptors (5ºAno + 9ºAno LP/MT)')
  console.log('  ENEM competencies (MT, LC, CN, CH)')
  console.log('\n📋 Demo credentials:')
  console.log('  Admin:      admin@arcadia.edu.br    / admin123')
  console.log('  Professor:  ana@arcadia.edu.br      / prof123')
  console.log('  Professor:  carlos@arcadia.edu.br   / prof123')
  console.log('  Professor:  mariana@arcadia.edu.br  / prof123')
  console.log('  Professor:  felipe@arcadia.edu.br   / prof123')
  console.log('  Pedagogo:   pedagoga@arcadia.edu.br / ped123')
  console.log('  Coord:      coord@arcadia.edu.br    / coord123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
