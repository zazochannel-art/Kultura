'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ColorPicker } from '@/components/shared/color-picker';
import { Field } from '@/components/shared/field';
import { IconBadge } from '@/components/shared/icon-badge';
import { IconPicker } from '@/components/shared/icon-picker';
import { SubmitButton } from '@/components/shared/submit-button';
import { useT } from '@/lib/i18n/context';
import { IDLE, type ActionResult } from '@/lib/actions/result';
import type { Category, CategoryKind } from '@/lib/types/database';
import { deleteCategory, saveCategory } from '@/app/(app)/settings/actions';

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const t = useT();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <div className="grid gap-2 sm:grid-cols-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className="flex items-center gap-2.5 rounded-lg border border-border px-3 py-2"
          >
            <IconBadge icon={category.icon} color={category.color} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{category.name}</p>
              <p className="text-xs text-muted-foreground">{t(`categories.kind.${category.kind}`)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('common.edit')}
              onClick={() => {
                setEditing(category);
                setOpen(true);
              }}
            >
              <Pencil className="size-3.5 text-muted-foreground" aria-hidden />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t('common.delete')}
              onClick={() => setDeleting(category)}
            >
              <Trash2 className="size-3.5 text-muted-foreground" aria-hidden />
            </Button>
          </div>
        ))}
      </div>

      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setEditing(null);
          setOpen(true);
        }}
      >
        <Plus className="size-4" aria-hidden />
        {t('categories.add')}
      </Button>

      <CategoryDialog key={editing?.id ?? 'new'} open={open} onOpenChange={setOpen} category={editing} />

      <AlertDialog open={Boolean(deleting)} onOpenChange={(value) => !value && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('categories.deleteConfirm', { name: deleting?.name ?? '' })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('categories.deleteConfirmBody')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending}
              className="bg-danger text-white hover:brightness-110"
              onClick={(event) => {
                event.preventDefault();
                if (!deleting) return;
                const id = deleting.id;
                startTransition(async () => {
                  const result = await deleteCategory(id);
                  if (result.ok) {
                    toast.success(t('categories.deleted'));
                    router.refresh();
                  } else {
                    toast.error(t(result.error ?? 'common.somethingWrong'));
                  }
                  setDeleting(null);
                });
              }}
            >
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: Category | null;
}) {
  const t = useT();
  const router = useRouter();
  const [state, action] = useActionState<ActionResult, FormData>(saveCategory, IDLE);

  const [icon, setIcon] = useState(category?.icon ?? 'Circle');
  const [color, setColor] = useState(category?.color ?? '#3987E5');
  const [kind, setKind] = useState<CategoryKind>(category?.kind ?? 'expense');

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(t(state.message));
      router.refresh();
      onOpenChange(false);
    } else if (state.error) {
      toast.error(t(state.error));
    }
  }, [state, t, router, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{category ? t('categories.edit') : t('categories.add')}</DialogTitle>
        </DialogHeader>

        <form action={action} className="space-y-4">
          {category ? <input type="hidden" name="id" value={category.id} /> : null}
          <input type="hidden" name="icon" value={icon} />
          <input type="hidden" name="color" value={color} />
          <input type="hidden" name="kind" value={kind} />

          <Field label={t('common.name')} htmlFor="name" error={state.fields?.name && t(state.fields.name)}>
            <Input
              id="name"
              name="name"
              required
              maxLength={40}
              defaultValue={category?.name ?? ''}
              autoFocus
            />
          </Field>

          <Field label={t('categories.kind')}>
            <Select value={kind} onValueChange={(value) => setKind(value as CategoryKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">{t('categories.kind.expense')}</SelectItem>
                <SelectItem value="income">{t('categories.kind.income')}</SelectItem>
                <SelectItem value="both">{t('categories.kind.both')}</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label={t('categories.color')}>
            <ColorPicker value={color} onChange={setColor} />
          </Field>

          <Field label={t('categories.icon')}>
            <IconPicker value={icon} onChange={setIcon} color={color} />
          </Field>

          <SubmitButton className="w-full" pendingLabel={t('common.saving')}>
            {t('common.save')}
          </SubmitButton>
        </form>
      </DialogContent>
    </Dialog>
  );
}
