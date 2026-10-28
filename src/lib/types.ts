export type TransactionType = 'expense' | 'income';
export type AccountType = 'checking' | 'savings' | 'credit' | 'investment';
export type FrequencyType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual';
export type TransactionStatus = 'cleared' | 'pending';

export interface Category {
  id: string;
  name: string;
  type: TransactionType;
  colorHex: string;
  iconName: string;
  isEssential: boolean;
  defaultBudget: number;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currentBalance: number;
  currency: string;
  institutionName: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  categoryId: string;
  amount: number;
  type: TransactionType;
  description: string;
  date: string; // YYYY-MM-DD
  status: TransactionStatus;
  tags: string[];
  isRecurring?: boolean;
  recurringPaymentId?: string;
  createdAt: string;
}

export interface RecurringPayment {
  id: string;
  name: string;
  categoryId: string;
  accountId?: string;
  amount: number;
  type: TransactionType;
  frequency: FrequencyType;
  dueDay: number; // 1-31
  nextDueDate: string; // YYYY-MM-DD
  autopay: boolean;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  period: 'monthly' | 'annual';
  allocatedAmount: number;
  monthYear: string; // YYYY-MM
}

export interface UserFinancials {
  netWorth: number;
  liquidBalance: number;
  monthlyIncome: number;
  monthlyFixedExpenses: number;
  monthlyVariableEstimated: number;
  monthlyNetSavings: number;
  savingsRatePct: number;
  safetyBuffer: number;
  currency: string;
}

export interface ScenarioAdjustment {
  enabled: boolean;
  monthlyExpenseDelta: number;
  monthlyIncomeDelta: number;
  oneTimeAmount: number;
  oneTimeDayOffset: number;
  name?: string;
}

export interface ScheduledEvent {
  name: string;
  amount: number;
  category: string;
  isRecurring: boolean;
}

export interface PredictionTimelinePoint {
  day: number;
  date: string; // YYYY-MM-DD
  baselineBalance: number;
  simulatedBalance: number;
  incomeEvents: ScheduledEvent[];
  expenseEvents: ScheduledEvent[];
  dailyVariableBurn: number;
  netDelta: number;
}

export interface PredictionResult {
  horizonDays: number;
  startBalance: number;
  safetyBuffer: number;
  baselineLowestBalance: number;
  baselineLowestDate: string;
  baselineBreachDetected: boolean;
  baselineDaysUntilBreach: number | null;
  simulatedLowestBalance: number;
  simulatedLowestDate: string;
  simulatedBreachDetected: boolean;
  simulatedDaysUntilBreach: number | null;
  dailyTimeline: PredictionTimelinePoint[];
  dailyVariableBurnRate: number;
  summary: {
    totalProjectedIncome: number;
    totalProjectedFixedExpense: number;
    totalProjectedVariableExpense: number;
    baselineEndBalance: number;
    simulatedEndBalance: number;
  };
}

export interface FinancialStoreData {
  user: {
    id: string;
    name: string;
    currency: string;
    safetyBuffer: number;
  };
  accounts: Account[];
  categories: Category[];
  recurringPayments: RecurringPayment[];
  transactions: Transaction[];
  budgets: Budget[];
  scenarios: ScenarioAdjustment[];
}
