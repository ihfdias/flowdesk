# FlowDesk

> Gerencie demandas do seu time com fluxos totalmente personalizáveis.

![FlowDesk Board](Captura%20de%20tela%20de%202026-05-07%2021-13-15.png)

---

## O problema

Times de marketing lidam com dezenas de demandas simultâneas — posts, campanhas, briefings, aprovações — espalhadas em planilhas, grupos de WhatsApp e e-mails. Não existe visibilidade do andamento, não existe responsável claro, e nenhuma rastreabilidade de quando e por que algo mudou de status.

O FlowDesk resolve isso com um board kanban onde **cada time define suas próprias etapas**, acompanha o progresso em tempo real, e tem histórico completo de cada movimentação.

---

## Features

- **Autenticação completa** — cadastro, login com JWT e rotas protegidas
- **Onboarding guiado** — novos usuários criam seu primeiro fluxo em 3 passos
- **Fluxos personalizáveis** — crie etapas com nome, cor e ordem definidos por você
- **Board kanban** — arraste demandas entre etapas com drag-and-drop
- **Demandas completas** — título, descrição, tag, prioridade, responsável e data de entrega
- **Histórico de movimentações** — cada avanço registra quem moveu, quando e com qual comentário
- **Comentários por etapa** — cada comentário é vinculado à etapa em que foi feito
- **Gestão de time** — convide membros por e-mail; membros veem e interagem com as demandas do fluxo
- **Notificações em tempo real** — polling a cada 30s; convites geram notificação com link direto ao board
- **Command Palette (⌘K)** — busca de demandas por título/tag ou pesquisa em linguagem natural via IA local (Ollama)
- **Arquivamento de demandas** — ao finalizar a última etapa, a demanda é arquivada e sai do board
- **Permissões** — apenas o criador do fluxo pode editar etapas, convidar membros ou deletar o fluxo

---

## Stack

### Backend
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express_5-000000?style=flat&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma_7-2D3748?style=flat&logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Zod](https://img.shields.io/badge/Zod-3E67B1?style=flat&logo=zod&logoColor=white)

### Frontend
![React](https://img.shields.io/badge/React_19-61DAFB?style=flat&logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=flat&logo=vite&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router_7-CA4245?style=flat&logo=reactrouter&logoColor=white)
![dnd-kit](https://img.shields.io/badge/dnd--kit-FF6B6B?style=flat)

### Outros
![Ollama](https://img.shields.io/badge/Ollama_(llama3.2)-000000?style=flat)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)

---

## Estrutura do projeto

```
flowdesk/
├── apps/
│   ├── api/                    # Servidor Node.js/Express
│   │   ├── prisma/
│   │   │   ├── schema.prisma   # Models: User, Flow, Stage, Demand, etc.
│   │   │   └── migrations/
│   │   └── src/
│   │       ├── controllers/    # Handlers HTTP (validação Zod → service)
│   │       ├── services/       # Regras de negócio e queries Prisma
│   │       ├── routes/         # Definição das rotas Express
│   │       ├── middlewares/    # Auth JWT
│   │       └── prisma/         # Client Prisma singleton
│   │
│   └── web/                    # SPA React/Vite
│       └── src/
│           ├── components/
│           │   ├── board/      # DemandCard, DemandModal, modais de fluxo
│           │   └── primitives/ # Avatar, PriorityDot, StageChip, TagPill
│           ├── pages/          # BoardPage, FlowEditorPage, Login, Register, Onboarding
│           └── lib/            # api.ts (axios), auth.tsx (contexto), colors.ts, types.ts
│
└── packages/
    └── types/                  # Tipos compartilhados (futuro)
```

---

## Instalação e execução local

### Pré-requisitos

- Node.js 20+
- PostgreSQL rodando localmente
- *(Opcional)* [Ollama](https://ollama.com) com o modelo `llama3.2:1b` para o Command Palette com IA

### 1. Clone o repositório

```bash
git clone https://github.com/seu-usuario/flowdesk.git
cd flowdesk
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Crie o arquivo `apps/api/.env` com o seguinte conteúdo:

```env
DATABASE_URL="postgresql://usuario:senha@localhost:5432/flowdesk"
JWT_SECRET="sua-chave-secreta-aqui"
PORT=3333
OLLAMA_URL="http://localhost:11434"
```

### 4. Execute as migrations e gere o client Prisma

```bash
cd apps/api
npx prisma migrate dev
npx prisma generate
```

### 5. Inicie os servidores

Em dois terminais separados:

```bash
# Terminal 1 — API (porta 3333)
cd apps/api
npm run dev

# Terminal 2 — Web (porta 5173)
cd apps/web
npm run dev
```

Acesse [http://localhost:5173](http://localhost:5173) no navegador.

### 6. *(Opcional)* Ativar busca com IA

```bash
# Instale o Ollama: https://ollama.com
ollama pull llama3.2:1b
ollama serve
```

---

## Variáveis de ambiente

| Variável | Descrição | Exemplo |
|---|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL | `postgresql://postgres:postgres@localhost:5432/flowdesk` |
| `JWT_SECRET` | Chave para assinar os tokens JWT | `minha-chave-super-secreta` |
| `PORT` | Porta do servidor da API | `3333` |
| `OLLAMA_URL` | URL da instância Ollama (opcional) | `http://localhost:11434` |

---

## O que aprendi

Este projeto foi construído do zero como estudo prático de desenvolvimento full stack. Os principais aprendizados:

**Arquitetura e design**
- Como estruturar uma API REST em camadas (controller → service → Prisma), separando validação de entrada da lógica de negócio
- A importância de pensar em permissões desde o modelo de dados: filtros `OR [createdById, members]` que garantem isolamento entre usuários sem lógica duplicada

**Banco de dados e Prisma**
- Modelagem relacional com chaves estrangeiras, índices compostos (`@@unique`) e deleção em cascata manual respeitando a ordem das FKs
- Diferença entre `$transaction([])` (operações independentes em paralelo) e `$transaction(async tx => {})` (operações encadeadas)
- Por que `findUnique` rejeita filtros compostos com relações — e quando usar `findFirst`

**Estado no frontend**
- Gerenciar estado otimista: atualizar a UI antes da confirmação do servidor e reverter em caso de erro (drag-and-drop de demandas)
- Padrão de polling com `setInterval` + cleanup no `useEffect` para notificações
- Separar responsabilidades entre componentes: o DemandModal não faz fetch nem sabe o que acontece depois — ele apenas chama `onAdvance` ou `onArchive` e quem decide é o BoardPage

**Integração com LLM local**
- Usar `format: "json"` no Ollama para forçar saída estruturada
- Modelos pequenos (`1b`) são ruins com UUIDs mas confiáveis com índices numéricos — troque o identificador, não o modelo

**TypeScript**
- Validação de entrada com Zod integrada ao Express — tipos inferidos a partir do schema eliminam duplicação
- Como tipar erros de rede no catch (`err as { response?: { status?: number } }`) sem perder segurança de tipos

---

## Autor

**Igor Dias** — [ihfdias.dev@gmail.com](mailto:ihfdias.dev@gmail.com)

---

*Projeto desenvolvido como estudo de desenvolvimento full stack — parte do portfólio pessoal.*
