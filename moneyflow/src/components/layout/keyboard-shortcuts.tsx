'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ALL_NAV } from './nav-items';
import { useQuickAdd } from './quick-add-context';

/**
 * Desktop shortcuts: `n` adds a transaction, `g` then a letter jumps to a page.
 * Deliberately ignored while typing, and while a dialog has focus.
 */
export function KeyboardShortcuts() {
  const router = useRouter();
  const { openQuickAdd } = useQuickAdd();
  const awaitingGoto = useRef(false);
  const gotoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const isTyping = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTyping(event.target)) return;

      const key = event.key.toLowerCase();

      if (awaitingGoto.current) {
        awaitingGoto.current = false;
        if (gotoTimer.current) clearTimeout(gotoTimer.current);

        const match = ALL_NAV.find((item) => item.shortcut === key);
        if (match) {
          event.preventDefault();
          router.push(match.href);
        }
        return;
      }

      if (key === 'g') {
        awaitingGoto.current = true;
        gotoTimer.current = setTimeout(() => {
          awaitingGoto.current = false;
        }, 1200);
        return;
      }

      if (key === 'n') {
        event.preventDefault();
        openQuickAdd('expense');
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (gotoTimer.current) clearTimeout(gotoTimer.current);
    };
  }, [router, openQuickAdd]);

  return null;
}
