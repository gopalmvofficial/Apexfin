import assert from 'node:assert';
import test from 'node:test';

// Sample mock data for unit verification
const mockCategories = [
  { id: 'cat-sal', name: 'Salary', type: 'income', colorHex: '#10b981', iconName: 'Briefcase', isEssential: true, defaultBudget: 7500 },
  { id: 'cat-rent', name: 'Rent', type: 'expense', colorHex: '#ef4444', iconName: 'Home', isEssential: true, defaultBudget: 2000 },
  { id: 'cat-food', name: 'Food', type: 'expense', colorHex: '#f59e0b', iconName: 'Coffee', isEssential: true, defaultBudget: 500 },
];

const mockRecurring = [
  {
    id: 'r-sal',
    name: 'Biweekly Paycheck',
    categoryId: 'cat-sal',
    amount: 3000,
    type: 'income',
    frequency: 'biweekly',
    dueDay: 1,
    nextDueDate: '2026-11-01',
    autopay: true,
    isActive: true,
    createdAt: '2026-10-26',
    updatedAt: '2026-10-26',
  },
  {
    id: 'r-rent',
    name: 'Rent Obligation',
    categoryId: 'cat-rent',
    amount: 2000,
    type: 'expense',
    frequency: 'monthly',
    dueDay: 1,
    nextDueDate: '2026-11-01',
    autopay: true,
    isActive: true,
    createdAt: '2026-10-26',
    updatedAt: '2026-10-26',
  },
];

const mockTransactions = [
  { id: 't1', accountId: 'a1', categoryId: 'cat-food', amount: 300, type: 'expense', description: 'Groceries', date: '2026-10-20', status: 'cleared', tags: [], isRecurring: false, createdAt: '2026-10-20' },
  { id: 't2', accountId: 'a1', categoryId: 'cat-food', amount: 600, type: 'expense', description: 'Restock', date: '2026-10-15', status: 'cleared', tags: [], isRecurring: false, createdAt: '2026-10-15' },
];

test('calculateDailyVariableBurn derives correct moving average', async () => {
  const { calculateDailyVariableBurn } = await import('../src/lib/predictive-engine.ts');
  const burn = calculateDailyVariableBurn(mockTransactions, 30);
  assert.ok(burn > 0, 'Burn rate should be positive');
  assert.strictEqual(burn, (300 + 600) / 30);
});

test('projectCashflow correctly generates daily timeline and calculates trough', async () => {
  const { projectCashflow } = await import('../src/lib/predictive-engine.ts');

  const result = projectCashflow({
    startBalance: 5000,
    safetyBuffer: 2000,
    recurringPayments: mockRecurring,
    transactions: mockTransactions,
    categories: mockCategories,
    horizonDays: 30,
    variableBurnMultiplier: 1.0,
    customStartDate: '2026-10-26',
  });

  assert.strictEqual(result.horizonDays, 30);
  assert.strictEqual(result.startBalance, 5000);
  assert.strictEqual(result.dailyTimeline.length, 30);
  assert.ok(result.baselineLowestBalance <= 5000, 'Lowest balance should be recorded');
  assert.ok(result.summary.totalProjectedIncome > 0, 'Projected income should be positive');
});

test('What-If Scenario simulates expense and income deltas accurately', async () => {
  const { projectCashflow } = await import('../src/lib/predictive-engine.ts');

  const baselineResult = projectCashflow({
    startBalance: 5000,
    safetyBuffer: 2000,
    recurringPayments: mockRecurring,
    transactions: mockTransactions,
    categories: mockCategories,
    horizonDays: 30,
    variableBurnMultiplier: 1.0,
    customStartDate: '2026-10-26',
  });

  const simulatedResult = projectCashflow({
    startBalance: 5000,
    safetyBuffer: 2000,
    recurringPayments: mockRecurring,
    transactions: mockTransactions,
    categories: mockCategories,
    horizonDays: 30,
    variableBurnMultiplier: 1.0,
    customStartDate: '2026-10-26',
    scenario: {
      enabled: true,
      monthlyExpenseDelta: 600,
      monthlyIncomeDelta: 0,
      oneTimeAmount: -1000,
      oneTimeDayOffset: 5,
    },
  });

  assert.ok(
    simulatedResult.summary.simulatedEndBalance < baselineResult.summary.baselineEndBalance,
    'Simulated balance with +$600 expense delta must end lower than baseline'
  );
});
