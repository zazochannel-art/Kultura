'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, Loader2, SendHorizonal, ShieldCheck, Trash2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader } from '@/components/shared/page-header';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n/context';
import type { TranslationKey } from '@/lib/i18n';

interface Turn {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS: TranslationKey[] = [
  'assistant.suggestion1',
  'assistant.suggestion2',
  'assistant.suggestion3',
  'assistant.suggestion4',
];

export function AssistantChat() {
  const t = useT();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [turns, pending]);

  const ask = async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || pending) return;

    const history = turns.slice(-6);
    setTurns((prev) => [...prev, { role: 'user', content: trimmed }]);
    setDraft('');
    setPending(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ question: trimmed, history }),
      });

      const payload = (await response.json()) as { answer?: string };
      setTurns((prev) => [
        ...prev,
        { role: 'assistant', content: payload.answer ?? t('assistant.error') },
      ]);
    } catch {
      setTurns((prev) => [...prev, { role: 'assistant', content: t('assistant.error') }]);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-[70dvh] flex-col gap-4">
      <PageHeader
        title={t('assistant.title')}
        description={t('assistant.subtitle')}
        action={
          turns.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setTurns([])}>
              <Trash2 className="size-4" aria-hidden />
              {t('assistant.clear')}
            </Button>
          ) : undefined
        }
      />

      <div className="flex-1 space-y-3">
        {turns.length === 0 ? (
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-start gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
                  <Bot className="size-5" aria-hidden />
                </span>
                <p className="pt-1.5 text-sm text-muted-foreground">{t('assistant.empty')}</p>
              </div>

              <div className="grid gap-2">
                {SUGGESTIONS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => ask(t(key))}
                    className="rounded-lg border border-border px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent/50"
                  >
                    {t(key)}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          turns.map((turn, index) => (
            <div
              key={index}
              className={cn('flex gap-3', turn.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              {turn.role === 'assistant' ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
                  <Bot className="size-4" aria-hidden />
                </span>
              ) : null}

              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
                  turn.role === 'user'
                    ? 'rounded-br-sm bg-primary text-primary-foreground'
                    : 'rounded-bl-sm border border-border bg-card',
                )}
              >
                {turn.content}
              </div>

              {turn.role === 'user' ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent">
                  <User className="size-4" aria-hidden />
                </span>
              ) : null}
            </div>
          ))
        )}

        {pending ? (
          <div className="flex items-center gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/15 text-secondary">
              <Bot className="size-4" aria-hidden />
            </span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {t('assistant.thinking')}
            </span>
          </div>
        ) : null}

        <div ref={endRef} />
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
        }}
        className="sticky bottom-20 space-y-2 lg:bottom-4"
      >
        <div className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-lg">
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                ask(draft);
              }
            }}
            placeholder={t('assistant.placeholder')}
            rows={1}
            maxLength={500}
            className="min-h-10 flex-1 resize-none border-0 bg-transparent focus-visible:ring-0"
          />
          <Button type="submit" size="icon" disabled={pending || !draft.trim()} aria-label={t('assistant.send')}>
            <SendHorizonal className="size-4" aria-hidden />
          </Button>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden />
          {t('assistant.grounded')}
        </p>
      </form>
    </div>
  );
}
