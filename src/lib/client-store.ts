'use client';

import type {
  Account,
  Budget,
  Category,
  FinancialStoreData,
  RecurringPayment,
  Transaction,
  UserFinancials,
} from './types.ts';
import { projectCashflow } from './predictive-engine.ts';

const STORAGE_KEY = 'apexfin_store_v1';

export const DEFAULT_CATEGORIES: Category[] = [
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

export const DEFAULT_ACCOUNTS: Account[] = [
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

export const DEFAULT_RECURRING: RecurringPayment[] = [
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

export const DEFAULT_TRANSACTIONS: Transaction[] = [
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
  {
    id: 'tx-010',
    accountId: 'acc-crd-01',
    categoryId: 'cat-exp-dine',
    amount: 14.50,
    type: 'expense',
    description: 'Artisan Espresso Roasters',
    date: '2026-10-04',
    status: 'cleared',
    tags: ['coffee'],
    isRecurring: false,
    createdAt: '2026-10-04T08:15:00Z',
  },
];

export const DEFAULT_BUDGETS: Budget[] = [
  { id: 'b-01', categoryId: 'cat-exp-rent', period: 'monthly', allocatedAmount: 2100, monthYear: '2026-10' },
  { id: 'b-02', categoryId: 'cat-exp-groc', period: 'monthly', allocatedAmount: 600, monthYear: '2026-10' },
  { id: 'b-03', categoryId: 'cat-exp-dine', period: 'monthly', allocatedAmount: 350, monthYear: '2026-10' },
  { id: 'b-04', categoryId: 'cat-exp-util', period: 'monthly', allocatedAmount: 220, monthYear: '2026-10' },
  { id: 'b-05', categoryId: 'cat-exp-trans', period: 'monthly', allocatedAmount: 250, monthYear: '2026-10' },
  { id: 'b-06', categoryId: 'cat-exp-sub', period: 'monthly', allocatedAmount: 120, monthYear: '2026-10' },
];

export function getInitialClientStore(): FinancialStoreData {
  return {
    user: {
      id: 'usr_001',
      name: 'Alex Rivera',
      currency: 'USD',
      safetyBuffer: 2000.00,
    },
    accounts: DEFAULT_ACCOUNTS,
    categories: DEFAULT_CATEGORIES,
    recurringPayments: DEFAULT_RECURRING,
    transactions: DEFAULT_TRANSACTIONS,
    budgets: DEFAULT_BUDGETS,
    scenarios: [
      {
        enabled: false,
        name: 'New Car Lease ($450/mo)',
        monthlyExpenseDelta: 450,
        monthlyIncomeDelta: 0,
        oneTimeAmount: -2500,
        oneTimeDayOffset: 14,
      },
    ],
  };
}

export function loadClientStore(): FinancialStoreData {
  if (typeof window === 'undefined') return getInitialClientStore();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = getInitialClientStore();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return getInitialClientStore();
  }
}

export function saveClientStore(data: FinancialStoreData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    console.error('Failed to save to localStorage', err);
  }
}

export function computeClientFinancials(store: FinancialStoreData): UserFinancials {
  const liquidBalance = store.accounts
    .filter((a) => a.type === 'checking' || a.type === 'savings')
    .reduce((sum, a) => sum + a.currentBalance, 0);

  const netWorth = store.accounts.reduce((sum, a) => sum + a.currentBalance, 0);

  const monthlyIncome = store.recurringPayments
    .filter((r) => r.isActive && r.type === 'income')
    .reduce((sum, r) => {
      if (r.frequency === 'biweekly') return sum + r.amount * 2.166;
      if (r.frequency === 'weekly') return sum + r.amount * 4.333;
      if (r.frequency === 'annual') return sum + r.amount / 12;
      return sum + r.amount;
    }, 0);

  const monthlyFixedExpenses = store.recurringPayments
    .filter((r) => r.isActive && r.type === 'expense')
    .reduce((sum, r) => {
      if (r.frequency === 'biweekly') return sum + r.amount * 2.166;
      if (r.frequency === 'weekly') return sum + r.amount * 4.333;
      if (r.frequency === 'annual') return sum + r.amount / 12;
      return sum + r.amount;
    }, 0);

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

export function createCleanStarterStore(
  userId: string = 'usr_001',
  name: string = 'Alex Rivera',
  currency: string = 'USD'
): FinancialStoreData {
  const d_fmt = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
  };

  const cleanAccounts: Account[] = [
    {
      id: `acc-chk-${userId.slice(-4)}`,
      name: 'Primary Checking',
      type: 'checking',
      currentBalance: 5420.50,
      currency,
      institutionName: 'JPMorgan Chase',
      updatedAt: new Date().toISOString(),
    },
    {
      id: `acc-sav-${userId.slice(-4)}`,
      name: 'High Yield Savings',
      type: 'savings',
      currentBalance: 14850.00,
      currency,
      institutionName: 'Marcus by Goldman',
      updatedAt: new Date().toISOString(),
    },
    {
      id: `acc-crd-${userId.slice(-4)}`,
      name: 'Corporate Card',
      type: 'credit',
      currentBalance: -420.75,
      currency,
      institutionName: 'Chase Card Services',
      updatedAt: new Date().toISOString(),
    },
  ];

  const cleanTransactions: Transaction[] = [
    {
      id: `tx-str-01-${userId.slice(-4)}`,
      accountId: cleanAccounts[0].id,
      categoryId: 'cat-inc-sal',
      amount: 3850.00,
      type: 'income',
      description: 'Principal Software Engineer Payroll Direct Deposit',
      date: d_fmt(2),
      status: 'cleared',
      tags: ['payroll', 'salary'],
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: `tx-str-02-${userId.slice(-4)}`,
      accountId: cleanAccounts[0].id,
      categoryId: 'cat-exp-rent',
      amount: 2100.00,
      type: 'expense',
      description: 'Apartment Lease Monthly ACH Wire',
      date: d_fmt(4),
      status: 'cleared',
      tags: ['housing', 'rent'],
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: `tx-str-03-${userId.slice(-4)}`,
      accountId: cleanAccounts[0].id,
      categoryId: 'cat-exp-groc',
      amount: 142.30,
      type: 'expense',
      description: 'Whole Foods Market Provisions Restock',
      date: d_fmt(5),
      status: 'cleared',
      tags: ['groceries'],
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: `tx-str-04-${userId.slice(-4)}`,
      accountId: cleanAccounts[0].id,
      categoryId: 'cat-exp-net',
      amount: 79.99,
      type: 'expense',
      description: 'Verizon Fios Gigabit Fiber Internet',
      date: d_fmt(7),
      status: 'cleared',
      tags: ['internet', 'bills'],
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: `tx-str-05-${userId.slice(-4)}`,
      accountId: cleanAccounts[0].id,
      categoryId: 'cat-exp-util',
      amount: 118.40,
      type: 'expense',
      description: 'National Grid Gas & Electricity Service',
      date: d_fmt(10),
      status: 'cleared',
      tags: ['utilities'],
      isRecurring: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: `tx-str-06-${userId.slice(-4)}`,
      accountId: cleanAccounts[2].id,
      categoryId: 'cat-exp-dine',
      amount: 24.50,
      type: 'expense',
      description: 'Artisan Espresso Roastery & Bakery',
      date: d_fmt(11),
      status: 'cleared',
      tags: ['coffee'],
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: `tx-str-07-${userId.slice(-4)}`,
      accountId: cleanAccounts[0].id,
      categoryId: 'cat-inc-side',
      amount: 1200.00,
      type: 'income',
      description: 'Technical Architecture Advisory Retainer',
      date: d_fmt(14),
      status: 'cleared',
      tags: ['consulting'],
      isRecurring: false,
      createdAt: new Date().toISOString(),
    },
  ];

  return {
    user: {
      id: userId,
      name,
      currency,
      safetyBuffer: 2000.00,
    },
    accounts: cleanAccounts,
    categories: DEFAULT_CATEGORIES,
    recurringPayments: DEFAULT_RECURRING,
    transactions: cleanTransactions,
    budgets: DEFAULT_BUDGETS,
    scenarios: [
      {
        enabled: false,
        name: 'New Car Lease ($450/mo)',
        monthlyExpenseDelta: 450,
        monthlyIncomeDelta: 0,
        oneTimeAmount: -2500,
        oneTimeDayOffset: 14,
      },
    ],
  };
}

export const clientStore = {
  load: loadClientStore,
  save: saveClientStore,
  getFinancials: () => computeClientFinancials(loadClientStore()),
  updateCurrency: (currency: string) => {
    const s = loadClientStore();
    s.user.currency = currency;
    s.accounts = s.accounts.map((a) => ({ ...a, currency }));
    saveClientStore(s);
    return s;
  },
  updateSettings: (safetyBuffer: number, currency: string, name: string) => {
    const s = loadClientStore();
    s.user.safetyBuffer = safetyBuffer;
    s.user.currency = currency;
    s.user.name = name;
    s.accounts = s.accounts.map((a) => ({ ...a, currency }));
    saveClientStore(s);
    return s;
  },
  initForNewUser: (userId: string, name: string, currency: string = 'USD') => {
    const s = createCleanStarterStore(userId, name, currency);
    saveClientStore(s);
    return s;
  },
  addTransaction: async (tx: Transaction) => {
    const s = loadClientStore();
    s.transactions.unshift(tx);
    saveClientStore(s);
  },
};

