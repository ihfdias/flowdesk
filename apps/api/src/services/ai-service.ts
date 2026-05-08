import prisma from '../prisma/client'

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434'
const MODEL = 'llama3.2:1b'

export async function searchDemands(query: string, userId: string) {
  const all = await prisma.demand.findMany({
    where: { flow: { createdById: userId } },
    include: {
      currentStage: { select: { id: true, name: true, color: true, order: true, flowId: true } },
      requestedBy: { select: { id: true, name: true } },
      assignedTo: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (all.length === 0) {
    return { summary: 'Nenhuma demanda encontrada no sistema.', demands: [] }
  }

  const context = all.map((d, i) =>
    `${i + 1}. ID: ${d.id} | Título: ${d.title} | Etapa: ${d.currentStage.name} | Tag: ${d.tag ?? '—'} | Prioridade: ${d.priority ?? '—'} | Responsável: ${d.assignedTo?.name ?? 'ninguém'} | Prazo: ${d.dueDate ? new Date(d.dueDate).toLocaleDateString('pt-BR') : '—'}`
  ).join('\n')

  const prompt = `Você é um assistente de busca de um sistema de gestão de demandas de marketing.

Pergunta: "${query}"

Demandas disponíveis:
${context}

Identifique quais demandas correspondem à pergunta. Responda APENAS com JSON válido no formato:
{"summary": "uma frase direta em português sobre o resultado", "ids": ["id-aqui"]}

Se nenhuma demanda corresponder, use ids vazio: []. APENAS o JSON, sem markdown.`

  try {
    const raw = await callOllama(prompt)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return { summary: 'Não consegui interpretar a resposta da IA.', demands: [] }

    const parsed = JSON.parse(match[0]) as { summary: string; ids: string[] }
    const ids = Array.isArray(parsed.ids) ? parsed.ids : []
    const demands = all.filter(d => ids.includes(d.id))
    return { summary: parsed.summary ?? '', demands }
  } catch {
    return { summary: 'Erro ao processar. Verifique se o Ollama está rodando.', demands: [] }
  }
}

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, prompt, stream: false }),
  })
  if (!res.ok) throw new Error(`Ollama retornou ${res.status}`)
  const data = await res.json() as { response: string }
  return data.response.trim()
}

export async function suggestStages(description: string): Promise<string[]> {
  const prompt = `Você é assistente de um sistema de gestão de demandas de marketing.
Com base na descrição abaixo, sugira entre 3 e 6 nomes curtos de etapas para um fluxo de trabalho.
Retorne APENAS um array JSON válido, sem explicações, sem markdown. Exemplo: ["Briefing","Criação","Revisão","Aprovação"]

Descrição: ${description}`

  const raw = await callOllama(prompt)

  // Extrai o primeiro array JSON encontrado na resposta
  const match = raw.match(/\[[\s\S]*?\]/)
  if (!match) return []

  try {
    const parsed = JSON.parse(match[0])
    if (Array.isArray(parsed) && parsed.every(s => typeof s === 'string')) {
      return parsed.slice(0, 6)
    }
    return []
  } catch {
    return []
  }
}

export async function summarizeDemand(demandId: string): Promise<string> {
  const demand = await prisma.demand.findUnique({
    where: { id: demandId },
    include: {
      currentStage: { select: { name: true } },
      requestedBy: { select: { name: true } },
      assignedTo: { select: { name: true } },
      history: {
        include: {
          fromStage: { select: { name: true } },
          toStage: { select: { name: true } },
          movedBy: { select: { name: true } },
        },
        orderBy: { movedAt: 'asc' },
      },
      comments: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  })

  if (!demand) throw new Error('Demanda não encontrada')

  // Monta contexto textual para o modelo
  const lines: string[] = [
    `Título: ${demand.title}`,
    demand.description ? `Descrição: ${demand.description}` : '',
    `Etapa atual: ${demand.currentStage.name}`,
    `Solicitante: ${demand.requestedBy.name}`,
    demand.assignedTo ? `Responsável: ${demand.assignedTo.name}` : 'Sem responsável atribuído.',
    '',
    'Histórico de movimentações:',
  ].filter(Boolean)

  for (const h of demand.history) {
    const date = new Date(h.movedAt).toLocaleDateString('pt-BR')
    const from = h.fromStage?.name ?? '(início)'
    const comment = h.comment ? ` — "${h.comment}"` : ''
    lines.push(`- ${h.movedBy.name} moveu de ${from} → ${h.toStage.name} em ${date}${comment}`)
  }

  if (demand.comments.length > 0) {
    lines.push('', 'Comentários:')
    for (const c of demand.comments) {
      const date = new Date(c.createdAt).toLocaleDateString('pt-BR')
      lines.push(`- ${c.author.name} (${date}): "${c.content}"`)
    }
  }

  const context = lines.join('\n')

  const prompt = `Você é assistente de um sistema de gestão de demandas. Resuma em 2 ou 3 frases curtas o que aconteceu com a demanda abaixo. Seja direto e use português informal.

${context}`

  return callOllama(prompt)
}
