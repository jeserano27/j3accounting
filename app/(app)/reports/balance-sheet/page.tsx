'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Printer } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import Decimal from 'decimal.js';

type AccountRow = {
  id: string; code: string; name: string;
  account_type: string; normal_balance: string;
  total_debit: number; total_credit: number;
};

function netBalance(row: AccountRow): Decimal {
  return row.normal_balance === 'debit'
    ? new Decimal(row.total_debit).minus(row.total_credit)
    : new Decimal(row.total_credit).minus(row.total_debit);
}

const TYPE_LABELS: Record<string, string> = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity',
};

export default function BalanceSheetPage() {
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
      if (!['asset', 'liability', 'equity'].includes(acct.account_type)) continue;
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

  const assetRows = rows.filter(r => r.account_type === 'asset');
  const liabilityRows = rows.filter(r => r.account_type === 'liability');
  const equityRows = rows.filter(r => r.account_type === 'equity');

  const totalAssets = assetRows.reduce((s, r) => s.plus(netBalance(r)), new Decimal(0));
  const totalLiabilities = liabilityRows.reduce((s, r) => s.plus(netBalance(r)), new Decimal(0));
  const totalEquity = equityRows.reduce((s, r) => s.plus(netBalance(r)), new Decimal(0));
  const totalLiabEquity = totalLiabilities.plus(totalEquity);

  function Section({ type, sectionRows, total }: { type: string; sectionRows: AccountRow[]; total: Decimal }) {
    return (
      <div>
        <div className="py-2 border-b-2 border-slate-900 mb-2">
          <span className="text-sm font-bold text-slate-900 uppercase tracking-wide">{TYPE_LABELS[type]}</span>
        </div>
        {sectionRows.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No entries recorded.</p>
        ) : (
          sectionRows.map(r => (
            <div key={r.id} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-slate-700 pl-4">{r.code} — {r.name}</span>
              <span className="text-sm font-mono text-slate-900">{formatMoney(netBalance(r).toFixed(2))}</span>
            </div>
          ))
        )}
        <div className="flex items-center justify-between py-2 mt-2 border-t border-slate-300">
          <span className="text-sm font-semibold text-slate-900">Total {TYPE_LABELS[type]}</span>
          <span className="text-sm font-mono font-bold text-slate-900">{formatMoney(total.toFixed(2))}</span>
        </div>
      </div>
    );
  }

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
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Balance Sheet</h2>
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
          <div className="px-8 py-6 border-b border-slate-200 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Balance Sheet</p>
            <h1 className="text-xl font-bold text-slate-900 mt-1">{companyName}</h1>
            <p className="text-sm text-slate-500 mt-1">As of {asOf}</p>
          </div>

          <div className="px-8 py-6 space-y-6">
            <Section type="asset" sectionRows={assetRows} total={totalAssets} />
            <Section type="liability" sectionRows={liabilityRows} total={totalLiabilities} />
            <Section type="equity" sectionRows={equityRows} total={totalEquity} />

            {/* Totals check */}
            <div className="space-y-1 pt-2">
              <div className="flex items-center justify-between py-3 border-t-2 border-slate-900">
                <span className="text-base font-bold text-slate-900">Total Assets</span>
                <span className="text-base font-mono font-bold text-slate-900">{formatMoney(totalAssets.toFixed(2))}</span>
              </div>
              <div className="flex items-center justify-between py-3 border-t border-slate-300">
                <span className="text-base font-bold text-slate-900">Total Liabilities + Equity</span>
                <span className={`text-base font-mono font-bold ${totalAssets.eq(totalLiabEquity) ? 'text-teal-700' : 'text-red-700'}`}>
                  {formatMoney(totalLiabEquity.toFixed(2))}
                </span>
              </div>
              {!totalAssets.eq(totalLiabEquity) && (
                <p className="text-xs text-red-600 mt-1">
                  Note: Assets do not equal Liabilities + Equity. Difference: {formatMoney(totalAssets.minus(totalLiabEquity).abs().toFixed(2))}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
