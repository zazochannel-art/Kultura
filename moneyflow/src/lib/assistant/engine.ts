import { evaluateAfford } from '@/lib/finance/afford';
import { formatMoney, parseAmount } from '@/lib/format';
import type { CurrencyCode, LanguageCode } from '@/lib/types/database';
import type { DailyBudgetResult } from '@/lib/finance/daily-budget';
import type { AssistantContext } from './context';

/**
 * The assistant's floor.
 *
 * Runs with no API key and no model: pure arithmetic over the same context
 * object the model would get. It exists so "ask about your money" is a real
 * feature of the app rather than a feature of whoever happens to have an API
 * key — and so there is always a grounded answer to compare the model's against.
 */

type Intent =
  | 'top_category'
  | 'category_spend'
  | 'can_i_afford'
  | 'how_to_save'
  | 'savings_forecast'
  | 'balance'
  | 'daily_budget'
  | 'budget_status'
  | 'goals'
  | 'debts'
  | 'score'
  | 'unknown';

const KEYWORDS: Record<Exclude<Intent, 'unknown' | 'category_spend'>, string[]> = {
  top_category: [
    'cei mai mulți bani', 'cel mai mult', 'pe ce am cheltuit', 'top categor',
    'больше всего', 'на что я потратил', 'most', 'spend the most', 'biggest',
  ],
  can_i_afford: [
    'pot cumpăra', 'îmi permit', 'imi permit', 'pot să cumpăr', 'afford',
    'могу ли я', 'могу купить', 'can i buy', 'can i afford',
  ],
  how_to_save: [
    'cum pot economisi', 'cum să economisesc', 'cum economisesc', 'vreau să economisesc',
    'как накопить', 'как сэкономить', 'how can i save', 'how do i save',
  ],
  savings_forecast: [
    'voi avea', 'peste 6 luni', 'peste', 'în câte luni', 'cât voi',
    'через', 'сколько накоплю', 'will i have', 'in 6 months', 'how much will i',
  ],
  daily_budget: [
    'pot cheltui azi', 'buget zilnic', 'astăzi', 'cât pot cheltui',
    'сегодня', 'дневной бюджет', 'spend today', 'daily budget',
  ],
  balance: [
    'sold', 'cât am', 'câți bani am', 'bani am',
    'баланс', 'сколько у меня', 'balance', 'how much do i have',
  ],
  budget_status: [
    'buget', 'bugete', 'depășit',
    'бюджет', 'бюджеты', 'budget', 'over budget',
  ],
  goals: [
    'obiectiv', 'obiective', 'scop',
    'цель', 'цели', 'goal', 'goals',
  ],
  debts: [
    'datorie', 'datorii', 'datorez',
    'долг', 'долги', 'debt', 'debts', 'owe',
  ],
  score: [
    'money score', 'scor', 'scorul',
    'оценка', 'счёт', 'score',
  ],
};

function detectIntent(question: string, context: AssistantContext): Intent {
  const q = question.toLowerCase();

  // Order matters: "can I afford X" also mentions money and categories.
  const ordered: Array<Exclude<Intent, 'unknown' | 'category_spend'>> = [
    'can_i_afford',
    'how_to_save',
    'top_category',
    'savings_forecast',
    'daily_budget',
    'budget_status',
    'goals',
    'debts',
    'score',
    'balance',
  ];

  for (const intent of ordered) {
    if (KEYWORDS[intent].some((keyword) => q.includes(keyword))) return intent;
  }

  // A bare category name is a question about that category.
  const named = context.categoriesLast6Months.find((row) => q.includes(row.name.toLowerCase()));
  if (named) return 'category_spend';

  return 'unknown';
}

function findCategory(question: string, context: AssistantContext) {
  const q = question.toLowerCase();
  return (
    context.categoriesThisMonth.find((row) => q.includes(row.name.toLowerCase())) ??
    context.categoriesLast6Months.find((row) => q.includes(row.name.toLowerCase())) ??
    null
  );
}

/** First money-looking number in the question — "un iPhone de 20.000" → 20000. */
function extractAmount(question: string): number | null {
  const match = question.match(/(\d[\d\s.,]*)/g);
  if (!match) return null;

  const candidates = match
    .map((raw) => parseAmount(raw))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (candidates.length === 0) return null;
  return Math.max(...candidates);
}

export interface EngineAnswer {
  text: string;
  intent: Intent;
  grounded: true;
}

