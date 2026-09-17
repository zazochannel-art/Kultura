"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CloudOff, LogIn, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Logo } from "@/components/layout/logo";
import { useZodForm } from "@/hooks/use-zod-form";
import { authSchema } from "@/lib/schemas";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { useApp } from "@/lib/app-provider";

/**
 * Autentificare. Sunt trei căi: cont nou, cont existent și „mod local” pentru
 * cine vrea să pornească imediat, fără cont.
 */
export default function LoginPage() {
  const router = useRouter();
  const { startLocalMode } = useApp();
  const [tab, setTab] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const form = useZodForm(authSchema, { email: "", password: "" });

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    const supabase = getSupabase();
    if (!supabase) {
      setError("Supabase nu este configurat. Folosește modul local.");
      return;
    }
    setError(null);
    setNotice(null);

    if (tab === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) return setError(translateAuthError(signUpError.message));
      if (!data.session) {
        setNotice("Ți-am trimis un email de confirmare. Deschide-l și revino aici.");
        return;
      }
      toast.success("Cont creat");
      router.replace("/");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return setError(translateAuthError(signInError.message));
    toast.success("Bine ai revenit!");
    router.replace("/");
  });

  return (
    <div className="aurora flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo />
          <p className="text-balance text-sm text-muted-foreground">
            Lucrări, măsurători, bani și poze — toate în buzunar.
          </p>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-2xl">
          {isSupabaseConfigured ? (
            <>
              <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-background p-1">
                {(
                  [
                    ["signin", "Am cont"],
                    ["signup", "Cont nou"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTab(key);
                      setError(null);
                      setNotice(null);
                    }}
                    className={`rounded-lg py-2.5 text-sm font-medium transition-colors ${
                      tab === key ? "bg-accent text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <Field label="Email" htmlFor="email" error={form.errors.email}>
                  <Input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="nume@exemplu.md"
                    value={form.values.email}
                    onChange={(event) => form.set("email", event.target.value)}
                  />
                </Field>

                <Field
                  label="Parolă"
                  htmlFor="password"
                  error={form.errors.password}
                  hint={tab === "signup" ? "Minimum 6 caractere" : undefined}
                >
                  <Input
                    id="password"
                    type="password"
                    autoComplete={tab === "signup" ? "new-password" : "current-password"}
                    placeholder="••••••••"
                    value={form.values.password}
                    onChange={(event) => form.set("password", event.target.value)}
                  />
                </Field>

                {error && (
                  <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-sm text-red-300">
                    {error}
                  </p>
                )}
                {notice && (
                  <p className="flex items-start gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2.5 text-sm text-cyan-200">
                    <Mail className="mt-0.5 size-4 shrink-0" />
                    {notice}
                  </p>
                )}

                <Button type="submit" size="xl" className="w-full" loading={form.submitting}>
                  <LogIn />
                  {tab === "signup" ? "Creează cont" : "Intră în cont"}
                </Button>
              </form>

              <div className="my-5 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">sau</span>
                <span className="h-px flex-1 bg-border" />
              </div>
            </>
          ) : (
            <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
              <p className="font-medium">Sincronizarea în cloud nu este configurată</p>
              <p className="mt-1 text-amber-200/80">
                Adaugă cheile Supabase în <code>.env.local</code> ca să poți folosi contul pe
                mai multe telefoane. Până atunci poți lucra local.
              </p>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            size="xl"
            className="w-full"
            onClick={() => {
              startLocalMode();
              router.replace("/");
            }}
          >
            <CloudOff /> Continuă în mod local
          </Button>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5" />
          Datele tale rămân ale tale — fiecare cont vede doar propriile lucrări.
        </p>
      </div>
    </div>
  );
}

/** Mesajele Supabase sunt în engleză; le traducem pe cele uzuale. */
function translateAuthError(message: string): string {
  const map: Record<string, string> = {
    "Invalid login credentials": "Email sau parolă greșită",
    "User already registered": "Există deja un cont cu acest email",
    "Email not confirmed": "Confirmă întâi emailul primit",
    "Password should be at least 6 characters":
      "Parola trebuie să aibă cel puțin 6 caractere",
  };
  return map[message] ?? message;
}
