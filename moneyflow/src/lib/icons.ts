/**
 * The icon set users can pick from.
 *
 * An explicit map rather than a dynamic `Icons[name]` lookup: the dynamic
 * version drags the entire icon library into the bundle, and this doubles as
 * the list the icon picker renders.
 */
import {
  Baby, Backpack, Banknote, Bike, Book, Briefcase, Bus, Car, Cat, Coffee, Coins,
  CreditCard, Dog, Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap, Heart,
  Home, Laptop, Landmark, Leaf, Lightbulb, type LucideIcon, Music, Package,
  PawPrint, PiggyBank, Pill, Plane, Plug, Scissors, ShieldCheck, Shirt,
  ShoppingBag, ShoppingCart, Smartphone, Sparkles, Stethoscope, Target, Ticket,
  Train, TrendingUp, Trophy, UtensilsCrossed, Wallet, Wifi, Wrench, Circle,
} from 'lucide-react';

export const ICON_MAP: Record<string, LucideIcon> = {
  Baby, Backpack, Banknote, Bike, Book, Briefcase, Bus, Car, Cat, Circle, Coffee,
  Coins, CreditCard, Dog, Dumbbell, Film, Fuel, Gamepad2, Gift, GraduationCap,
  Heart, Home, Landmark, Laptop, Leaf, Lightbulb, Music, Package, PawPrint,
  PiggyBank, Pill, Plane, Plug, Scissors, ShieldCheck, Shirt, ShoppingBag,
  ShoppingCart, Smartphone, Sparkles, Stethoscope, Target, Ticket, Train,
  TrendingUp, Trophy, UtensilsCrossed, Wallet, Wifi, Wrench,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

export const FALLBACK_ICON: LucideIcon = Circle;

export function getIcon(name: string | null | undefined): LucideIcon {
  return (name && ICON_MAP[name]) || Circle;
}

/**
 * The palette offered for categories, goals and accounts.
 *
 * A category's colour is its identity everywhere in the app, charts included,
 * so these are not arbitrary brand tints: the first eight are a categorical
 * ramp selected against the dark chart surface and checked for colour-vision
 * separation, in the order a user is most likely to pick them. The rest are
 * accents for labelling rather than for sitting next to each other in a chart.
 */
export const COLOR_SWATCHES = [
  '#3987E5', '#D95926', '#199E70', '#C98500', '#D55181', '#008300', '#9085E9', '#E66767',
  '#06B6D4', '#8B5CF6', '#22C55E', '#F59E0B', '#EF4444', '#EC4899', '#0EA5E9', '#71717A',
];
