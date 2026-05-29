# Arcadia — Sistema de Gestão Escolar

> Sistema web completo de gestão e distribuição de aulas para escolas, com foco em organização pedagógica, acompanhamento acadêmico e estrutura preparada para relatórios por inteligência artificial.

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Framework | Next.js 14 (App Router) |
| Linguagem | TypeScript |
| Banco de dados | Prisma ORM + SQLite (dev) / PostgreSQL (prod) |
| Autenticação | NextAuth.js |
| Estilização | Tailwind CSS + shadcn/ui |
| Formulários | React Hook Form + Zod |

---

## Módulos do Sistema

### Painel Administrativo
| Módulo | Descrição |
|--------|-----------|
| **Turmas** | CRUD completo com segmento, série, turno, currículo, unidade escolar |
| **Professores** | Cadastro com vínculo a componentes curriculares e turmas |
| **Alunos** | Cadastro completo: dados pessoais, acadêmicos, responsáveis e informações pedagógicas |
| **Aulas** | Gestão de aulas com materiais, links, documentos e vídeos incorporados (YouTube/Vimeo) |
| **Avaliações** | Cadastro de avaliações por tipo, peso, período e critérios |

### Portal do Professor
| Módulo | Descrição |
|--------|-----------|
| **Portal** | Visualização restrita às aulas e turmas vinculadas, com vídeos embed integrados |
| **Diário de Classe** | Registro do que foi trabalhado em aula — compartilhado entre professores da mesma turma/componente |
| **Tarefas de Casa** | Gestão de tarefas vinculadas a aulas, turmas e componentes com prazo e instruções |
| **Lançamento de Notas** | Interface para inserção e edição de notas por avaliação e aluno |

### Perfil do Pedagogo
| Módulo | Descrição |
|--------|-----------|
| **Registros Pedagógicos** | Advertências, atendimentos, reuniões, encaminhamentos, observações e planos de ação organizados por aluno, data, tipo e nível de confidencialidade |

### Integrações
| Módulo | Descrição |
|--------|-----------|
| **Wayground Sync** | Estrutura preparada para sincronização de tarefas com identificador externo, status de realização, data de envio/conclusão e resultado |
| **Audit Log** | Registro histórico de todas as ações relevantes: usuário, data/hora, tipo de ação, entidade afetada, dados anteriores e novos |

---

## Perfis de Acesso

| Perfil | Acesso |
|--------|--------|
| `ADMIN` | Acesso total ao sistema |
| `COORDENACAO` | Painel administrativo + registros pedagógicos |
| `PROFESSOR` | Portal do professor, diário de classe, tarefas e notas |
| `PEDAGOGO` | Registros pedagógicos + consulta de alunos |
| `VISUALIZACAO` | Acesso somente leitura |

---

## Modelo de Dados

```
User ──────────── Teacher ──── TeacherSubject ──── Subject
                      └──────── TeacherClass  ──── Class ──── Student
                                                        └──── StudentGuardian
Lesson ──── LessonClass ──── Class
      └──── LessonMaterial
      └──── ClassRecord (diário compartilhado)
      └──── Homework ──── HomeworkSubmission ──── Student
                    └──── WaygroundSync

Assessment ──── GradeRecord ──── Student

PedagogicalRecord ──── Student

AuditLog ──── User
```

---

## Estrutura de Arquivos

```
arcadia/
├── prisma/
│   ├── schema.prisma          # Modelo completo de dados
│   └── seed.ts                # Dados de demonstração
├── src/
│   ├── app/
│   │   ├── (auth)/login/      # Página de login
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/     # Dashboard com métricas
│   │   │   ├── admin/
│   │   │   │   ├── turmas/
│   │   │   │   ├── professores/
│   │   │   │   ├── alunos/
│   │   │   │   ├── aulas/
│   │   │   │   └── avaliacoes/
│   │   │   ├── professor/
│   │   │   │   ├── portal/
│   │   │   │   ├── registro-aula/
│   │   │   │   ├── tarefas/
│   │   │   │   └── notas/
│   │   │   └── pedagogo/
│   │   │       └── registros/
│   │   └── api/               # Rotas de API REST
│   ├── components/
│   │   ├── ui/                # Componentes shadcn/ui
│   │   └── sidebar.tsx        # Sidebar dinâmica por perfil
│   ├── lib/
│   │   ├── auth.ts            # Configuração NextAuth
│   │   ├── prisma.ts          # Client Prisma
│   │   ├── audit.ts           # Audit log helper
│   │   └── utils.ts           # Utilitários e labels
│   ├── hooks/
│   │   └── use-toast.ts
│   ├── middleware.ts           # Proteção de rotas por perfil
│   └── types/
│       └── next-auth.d.ts
└── README.md
```

