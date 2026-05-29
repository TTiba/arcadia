import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clean up in dependency order
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

  // School
  const school = await prisma.school.create({
    data: {
      name: 'Escola Municipal Arcadia',
      address: 'Rua das Flores, 123 - Centro',
      phone: '(11) 3456-7890',
      email: 'contato@arcadia.edu.br',
    }
  })

  // Segments
  const segFundI = await prisma.segment.create({ data: { name: 'Ensino Fundamental I' } })
  const segFundII = await prisma.segment.create({ data: { name: 'Ensino Fundamental II' } })

  // Grades
  const grade5 = await prisma.grade.create({ data: { name: '5º Ano', segmentId: segFundI.id } })
  const grade9 = await prisma.grade.create({ data: { name: '9º Ano', segmentId: segFundII.id } })

  // Subjects
  const subPortugues = await prisma.subject.create({ data: { name: 'Língua Portuguesa', segmentId: segFundI.id } })
  const subMatematica = await prisma.subject.create({ data: { name: 'Matemática', segmentId: segFundI.id } })
  const subCiencias = await prisma.subject.create({ data: { name: 'Ciências', segmentId: segFundI.id } })
  const subHistoria = await prisma.subject.create({ data: { name: 'História', segmentId: segFundII.id } })
  const subGeografia = await prisma.subject.create({ data: { name: 'Geografia', segmentId: segFundII.id } })

  // Classes
  const class5A = await prisma.class.create({
    data: {
      name: '5º Ano A',
      curriculum: 'BNCC 2024',
      gradeId: grade5.id,
      period: '2024',
      schoolId: school.id,
      shift: 'Manhã',
      year: 2024,
    }
  })

  const class9B = await prisma.class.create({
    data: {
      name: '9º Ano B',
      curriculum: 'BNCC 2024',
      gradeId: grade9.id,
      period: '2024',
      schoolId: school.id,
      shift: 'Tarde',
      year: 2024,
    }
  })

  // Users
  const hash = (p: string) => bcrypt.hashSync(p, 10)

  const adminUser = await prisma.user.create({
    data: { name: 'Administrador Arcadia', email: 'admin@arcadia.edu.br', password: hash('admin123'), role: 'ADMIN' }
  })
  const teacherUser1 = await prisma.user.create({
    data: { name: 'Ana Paula Silva', email: 'ana@arcadia.edu.br', password: hash('prof123'), role: 'PROFESSOR' }
  })
  const teacherUser2 = await prisma.user.create({
    data: { name: 'Carlos Eduardo Santos', email: 'carlos@arcadia.edu.br', password: hash('prof123'), role: 'PROFESSOR' }
  })
  const teacherUser3 = await prisma.user.create({
    data: { name: 'Mariana Costa', email: 'mariana@arcadia.edu.br', password: hash('prof123'), role: 'PROFESSOR' }
  })
  const pedagogoUser = await prisma.user.create({
    data: { name: 'Fernanda Oliveira', email: 'pedagoga@arcadia.edu.br', password: hash('ped123'), role: 'PEDAGOGO' }
  })
  await prisma.user.create({
    data: { name: 'Roberto Alves', email: 'coord@arcadia.edu.br', password: hash('coord123'), role: 'COORDENACAO' }
  })

  // Teachers
  const teacher1 = await prisma.teacher.create({ data: { userId: teacherUser1.id, registration: 'PROF-001' } })
  const teacher2 = await prisma.teacher.create({ data: { userId: teacherUser2.id, registration: 'PROF-002' } })
  const teacher3 = await prisma.teacher.create({ data: { userId: teacherUser3.id, registration: 'PROF-003' } })

  // Teacher-Subject links
  await prisma.teacherSubject.createMany({
    data: [
      { teacherId: teacher1.id, subjectId: subPortugues.id },
      { teacherId: teacher2.id, subjectId: subMatematica.id },
      { teacherId: teacher2.id, subjectId: subCiencias.id },
      { teacherId: teacher3.id, subjectId: subHistoria.id },
      { teacherId: teacher3.id, subjectId: subGeografia.id },
    ]
  })

  // Teacher-Class-Subject links
  await prisma.teacherClass.createMany({
    data: [
      { teacherId: teacher1.id, classId: class5A.id, subjectId: subPortugues.id },
      { teacherId: teacher2.id, classId: class5A.id, subjectId: subMatematica.id },
      { teacherId: teacher2.id, classId: class9B.id, subjectId: subCiencias.id },
      { teacherId: teacher3.id, classId: class9B.id, subjectId: subHistoria.id },
      { teacherId: teacher3.id, classId: class9B.id, subjectId: subGeografia.id },
    ]
  })

  // Students - 5º Ano A
  const names5A = ['Lucas Ferreira', 'Maria Eduarda Lima', 'Pedro Henrique Costa', 'Isabela Santos',
    'Gabriel Alves', 'Sophia Rodrigues', 'Matheus Oliveira', 'Laura Pereira', 'Arthur Souza', 'Beatriz Nunes']
  const students5A = await Promise.all(
    names5A.map((name, i) => prisma.student.create({
      data: { name, enrollment: `2024-5A-${String(i + 1).padStart(3, '0')}`, classId: class5A.id, status: 'ATIVO', birthDate: new Date(2013, i % 12, (i % 28) + 1) }
    }))
  )

  // Students - 9º Ano B
  const names9B = ['Enzo Gabriel Silva', 'Valentina Costa', 'Nicolas Barbosa', 'Giulia Martins',
    'Rafael Carvalho', 'Alice Ferreira', 'Gustavo Santos', 'Lívia Rodrigues', 'Felipe Almeida', 'Helena Nascimento']
  const students9B = await Promise.all(
    names9B.map((name, i) => prisma.student.create({
      data: { name, enrollment: `2024-9B-${String(i + 1).padStart(3, '0')}`, classId: class9B.id, status: 'ATIVO', birthDate: new Date(2009, i % 12, (i % 28) + 1) }
    }))
  )

  // Guardians
  await prisma.studentGuardian.createMany({
    data: [
      { studentId: students5A[0].id, name: 'José Ferreira', relationship: 'Pai', phone: '(11) 91234-5678', email: 'jose@email.com', isPrimary: true },
      { studentId: students5A[1].id, name: 'Ana Lima', relationship: 'Mãe', phone: '(11) 97654-3210', isPrimary: true },
      { studentId: students9B[0].id, name: 'Ricardo Silva', relationship: 'Pai', phone: '(11) 98765-4321', email: 'ricardo@email.com', isPrimary: true },
    ]
  })

  // Lessons
  const lesson1 = await prisma.lesson.create({
    data: {
      title: 'Interpretação de Texto - Narrativas',
      description: 'Estudo de narrativas clássicas e contemporâneas com foco em interpretação e análise crítica.',
      subjectId: subPortugues.id,
      startDate: new Date(2024, 2, 1),
      endDate: new Date(2024, 2, 31),
      createdById: teacherUser1.id,
      lessonClasses: { create: [{ classId: class5A.id }] },
      materials: {
        create: [
          { type: 'LINK', title: 'Texto: O Pequeno Príncipe', url: 'https://www.dominiopublico.gov.br/pesquisa/DetalheObraForm.do?select_action=&co_obra=2064', description: 'Link para leitura do texto base' },
          { type: 'VIDEO', title: 'Vídeo explicativo - Interpretação', url: 'https://www.youtube.com/watch?v=ZbZSe6N_BXs', description: 'Assista antes da aula' },
          { type: 'DOCUMENTO', title: 'Atividade impressa', url: '/docs/atividade-narrativa.pdf', description: 'Atividade para fixação' },
        ]
      }
    }
  })

  const lesson2 = await prisma.lesson.create({
    data: {
      title: 'Frações - Conceitos Básicos',
      description: 'Introdução ao conceito de fração, numerador e denominador, frações equivalentes.',
      subjectId: subMatematica.id,
      startDate: new Date(2024, 2, 4),
      endDate: new Date(2024, 2, 22),
      createdById: teacherUser2.id,
      lessonClasses: { create: [{ classId: class5A.id }] },
      materials: {
        create: [
          { type: 'VIDEO', title: 'Khan Academy - Introdução a Frações', url: 'https://www.youtube.com/watch?v=l3RuKFMBJ9o', description: 'Vídeo introdutório' },
          { type: 'LINK', title: 'Exercícios interativos', url: 'https://www.matematica.pt/util/fracoes.php', description: 'Praticar frações online' },
        ]
      }
    }
  })

  const lesson3 = await prisma.lesson.create({
    data: {
      title: 'Sistema Solar e Planetas',
      description: 'Exploração do sistema solar, características dos planetas e movimentos terrestres.',
      subjectId: subCiencias.id,
      startDate: new Date(2024, 3, 1),
      endDate: new Date(2024, 3, 30),
      createdById: teacherUser2.id,
      lessonClasses: { create: [{ classId: class9B.id }] },
      materials: {
        create: [
          { type: 'VIDEO', title: 'NASA - Sistema Solar', url: 'https://www.youtube.com/watch?v=libKVRa01L8', description: 'Documentário NASA' },
          { type: 'LINK', title: 'Simulador do Sistema Solar', url: 'https://solarsystem.nasa.gov', description: 'Explore interativamente' },
        ]
      }
    }
  })

  const lesson4 = await prisma.lesson.create({
    data: {
      title: 'Revolução Industrial',
      description: 'Contexto histórico, causas e consequências da Revolução Industrial.',
      subjectId: subHistoria.id,
      startDate: new Date(2024, 3, 8),
      endDate: new Date(2024, 4, 10),
      createdById: teacherUser3.id,
      lessonClasses: { create: [{ classId: class9B.id }] },
      materials: {
        create: [
          { type: 'VIDEO', title: 'Revolução Industrial - Resumo', url: 'https://www.youtube.com/watch?v=zhL5DCizj5c', description: 'Vídeo resumo' },
        ]
      }
    }
  })

  const lesson5 = await prisma.lesson.create({
    data: {
      title: 'Biomas Brasileiros',
      description: 'Características e importância dos principais biomas do Brasil.',
      subjectId: subGeografia.id,
      startDate: new Date(2024, 4, 6),
      endDate: new Date(2024, 4, 31),
      createdById: teacherUser3.id,
      lessonClasses: { create: [{ classId: class9B.id }] },
      materials: {
        create: [
          { type: 'VIDEO', title: 'Biomas do Brasil', url: 'https://www.youtube.com/watch?v=BIJRhexTCZI' },
          { type: 'LINK', title: 'IBGE - Biomas', url: 'https://www.ibge.gov.br/geociencias/informacoes-ambientais/vegetacao/15842-biomas.html' },
        ]
      }
    }
  })

  // Class Records (Diário)
  await prisma.classRecord.createMany({
    data: [
      { lessonId: lesson1.id, classId: class5A.id, teacherId: teacher1.id, subjectId: subPortugues.id, userId: teacherUser1.id, date: new Date(2024, 2, 5), contentDeveloped: 'Leitura coletiva do capítulo 1 de O Pequeno Príncipe. Discussão sobre personagens e cenário.', observations: 'Turma participativa, bom engajamento com o texto.', pending: 'Alguns alunos precisam terminar a leitura em casa.' },
      { lessonId: lesson2.id, classId: class5A.id, teacherId: teacher2.id, subjectId: subMatematica.id, userId: teacherUser2.id, date: new Date(2024, 2, 7), contentDeveloped: 'Introdução ao conceito de fração com material concreto (pizzas e barras). Exercícios de identificação.', observations: 'Dificuldade inicial com o conceito, mas boa evolução ao final.' },
      { lessonId: lesson3.id, classId: class9B.id, teacherId: teacher2.id, subjectId: subCiencias.id, userId: teacherUser2.id, date: new Date(2024, 3, 3), contentDeveloped: 'Apresentação do sistema solar com vídeo da NASA. Mapa mental coletivo.', observations: 'Turma muito interessada, muitas perguntas sobre planetas distantes.', adaptations: 'Aluno com DV utilizou material em relevo.' },
    ]
  })

  // Homework
  const hw1 = await prisma.homework.create({
    data: { title: 'Leitura - Capítulos 2 e 3', instructions: 'Leia os capítulos 2 e 3 de O Pequeno Príncipe e responda às questões da folha impressa.', lessonId: lesson1.id, classId: class5A.id, subjectId: subPortugues.id, dueDate: new Date(2024, 2, 12), externalId: 'WAY-PORT-001' }
  })
  const hw2 = await prisma.homework.create({
    data: { title: 'Lista de Frações', instructions: 'Resolver os exercícios 1 a 10 da lista de frações distribuída em sala.', lessonId: lesson2.id, classId: class5A.id, subjectId: subMatematica.id, dueDate: new Date(2024, 2, 14), externalId: 'WAY-MAT-002' }
  })
  const hw3 = await prisma.homework.create({
    data: { title: 'Pesquisa sobre Planetas', instructions: 'Escolha um planeta e faça uma pesquisa de pelo menos 1 página com suas características.', lessonId: lesson3.id, classId: class9B.id, subjectId: subCiencias.id, dueDate: new Date(2024, 3, 10) }
  })
  const hw4 = await prisma.homework.create({
    data: { title: 'Linha do Tempo - Revolução Industrial', instructions: 'Criar uma linha do tempo com os principais eventos da Revolução Industrial (1760-1840).', lessonId: lesson4.id, classId: class9B.id, subjectId: subHistoria.id, dueDate: new Date(2024, 3, 17), externalId: 'WAY-HIS-003' }
  })
  await prisma.homework.create({
    data: { title: 'Mapa dos Biomas Brasileiros', instructions: 'Completar o mapa mudo do Brasil identificando e colorindo os biomas estudados.', lessonId: lesson5.id, classId: class9B.id, subjectId: subGeografia.id, dueDate: new Date(2024, 4, 13) }
  })

  // Homework Submissions
  await prisma.homeworkSubmission.createMany({
    data: [
      ...students5A.slice(0, 7).map(s => ({ homeworkId: hw1.id, studentId: s.id, submittedAt: new Date(2024, 2, 11), waygroundStatus: 'CONCLUIDA' })),
      ...students5A.slice(0, 5).map(s => ({ homeworkId: hw2.id, studentId: s.id, submittedAt: new Date(2024, 2, 13), waygroundStatus: 'CONCLUIDA' })),
      ...students9B.slice(0, 8).map(s => ({ homeworkId: hw3.id, studentId: s.id, submittedAt: new Date(2024, 3, 9), waygroundStatus: 'CONCLUIDA' })),
    ]
  })

  // Wayground syncs
  await prisma.waygroundSync.createMany({
    data: students5A.slice(0, 7).map(s => ({
      homeworkId: hw1.id, studentId: s.id,
      externalTaskId: `WAY-PORT-001-${s.id}`, status: 'CONCLUIDA',
      sentDate: new Date(2024, 2, 10), completionDate: new Date(2024, 2, 11),
      result: '8.5', syncedAt: new Date(2024, 2, 12),
    }))
  })

  // Assessments
  const assess1 = await prisma.assessment.create({
    data: { name: 'Avaliação Bimestral - Português', subjectId: subPortugues.id, classId: class5A.id, period: '1º Bimestre', weight: 2.0, type: 'PROVA', date: new Date(2024, 2, 28), criteria: 'Interpretação de texto (40%), Gramática (30%), Produção textual (30%)', maxScore: 10.0 }
  })
  const assess2 = await prisma.assessment.create({
    data: { name: 'Trabalho de Frações', subjectId: subMatematica.id, classId: class5A.id, period: '1º Bimestre', weight: 1.0, type: 'TRABALHO', date: new Date(2024, 2, 22), criteria: 'Resolução correta (70%), Apresentação (30%)', maxScore: 10.0 }
  })
  await prisma.assessment.create({
    data: { name: 'Seminário - Revolução Industrial', subjectId: subHistoria.id, classId: class9B.id, period: '2º Bimestre', weight: 1.5, type: 'SEMINARIO', date: new Date(2024, 3, 26), criteria: 'Conteúdo (50%), Apresentação oral (30%), Material visual (20%)', maxScore: 10.0 }
  })

  // Grade Records
  const scores1 = [8.5, 7.0, 9.0, 6.5, 8.0, 7.5, 9.5, 6.0, 8.5, 7.0]
  await Promise.all(students5A.map((s, i) => prisma.gradeRecord.create({
    data: { assessmentId: assess1.id, studentId: s.id, teacherId: teacher1.id, userId: teacherUser1.id, score: scores1[i], observations: scores1[i] < 6 ? 'Aluno precisa de reforço' : null }
  })))

  const scores2 = [7.0, 8.5, 9.0, 5.5, 7.5, 8.0, 6.0, 9.5, 7.0, 8.0]
  await Promise.all(students5A.map((s, i) => prisma.gradeRecord.create({
    data: { assessmentId: assess2.id, studentId: s.id, teacherId: teacher2.id, userId: teacherUser2.id, score: scores2[i] }
  })))

  // Pedagogical records
  await prisma.pedagogicalRecord.createMany({
    data: [
      { studentId: students5A[3].id, pedagogueId: pedagogoUser.id, type: 'OBSERVACAO', title: 'Dificuldades de concentração', content: 'Aluno apresenta dificuldades de concentração nas aulas, especialmente nas disciplinas da tarde. Professores relatam agitação e distração frequente.', date: new Date(2024, 2, 15), confidentiality: 'RESTRITO', actionPlan: 'Conversar com a família. Solicitar avaliação neuropsicológica.' },
      { studentId: students5A[3].id, pedagogueId: pedagogoUser.id, type: 'REUNIAO', title: 'Reunião com família', content: 'Reunião realizada com os pais do aluno. Família relatou que o aluno tem dormido tarde por causa de jogos eletrônicos.', date: new Date(2024, 2, 22), confidentiality: 'RESTRITO', actionPlan: 'Família comprometeu-se a estabelecer rotina de sono.' },
      { studentId: students9B[1].id, pedagogueId: pedagogoUser.id, type: 'ATENDIMENTO', title: 'Atendimento individual', content: 'Aluna procurou a pedagoga relatando dificuldades de relacionamento com colegas.', date: new Date(2024, 3, 5), confidentiality: 'CONFIDENCIAL', actionPlan: 'Mediar situação em grupo. Acompanhar nos próximos 30 dias.' },
      { studentId: students9B[4].id, pedagogueId: pedagogoUser.id, type: 'ADVERTENCIA', title: 'Advertência verbal - Comportamento', content: 'Aluno recebeu advertência verbal por comportamento inadequado durante aula de Ciências.', date: new Date(2024, 3, 8), confidentiality: 'RESTRITO' },
    ]
  })

  // Audit logs
  await prisma.auditLog.createMany({
    data: [
      { userId: adminUser.id, action: 'CREATE', entityType: 'School', entityId: school.id, newData: JSON.stringify({ name: school.name }) },
      { userId: adminUser.id, action: 'CREATE', entityType: 'Class', entityId: class5A.id, newData: JSON.stringify({ name: class5A.name }) },
      { userId: adminUser.id, action: 'CREATE', entityType: 'Class', entityId: class9B.id, newData: JSON.stringify({ name: class9B.name }) },
    ]
  })

  console.log('\n✅ Seed complete!')
  console.log('\n📋 Demo credentials:')
  console.log('  Admin:      admin@arcadia.edu.br    / admin123')
  console.log('  Professor:  ana@arcadia.edu.br      / prof123')
  console.log('  Professor:  carlos@arcadia.edu.br   / prof123')
  console.log('  Professor:  mariana@arcadia.edu.br  / prof123')
  console.log('  Pedagogo:   pedagoga@arcadia.edu.br / ped123')
  console.log('  Coord:      coord@arcadia.edu.br    / coord123')
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
