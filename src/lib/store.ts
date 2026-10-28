import fs from 'fs';
import path from 'path';
import {
  Account,
  Budget,
  Category,
  FinancialStoreData,
  RecurringPayment,
  ScenarioAdjustment,
  Transaction,
  UserFinancials,
} from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'financials.json');

const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-inc-sal', name: 'Salary & Wages', type: 'income', colorHex: '#10b981', iconName: 'Briefcase', isEssential: true, defaultBudget: 7500 },
  { id: 'cat-inc-side', name: 'Freelance & Consulting', type: 'income', colorHex: '#059669', iconName: 'Laptop', isEssential: false, defaultBudget: 1200 },
  { id: 'cat-exp-rent', name: 'Housing & Rent', type: 'expense', colorHex: '#ef4444', iconName: 'Home', isEssential: true, defaultBudget: 2100 },
  { id: 'cat-exp-util', name: 'Utilities & Power', type: 'expense', colorHex: '#f59e0b', iconName: 'Zap', isEssential: true, defaultBudget: 220 },
  { id: 'cat-exp-net', name: 'Internet & Fiber', type: 'expense', colorHex: '#3b82f6', iconName: 'Wifi', isEssential: true, defaultBudget: 80 },
  { id: 'cat-exp-groc', name: 'Groceries & Household', type: 'expense', colorHex: '#84cc16', iconName: 'ShoppingCart', isEssential: true, defaultBudget: 600 },
  { id: 'cat-exp-sub', name: 'Subscriptions & Software', type: 'expense', colorHex: '#8b5cf6', iconName: 'CreditCard', isEssential: false, defaultBudget: 150 },
  { id: 'cat-exp-ins', name: 'Insurance & Healthcare', type: 'expense', colorHex: '#ec4899', iconName: 'Shield', isEssential: true, defaultBudget: 380 },
  { id: 'cat-exp-trans', name: 'Transport & Fuel', type: 'expense', colorHex: '#06b6d4', iconName: 'Car', isEssential: true, defaultBudget: 250 },
  { id: 'cat-exp-dine', name: 'Dining & Coffee', type: 'expense', colorHex: '#f97316', iconName: 'Coffee', isEssential: false, defaultBudget: 400 },
  { id: 'cat-exp-fit', name: 'Fitness & Wellness', type: 'expense', colorHex: '#14b8a6', iconName: 'Activity', isEssential: false, defaultBudget: 110 },
];

