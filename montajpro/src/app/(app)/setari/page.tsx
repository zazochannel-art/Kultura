"use client";

import { useRef, useState } from "react";
import {
  Bell,
  Building2,
  Coins,
  Download,
  FlaskConical,
  LogOut,
  RefreshCw,
  Ruler,
  Share,
  Smartphone,
  Tags,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldRow } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { MoneyInput, NumberInput } from "@/components/ui/number-input";
import { Confirm } from "@/components/ui/confirm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportData, importData, updateSettings } from "@/lib/db/actions";
import { hasDemoData, removeDemoData, seedDemoData } from "@/lib/db/demo";
import { useTable } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import { useInstallPrompt } from "@/hooks/use-install-prompt";
import { CURRENCIES, DEFAULT_MATERIAL_CATEGORIES } from "@/lib/constants";
import type { DefaultRates, NotificationPrefs } from "@/lib/types";
import { formatDateTime } from "@/lib/format";

const RATE_LABELS: Record<keyof DefaultRates, string> = {
  stair_step: "Treaptă",
  stair_riser: "Contratreaptă",
  landing: "Podest",
  railing: "Balustradă",
  parquet_m2: "Parchet (m²)",
  plinth_m: "Plintă (m)",
  hourly: "Tarif orar",
};

const NOTIFICATION_LABELS: Record<keyof NotificationPrefs, string> = {
  job_today: "Lucrare azi",
  job_tomorrow: "Lucrare mâine",
  payment_due: "Plată restantă",
  tool_warranty: "Garanție sculă",
  materials_missing: "Materiale lipsă",
  quote_pending: "Ofertă neconfirmată",
};

