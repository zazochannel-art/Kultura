'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ScoreRing, buildAdvice } from '@/components/dashboard/money-score-card';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney } from '@/lib/format';
import type { MoneyScoreResult, ScoreKey } from '@/lib/finance/money-score';
import type { TranslationKey } from '@/lib/i18n';

const GRADE_TONE: Record<MoneyScoreResult['grade'], string> = {
  excellent: 'var(--success)',
  good: 'var(--primary)',
  fair: 'var(--warning)',
  poor: 'var(--danger)',
};

const LEVEL_BAR = {
  good: 'bg-success',
  ok: 'bg-warning',
  poor: 'bg-danger',
} as const;

export function ScoreDetail({
  score,
  savingsTarget,
  savedThisMonth,
  emergencyGap,
  debtOwed,
}: {
  score: MoneyScoreResult;
  savingsTarget: number;
  savedThisMonth: number;
  emergencyGap: number;
  debtOwed: number;
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
    <Card id="score">
      <CardContent className="space-y-5 p-5">
        <div className="flex items-center gap-4">
          <ScoreRing score={score.score} tone={GRADE_TONE[score.grade]} size={104} />
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{t('score.title')}</p>
            <p className="text-base font-semibold">{verdict}</p>
            {advice ? <p className="text-sm text-muted-foreground">{advice}</p> : null}
          </div>
        </div>

        <ul className="space-y-3">
          {score.components.map((component) => (
            <li key={component.key} className="space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="truncate text-sm">{t(`score.${component.key as ScoreKey}` as TranslationKey)}</span>
                <span className="mf-tabular shrink-0 text-xs text-muted-foreground">
                  {t('score.points', { points: component.points, weight: component.weight })}
                </span>
              </div>
              <Progress
                value={component.ratio * 100}
                className="h-1.5"
                indicatorClassName={LEVEL_BAR[component.level]}
              />
            </li>
          ))}
        </ul>

        <p className="text-xs text-muted-foreground">
          {t('analytics.savingsRate')}:{' '}
          <span className="mf-tabular text-foreground">
            {Math.round(score.savingsRate * 100)}%
          </span>
          {savingsTarget > 0 ? (
            <>
              {' · '}
              {formatMoney(savedThisMonth, currency, lang)} / {formatMoney(savingsTarget, currency, lang)}
            </>
          ) : null}
        </p>
      </CardContent>
    </Card>
  );
}
