'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Download, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Field } from '@/components/shared/field';
import { MoneyInput } from '@/components/shared/money-input';
import { PageHeader } from '@/components/shared/page-header';
import { SubmitButton } from '@/components/shared/submit-button';
import { PushPermission } from '@/components/notifications/push-permission';
import { SettingsSection } from './settings-section';
import { CategoriesManager } from './categories-manager';
import { useI18n } from '@/lib/i18n/context';
import { CURRENCIES } from '@/lib/format';
import { LANGUAGES } from '@/lib/i18n';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import type { Category, CurrencyCode, LanguageCode, Profile } from '@/lib/types/database';
import {
  changePassword,
  clearDemoData,
  deleteAccountForever,
  loadDemoData,
  updatePreferences,
  updateProfile,
} from '@/app/(app)/settings/actions';

export function SettingsView({
  profile,
  categories,
  email,
}: {
  profile: Profile;
  categories: Category[];
  email: string;
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <PageHeader title={t('settings.title')} description={email} />

      <ProfileSection profile={profile} />
      <PreferencesSection profile={profile} />

      <SettingsSection title={t('categories.title')}>
        <CategoriesManager categories={categories} />
      </SettingsSection>

      <SecuritySection />

      <SettingsSection title={t('notifications.title')}>
        <PushPermission />
      </SettingsSection>

      <ExportSection />
      <DemoSection isDemo={profile.is_demo} />
      <DangerSection />
    </div>
  );
}

function ProfileSection({ profile }: { profile: Profile }) {
  const { t, currency } = useI18n();
  const router = useRouter();
  const [state, action] = useActionState<ActionResult, FormData>(updateProfile, IDLE);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(t(state.message));
      router.refresh();
    } else if (state.error) {
      toast.error(t(state.error));
    }
  }, [state, t, router]);

  return (
    <SettingsSection title={t('settings.profile')}>
      <form action={action} className="space-y-4">
        <Field label={t('common.name')} htmlFor="name" error={state.fields?.name && t(state.fields.name)}>
          <Input id="name" name="name" maxLength={60} defaultValue={profile.name ?? ''} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('settings.income')} htmlFor="monthly_income">
            <MoneyInput
              id="monthly_income"
              name="monthly_income"
              currency={currency}
              defaultValue={String(profile.monthly_income)}
            />
          </Field>
          <Field label={t('settings.savingsTarget')} htmlFor="monthly_savings_target">
            <MoneyInput
              id="monthly_savings_target"
              name="monthly_savings_target"
              currency={currency}
              defaultValue={String(profile.monthly_savings_target)}
            />
          </Field>
          <Field label={t('settings.emergencyTarget')} htmlFor="emergency_fund_target">
            <MoneyInput
              id="emergency_fund_target"
              name="emergency_fund_target"
              currency={currency}
              defaultValue={String(profile.emergency_fund_target)}
            />
          </Field>
          <Field label={t('settings.payday')} htmlFor="payday_day">
            <Input
              id="payday_day"
              name="payday_day"
              type="number"
              min={1}
              max={31}
              defaultValue={profile.payday_day}
            />
          </Field>
        </div>

        <SubmitButton pendingLabel={t('common.saving')}>{t('common.save')}</SubmitButton>
      </form>
    </SettingsSection>
  );
}

function PreferencesSection({ profile }: { profile: Profile }) {
  const { t } = useI18n();
  const router = useRouter();
  const [state, action] = useActionState<ActionResult, FormData>(updatePreferences, IDLE);

  const [currency, setCurrency] = useState<CurrencyCode>(profile.currency);
  const [language, setLanguage] = useState<LanguageCode>(profile.language);
  const [theme, setTheme] = useState(profile.theme === 'light' ? 'light' : 'dark');

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(t(state.message));
      router.refresh();
    } else if (state.error) {
      toast.error(t(state.error));
    }
  }, [state, t, router]);

  return (
    <SettingsSection title={t('settings.currency')}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="currency" value={currency} />
        <input type="hidden" name="language" value={language} />
        <input type="hidden" name="theme" value={theme} />

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={t('settings.currency')}>
            <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code} · {t(`currency.${code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('settings.language')}>
            <Select value={language} onValueChange={(value) => setLanguage(value as LanguageCode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {t(`lang.${code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('settings.theme')}>
            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
                <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <SubmitButton pendingLabel={t('common.saving')}>{t('common.save')}</SubmitButton>
      </form>
    </SettingsSection>
  );
}

