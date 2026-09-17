"use client";

import Link from "next/link";
import {
  ArrowRight,
  Calculator,
  CalendarCheck,
  Clock,
  FileText,
  Hammer,
  Package,
  Plus,
  Receipt,
  Ruler,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { TodayJobCard } from "@/components/dashboard/today-job-card";
import { JobCard } from "@/components/jobs/job-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useDashboardData } from "@/hooks/use-data";
import { useApp } from "@/lib/app-provider";
import { formatDuration, formatMoney, monthName, weekdayName } from "@/lib/format";

/** Dashboard-ul: ce se întâmplă azi, cât ai de încasat, cum stai luna asta. */
export default function DashboardPage() {
  const { currency, settings } = useApp();
  const data = useDashboardData();
  const today = new Date();
  const firstName = settings?.full_name?.split(" ")[0];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-sm capitalize text-muted-foreground">
          {weekdayName(today)}, {today.getDate()} {monthName(today.getMonth())}
        </p>
        <h2 className="text-2xl font-bold tracking-tight">
          {firstName ? `Salut, ${firstName}` : "Salut"} 👋
        </h2>
      </header>

      <section className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
        <StatCard
          label="Lucrări active"
          value={String(data.activeJobs.length)}
          icon={Hammer}
          tone="primary"
          href="/lucrari?filtru=in_progress"
          hint={`${data.todayJobs.length} programate azi`}
        />
        <StatCard
          label="Bani de încasat"
          value={formatMoney(data.receivable, currency, { compact: true })}
          icon={Wallet}
          tone="warning"
          href="/finante"
        />
        <StatCard
          label="Încasări luna asta"
          value={formatMoney(data.monthIncome, currency, { compact: true })}
          icon={TrendingUp}
          tone="success"
          href="/finante"
        />
        <StatCard
          label="Cheltuieli luna asta"
          value={formatMoney(data.monthExpenses, currency, { compact: true })}
          icon={TrendingDown}
          tone="danger"
          href="/finante"
        />
        <StatCard
          label="Profit estimat"
          value={formatMoney(data.monthProfit, currency, { compact: true })}
          icon={Receipt}
          tone={data.monthProfit >= 0 ? "success" : "danger"}
          href="/finante"
        />
        <StatCard
          label="Ore lucrate"
          value={formatDuration(data.monthMinutes)}
          icon={Clock}
          tone="secondary"
          hint="luna aceasta"
        />
        <StatCard
          label="Materiale necesare"
          value={String(data.neededMaterials.length)}
          icon={Package}
          tone={data.neededMaterials.length ? "warning" : "default"}
          href="/materiale"
          hint="de cumpărat"
        />
        <StatCard
          label="Oferte trimise"
          value={String(data.pendingQuotes.length)}
          icon={FileText}
          tone="secondary"
          href="/oferte"
          hint="în așteptare"
        />
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-semibold">
            <CalendarCheck className="size-5 text-primary" /> Astăzi
          </h3>
          <Link
            href="/calendar"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Calendar <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {data.todayJobs.length ? (
          <div className="space-y-3">
            {data.todayJobs.map((job) => (
              <TodayJobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarCheck}
            title="Nicio lucrare programată azi"
            description="Zi liberă sau încă neplanificată. Poți adăuga o lucrare sau face o măsurătoare."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild>
                  <Link href="/lucrari/nou">
                    <Plus /> Lucrare nouă
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/masuratori/nou">
                    <Ruler /> Măsurătoare
                  </Link>
                </Button>
              </div>
            }
          />
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Link
          href="/calculator"
          className="card-hover flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300">
            <Calculator className="size-5" />
          </span>
          <div>
            <p className="font-medium">Calculator preț</p>
            <p className="text-xs text-muted-foreground">Trepte, m², metri liniari</p>
          </div>
        </Link>
        <Link
          href="/masuratori/nou"
          className="card-hover flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
            <Ruler className="size-5" />
          </span>
          <div>
            <p className="font-medium">Măsurătoare rapidă</p>
            <p className="text-xs text-muted-foreground">Direct de pe telefon</p>
          </div>
        </Link>
        <Link
          href="/oferte/nou"
          className="card-hover flex items-center gap-3 rounded-2xl border border-border bg-card p-4 hover:border-primary/40"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-fuchsia-500/10 text-fuchsia-300">
            <FileText className="size-5" />
          </span>
          <div>
            <p className="font-medium">Ofertă nouă</p>
            <p className="text-xs text-muted-foreground">Gata de trimis clientului</p>
          </div>
        </Link>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Lucrări recente</h3>
          <Link
            href="/lucrari"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            Toate <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {data.recentJobs.length ? (
          <div className="space-y-3">
            {data.recentJobs.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Hammer}
            title="Nicio lucrare încă"
            description="Adaugă prima lucrare ca să vezi aici tot ce ai de făcut."
            action={
              <Button asChild>
                <Link href="/lucrari/nou">
                  <Plus /> Lucrare nouă
                </Link>
              </Button>
            }
          />
        )}
      </section>
    </div>
  );
}
