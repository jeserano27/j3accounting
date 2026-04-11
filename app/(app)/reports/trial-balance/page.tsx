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
  normal_balance: string;
  total_debit: number;
  total_credit: number;
};

const TYPE_ORDER = ['asset', 'liability', 'equity', 'revenue', 'expense'];
const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity',
  revenue: 'Revenue', expense: 'Expenses',
};

export default function TrialBalancePage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
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
          setCompanyName(((data.company as unknown) as { name: string } | null)?.name ?? '');
        }
      });
  }, []);

  async function generate() {
    if (!companyId) return;
    setLoading(true);
    const supabase = createClient();

    const { data } = await supabase
      .from('journal_lines')
      .select(`
        debit, credit,
        account:accounts(id, code, name, account_type, normal_balance),
        entry:journal_entries!inner(entry_date, status, company_id)
      `)
      .eq('entry.status', 'posted')
      .eq('entry.company_id', companyId)
      .lte('entry.entry_date', asOf);

    if (!data) { setLoading(false); return; }

    const map: Record<string, AccountRow> = {};
    for (const line of data) {
      const acct = (line.account as unknown) as AccountRow | null;
      if (!acct) continue;
      if (!map[acct.id]) {
        map[acct.id] = { ...acct, total_debit: 0, total_credit: 0 };
      }
      map[acct.id].total_debit += Number(line.debit);
      map[acct.id].total_credit += Number(line.credit);
    }

    // Only include accounts with activity
    const active = Object.values(map)
      .filter(r => r.total_debit > 0 || r.total_credit > 0)
      .sort((a, b) => a.code.localeCompare(b.code));

    setRows(active);
    setLoading(false);
    setGenerated(true);
  }

  // For trial balance, show raw debit/credit columns (not net)
  // Each account shows its debit balance OR credit balance (whichever is the normal side)
  function trialBalanceAmounts(row: AccountRow): { debit: Decimal; credit: Decimal } {
    const net = row.normal_balance === 'debit'
      ? new Decimal(row.total_debit).minus(row.total_credit)
      : new Decimal(row.total_credit).minus(row.total_debit);

    if (row.normal_balance === 'debit') {
      return net.gte(0)
        ? { debit: net, credit: new Decimal(0) }
        : { debit: new Decimal(0), credit: net.abs() };
    } else {
      return net.gte(0)
        ? { debit: new Decimal(0), credit: net }
        : { debit: net.abs(), credit: new Decimal(0) };
    }
  }

  const grouped = TYPE_ORDER.reduce<Record<string, AccountRow[]>>((acc, t) => {
    acc[t] = rows.filter(r => r.account_type === t);
    return acc;
  }, {});

  const totalDebit = rows.reduce((s, r) => s.plus(trialBalanceAmounts(r).debit), new Decimal(0));
  const totalCredit = rows.reduce((s, r) => s.plus(trialBalanceAmounts(r).credit), new Decimal(0));
  const isBalanced = totalDebit.eq(totalCredit);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Trial Balance</h2>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">As of Date</label>
            <input type="date" value={asOf} onChange={e => setAsOf(e.target.value)}
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
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-200 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Trial Balance</p>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{companyName}</h1>
            <p className="text-sm text-slate-500 mt-1">As of {asOf}</p>
          </div>

          {/* Column headers */}
          <div className="grid grid-cols-12 gap-4 px-8 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-1">Code</div>
            <div className="col-span-7">Account Name</div>
            <div className="col-span-2 text-right">Debit</div>
            <div className="col-span-2 text-right">Credit</div>
          </div>

          {/* Rows grouped by type */}
          {TYPE_ORDER.map(type => {
            const typeRows = grouped[type];
            if (!typeRows || typeRows.length === 0) return null;
            const typeDebit = typeRows.reduce((s, r) => s.plus(trialBalanceAmounts(r).debit), new Decimal(0));
            const typeCredit = typeRows.reduce((s, r) => s.plus(trialBalanceAmounts(r).credit), new Decimal(0));
            return (
              <div key={type}>
                {/* Type header */}
                <div className="px-8 py-2 bg-slate-50/60 border-t border-slate-100">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{TYPE_LABELS[type]}</span>
                </div>
                {typeRows.map(r => {
                  const { debit, credit } = trialBalanceAmounts(r);
                  return (
                    <div key={r.id} className="grid grid-cols-12 gap-4 px-8 py-2 items-center border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <div className="col-span-1 font-mono text-xs text-slate-500">{r.code}</div>
                      <div className="col-span-7 text-sm text-slate-700">{r.name}</div>
                      <div className="col-span-2 text-right font-mono text-sm text-slate-700">
                        {debit.gt(0) ? formatMoney(debit.toFixed(2)) : ''}
                      </div>
                      <div className="col-span-2 text-right font-mono text-sm text-slate-700">
                        {credit.gt(0) ? formatMoney(credit.toFixed(2)) : ''}
                      </div>
                    </div>
                  );
                })}
                {/* Type subtotal */}
                <div className="grid grid-cols-12 gap-4 px-8 py-2 items-center border-t border-slate-200 bg-slate-50/80">
                  <div className="col-span-8 text-xs font-semibold text-slate-500 pl-1">Total {TYPE_LABELS[type]}</div>
                  <div className="col-span-2 text-right font-mono text-xs font-semibold text-slate-700">
                    {typeDebit.gt(0) ? formatMoney(typeDebit.toFixed(2)) : ''}
                  </div>
                  <div className="col-span-2 text-right font-mono text-xs font-semibold text-slate-700">
                    {typeCredit.gt(0) ? formatMoney(typeCredit.toFixed(2)) : ''}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Grand totals */}
          <div className="grid grid-cols-12 gap-4 px-8 py-4 border-t-2 border-slate-900 bg-slate-50">
            <div className="col-span-8 text-base font-bold text-slate-900">Grand Total</div>
            <div className="col-span-2 text-right font-mono text-base font-bold text-slate-900">
              {formatMoney(totalDebit.toFixed(2))}
            </div>
            <div className="col-span-2 text-right font-mono text-base font-bold text-slate-900">
              {formatMoney(totalCredit.toFixed(2))}
            </div>
          </div>

          {/* Balance check */}
          <div className={`px-8 py-3 flex items-center gap-2 text-sm font-medium ${isBalanced ? 'bg-teal-50 text-teal-700' : 'bg-red-50 text-red-700'}`}>
            {isBalanced ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Trial balance is in balance. Total debits equal total credits.
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Out of balance. Difference: {formatMoney(totalDebit.minus(totalCredit).abs().toFixed(2))}
              </>
            )}
          </div>

          {rows.length === 0 && (
            <div className="px-8 py-12 text-center text-slate-400 text-sm">No posted journal entries found for this period.</div>
          )}
        </div>
      )}
    </div>
  );
}
