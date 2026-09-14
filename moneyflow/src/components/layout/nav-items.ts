import {
  BarChart3,
  Bot,
  CreditCard,
  Goal,
  HandCoins,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
  Repeat,
  Settings,
  Sparkles,
  Wallet,
  FileText,
} from 'lucide-react';
import type { TranslationKey } from '@/lib/i18n';

export interface NavItem {
  href: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  /** Single-key shortcut after pressing `g`. */
  shortcut?: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, shortcut: 'd' },
  { href: '/transactions', labelKey: 'nav.transactions', icon: CreditCard, shortcut: 't' },
  { href: '/budgets', labelKey: 'nav.budgets', icon: PiggyBank, shortcut: 'b' },
  { href: '/goals', labelKey: 'nav.goals', icon: Goal, shortcut: 'g' },
  { href: '/analytics', labelKey: 'nav.analytics', icon: BarChart3, shortcut: 'a' },
  { href: '/recurring', labelKey: 'nav.recurring', icon: Repeat, shortcut: 'r' },
  { href: '/debts', labelKey: 'nav.debts', icon: HandCoins, shortcut: 'e' },
];

export const SECONDARY_NAV: NavItem[] = [
  { href: '/afford', labelKey: 'nav.afford', icon: Sparkles, shortcut: 'f' },
  { href: '/assistant', labelKey: 'nav.assistant', icon: Bot, shortcut: 'i' },
  { href: '/reports', labelKey: 'nav.reports', icon: FileText, shortcut: 'p' },
  { href: '/accounts', labelKey: 'nav.accounts', icon: Wallet, shortcut: 'c' },
  { href: '/settings', labelKey: 'nav.settings', icon: Settings, shortcut: 's' },
];

export const ALL_NAV = [...PRIMARY_NAV, ...SECONDARY_NAV];

/** The five slots on the phone bar; the middle one is the add button. */
export const MOBILE_NAV: NavItem[] = [
  { href: '/dashboard', labelKey: 'nav.home', icon: LayoutDashboard },
  { href: '/transactions', labelKey: 'nav.transactions', icon: CreditCard },
  { href: '/goals', labelKey: 'nav.goals', icon: Goal },
];