function SecuritySection() {
  const { t } = useI18n();
  const [state, action] = useActionState<ActionResult, FormData>(changePassword, IDLE);

  useEffect(() => {
    if (state.ok && state.message) toast.success(t(state.message));
    else if (state.error) toast.error(t(state.error));
  }, [state, t]);

  return (
    <SettingsSection title={t('settings.security')}>
      <form action={action} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label={t('settings.newPassword')}
            htmlFor="password"
            error={state.fields?.password && t(state.fields.password)}
          >
            <Input id="password" name="password" type="password" autoComplete="new-password" />
          </Field>
          <Field
            label={t('auth.passwordConfirm')}
            htmlFor="passwordConfirm"
            error={state.fields?.passwordConfirm && t(state.fields.passwordConfirm)}
          >
            <Input
              id="passwordConfirm"
              name="passwordConfirm"
              type="password"
              autoComplete="new-password"
            />
          </Field>
        </div>

        <SubmitButton variant="outline" pendingLabel={t('common.saving')}>
          {t('settings.changePassword')}
        </SubmitButton>
      </form>
    </SettingsSection>
  );
}

function ExportSection() {
  const { t } = useI18n();

  return (
    <SettingsSection title={t('settings.export')} description={t('settings.exportHint')}>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" asChild>
          <a href="/api/export?format=json" download>
            <Download className="size-4" aria-hidden />
            {t('settings.exportJson')}
          </a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href="/api/export?format=csv" download>
            <Download className="size-4" aria-hidden />
            {t('settings.exportCsv')}
          </a>
        </Button>
      </div>
    </SettingsSection>
  );
}

function DemoSection({ isDemo }: { isDemo: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(t(result.message ?? 'settings.saved'));
        router.refresh();
      } else {
        toast.error(t(result.error ?? 'common.somethingWrong'));
      }
    });

  return (
    <SettingsSection title={t('settings.demo')} description={t('settings.demoHint')}>
      {isDemo ? (
        <Badge variant="warning">{t('settings.demoActive')}</Badge>
      ) : (
        <p className="text-xs text-warning">{t('settings.demoWarning')}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={pending} onClick={() => run(loadDemoData)}>
          <Sparkles className="size-4" aria-hidden />
          {t('settings.demoLoad')}
        </Button>
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(clearDemoData)}>
          <Trash2 className="size-4" aria-hidden />
          {t('settings.demoClear')}
        </Button>
      </div>
    </SettingsSection>
  );
}

function DangerSection() {
  const { t } = useI18n();
  const [state, action] = useActionState<ActionResult, FormData>(deleteAccountForever, IDLE);

  useEffect(() => {
    if (state.error) toast.error(t(state.error));
  }, [state, t]);

  return (
    <SettingsSection title={t('settings.deleteAccount')} description={t('settings.deleteAccountHint')}>
      <form action={action} className="space-y-3">
        <p className="text-sm text-muted-foreground">{t('settings.deleteConfirmBody')}</p>

        <Field htmlFor="confirm" error={state.fields?.confirm && t('common.required')}>
          <Input
            id="confirm"
            name="confirm"
            placeholder={t('settings.deleteKeyword')}
            autoComplete="off"
            className="max-w-48"
          />
        </Field>

        <SubmitButton variant="destructive" pendingLabel={t('common.saving')}>
          <Trash2 className="size-4" aria-hidden />
          {t('settings.deleteAccount')}
        </SubmitButton>
      </form>
    </SettingsSection>
  );
}
