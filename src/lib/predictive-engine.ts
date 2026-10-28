import type {
  Category,
  PredictionResult,
  PredictionTimelinePoint,
  RecurringPayment,
  ScenarioAdjustment,
  ScheduledEvent,
  Transaction,
} from './types.ts';

interface ProjectCashflowParams {
  startBalance: number;
  safetyBuffer: number;
  recurringPayments: RecurringPayment[];
  transactions: Transaction[];
  categories: Category[];
  horizonDays: number;
  variableBurnMultiplier?: number;
  scenario?: ScenarioAdjustment;
  customStartDate?: string;
}

export function calculateDailyVariableBurn(
  transactions: Transaction[],
  lookbackDays: number = 30
): number {
  const now = new Date();
  const pastCutoff = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);

  const variableExpenses = transactions.filter((tx) => {
    if (tx.type !== 'expense') return false;
    if (tx.isRecurring) return false;
    const txDate = new Date(tx.date);
    return txDate >= pastCutoff;
  });

  const total = variableExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  const calculatedDaily = total / Math.max(1, lookbackDays);

  // If data has zero transactions, provide a realistic baseline ($42.50/day)
  return calculatedDaily > 0 ? calculatedDaily : 42.5;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function daysBetween(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
  return Math.round((e - s) / msPerDay);
}

function getLastDayOfMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

export function shouldEventTrigger(
  item: RecurringPayment,
  currentDate: Date
): boolean {
  if (!item.isActive) return false;

  const parts = item.nextDueDate.split('-');
  const anchorDate = new Date(
    parseInt(parts[0], 10),
    parseInt(parts[1], 10) - 1,
    parseInt(parts[2], 10)
  );

  const dayDiff = daysBetween(anchorDate, currentDate);
  if (dayDiff < 0) {
    // Current date is before initial anchor, but check if it's the exact same day
    return isSameDay(anchorDate, currentDate);
  }

  const curYear = currentDate.getFullYear();
  const curMonth = currentDate.getMonth();
  const curDay = currentDate.getDate();

  switch (item.frequency) {
    case 'daily':
      return true;

    case 'weekly':
      return dayDiff % 7 === 0;

    case 'biweekly':
      return dayDiff % 14 === 0;

    case 'monthly': {
      const maxDaysThisMonth = getLastDayOfMonth(curYear, curMonth);
      const targetDay = Math.min(item.dueDay, maxDaysThisMonth);
      return curDay === targetDay;
    }

    case 'quarterly': {
      const maxDaysThisMonth = getLastDayOfMonth(curYear, curMonth);
      const targetDay = Math.min(item.dueDay, maxDaysThisMonth);
      if (curDay !== targetDay) return false;
      const anchorMonth = anchorDate.getMonth();
      const monthDiff = (curYear - anchorDate.getFullYear()) * 12 + (curMonth - anchorMonth);
      return monthDiff >= 0 && monthDiff % 3 === 0;
    }

    case 'annual': {
      return (
        curMonth === anchorDate.getMonth() &&
        curDay === anchorDate.getDate()
      );
    }

    default:
      return false;
  }
}