export default function SettingsPage() {
  const {
    settings,
    currency,
    mode,
    email,
    signOut,
    sync,
    lastSyncAt,
    pendingChanges,
  } = useApp();
  const { canInstall, installed, isIOS, install } = useInstallPrompt();
  const fileRef = useRef<HTMLInputElement>(null);
  const [newCategory, setNewCategory] = useState("");
  // Recitim la fiecare schimbare de date, ca butonul demo să fie corect.
  useTable("clients");
  const demoLoaded = hasDemoData();

  if (!settings) {
    return (
      <p className="text-sm text-muted-foreground">Se încarcă setările…</p>
    );
  }

  const rates = settings.default_rates;
  const prefs = settings.notification_prefs;
  const categories = settings.material_categories?.length
    ? settings.material_categories
    : DEFAULT_MATERIAL_CATEGORIES;

  const download = () => {
    const payload = exportData();
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `montajpro-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Backup descărcat");
  };

  const upload = async (file: File) => {
    try {
      const text = await file.text();
      const count = await importData(JSON.parse(text));
      toast.success(`${count} înregistrări importate`);
    } catch {
      toast.error("Fișierul nu a putut fi citit");
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Setări"
        description="Profil, monedă, tarife și backup"
      />

      <section className="space-y-3.5 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <User className="size-4 text-primary" /> Profil
        </h3>
        <Field label="Nume">
          <Input
            defaultValue={settings.full_name ?? ""}
            onBlur={(event) =>
              void updateSettings({ full_name: event.target.value || null })
            }
            placeholder="Ion Popescu"
          />
        </Field>
        <FieldRow>
          <Field label="Telefon">
            <Input
              type="tel"
              defaultValue={settings.phone ?? ""}
              onBlur={(event) =>
                void updateSettings({ phone: event.target.value || null })
              }
              placeholder="+373 69 123 456"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              defaultValue={settings.email ?? email ?? ""}
              onBlur={(event) =>
                void updateSettings({ email: event.target.value || null })
              }
            />
          </Field>
        </FieldRow>
        <Field label="Firmă / brand" hint="Apare pe oferte">
          <Input
            defaultValue={settings.company ?? ""}
            onBlur={(event) =>
              void updateSettings({ company: event.target.value || null })
            }
            placeholder="MontajPro SRL"
          />
        </Field>
      </section>

      <section className="space-y-3.5 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Coins className="size-4 text-primary" /> Monedă și unități
        </h3>
        <FieldRow>
          <Field label="Monedă">
            <Select
              value={settings.currency}
              onValueChange={(value) => {
                void updateSettings({ currency: value });
                toast.success(`Monedă: ${value}`);
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((item) => (
                  <SelectItem key={item.code} value={item.code}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Unități">
            <Select
              value={settings.units}
              onValueChange={(value) =>
                void updateSettings({ units: value as "metric" | "imperial" })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metric">Metric (m, m², cm)</SelectItem>
                <SelectItem value="imperial">Imperial (ft, in)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </FieldRow>
        <Field label="TVA" hint="0 dacă nu lucrezi cu TVA">
          <NumberInput
            value={settings.vat_percent}
            onChange={(value) => void updateSettings({ vat_percent: value })}
            suffix="%"
            step={1}
          />
        </Field>
      </section>

      <section className="space-y-3.5 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Ruler className="size-4 text-primary" /> Tarife implicite
        </h3>
        <p className="text-xs text-muted-foreground">
          Se folosesc automat în calculatorul de preț.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {(Object.keys(RATE_LABELS) as (keyof DefaultRates)[]).map((key) => (
            <Field key={key} label={RATE_LABELS[key]}>
              <MoneyInput
                value={rates[key]}
                currency={currency}
                onChange={(value) =>
                  void updateSettings({
                    default_rates: { ...rates, [key]: value },
                  })
                }
              />
            </Field>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Tags className="size-4 text-primary" /> Categorii materiale
        </h3>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <span
              key={category}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-sm"
            >
              {category}
              <button
                type="button"
                aria-label={`Șterge ${category}`}
                onClick={() =>
                  void updateSettings({
                    material_categories: categories.filter(
                      (item) => item !== category,
                    ),
                  })
                }
                className="text-muted-foreground hover:text-red-400"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newCategory}
            onChange={(event) => setNewCategory(event.target.value)}
            placeholder="Categorie nouă"
          />
          <Button
            variant="outline"
            onClick={() => {
              const value = newCategory.trim();
              if (!value || categories.includes(value)) return;
              void updateSettings({
                material_categories: [...categories, value],
              });
              setNewCategory("");
            }}
          >
            Adaugă
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="size-4 text-primary" /> Notificări
        </h3>
        {(Object.keys(NOTIFICATION_LABELS) as (keyof NotificationPrefs)[]).map(
          (key) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-sm">{NOTIFICATION_LABELS[key]}</span>
              <Switch
                checked={prefs[key]}
                onCheckedChange={(checked) =>
                  void updateSettings({
                    notification_prefs: { ...prefs, [key]: checked },
                  })
                }
              />
            </div>
          ),
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Smartphone className="size-4 text-primary" /> Aplicație
        </h3>
        {installed ? (
          <p className="text-sm text-muted-foreground">
            Aplicația este instalată pe acest dispozitiv. ✓
          </p>
        ) : canInstall ? (
          <Button
            className="w-full"
            onClick={async () => {
              const accepted = await install();
              if (accepted) toast.success("Aplicația se instalează");
            }}
          >
            <Download /> Instalează aplicația
          </Button>
        ) : isIOS ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Share className="mt-0.5 size-4 shrink-0" />
            Pe iPhone: apasă <strong>Partajează</strong>, apoi{" "}
            <strong>Adaugă pe ecranul principal</strong>.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Deschide site-ul în Chrome sau Safari pe telefon ca să îl poți
            instala.
          </p>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {mode === "local" ? "Mod local" : "Sincronizare cloud"}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {mode === "local"
                ? "Datele sunt doar pe acest dispozitiv"
                : lastSyncAt
                  ? `Ultima sincronizare: ${formatDateTime(lastSyncAt)}`
                  : "Încă nesincronizat"}
              {pendingChanges > 0 && ` · ${pendingChanges} de trimis`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void sync()}>
            <RefreshCw /> Sincronizează
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Building2 className="size-4 text-primary" /> Oferte
        </h3>
        <Field label="Condiții implicite" hint="Apar pe fiecare ofertă">
          <Textarea
            defaultValue={settings.quote_terms ?? ""}
            onBlur={(event) =>
              void updateSettings({ quote_terms: event.target.value || null })
            }
            placeholder="Garanție 24 luni la manoperă. Avans 40% la confirmare."
          />
        </Field>
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <FlaskConical className="size-4 text-primary" /> Date demo
        </h3>
        <p className="text-xs text-muted-foreground">
          Încarcă câteva lucrări, clienți și plăți de probă ca să vezi cum arată
          aplicația plină. Toate sunt marcate cu <strong>(DEMO)</strong> și se
          pot șterge oricând.
        </p>
        {demoLoaded ? (
          <Confirm
            title="Ștergi datele demo?"
            description="Se șterg doar înregistrările marcate cu (DEMO)."
            onConfirm={async () => {
              await removeDemoData();
              toast.success("Datele demo au fost șterse");
            }}
          >
            <Button
              variant="outline"
              className="w-full text-red-400 hover:text-red-300"
            >
              <Trash2 /> Șterge datele demo
            </Button>
          </Confirm>
        ) : (
          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              await seedDemoData();
              toast.success("Date demo încărcate");
            }}
          >
            <FlaskConical /> Încarcă date demo
          </Button>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Backup</h3>
        <p className="text-xs text-muted-foreground">
          Descarcă toate datele într-un fișier, ca să le poți păstra sau muta pe
          alt telefon.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={download}>
            <Download /> Export
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload /> Import
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </section>

      <Confirm
        title="Ieși din cont?"
        description="Datele nesincronizate rămase pe acest dispozitiv se șterg."
        confirmLabel="Ieși"
        onConfirm={() => void signOut()}
      >
        <Button
          variant="outline"
          size="xl"
          className="w-full text-red-400 hover:text-red-300"
        >
          <LogOut />{" "}
          {mode === "local" ? "Resetează datele locale" : "Ieși din cont"}
        </Button>
      </Confirm>
    </div>
  );
}
