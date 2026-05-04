# FlowDesk — CLAUDE.md

Este arquivo é o guia principal para o Claude Code entender o projeto. Leia com atenção antes de qualquer ação.

---

## 🧭 O que é o FlowDesk

FlowDesk é um sistema de gestão de demandas com fluxos personalizáveis voltado para times de **marketing e comunicação**. Usuários criam fluxos com etapas customizadas (ex: Briefing → Criação → Revisão → Aprovação → Publicado) e abrem demandas que percorrem essas etapas, com registro de histórico, comentários e integração com IA local.

**Problema real que resolve:** times de comunicação não têm visibilidade de onde cada demanda está, quem é responsável por cada etapa e o que já foi feito.

---

## 👨‍💻 Perfil do desenvolvedor

- Iniciante em desenvolvimento Full Stack
- Está aprendendo enquanto constrói
- Usa **JavaScript / TypeScript**
- **Sempre explique o raciocínio** antes de gerar código
- **Prefira passos pequenos e claros** a grandes blocos de uma vez
- Quando sugerir um comando, explique o que ele faz
- Quando criar um arquivo, explique por que ele existe e qual sua responsabilidade

---

## 🗂️ Estrutura do Projeto (Monorepo)

```
flowdesk/
├── apps/
│   ├── web/          # Frontend React + TypeScript (Vite)
│   └── api/          # Backend Node.js + Express + TypeScript
├── packages/
│   └── types/        # Tipos TypeScript compartilhados entre front e back
├── CLAUDE.md
├── package.json      # Raiz do monorepo (npm workspaces)
└── README.md
```

---

## 🛠️ Stack Tecnológica

### Frontend (`apps/web`)
- **React 18** com **TypeScript**
- **Vite** como bundler
- **Tailwind CSS** para estilização
- **React Router** para navegação
- **TanStack Query** para gerenciamento de estado assíncrono e cache
- **Axios** para chamadas HTTP

### Backend (`apps/api`)
- **Node.js** com **Express** e **TypeScript**
- **Prisma ORM** para acesso ao banco de dados
- **PostgreSQL** como banco de dados
- **JWT** para autenticação
- **Zod** para validação de dados nas rotas

### IA
- **Ollama** rodando localmente com modelo **Llama 3**
- Chamadas via HTTP para `http://localhost:11434`
- Funcionalidades: sugestão de etapas ao abrir demanda, resumo de histórico

### Deploy
- Frontend: **Vercel**
- Backend + Banco: **Railway**

---

## 🗄️ Modelo de Dados (Prisma)

```
User
  - id, name, email, passwordHash, role, createdAt

Flow (Fluxo)
  - id, name, description, createdBy (User), createdAt
  - stages: Stage[]

Stage (Etapa do fluxo)
  - id, name, color, order, flowId
  - defaultAssigneeId (User?)

Demand (Demanda)
  - id, title, description, flowId
  - currentStageId (Stage)
  - requestedBy (User)
  - assignedTo (User?)
  - dueDate, createdAt

DemandHistory (Histórico de movimentações)
  - id, demandId, fromStageId, toStageId
  - movedBy (User), movedAt, comment

Comment (Comentário por etapa)
  - id, demandId, stageId, authorId, content, createdAt
```

---

## 🔐 Autenticação

- JWT armazenado no `localStorage` do frontend
- Token enviado no header `Authorization: Bearer <token>`
- Middleware `authMiddleware` no backend valida o token em todas as rotas protegidas
- Dois perfis: `ADMIN` (cria fluxos) e `MEMBER` (abre e movimenta demandas)

---

## 📡 Padrão de API REST

```
# Auth
POST   /api/auth/register
POST   /api/auth/login

# Flows
GET    /api/flows
POST   /api/flows
GET    /api/flows/:id
PUT    /api/flows/:id
DELETE /api/flows/:id

# Stages
POST   /api/flows/:flowId/stages
PUT    /api/flows/:flowId/stages/:stageId
DELETE /api/flows/:flowId/stages/:stageId

# Demands
GET    /api/demands
POST   /api/demands
GET    /api/demands/:id
PATCH  /api/demands/:id/advance   # Avança para próxima etapa
PATCH  /api/demands/:id/move      # Move para etapa específica

# Comments
GET    /api/demands/:id/comments
POST   /api/demands/:id/comments

# IA
POST   /api/ai/suggest-stages     # Sugere etapas com base na descrição
POST   /api/ai/summarize/:demandId # Resume histórico da demanda
```

---

## 🤖 Integração com Ollama (IA Local)

O Ollama deve estar rodando localmente na porta `11434`. As chamadas de IA são **opcionais** — se o Ollama não estiver disponível, o sistema funciona normalmente sem IA.

```typescript
// Exemplo de chamada ao Ollama
const response = await fetch('http://localhost:11434/api/generate', {
  method: 'POST',
  body: JSON.stringify({
    model: 'llama3',
    prompt: '...',
    stream: false
  })
})
```

---

## 🌍 Variáveis de Ambiente

### `apps/api/.env`
```
DATABASE_URL="postgresql://user:password@localhost:5432/flowdesk"
JWT_SECRET="sua-chave-secreta-aqui"
PORT=3333
OLLAMA_URL="http://localhost:11434"
```

### `apps/web/.env`
```
VITE_API_URL="http://localhost:3333"
```

---

## 📋 Módulos do Projeto

| # | Módulo | Status |
|---|---|---|
| 1 | Setup & Estrutura (monorepo, TypeScript, Tailwind) | ⬜ Pendente |
| 2 | Backend & Banco (Prisma, PostgreSQL, rotas base) | ⬜ Pendente |
| 3 | Autenticação (JWT, registro, login) | ⬜ Pendente |
| 4 | Fluxos & Demandas (CRUD, progressão de etapas) | ⬜ Pendente |
| 5 | Frontend (telas, board visual) | ⬜ Pendente |
| 6 | IA com Ollama (sugestões, resumo) | ⬜ Pendente |
| 7 | Deploy & Portfólio | ⬜ Pendente |

---

## ✅ Convenções de Código

- **Nomes de arquivos:** `kebab-case` (ex: `demand-controller.ts`)
- **Nomes de variáveis e funções:** `camelCase`
- **Nomes de tipos e classes:** `PascalCase`
- **Sempre tipar** funções, parâmetros e retornos em TypeScript — evitar `any`
- **Separar responsabilidades:** controller só lida com request/response, lógica fica no service
- **Validação de entrada** sempre com Zod no backend antes de chegar no service

### Estrutura de uma rota (padrão)
```
router → controller → service → repository (Prisma)
```

---

## 🚫 O que NÃO fazer

- Não usar `any` em TypeScript sem justificativa
- Não misturar lógica de negócio no controller
- Não fazer chamadas diretas ao Prisma fora da camada de service/repository
- Não commitar o arquivo `.env`
- Não usar `var` — sempre `const` ou `let`

---

## 💡 Como pedir ajuda ao Claude Code

Exemplos de prompts úteis durante o desenvolvimento:

- *"Explica o que esse erro significa e como corrigir"*
- *"Cria o service de criação de demanda seguindo o padrão do projeto"*
- *"Refatora essa função para ficar mais legível"*
- *"Escreve um teste simples para essa rota"*
- *"O que esse trecho de código está fazendo exatamente?"*