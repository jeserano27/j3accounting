'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Printer } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import Decimal from 'decimal.js';

type AccountRow = {
  id: string;
  code: string;
  name: string;
  account_type: string;
  sub_type: string | null;
  normal_balance: string;
  total_debit: number;
  total_credit: number;
};

function netBalance(row: AccountRow): Decimal {
  if (row.normal_balance === 'debit') {
    return new Decimal(row.total_debit).minus(row.total_credit);
  }
  return new Decimal(row.total_credit).minus(row.total_debit);
}

function thisYearRange() {
  const y = new Date().getFullYear();
  return { from: `${y}-01-01`, to: new Date().toISOString().slice(0, 10) };
}

export default function IncomeStatementPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const range = thisYearRange();
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('user_companies')
      .select('company_id, company:companies(name)')
      .eq('is_default', true).single()
      .then(({ data }) => {
        if (data) {
          setCompanyId(data.company_id);
          setCompanyName((data.company as { name: string } | null)?.name ?? '');
        }
      });
  }, []);

  async function generate() {
    if (!companyId) return;
    setLoading(true);
    const supabase = createClient();

    // Get all posted journal lines for the period, for revenue/expense accounts
    const { data } = await supabase
      .from('journal_lines')
      .select(`
        debit, credit,
        account:accounts(id, code, name, account_type, sub_type, normal_balance),
        entry:journal_entries!inner(entry_date, status, company_id)
      `)
      .eq('entry.status', 'posted')
      .eq('entry.company_id', companyId)
      .gte('entry.entry_date', from)
      .lte('entry.entry_date', to);

    if (!data) { setLoading(false); return; }

    // Aggregate by account
    const map: Record<string, AccountRow> = {};
    for (const line of data) {
      const acct = line.account as AccountRow | null;
      if (!acct) continue;
      if (!['revenue', 'expense'].includes(acct.account_type)) continue;
      if (!map[acct.id]) {
        map[acct.id] = { ...acct, total_debit: 0, total_credit: 0 };
      }
      map[acct.id].total_debit += line.debit;
      map[acct.id].total_credit += line.credit;
    }

    setRows(Object.values(map).sort((a, b) => a.code.localeCompare(b.code)));
    setLoading(false);
    setGenerated(true);
  }

  const revenueRows = rows.filter(r => r.account_type === 'revenue');
  const expenseRows = rows.filter(r => r.account_type === 'expense');

  const totalRevenue = revenueRows.reduce((sum, r) => sum.plus(netBalance(r)), new Decimal(0));
  const totalExpense = expenseRows.reduce((sum, r) => sum.plus(netBalance(r)), new Decimal(0));
  const netIncome = totalRevenue.minus(totalExpense);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/reports" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Reports
        </Link>
        {generated && (
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors print:hidden">
            <Printer className="w-4 h-4" /> Print
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 print:hidden">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Income Statement</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
          </div>
          <button onClick={generate} disabled={loading}
            className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60">
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Report */}
      {generated && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border-0">
          {/* Report header */}
          <div className="px-8 py-6 border-b border-slate-200 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Income Statement</p>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{companyName}</h1>
            <p className="text-sm text-slate-500 mt-1">For the period {from} to {to}</p>
          </div>

          <div className="px-8 py-6 space-y-6">
            {/* Revenue */}
            <div>
              <div className="flex items-center justify-between py-2 border-b-2 border-slate-900 mb-2">
                <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">Revenue</span>
              </div>
              {revenueRows.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No revenue recorded for this period.</p>
              ) : (
                revenueRows.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-slate-700">{r.code} — {r.name}</span>
                    <span className="text-sm font-mono text-slate-900">{formatMoney(netBalance(r).toFixed(2))}</span>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between py-2 mt-2 border-t border-slate-300">
                <span className="text-sm font-semibold text-slate-900">Total Revenue</span>
                <span className="text-sm font-mono font-bold text-teal-700">{formatMoney(totalRevenue.toFixed(2))}</span>
              </div>
            </div>

            {/* Expenses */}
            <div>
              <div className="flex items-center justify-between py-2 border-b-2 border-slate-900 mb-2">
                <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">Expenses</span>
              </div>
              {expenseRows.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No expenses recorded for this period.</p>
              ) : (
                expenseRows.map(r => (
                  <div key={r.id} className="flex items-center justify-between py-1.5">
                    <span className="text-sm text-slate-700">{r.code} — {r.name}</span>
                    <span className="text-sm font-mono text-slate-900">{formatMoney(netBalance(r).toFixed(2))}</span>
                  </div>
                ))
              )}
              <div className="flex items-center justify-between py-2 mt-2 border-t border-slate-300">
                <span className="text-sm font-semibold text-slate-900">Total Expenses</span>
                <span className="text-sm font-mono font-bold text-red-700">{formatMoney(totalExpense.toFixed(2))}</span>
              </div>
            </div>

            {/* Net Income */}
            <div className="flex items-center justify-between py-4 border-t-2 border-slate-900">
              <span className="text-base font-bold text-slate-900">Net Income</span>
              <span className={`text-base font-mono font-bold ${netIncome.gte(0) ? 'text-teal-700' : 'text-red-700'}`}>
                {netIncome.lt(0) ? '(' : ''}{formatMoney(netIncome.abs().toFixed(2))}{netIncome.lt(0) ? ')' : ''}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
