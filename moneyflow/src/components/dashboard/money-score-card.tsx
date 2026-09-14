'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney } from '@/lib/format';
import { weakestComponent, type MoneyScoreResult } from '@/lib/finance/money-score';
import type { CurrencyCode, LanguageCode } from '@/lib/types/database';
import type { Translate } from '@/lib/i18n';

const GRADE_TONE: Record<MoneyScoreResult['grade'], string> = {
  excellent: 'var(--success)',
  good: 'var(--primary)',
  fair: 'var(--warning)',
  poor: 'var(--danger)',
};

export function MoneyScoreCard({
  score,
  savingsTarget,
  savedThisMonth,
  emergencyGap,
  debtOwed,
  compact = false,
}: {
  score: MoneyScoreResult;
  savingsTarget: number;
  savedThisMonth: number;
  emergencyGap: number;
  debtOwed: number;
  compact?: boolean;
}) {
  const { t, lang, currency } = useI18n();

  const verdict =
    score.grade === 'excellent'
      ? t('score.excellent')
      : score.grade === 'good'
        ? t('score.good')
        : score.grade === 'fair'
          ? t('score.fair')
          : t('score.poor');

  const advice = buildAdvice(score, t, lang, currency, {
    savingsTarget,
    savedThisMonth,
    emergencyGap,
    debtOwed,
  });

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <ScoreRing score={score.score} tone={GRADE_TONE[score.grade]} />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-muted-foreground">{t('dashboard.moneyScore')}</p>
            {compact ? (
              <Link
                href="/analytics#score"
                className="flex shrink-0 items-center text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                {t('common.showMore')}
                <ChevronRight className="size-3.5" aria-hidden />
              </Link>
            ) : null}
          </div>
          <p className="text-sm font-medium">{verdict}</p>
          {advice ? <p className="text-sm text-muted-foreground">{advice}</p> : null}
        </div>
      </div>
    </Card>
  );
}

/** A 0-100 dial. Pure SVG: no chart library for one arc. */
export function ScoreRing({ score, tone, size = 72 }: { score: number; tone: string; size?: number }) {
  const stroke = size >= 100 ? 10 : 7;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(100, Math.max(0, score)) / 100;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className="shrink-0 -rotate-90"
      role="img"
      aria-label={`${score}/100`}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={tone}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - progress)}
        style={{ transition: 'stroke-dashoffset 700ms cubic-bezier(0.22, 1, 0.36, 1)' }}
      />
      <text
        x="50%"
        y="50%"
        textAnchor="middle"
        dominantBaseline="central"
        className="rotate-90 fill-foreground font-semibold"
        style={{ transformOrigin: 'center', fontSize: size >= 100 ? 26 : 19 }}
      >
        {score}
      </text>
    </svg>
  );
}

/** The single most useful next step, drawn from the weakest score component. */
export function buildAdvice(
  score: MoneyScoreResult,
  t: Translate,
  lang: LanguageCode,
  currency: CurrencyCode,
  context: {
    savingsTarget: number;
    savedThisMonth: number;
    emergencyGap: number;
    debtOwed: number;
  },
): string | null {
  const weakest = weakestComponent(score);
  if (!weakest || weakest.ratio >= 0.95) return null;

  const money = (value: number) => formatMoney(Math.max(0, Math.round(value)), currency, lang);

  switch (weakest.key) {
    case 'savings_rate': {
      const gap = Math.max(0, context.savingsTarget - context.savedThisMonth) || 300;
      return t('score.advice.savings_rate', { amount: money(gap) });
    }
    case 'budget_adherence':
      return t('score.advice.budget_adherence');
    case 'emergency_fund':
      return t('score.advice.emergency_fund', { amount: money(context.emergencyGap) });
    case 'debt_level':
      return t('score.advice.debt_level', { amount: money(context.debtOwed) });
    case 'spending_consistency':
      return t('score.advice.spending_consistency');
    case 'goal_progress':
      return t('score.advice.goal_progress');
    case 'recurring_load':
      return t('score.advice.recurring_load', { percent: Math.round(weakest.value * 100) });
    default:
      return null;
  }
}
