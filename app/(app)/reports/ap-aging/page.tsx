'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Printer } from 'lucide-react';
import { formatMoney, formatDate } from '@/lib/utils';
import Decimal from 'decimal.js';
import { cn } from '@/lib/utils';

type AgingRow = {
  bill_id: string;
  bill_number: string;
  supplier_name: string;
  supplier_ref: string | null;
  bill_date: string;
  due_date: string;
  total_amount: string;
  balance_due: string;
  days_overdue: number;
};

type Bucket = 'current' | '1-30' | '31-60' | '61-90' | '90+';

function getBucket(daysOverdue: number): Bucket {
  if (daysOverdue <= 0) return 'current';
  if (daysOverdue <= 30) return '1-30';
  if (daysOverdue <= 60) return '31-60';
  if (daysOverdue <= 90) return '61-90';
  return '90+';
}

const BUCKET_LABELS: Record<Bucket, string> = {
  current: 'Current', '1-30': '1–30 Days', '31-60': '31–60 Days', '61-90': '61–90 Days', '90+': '90+ Days',
};

const BUCKET_COLORS: Record<Bucket, string> = {
  current: 'text-teal-700', '1-30': 'text-amber-600', '31-60': 'text-orange-600',
  '61-90': 'text-red-600', '90+': 'text-red-800',
};

const BUCKETS: Bucket[] = ['current', '1-30', '31-60', '61-90', '90+'];

export default function APAgingPage() {
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [rows, setRows] = useState<AgingRow[]>([]);
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

    const { data } = await supabase
      .from('bills')
      .select('id, bill_number, supplier_ref, bill_date, due_date, total_amount, balance_due, supplier:suppliers(name)')
      .eq('company_id', companyId)
      .in('status', ['approved', 'partial'])
      .lte('bill_date', asOf)
      .gt('balance_due', 0);

    if (!data) { setLoading(false); return; }

    const asOfDate = new Date(asOf);
    const agingRows: AgingRow[] = data.map(b => {
      const due = new Date(b.due_date);
      const daysOverdue = Math.floor((asOfDate.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
      return {
        bill_id: b.id,
        bill_number: b.bill_number,
        supplier_name: (b.supplier as { name: string } | null)?.name ?? '—',
        supplier_ref: b.supplier_ref,
        bill_date: b.bill_date,
        due_date: b.due_date,
        total_amount: b.total_amount,
        balance_due: b.balance_due,
        days_overdue: daysOverdue,
      };
    });

    setRows(agingRows.sort((a, b) => b.days_overdue - a.days_overdue));
    setLoading(false);
    setGenerated(true);
  }

  const bucketed = BUCKETS.reduce<Record<Bucket, AgingRow[]>>((acc, b) => {
    acc[b] = rows.filter(r => getBucket(r.days_overdue) === b);
    return acc;
  }, {} as Record<Bucket, AgingRow[]>);

  const bucketTotals = BUCKETS.reduce<Record<Bucket, Decimal>>((acc, b) => {
    acc[b] = bucketed[b].reduce((s, r) => s.plus(r.balance_due), new Decimal(0));
    return acc;
  }, {} as Record<Bucket, Decimal>);

  const grandTotal = rows.reduce((s, r) => s.plus(r.balance_due), new Decimal(0));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
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
        <h2 className="text-sm font-semibold text-slate-700 mb-4">AP Aging Report</h2>
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

      {generated && (
        <>
          {/* Summary buckets */}
          <div className="grid grid-cols-5 gap-3 print:hidden">
            {BUCKETS.map(b => (
              <div key={b} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-xs text-slate-500 mb-1">{BUCKET_LABELS[b]}</p>
                <p className={cn('text-base font-bold font-mono', BUCKET_COLORS[b])}>
                  {formatMoney(bucketTotals[b].toFixed(2))}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{bucketed[b].length} bill{bucketed[b].length !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>

          {/* Full table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border-0">
            <div className="px-6 py-4 border-b border-slate-200 text-center print:block hidden">
              <p className="text-xs text-slate-500 uppercase tracking-wide">AP Aging Report</p>
              <h1 className="text-xl font-bold text-slate-900 mt-1">{companyName}</h1>
              <p className="text-sm text-slate-500 mt-1">As of {asOf}</p>
            </div>

            {rows.length === 0 ? (
              <div className="px-6 py-12 text-center text-slate-500 text-sm">No outstanding bills as of {asOf}.</div>
            ) : (
              <>
                <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  <div className="col-span-2">Bill #</div>
                  <div className="col-span-3">Supplier</div>
                  <div className="col-span-2">Supplier Ref</div>
                  <div className="col-span-2">Due Date</div>
                  <div className="col-span-1 text-right">Days</div>
                  <div className="col-span-2 text-right">Balance Due</div>
                </div>

                {BUCKETS.filter(b => bucketed[b].length > 0).map(bucket => (
                  <div key={bucket}>
                    <div className="px-6 py-2 bg-slate-50/70 border-t border-slate-100">
                      <span className={cn('text-xs font-semibold', BUCKET_COLORS[bucket])}>{BUCKET_LABELS[bucket]}</span>
                    </div>
                    {bucketed[bucket].map(row => (
                      <Link key={row.bill_id} href={`/ap/${row.bill_id}`}
                        className="grid grid-cols-12 gap-4 px-6 py-3 items-center border-t border-slate-100 text-sm hover:bg-slate-50 transition-colors">
                        <div className="col-span-2 font-mono text-slate-700 text-xs">{row.bill_number}</div>
                        <div className="col-span-3 text-slate-700 text-xs truncate">{row.supplier_name}</div>
                        <div className="col-span-2 text-slate-500 text-xs truncate">{row.supplier_ref ?? '—'}</div>
                        <div className="col-span-2 text-slate-500 text-xs">{formatDate(row.due_date)}</div>
                        <div className={cn('col-span-1 text-right text-xs font-medium', BUCKET_COLORS[getBucket(row.days_overdue)])}>
                          {row.days_overdue > 0 ? row.days_overdue : '—'}
                        </div>
                        <div className="col-span-2 text-right font-mono font-semibold text-slate-900 text-xs">
                          {formatMoney(row.balance_due)}
                        </div>
                      </Link>
                    ))}
                    <div className="grid grid-cols-12 gap-4 px-6 py-2 border-t border-slate-200 bg-slate-50">
                      <div className="col-span-10 text-right text-xs text-slate-500 font-medium">Subtotal</div>
                      <div className="col-span-2 text-right font-mono font-semibold text-slate-900 text-xs">
                        {formatMoney(bucketTotals[bucket].toFixed(2))}
                      </div>
                    </div>
                  </div>
                ))}

                <div className="grid grid-cols-12 gap-4 px-6 py-4 border-t-2 border-slate-900 bg-slate-50">
                  <div className="col-span-10 text-right text-sm font-bold text-slate-900">Total Outstanding AP</div>
                  <div className="col-span-2 text-right font-mono font-bold text-slate-900 text-sm">
                    {formatMoney(grandTotal.toFixed(2))}
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