const INITIAL_ACCOUNTS: Account[] = [
  {
    id: 'acc-chk-01',
    name: 'Primary Checking (Chase)',
    type: 'checking',
    currentBalance: 7850.40,
    currency: 'USD',
    institutionName: 'JPMorgan Chase',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'acc-sav-01',
    name: 'High Yield Savings (Marcus)',
    type: 'savings',
    currentBalance: 18450.00,
    currency: 'USD',
    institutionName: 'Marcus by Goldman',
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'acc-crd-01',
    name: 'Sapphire Preferred (Credit)',
    type: 'credit',
    currentBalance: -890.25,
    currency: 'USD',
    institutionName: 'Chase Card Services',
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_RECURRING: RecurringPayment[] = [
  {
    id: 'rec-sal-01',
    name: 'Principal Software Engineer Salary',
    categoryId: 'cat-inc-sal',
    amount: 3850.00,
    type: 'income',
    frequency: 'biweekly',
    dueDay: 1,
    nextDueDate: '2026-11-01',
    autopay: true,
    isActive: true,
    notes: 'Direct deposit every other Friday/1st',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec-exp-rent',
    name: 'Apartment Lease & Building Fee',
    categoryId: 'cat-exp-rent',
    amount: 2100.00,
    type: 'expense',
    frequency: 'monthly',
    dueDay: 1,
    nextDueDate: '2026-11-01',
    autopay: true,
    isActive: true,
    notes: 'Automated ACH wire on the 1st',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec-exp-ins',
    name: 'Premium Health & Dental Coverage',
    categoryId: 'cat-exp-ins',
    amount: 340.00,
    type: 'expense',
    frequency: 'monthly',
    dueDay: 5,
    nextDueDate: '2026-11-05',
    autopay: true,
    isActive: true,
    notes: 'Kaiser Permanente Auto-debit',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec-exp-util',
    name: 'Municipal Gas & Electricity',
    categoryId: 'cat-exp-util',
    amount: 145.00,
    type: 'expense',
    frequency: 'monthly',
    dueDay: 12,
    nextDueDate: '2026-11-12',
    autopay: true,
    isActive: true,
    notes: 'National Grid utility bill',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec-exp-net',
    name: 'Gigabit Fiber Internet',
    categoryId: 'cat-exp-net',
    amount: 79.99,
    type: 'expense',
    frequency: 'monthly',
    dueDay: 18,
    nextDueDate: '2026-11-18',
    autopay: true,
    isActive: true,
    notes: 'Verizon Fios fiber',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec-exp-gym',
    name: 'Equinox Gym & Spa Membership',
    categoryId: 'cat-exp-fit',
    amount: 110.00,
    type: 'expense',
    frequency: 'monthly',
    dueDay: 20,
    nextDueDate: '2026-11-20',
    autopay: true,
    isActive: true,
    notes: 'Monthly club membership',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec-exp-carins',
    name: 'GEICO Auto Insurance Policy',
    categoryId: 'cat-exp-ins',
    amount: 142.50,
    type: 'expense',
    frequency: 'monthly',
    dueDay: 24,
    nextDueDate: '2026-11-24',
    autopay: true,
    isActive: true,
    notes: 'Vehicle coverage comprehensive',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec-exp-sub-01',
    name: 'Cloud & Developer Tool Stack',
    categoryId: 'cat-exp-sub',
    amount: 45.00,
    type: 'expense',
    frequency: 'monthly',
    dueDay: 26,
    nextDueDate: '2026-10-26',
    autopay: true,
    isActive: true,
    notes: 'GitHub Pro + Vercel Pro + Claude AI',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'rec-exp-sub-02',
    name: 'Entertainment (Netflix + Spotify 4K)',
    categoryId: 'cat-exp-sub',
    amount: 32.98,
    type: 'expense',
    frequency: 'monthly',
    dueDay: 28,
    nextDueDate: '2026-10-28',
    autopay: true,
    isActive: true,
    notes: 'Family media bundle',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const INITIAL_TRANSACTIONS: Transaction[] = [
  {
    id: 'tx-001',
    accountId: 'acc-chk-01',
    categoryId: 'cat-exp-groc',
    amount: 142.30,
    type: 'expense',
    description: 'Whole Foods Market weekly restock',
    date: '2026-10-25',
    status: 'cleared',
    tags: ['groceries', 'household'],
    isRecurring: false,
    createdAt: '2026-10-25T14:22:00Z',
  },
  {
    id: 'tx-002',
    accountId: 'acc-crd-01',
    categoryId: 'cat-exp-dine',
    amount: 68.50,
    type: 'expense',
    description: 'Bistro dinner with colleagues',
    date: '2026-10-24',
    status: 'cleared',
    tags: ['dining', 'social'],
    isRecurring: false,
    createdAt: '2026-10-24T20:10:00Z',
  },
  {
    id: 'tx-003',
    accountId: 'acc-chk-01',
    categoryId: 'cat-exp-trans',
    amount: 52.00,
    type: 'expense',
    description: 'Shell EV charging & premium fuel',
    date: '2026-10-22',
    status: 'cleared',
    tags: ['transport'],
    isRecurring: false,
    createdAt: '2026-10-22T09:15:00Z',
  },
  {
    id: 'tx-004',
    accountId: 'acc-chk-01',
    categoryId: 'cat-inc-sal',
    amount: 3850.00,
    type: 'income',
    description: 'Bi-weekly payroll direct deposit',
    date: '2026-10-18',
    status: 'cleared',
    tags: ['payroll', 'salary'],
    isRecurring: true,
    createdAt: '2026-10-18T06:00:00Z',
  },
  {
    id: 'tx-005',
    accountId: 'acc-chk-01',
    categoryId: 'cat-exp-net',
    amount: 79.99,
    type: 'expense',
    description: 'Verizon Fios high-speed fiber',
    date: '2026-10-18',
    status: 'cleared',
    tags: ['bills', 'internet'],
    isRecurring: true,
    createdAt: '2026-10-18T08:00:00Z',
  },
  {
    id: 'tx-006',
    accountId: 'acc-chk-01',
    categoryId: 'cat-exp-util',
    amount: 138.40,
    type: 'expense',
    description: 'National Grid electricity',
    date: '2026-10-12',
    status: 'cleared',
    tags: ['utilities'],
    isRecurring: true,
    createdAt: '2026-10-12T07:30:00Z',
  },
  {
    id: 'tx-007',
    accountId: 'acc-crd-01',
    categoryId: 'cat-exp-dine',
    amount: 24.80,
    type: 'expense',
    description: 'Artisan Espresso Roasters',
    date: '2026-10-11',
    status: 'cleared',
    tags: ['coffee'],
    isRecurring: false,
    createdAt: '2026-10-11T11:00:00Z',
  },
  {
    id: 'tx-008',
    accountId: 'acc-chk-01',
    categoryId: 'cat-exp-rent',
    amount: 2100.00,
    type: 'expense',
    description: 'Monthly Apartment Lease ACH',
    date: '2026-10-01',
    status: 'cleared',
    tags: ['rent', 'fixed'],
    isRecurring: true,
    createdAt: '2026-10-01T04:00:00Z',
  },
  {
    id: 'tx-009',
    accountId: 'acc-chk-01',
    categoryId: 'cat-inc-side',
    amount: 1200.00,
    type: 'income',
    description: 'Frontend architecture client advisory',
    date: '2026-10-05',
    status: 'cleared',
    tags: ['consulting'],
    isRecurring: false,
    createdAt: '2026-10-05T15:30:00Z',
  },
];

const INITIAL_BUDGETS: Budget[] = [
  { id: 'b-01', categoryId: 'cat-exp-rent', period: 'monthly', allocatedAmount: 2100, monthYear: '2026-10' },
  { id: 'b-02', categoryId: 'cat-exp-groc', period: 'monthly', allocatedAmount: 600, monthYear: '2026-10' },
  { id: 'b-03', categoryId: 'cat-exp-dine', period: 'monthly', allocatedAmount: 350, monthYear: '2026-10' },
  { id: 'b-04', categoryId: 'cat-exp-util', period: 'monthly', allocatedAmount: 220, monthYear: '2026-10' },
  { id: 'b-05', categoryId: 'cat-exp-trans', period: 'monthly', allocatedAmount: 250, monthYear: '2026-10' },
  { id: 'b-06', categoryId: 'cat-exp-sub', period: 'monthly', allocatedAmount: 120, monthYear: '2026-10' },
];

function getInitialStore(): FinancialStoreData {
  return {
    user: {
      id: 'usr_001',
      name: 'Alex Rivera',
      currency: 'USD',
      safetyBuffer: 2000.00,
    },
    accounts: INITIAL_ACCOUNTS,
    categories: INITIAL_CATEGORIES,
    recurringPayments: INITIAL_RECURRING,
    transactions: INITIAL_TRANSACTIONS,
    budgets: INITIAL_BUDGETS,
    scenarios: [
      {
        enabled: false,
        name: 'New Car Lease ($450/mo)',
        monthlyExpenseDelta: 450,
        monthlyIncomeDelta: 0,
        oneTimeAmount: -2500, // Down payment
        oneTimeDayOffset: 14,
      },
    ],
  };
}

let inMemoryStore: FinancialStoreData | null = null;

function ensureDataFile(): void {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    const initial = getInitialStore();
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    inMemoryStore = initial;
  }
}

export function getStore(): FinancialStoreData {
  if (inMemoryStore) {
    return inMemoryStore;
  }

  ensureDataFile();

  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    inMemoryStore = JSON.parse(raw);
    return inMemoryStore!;
  } catch (error) {
    console.error('Failed to read data file, restoring initial defaults', error);
    inMemoryStore = getInitialStore();
    return inMemoryStore;
  }
}

export function saveStore(newData: FinancialStoreData): void {
  inMemoryStore = newData;
  ensureDataFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(newData, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to persist store to disk', error);
  }
}

export function resetStoreToDefaults(): FinancialStoreData {
  const initial = getInitialStore();
  saveStore(initial);
  return initial;
}

export function computeUserFinancials(store: FinancialStoreData): UserFinancials {
  const liquidBalance = store.accounts
    .filter((a) => a.type === 'checking' || a.type === 'savings')
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const netWorth = store.accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  // Approximate monthly income from recurring income payments
  const monthlyIncome = store.recurringPayments
    .filter((r) => r.isActive && r.type === 'income')
    .reduce((sum, r) => {
      if (r.frequency === 'biweekly') return sum + r.amount * 2.166;
      if (r.frequency === 'weekly') return sum + r.amount * 4.333;
      if (r.frequency === 'annual') return sum + r.amount / 12;
      return sum + r.amount;
    }, 0);

  // Approximate monthly fixed expenses from recurring expense payments
  const monthlyFixedExpenses = store.recurringPayments
    .filter((r) => r.isActive && r.type === 'expense')
    .reduce((sum, r) => {
      if (r.frequency === 'biweekly') return sum + r.amount * 2.166;
      if (r.frequency === 'weekly') return sum + r.amount * 4.333;
      if (r.frequency === 'annual') return sum + r.amount / 12;
      return sum + r.amount;
    }, 0);

  // Approximate variable spendings (~ $42.50/day * 30 days)
  const monthlyVariableEstimated = 1275.00;

  const monthlyNetSavings = monthlyIncome - monthlyFixedExpenses - monthlyVariableEstimated;
  const savingsRatePct = monthlyIncome > 0
    ? Math.max(0, Math.round((monthlyNetSavings / monthlyIncome) * 1000) / 10)
    : 0;

  return {
    netWorth: Math.round(netWorth * 100) / 100,
    liquidBalance: Math.round(liquidBalance * 100) / 100,
    monthlyIncome: Math.round(monthlyIncome * 100) / 100,
    monthlyFixedExpenses: Math.round(monthlyFixedExpenses * 100) / 100,
    monthlyVariableEstimated: Math.round(monthlyVariableEstimated * 100) / 100,
    monthlyNetSavings: Math.round(monthlyNetSavings * 100) / 100,
    savingsRatePct,
    safetyBuffer: store.user.safetyBuffer,
    currency: store.user.currency,
  };
}