export function answerFromData(
  question: string,
  context: AssistantContext,
  budget: DailyBudgetResult,
  lang: LanguageCode,
): EngineAnswer {
  const currency = context.currency as CurrencyCode;
  const money = (value: number) => formatMoney(value, currency, lang);
  const intent = detectIntent(question, context);

  const L = LINES[lang] ?? LINES.ro;

  switch (intent) {
    case 'top_category': {
      const top = context.categoriesThisMonth[0];
      if (!top) return { text: L.noData, intent, grounded: true };
      const rest = context.categoriesThisMonth.slice(1, 4);
      return {
        text: [
          L.topCategory(top.name, money(top.spent), top.share),
          rest.length > 0
            ? `${L.then} ${rest.map((row) => `${row.name} ${money(row.spent)}`).join(', ')}.`
            : '',
        ]
          .filter(Boolean)
          .join(' '),
        intent,
        grounded: true,
      };
    }

    case 'category_spend': {
      const category = findCategory(question, context);
      if (!category) return { text: L.noData, intent, grounded: true };

      const long = context.categoriesLast6Months.find((row) => row.name === category.name);
      const thisMonth =
        'spent' in category ? category.spent : (category as { total: number }).total;

      return {
        text: [
          L.categorySpend(category.name, money(thisMonth)),
          long ? L.categoryAverage(money(long.monthlyAverage)) : '',
        ]
          .filter(Boolean)
          .join(' '),
        intent,
        grounded: true,
      };
    }

    case 'can_i_afford': {
      const price = extractAmount(question);
      if (price === null) return { text: L.needPrice, intent, grounded: true };

      const result = evaluateAfford({
        price,
        budget,
        savingsBalance: context.balance.savings,
        monthlySavingsTarget: context.profile.monthlySavingsTarget,
        goals: context.goals.map((goal, index) => ({
          id: String(index),
          name: goal.name,
          monthly_contribution: goal.monthlyContribution,
          target_amount: goal.target,
          current_amount: goal.current,
        })),
      });

      return {
        text: L.afford(
          result.verdict,
          money(price),
          money(result.remainingAfter),
          money(result.dailyAfter),
          budget.remainingDays,
        ),
        intent,
        grounded: true,
      };
    }

    case 'how_to_save': {
      const goal = extractAmount(question) ?? context.profile.monthlySavingsTarget;
      const top = context.categoriesThisMonth.slice(0, 3);
      if (top.length === 0) return { text: L.noData, intent, grounded: true };

      // Split the target across the three biggest categories, weighted by spend.
      const topTotal = top.reduce((sum, row) => sum + row.spent, 0);
      const cuts = top.map((row) => ({
        name: row.name,
        cut: topTotal > 0 ? Math.round((row.spent / topTotal) * goal) : 0,
        spent: row.spent,
      }));

      return {
        text: [
          L.saveIntro(money(goal)),
          cuts
            .filter((cut) => cut.cut > 0)
            .map((cut) => `${cut.name}: −${money(cut.cut)} (${money(cut.spent)} → ${money(cut.spent - cut.cut)})`)
            .join('; '),
          L.saveOutro(money(budget.dailyBudget)),
        ].join(' '),
        intent,
        grounded: true,
      };
    }

    case 'savings_forecast': {
      const months = extractAmount(question);
      const horizon = months !== null && months <= 60 ? Math.round(months) : 6;

      const history = context.monthlyHistory;
      const averageSaved =
        history.length > 0
          ? history.reduce((sum, row) => sum + (row.income - row.expenses), 0) / history.length
          : context.profile.monthlySavingsTarget;

      const projected = context.balance.savings + averageSaved * horizon;

      return {
        text: L.forecast(horizon, money(Math.max(0, projected)), money(averageSaved)),
        intent,
        grounded: true,
      };
    }

    case 'daily_budget':
      return {
        text: L.daily(
          money(budget.canSpendToday),
          money(budget.dailyBudget),
          budget.remainingDays,
          money(budget.availableMoney),
        ),
        intent,
        grounded: true,
      };

    case 'balance':
      return {
        text: L.balance(
          money(context.balance.total),
          money(context.month.income),
          money(context.month.expenses),
          money(context.balance.savings),
        ),
        intent,
        grounded: true,
      };

    case 'budget_status': {
      if (context.budgets.length === 0) return { text: L.noBudgets, intent, grounded: true };
      const over = context.budgets.filter((row) => row.status === 'over');
      const near = context.budgets.filter((row) => row.status === 'near_limit');

      return {
        text: [
          over.length > 0
            ? L.budgetOver(over.map((row) => `${row.category} (${money(row.spent - row.planned)})`).join(', '))
            : '',
          near.length > 0 ? L.budgetNear(near.map((row) => row.category).join(', ')) : '',
          over.length === 0 && near.length === 0 ? L.budgetFine : '',
        ]
          .filter(Boolean)
          .join(' '),
        intent,
        grounded: true,
      };
    }

    case 'goals': {
      if (context.goals.length === 0) return { text: L.noGoals, intent, grounded: true };
      return {
        text: context.goals
          .map((goal) =>
            L.goal(
              goal.name,
              money(goal.current),
              money(goal.target),
              goal.monthsToReach,
            ),
          )
          .join(' '),
        intent,
        grounded: true,
      };
    }

    case 'debts': {
      if (context.debts.items.length === 0) return { text: L.noDebts, intent, grounded: true };
      return {
        text: L.debts(money(context.debts.iOwe), money(context.debts.owedToMe)),
        intent,
        grounded: true,
      };
    }

    case 'score':
      return {
        text: L.score(context.moneyScore.score, context.moneyScore.savingsRate),
        intent,
        grounded: true,
      };

    default:
      return { text: L.fallback(money(budget.canSpendToday), money(context.balance.total)), intent, grounded: true };
  }
}

