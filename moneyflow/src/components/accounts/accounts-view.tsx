'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Archive,
  ArchiveRestore,
  Banknote,
  CreditCard,
  Landmark,
  MoreVertical,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  Wallet,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { PageHeader } from '@/components/shared/page-header';
import { AccountDialog } from './account-dialog';
import { useI18n } from '@/lib/i18n/context';
import { formatMoney } from '@/lib/format';
import { deleteAccount, toggleArchiveAccount } from '@/app/(app)/accounts/actions';
import type { Account, AccountType, CurrencyCode } from '@/lib/types/database';

const TYPE_ICONS: Record<AccountType, typeof Wallet> = {
  cash: Banknote,
  bank: Landmark,
  card: CreditCard,
  savings: PiggyBank,
};

export function AccountsView({
  accounts,
  archived,
  currency,
}: {
  accounts: Account[];
  archived: Account[];
  currency: CurrencyCode;
}) {
  const { t, lang } = useI18n();
  const router = useRouter();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleting, setDeleting] = useState<Account | null>(null);
  const [pending, startTransition] = useTransition();

  const total = accounts
    .filter((account) => account.include_in_total)
    .reduce((sum, account) => sum + Number(account.balance), 0);

  const run = (fn: () => Promise<{ ok: boolean; error?: Parameters<typeof t>[0] }>, okKey: Parameters<typeof t>[0]) => {
    startTransition(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(t(okKey));
        router.refresh();
      } else {
        toast.error(t(result.error ?? 'common.somethingWrong'));
      }
      setDeleting(null);
    });
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={t('accounts.title')}
        action={
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {t('accounts.add')}
          </Button>
        }
      />

      <Card className="p-5">
        <p className="text-sm text-muted-foreground">{t('accounts.total')}</p>
        <p className="mf-hero-number mt-1 text-3xl font-semibold sm:text-4xl">
          {formatMoney(total, currency, lang)}
        </p>
      </Card>

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t('accounts.empty')}
          description={t('accounts.emptyHint')}
          action={
            <Button
              size="sm"
              onClick={() => {
                setEditing(null);
                setDialogOpen(true);
              }}
            >
              {t('accounts.add')}
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={() => {
                setEditing(account);
                setDialogOpen(true);
              }}
              onArchive={() => run(() => toggleArchiveAccount(account.id, true), 'accounts.saved')}
              onDelete={() => setDeleting(account)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 ? (
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">{t('accounts.archived')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {archived.map((account) => (
              <AccountCard
                key={account.id}
                account={account}
                dimmed
                onEdit={() => {
                  setEditing(account);
                  setDialogOpen(true);
                }}
                onRestore={() => run(() => toggleArchiveAccount(account.id, false), 'accounts.saved')}
                onDelete={() => setDeleting(account)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <AccountDialog
        key={editing?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={editing}
        defaultCurrency={currency}
      />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('accounts.deleteConfirm', { name: deleting?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('accounts.deleteConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-danger text-white hover:brightness-110"
              onClick={(event) => {
                event.preventDefault();
                if (deleting) run(() => deleteAccount(deleting.id), 'accounts.deleted');
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AccountCard({
  account,
  dimmed,
  onEdit,
  onArchive,
  onRestore,
  onDelete,
}: {
  account: Account;
  dimmed?: boolean;
  onEdit: () => void;
  onArchive?: () => void;
  onRestore?: () => void;
  onDelete: () => void;
}) {
  const { t, lang } = useI18n();
  const Icon = TYPE_ICONS[account.type];

  return (
    <Card className={dimmed ? 'opacity-60' : undefined}>
      <CardContent className="flex items-center gap-3 p-4">
        <span
          className="flex size-10 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${account.color}1f`, color: account.color }}
        >
          <Icon className="size-5" aria-hidden />
        </span>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{account.name}</p>
          <p className="text-xs text-muted-foreground">{t(`accounts.type.${account.type}`)}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="text-right">
            <p className="mf-tabular text-sm font-semibold">
              {formatMoney(Number(account.balance), account.currency, lang)}
            </p>
            {!account.include_in_total ? (
              <Badge variant="outline" className="mt-0.5 text-[10px]">
                {t('accounts.includeInTotal')}
              </Badge>
            ) : null}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('common.edit')}>
                <MoreVertical className="size-4 text-muted-foreground" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil className="size-4" aria-hidden />
                {t('common.edit')}
              </DropdownMenuItem>
              {onArchive ? (
                <DropdownMenuItem onSelect={onArchive}>
                  <Archive className="size-4" aria-hidden />
                  {t('accounts.archive')}
                </DropdownMenuItem>
              ) : null}
              {onRestore ? (
                <DropdownMenuItem onSelect={onRestore}>
                  <ArchiveRestore className="size-4" aria-hidden />
                  {t('common.retry')}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem variant="danger" onSelect={onDelete}>
                <Trash2 className="size-4" aria-hidden />
                {t('common.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
