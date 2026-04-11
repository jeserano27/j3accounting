'use client';

import Link from 'next/link';
import { TrendingUp, Scale, Users, Wallet, BarChart3, TableProperties } from 'lucide-react';

const reports = [
  {
    href: '/reports/income-statement',
    icon: TrendingUp,
    label: 'Income Statement',
    description: 'Revenue vs expenses for a selected period. Shows gross profit, operating income, and net income.',
    color: 'text-teal-600 bg-teal-50',
  },
  {
    href: '/reports/balance-sheet',
    icon: Scale,
    label: 'Balance Sheet',
    description: 'Assets, liabilities, and equity as of a selected date. Shows your company\'s financial position.',
    color: 'text-blue-600 bg-blue-50',
  },
  {
    href: '/reports/trial-balance',
    icon: TableProperties,
    label: 'Trial Balance',
    description: 'All account debit and credit balances as of a date. Verifies the books are in balance.',
    color: 'text-violet-600 bg-violet-50',
  },
  {
    href: '/reports/ar-aging',
    icon: Users,
    label: 'AR Aging',
    description: 'Outstanding invoices grouped by age: current, 1–30, 31–60, 61–90, and 90+ days overdue.',
    color: 'text-amber-600 bg-amber-50',
  },
  {
    href: '/reports/ap-aging',
    icon: Wallet,
    label: 'AP Aging',
    description: 'Outstanding bills grouped by age. Shows how much you owe and when payments are due.',
    color: 'text-red-600 bg-red-50',
  },
];

export default function ReportsPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-slate-400" />
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500 text-sm">Financial statements and business insights</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map(r => {
          const Icon = r.icon;
          return (
            <Link key={r.href} href={r.href}
              className="bg-white rounded-xl border border-slate-200 p-6 hover:border-teal-300 hover:shadow-sm transition-all group">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${r.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <h2 className="text-base font-semibold text-slate-900 mb-1 group-hover:text-teal-700 transition-colors">{r.label}</h2>
              <p className="text-slate-500 text-sm leading-relaxed">{r.description}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
