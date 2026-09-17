import {
  Calculator,
  CalendarDays,
  FileText,
  Hammer,
  Image as ImageIcon,
  LayoutDashboard,
  Package,
  Bell,
  Ruler,
  Settings,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Cheie pentru numărătoare (ex. notificări necitite). */
  badge?: "notifications" | "active_jobs";
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Principal",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/lucrari", label: "Lucrări", icon: Hammer, badge: "active_jobs" },
      { href: "/calendar", label: "Calendar", icon: CalendarDays },
      { href: "/clienti", label: "Clienți", icon: Users },
    ],
  },
  {
    title: "Pe teren",
    items: [
      { href: "/masuratori", label: "Măsurători", icon: Ruler },
      { href: "/calculator", label: "Calculator preț", icon: Calculator },
      { href: "/oferte", label: "Oferte", icon: FileText },
    ],
  },
  {
    title: "Resurse",
    items: [
      { href: "/finante", label: "Finanțe", icon: Wallet },
      { href: "/materiale", label: "Materiale", icon: Package },
      { href: "/scule", label: "Scule", icon: Wrench },
      { href: "/portofoliu", label: "Portofoliu", icon: ImageIcon },
    ],
  },
  {
    title: "Cont",
    items: [
      { href: "/notificari", label: "Notificări", icon: Bell, badge: "notifications" },
      { href: "/setari", label: "Setări", icon: Settings },
    ],
  },
];

/** Cele 4 destinații din bara de jos (a 5-a poziție este butonul „+”). */
export const BOTTOM_NAV: NavItem[] = [
  { href: "/", label: "Acasă", icon: LayoutDashboard },
  { href: "/lucrari", label: "Lucrări", icon: Hammer },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/finante", label: "Bani", icon: Wallet },
];

export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
