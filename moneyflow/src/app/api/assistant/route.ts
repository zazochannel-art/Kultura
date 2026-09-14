import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { requireUser } from '@/lib/actions/auth-guard';
import { buildAssistantContext } from '@/lib/assistant/context';
import { answerFromData } from '@/lib/assistant/engine';
import { getLanguage } from '@/lib/i18n/server';
import type { LanguageCode } from '@/lib/types/database';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  question: z.string().trim().min(1).max(500),
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(10)
    .optional(),
});

const LANGUAGE_NAMES: Record<LanguageCode, string> = {
  ro: 'Romanian',
  ru: 'Russian',
  en: 'English',
};

/**
 * The assistant's instructions.
 *
 * The whole value of this feature is that it answers about *this user's* money,
 * so the model gets one source of facts and an explicit instruction to say when
 * something is not in it. An invented balance would be worse than no answer.
 */
function systemPrompt(language: LanguageCode, currency: string): string {
  return `You are the financial assistant inside MONEYFLOW, a personal finance app.

Answer ONLY from the JSON financial context supplied in the user turn. It is the
user's real, current data.

Rules:
- Never invent, estimate, or round a figure that is not derivable from the context.
- If the context does not contain what was asked, say so plainly and name what the
  user would need to add to the app (a transaction, a budget, a goal).
- Amounts are in ${currency}. Write them the way the context does; do not convert.
- Reply in ${LANGUAGE_NAMES[language]}.
- Be short: two or three sentences, or a compact list. No preamble, no disclaimers,
  no suggestion to consult a financial advisor.
- When the user asks whether they can afford something, use availableUntilMonthEnd,
  daysLeftInMonth and the savings target to say yes / careful / no, and give the
  reason with the numbers behind it.
- You give arithmetic and observations about the user's own data. You do not give
  investment advice.`;
}

export async function POST(request: Request) {
  const session = await requireUser();
  if (!session) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const built = await buildAssistantContext();
  if (!built) return NextResponse.json({ error: 'no_profile' }, { status: 400 });

  const { context, snapshot } = built;
  const lang = await getLanguage(snapshot.profile.language);

  // Always compute the grounded answer: it is the fallback when there is no API
  // key, and the safety net when the model call fails.
  const local = answerFromData(parsed.data.question, context, snapshot.dailyBudget, lang);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ answer: local.text, source: 'engine' });
  }

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 1200,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
      system: [
        {
          type: 'text',
          text: systemPrompt(lang, context.currency),
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        ...(parsed.data.history ?? []).map((turn) => ({
          role: turn.role,
          content: turn.content,
        })),
        {
          role: 'user' as const,
          content: `Financial context (JSON):\n${JSON.stringify(context)}\n\nQuestion: ${parsed.data.question}`,
        },
      ],
    });

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ answer: local.text, source: 'engine' });
    }

    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
      .trim();

    return NextResponse.json({ answer: text || local.text, source: text ? 'model' : 'engine' });
  } catch {
    // A model outage must not take the feature down — the arithmetic still works.
    return NextResponse.json({ answer: local.text, source: 'engine' });
  }
}