export function projectCashflow({
  startBalance,
  safetyBuffer,
  recurringPayments,
  transactions,
  categories,
  horizonDays,
  variableBurnMultiplier = 1.0,
  scenario,
  customStartDate,
}: ProjectCashflowParams): PredictionResult {
  const categoryMap = new Map<string, Category>();
  for (const cat of categories) {
    categoryMap.set(cat.id, cat);
  }

  const baseDate = customStartDate ? new Date(customStartDate) : new Date();
  baseDate.setHours(0, 0, 0, 0);

  const rawDailyVariableBurn = calculateDailyVariableBurn(transactions, 30);
  const effectiveDailyVariableBurn = rawDailyVariableBurn * Math.max(0, variableBurnMultiplier);

  const timeline: PredictionTimelinePoint[] = [];

  let currentBaseline = startBalance;
  let currentSimulated = startBalance;

  let baselineLowestBalance = startBalance;
  let baselineLowestDate = baseDate.toISOString().slice(0, 10);
  let baselineBreachDetected = startBalance < safetyBuffer;
  let baselineDaysUntilBreach: number | null = baselineBreachDetected ? 0 : null;

  let simulatedLowestBalance = startBalance;
  let simulatedLowestDate = baseDate.toISOString().slice(0, 10);
  let simulatedBreachDetected = startBalance < safetyBuffer;
  let simulatedDaysUntilBreach: number | null = simulatedBreachDetected ? 0 : null;

  let totalProjectedIncome = 0;
  let totalProjectedFixedExpense = 0;
  let totalProjectedVariableExpense = 0;

  const scenarioActive = Boolean(scenario?.enabled);
  const monthlyExpenseDelta = scenarioActive ? (scenario?.monthlyExpenseDelta ?? 0) : 0;
  const monthlyIncomeDelta = scenarioActive ? (scenario?.monthlyIncomeDelta ?? 0) : 0;
  const oneTimeAmount = scenarioActive ? (scenario?.oneTimeAmount ?? 0) : 0;
  const oneTimeDayOffset = scenarioActive ? (scenario?.oneTimeDayOffset ?? 0) : 0;

  // Convert monthly deltas to daily increments for smooth simulation
  const dailyIncomeDelta = monthlyIncomeDelta / 30.417;
  const dailyExpenseDelta = monthlyExpenseDelta / 30.417;

  for (let day = 1; day <= horizonDays; day++) {
    const iterDate = new Date(baseDate.getTime() + day * 24 * 60 * 60 * 1000);
    const dateStr = iterDate.toISOString().slice(0, 10);

    const incomeEvents: ScheduledEvent[] = [];
    const expenseEvents: ScheduledEvent[] = [];

    let dayScheduledIncome = 0;
    let dayScheduledExpense = 0;

    for (const payment of recurringPayments) {
      if (shouldEventTrigger(payment, iterDate)) {
        const cat = categoryMap.get(payment.categoryId);
        const event: ScheduledEvent = {
          name: payment.name,
          amount: payment.amount,
          category: cat ? cat.name : 'General',
          isRecurring: true,
        };

        if (payment.type === 'income') {
          incomeEvents.push(event);
          dayScheduledIncome += payment.amount;
        } else {
          expenseEvents.push(event);
          dayScheduledExpense += payment.amount;
        }
      }
    }

    totalProjectedIncome += dayScheduledIncome;
    totalProjectedFixedExpense += dayScheduledExpense;
    totalProjectedVariableExpense += effectiveDailyVariableBurn;

    // Baseline calculation
    const baselineDayNet = dayScheduledIncome - dayScheduledExpense - effectiveDailyVariableBurn;
    currentBaseline += baselineDayNet;

    // Simulated calculation
    let simulatedDayNet = baselineDayNet;
    if (scenarioActive) {
      simulatedDayNet += dailyIncomeDelta;
      simulatedDayNet -= dailyExpenseDelta;

      if (day === oneTimeDayOffset) {
        simulatedDayNet += oneTimeAmount;
        if (oneTimeAmount > 0) {
          incomeEvents.push({
            name: `Scenario Windfall (${scenario?.name || 'Lump Sum'})`,
            amount: oneTimeAmount,
            category: 'Simulation',
            isRecurring: false,
          });
        } else if (oneTimeAmount < 0) {
          expenseEvents.push({
            name: `Scenario Expense (${scenario?.name || 'One-Time'})`,
            amount: Math.abs(oneTimeAmount),
            category: 'Simulation',
            isRecurring: false,
          });
        }
      }
    }
    currentSimulated += simulatedDayNet;

    // Check lowest balances
    if (currentBaseline < baselineLowestBalance) {
      baselineLowestBalance = currentBaseline;
      baselineLowestDate = dateStr;
    }
    if (currentSimulated < simulatedLowestBalance) {
      simulatedLowestBalance = currentSimulated;
      simulatedLowestDate = dateStr;
    }

    // Check breach flags
    if (!baselineBreachDetected && currentBaseline < safetyBuffer) {
      baselineBreachDetected = true;
      baselineDaysUntilBreach = day;
    }
    if (!simulatedBreachDetected && currentSimulated < safetyBuffer) {
      simulatedBreachDetected = true;
      simulatedDaysUntilBreach = day;
    }

    timeline.push({
      day,
      date: dateStr,
      baselineBalance: Math.round(currentBaseline * 100) / 100,
      simulatedBalance: Math.round(currentSimulated * 100) / 100,
      incomeEvents,
      expenseEvents,
      dailyVariableBurn: Math.round(effectiveDailyVariableBurn * 100) / 100,
      netDelta: Math.round(baselineDayNet * 100) / 100,
    });
  }

  return {
    horizonDays,
    startBalance,
    safetyBuffer,
    baselineLowestBalance: Math.round(baselineLowestBalance * 100) / 100,
    baselineLowestDate,
    baselineBreachDetected,
    baselineDaysUntilBreach,
    simulatedLowestBalance: Math.round(simulatedLowestBalance * 100) / 100,
    simulatedLowestDate,
    simulatedBreachDetected,
    simulatedDaysUntilBreach,
    dailyTimeline: timeline,
    dailyVariableBurnRate: Math.round(effectiveDailyVariableBurn * 100) / 100,
    summary: {
      totalProjectedIncome: Math.round(totalProjectedIncome * 100) / 100,
      totalProjectedFixedExpense: Math.round(totalProjectedFixedExpense * 100) / 100,
      totalProjectedVariableExpense: Math.round(totalProjectedVariableExpense * 100) / 100,
      baselineEndBalance: Math.round(currentBaseline * 100) / 100,
      simulatedEndBalance: Math.round(currentSimulated * 100) / 100,
    },
  };
}