---

## Como Executar

### Pré-requisitos
- Node.js 18+
- npm ou yarn

### Instalação

```bash
# Clone o repositório
git clone https://github.com/TTiba/arcadia.git
cd arcadia

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Configure o banco de dados
npm run db:setup   # gera o client + cria o banco + popula com dados de exemplo

# Inicie o servidor de desenvolvimento
npm run dev
```

Acesse: [http://localhost:3000](http://localhost:3000)

### Scripts disponíveis

```bash
npm run dev          # Servidor de desenvolvimento
npm run build        # Build de produção
npm run start        # Servidor de produção
npm run db:generate  # Gera o Prisma Client
npm run db:push      # Sincroniza o schema com o banco
npm run db:seed      # Popula o banco com dados de exemplo
npm run db:setup     # Executa generate + push + seed
```

---

## Credenciais de Demonstração

| Perfil | Email | Senha |
|--------|-------|-------|
| Administrador | `admin@arcadia.edu.br` | `admin123` |
| Professor | `ana@arcadia.edu.br` | `prof123` |
| Professor | `carlos@arcadia.edu.br` | `prof123` |
| Professor | `mariana@arcadia.edu.br` | `prof123` |
| Pedagogo | `pedagoga@arcadia.edu.br` | `ped123` |
| Coordenação | `coord@arcadia.edu.br` | `coord123` |

---

## Dados de Demonstração (Seed)

Ao rodar `npm run db:seed`, o sistema é populado com:

- **1 escola** — Escola Municipal Arcadia
- **2 segmentos** — Ensino Fundamental I e II
- **5 componentes curriculares** — Português, Matemática, Ciências, História, Geografia
- **2 turmas** — 5º Ano A (manhã) e 9º Ano B (tarde)
- **3 professores** vinculados a componentes e turmas
- **20 alunos** (10 por turma) com dados completos
- **5 aulas** com materiais, links e vídeos do YouTube
- **3 registros de diário de classe**
- **5 tarefas de casa** (algumas com ID Wayground)
- **3 avaliações** com notas lançadas para todos os alunos
- **4 registros pedagógicos** com diferentes tipos e confidencialidades
- **Logs de auditoria** das operações realizadas

---

## Preparado para Inteligência Artificial

O modelo de dados é totalmente relacional, rastreável e estruturado para permitir que uma IA responda perguntas como:

- Quais alunos não realizaram tarefas?
- Quais turmas estão com maior índice de pendências?
- Quais professores não registraram suas aulas?
- Quais conteúdos foram trabalhados por turma?
- Quais alunos possuem observações pedagógicas recorrentes?
- Quais componentes têm menor desempenho em avaliações?
- Quais alunos precisam de acompanhamento?
- Quais tarefas tiveram baixa adesão?
- Quais padrões pedagógicos podem ser identificados?

---

## Integração Wayground

O sistema possui estrutura preparada para integração com o Wayground:

- Tabela `wayground_syncs` com `external_task_id`, `status`, `sent_date`, `completion_date`, `result`
- Endpoint `POST /api/wayground/sync` para sincronização manual ou automática
- Endpoint `GET /api/wayground/sync?homeworkId=` para consulta de status
- Identificador externo configurável por tarefa

---

## Boas Práticas de Segurança e Auditoria

- **Senhas** armazenadas com hash bcrypt
- **Autenticação** via JWT (NextAuth.js)
- **Autorização** por perfil em todas as rotas de API e páginas
- **Middleware** de proteção de rotas no servidor
- **Audit log** automático para criação, edição e exclusão de entidades
- **Dados sensíveis** com nível de confidencialidade (Público / Restrito / Confidencial)
- **Sessões** controladas com tempo de expiração

---

## Variáveis de Ambiente

```env
DATABASE_URL="file:./dev.db"          # SQLite para desenvolvimento
NEXTAUTH_SECRET="sua-chave-secreta"   # Chave para assinar tokens JWT
NEXTAUTH_URL="http://localhost:3000"  # URL base da aplicação
```

Para produção com PostgreSQL:
```env
DATABASE_URL="postgresql://user:password@host:5432/arcadia"
```

---

## Licença

Este projeto foi desenvolvido para fins educacionais e de gestão escolar.
