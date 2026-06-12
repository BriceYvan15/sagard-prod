import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class AiService {
  constructor(private config: ConfigService) {}

  async chat(message: string, context?: string): Promise<{ reply: string }> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY')
    if (!apiKey) return { reply: 'Assistant IA non configuré. Veuillez définir OPENAI_API_KEY.' }

    const systemPrompt = `Tu es l'assistant IA de SAGARD SÉCURITÉ, une entreprise de sécurité privée en Côte d'Ivoire.
Tu aides les équipes internes (DG, commerciaux, RH, opérations) avec des informations sur la gestion des agents, contrats, facturation et opérations.
Réponds toujours en français de manière professionnelle et concise.
${context ? `Contexte additionnel : ${context}` : ''}`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: message }],
        max_tokens: 500,
        temperature: 0.7,
      }),
    })

    if (!res.ok) throw new Error(`OpenAI error: ${res.status}`)
    const data: any = await res.json()
    return { reply: data.choices[0].message.content }
  }
}