interface Lines {
  noData: string;
  noBudgets: string;
  noGoals: string;
  noDebts: string;
  needPrice: string;
  then: string;
  budgetFine: string;
  topCategory: (name: string, amount: string, share: number) => string;
  categorySpend: (name: string, amount: string) => string;
  categoryAverage: (amount: string) => string;
  afford: (verdict: string, price: string, left: string, daily: string, days: number) => string;
  saveIntro: (amount: string) => string;
  saveOutro: (daily: string) => string;
  forecast: (months: number, total: string, perMonth: string) => string;
  daily: (today: string, perDay: string, days: number, available: string) => string;
  balance: (total: string, income: string, expenses: string, savings: string) => string;
  budgetOver: (list: string) => string;
  budgetNear: (list: string) => string;
  goal: (name: string, current: string, target: string, months: number | null) => string;
  debts: (owe: string, owed: string) => string;
  score: (score: number, rate: number) => string;
  fallback: (today: string, total: string) => string;
}

const LINES: Record<LanguageCode, Lines> = {
  ro: {
    noData: 'Nu am destule date ca să răspund. Adaugă câteva tranzacții și întreabă din nou.',
    noBudgets: 'Nu ai setat încă bugete pe categorii.',
    noGoals: 'Nu ai încă niciun obiectiv.',
    noDebts: 'Nu ai datorii înregistrate.',
    needPrice: 'Spune-mi cât costă și îți spun dacă îți permiți.',
    then: 'Apoi:',
    budgetFine: 'Toate bugetele sunt în limite.',
    topCategory: (name, amount, share) =>
      `Luna aceasta ai cheltuit cel mai mult pe ${name}: ${amount} (${share}% din total).`,
    categorySpend: (name, amount) => `Luna aceasta ai cheltuit ${amount} pe ${name}.`,
    categoryAverage: (amount) => `Media ultimelor luni este ${amount} pe lună.`,
    afford: (verdict, price, left, daily, days) =>
      verdict === 'yes'
        ? `Da. După o achiziție de ${price} îți rămân ${left} și ${daily} pe zi pentru următoarele ${days} zile.`
        : verdict === 'careful'
          ? `Cu atenție. După ${price} îți rămân ${left}, adică doar ${daily} pe zi pentru ${days} zile.`
          : `Nu e recomandat. ${price} depășește ce ai disponibil; ți-ar rămâne ${left}.`,
    saveIntro: (amount) => `Ca să economisești ${amount} luna aceasta, ai putea tăia:`,
    saveOutro: (daily) => `Bugetul tău zilnic curent este ${daily}.`,
    forecast: (months, total, perMonth) =>
      `În ritmul actual (${perMonth} pe lună), peste ${months} luni ai avea aproximativ ${total} în economii.`,
    daily: (today, perDay, days, available) =>
      `Azi poți cheltui ${today}. Bugetul zilnic este ${perDay} pentru cele ${days} zile rămase, din ${available} disponibili.`,
    balance: (total, income, expenses, savings) =>
      `Ai ${total} în total. Luna aceasta: ${income} venituri, ${expenses} cheltuieli, ${savings} în economii.`,
    budgetOver: (list) => `Ai depășit bugetul la: ${list}.`,
    budgetNear: (list) => `Aproape de limită: ${list}.`,
    goal: (name, current, target, months) =>
      `${name}: ${current} din ${target}${months !== null ? `, aproximativ ${months} luni rămase` : ''}.`,
    debts: (owe, owed) => `Datorezi ${owe} și ți se datorează ${owed}.`,
    score: (score, rate) => `Money Score-ul tău este ${score}/100, cu o rată de economisire de ${rate}%.`,
    fallback: (today, total) =>
      `Pot răspunde despre cheltuieli, bugete, obiective și datorii. Deocamdată: azi poți cheltui ${today}, iar soldul tău total este ${total}.`,
  },
  ru: {
    noData: 'Данных пока не хватает. Добавьте несколько операций и спросите снова.',
    noBudgets: 'Бюджеты по категориям ещё не заданы.',
    noGoals: 'Целей пока нет.',
    noDebts: 'Долгов не записано.',
    needPrice: 'Скажите цену — и я отвечу, по карману ли это.',
    then: 'Затем:',
    budgetFine: 'Все бюджеты в пределах нормы.',
    topCategory: (name, amount, share) =>
      `В этом месяце больше всего ушло на «${name}»: ${amount} (${share}% от всех расходов).`,
    categorySpend: (name, amount) => `В этом месяце на «${name}» потрачено ${amount}.`,
    categoryAverage: (amount) => `Среднее за последние месяцы — ${amount} в месяц.`,
    afford: (verdict, price, left, daily, days) =>
      verdict === 'yes'
        ? `Да. После покупки на ${price} останется ${left} и ${daily} в день на следующие ${days} дн.`
        : verdict === 'careful'
          ? `Осторожно. После ${price} останется ${left} — всего ${daily} в день на ${days} дн.`
          : `Не рекомендуется. ${price} больше доступного; останется ${left}.`,
    saveIntro: (amount) => `Чтобы накопить ${amount} в этом месяце, можно сократить:`,
    saveOutro: (daily) => `Текущий дневной бюджет — ${daily}.`,
    forecast: (months, total, perMonth) =>
      `При нынешнем темпе (${perMonth} в месяц) через ${months} мес. накопления составят около ${total}.`,
    daily: (today, perDay, days, available) =>
      `Сегодня можно потратить ${today}. Дневной бюджет — ${perDay} на оставшиеся ${days} дн., из ${available} доступных.`,
    balance: (total, income, expenses, savings) =>
      `Всего у вас ${total}. В этом месяце: доходы ${income}, расходы ${expenses}, накопления ${savings}.`,
    budgetOver: (list) => `Бюджет превышен: ${list}.`,
    budgetNear: (list) => `Близко к лимиту: ${list}.`,
    goal: (name, current, target, months) =>
      `${name}: ${current} из ${target}${months !== null ? `, осталось примерно ${months} мес.` : ''}.`,
    debts: (owe, owed) => `Вы должны ${owe}, вам должны ${owed}.`,
    score: (score, rate) => `Ваш Money Score — ${score}/100, норма сбережений ${rate}%.`,
    fallback: (today, total) =>
      `Могу ответить про расходы, бюджеты, цели и долги. Пока так: сегодня можно потратить ${today}, общий баланс — ${total}.`,
  },
  en: {
    noData: "I don't have enough data to answer. Add a few transactions and ask again.",
    noBudgets: "You haven't set any category budgets yet.",
    noGoals: 'You have no goals yet.',
    noDebts: 'No debts recorded.',
    needPrice: 'Tell me the price and I will tell you whether you can afford it.',
    then: 'Then:',
    budgetFine: 'Every budget is within its limit.',
    topCategory: (name, amount, share) =>
      `This month your biggest spend was ${name}: ${amount} (${share}% of everything).`,
    categorySpend: (name, amount) => `You spent ${amount} on ${name} this month.`,
    categoryAverage: (amount) => `The recent monthly average is ${amount}.`,
    afford: (verdict, price, left, daily, days) =>
      verdict === 'yes'
        ? `Yes. After spending ${price} you keep ${left}, which is ${daily} a day for the next ${days} days.`
        : verdict === 'careful'
          ? `Careful. After ${price} you keep ${left} — only ${daily} a day for ${days} days.`
          : `Not recommended. ${price} is more than you have available; you would be left with ${left}.`,
    saveIntro: (amount) => `To save ${amount} this month you could cut:`,
    saveOutro: (daily) => `Your current daily budget is ${daily}.`,
    forecast: (months, total, perMonth) =>
      `At the current rate (${perMonth} a month), in ${months} months you would have about ${total} saved.`,
    daily: (today, perDay, days, available) =>
      `You can spend ${today} today. The daily budget is ${perDay} across the ${days} days left, out of ${available} available.`,
    balance: (total, income, expenses, savings) =>
      `You have ${total} in total. This month: ${income} in, ${expenses} out, ${savings} saved.`,
    budgetOver: (list) => `Over budget: ${list}.`,
    budgetNear: (list) => `Close to the limit: ${list}.`,
    goal: (name, current, target, months) =>
      `${name}: ${current} of ${target}${months !== null ? `, roughly ${months} months to go` : ''}.`,
    debts: (owe, owed) => `You owe ${owe} and you are owed ${owed}.`,
    score: (score, rate) => `Your Money Score is ${score}/100, with a ${rate}% savings rate.`,
    fallback: (today, total) =>
      `I can answer about spending, budgets, goals and debts. For now: you can spend ${today} today, and your total balance is ${total}.`,
  },
};
