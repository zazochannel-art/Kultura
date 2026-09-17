"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  FileText,
  Hammer,
  Play,
  Receipt,
  Ruler,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ClientDialog } from "@/components/forms/client-dialog";
import { ExpenseDialog } from "@/components/forms/expense-dialog";
import { useActiveSession, useJobs } from "@/hooks/use-data";
import { startWork } from "@/lib/db/actions";
import { cn } from "@/lib/utils";

/**
 * Meniul „Adaugă”. Regula: orice acțiune frecventă la maximum două apăsări —
 * o apăsare pe „+”, una pe acțiune.
 */
export function QuickAdd({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const jobs = useJobs();
  const activeSession = useActiveSession();
  const [clientOpen, setClientOpen] = useState(false);
  const [expenseOpen, setExpenseOpen] = useState(false);

  /** Lucrarea „curentă”: cea cronometrată, altfel cea de azi, altfel ultima. */
  const currentJob =
    (activeSession && jobs.find((job) => job.id === activeSession.job_id)) ||
    jobs.find((job) => job.status === "in_progress") ||
    jobs.find((job) => ["confirmed", "materials"].includes(job.status)) ||
    null;

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const actions = [
    {
      label: "Lucrare nouă",
      hint: "Client, preț, dată",
      icon: Hammer,
      tone: "from-cyan-500/20 to-cyan-500/5 text-cyan-300",
      onClick: () => go("/lucrari/nou"),
    },
    {
      label: "Măsurătoare rapidă",
      hint: "Scară, parchet, plintă",
      icon: Ruler,
      tone: "from-violet-500/20 to-violet-500/5 text-violet-300",
      onClick: () => go("/masuratori/nou"),
    },
    {
      label: activeSession ? "Lucrare în desfășurare" : "Start lucrare",
      hint: currentJob ? currentJob.title : "Alege o lucrare",
      icon: Play,
      tone: "from-emerald-500/20 to-emerald-500/5 text-emerald-300",
      onClick: async () => {
        if (activeSession) return go(`/lucrari/${activeSession.job_id}`);
        if (!currentJob) {
          onOpenChange(false);
          toast.info("Creează întâi o lucrare");
          return router.push("/lucrari/nou");
        }
        await startWork(currentJob.id);
        toast.success(`Cronometru pornit: ${currentJob.title}`);
        go(`/lucrari/${currentJob.id}`);
      },
    },
    {
      label: "Adaugă fotografie",
      hint: currentJob ? currentJob.title : "Alege o lucrare",
      icon: Camera,
      tone: "from-amber-500/20 to-amber-500/5 text-amber-300",
      onClick: () => {
        if (!currentJob) {
          onOpenChange(false);
          toast.info("Deschide o lucrare ca să adaugi poze");
          return router.push("/lucrari");
        }
        go(`/lucrari/${currentJob.id}?tab=poze`);
      },
    },
    {
      label: "Cheltuială",
      hint: "Materiale, combustibil, scule",
      icon: Receipt,
      tone: "from-red-500/20 to-red-500/5 text-red-300",
      onClick: () => {
        onOpenChange(false);
        setExpenseOpen(true);
      },
    },
    {
      label: "Client nou",
      hint: "Nume și telefon",
      icon: UserPlus,
      tone: "from-blue-500/20 to-blue-500/5 text-blue-300",
      onClick: () => {
        onOpenChange(false);
        setClientOpen(true);
      },
    },
    {
      label: "Ofertă nouă",
      hint: "Generează și trimite",
      icon: FileText,
      tone: "from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-300",
      onClick: () => go("/oferte/nou"),
    },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ce adaugi?</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            {actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => void action.onClick()}
                className="flex items-center gap-3.5 rounded-2xl border border-border bg-background p-3.5 text-left transition-colors hover:bg-accent active:scale-[0.99]"
              >
                <span
                  className={cn(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
                    action.tone,
                  )}
                >
                  <action.icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{action.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {action.hint}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ClientDialog open={clientOpen} onOpenChange={setClientOpen} />
      <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} />
    </>
  );
}
