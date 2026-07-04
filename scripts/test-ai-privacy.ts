import { prisma } from '../src/lib/prisma'
import { buildRoster, scrubText, getOrCreateAlias, remapAliasesForDisplay, containsPiiPatterns } from '../src/lib/ai-privacy'

async function main() {
  const cls = await prisma.class.findFirst({
    where: { name: { contains: '9º' } },
    include: { students: { take: 3, select: { id: true, name: true } }, school: { select: { id: true, name: true } } },
  })
  if (!cls) throw new Error('turma não encontrada')
  const [s1, s2] = cls.students
  const prof = await prisma.teacher.findFirst({ include: { user: true } })
  if (!prof) throw new Error('professor não encontrado')

  console.log('Turma:', cls.name, '| Alunos:', s1.name, '/', s2.name, '| Prof:', prof.user.name)

  const roster = await buildRoster([cls.id], cls.school?.id)
  console.log('Roster:', roster.entries.length, 'nomes')

  // Simula o que um professor escreveria num diário/ocorrência
  const texto = `Hoje o ${s1.name} deu problema na aula e discutiu com ${s2.name.split(' ')[0]}. ` +
    `A Profª ${prof.user.name} presenciou. Mãe dele (fone (41) 99876-5432, cpf 123.456.789-01, ` +
    `email maria@gmail.com) foi chamada. ${s1.name.split(' ')[0]} pediu desculpas depois.`

  const limpo = scrubText(texto, roster)
  console.log('\n--- ORIGINAL ---\n' + texto)
  console.log('\n--- SCRUBBED ---\n' + limpo)

  // Verificações
  const fail = (m: string) => { console.error('FALHOU: ' + m); process.exitCode = 1 }
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  for (const nome of [s1.name, s2.name, prof.user.name]) {
    for (const parte of nome.split(' ').filter(p => p.length > 3)) {
      if (norm(limpo).includes(norm(parte))) fail(`nome vazou: ${parte}`)
    }
  }
  if (containsPiiPatterns(limpo)) fail('CPF/email ainda presentes')
  if (/99876/.test(limpo)) fail('telefone vazou')

  // Round-trip: alias na "resposta da IA" → nome real na exibição
  const aliasAluno = await getOrCreateAlias('ALUNO', s1.id)
  const respostaSimulada = `O ${aliasAluno} apresentou melhora após a intervenção.`
  const exibicao = await remapAliasesForDisplay(respostaSimulada)
  console.log('\n--- RESPOSTA IA ---\n' + respostaSimulada)
  console.log('--- EXIBIÇÃO ---\n' + exibicao)
  if (!exibicao.includes(s1.name)) fail('remap de exibição não recuperou o nome')

  console.log('\n' + (process.exitCode ? '✗ TESTE FALHOU' : '✓ TODOS OS CHECKS PASSARAM'))
  await prisma.$disconnect()
}
main()
