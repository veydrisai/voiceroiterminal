import { GoogleGenerativeAI } from '@google/generative-ai'

export type KPIs = {
  dailyCallVolume: number
  confirmedBookings: number
  projectedRevenue: number
  weeklyCallVolume: number
  weeklySalesYield: number
  monthlyGrossYield: number
}

export type PipelineRow = {
  time: string
  caller: string
  intent: string
  outcome: string
  revenue: number
}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: 'gemini-2.5-flash' })
}

export async function generateInsights(kpis: KPIs, recentCalls: PipelineRow[]): Promise<string> {
  const model = getModel()
  if (!model) return 'Add GEMINI_API_KEY to your environment variables to enable AI insights.'

  const outcomeBreakdown: Record<string, number> = {}
  const intentBreakdown: Record<string, number> = {}
  for (const row of recentCalls) {
    outcomeBreakdown[row.outcome] = (outcomeBreakdown[row.outcome] ?? 0) + 1
    intentBreakdown[row.intent] = (intentBreakdown[row.intent] ?? 0) + 1
  }

  const prompt = `You are a concise voice AI performance analyst. Given the following KPIs for a client using an AI voice booking assistant, provide 3-4 bullet-point insights (no headers, no markdown beyond bullet points). Focus on what the numbers mean for the business, any patterns in intent/outcome, and 1 actionable recommendation. Be direct and data-driven.

KPIs:
- Daily call volume: ${kpis.dailyCallVolume}
- Daily confirmed bookings: ${kpis.confirmedBookings}
- Daily projected revenue: $${kpis.projectedRevenue}
- Weekly call volume: ${kpis.weeklyCallVolume}
- Weekly sales yield: ${kpis.weeklySalesYield}%
- Monthly gross yield: ${kpis.monthlyGrossYield}%

Recent call intent distribution: ${JSON.stringify(intentBreakdown)}
Recent call outcome distribution: ${JSON.stringify(outcomeBreakdown)}
Total recent calls analyzed: ${recentCalls.length}

Provide insights:`

  const result = await model.generateContent(prompt)
  return result.response.text()
}

export async function answerDataQuestion(question: string, kpis: KPIs, recentCalls: PipelineRow[]): Promise<string> {
  const model = getModel()
  if (!model) return 'Add GEMINI_API_KEY to your environment variables to enable AI chat.'

  const prompt = `You are a voice AI ROI assistant. Answer the following question about the user's dashboard data concisely (2-4 sentences max). Be direct and data-driven.

Dashboard KPIs:
- Daily call volume: ${kpis.dailyCallVolume}
- Daily confirmed bookings: ${kpis.confirmedBookings}
- Daily projected revenue: $${kpis.projectedRevenue}
- Weekly call volume: ${kpis.weeklyCallVolume}
- Weekly sales yield: ${kpis.weeklySalesYield}%
- Monthly gross yield: ${kpis.monthlyGrossYield}%
- Recent calls analyzed: ${recentCalls.length}

User question: ${question}

Answer:`

  const result = await model.generateContent(prompt)
  return result.response.text()
}
