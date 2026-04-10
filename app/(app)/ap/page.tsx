'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Plus, Search, Users } from 'lucide-react';
import { cn, formatMoney, formatDate } from '@/lib/utils';

type BillRow = {
  id: string;
  bill_number: string;
  supplier_ref: string | null;
  bill_date: string;
  due_date: string;
  status: string;
  total_amount: string;
  amount_paid: string;
  balance_due: string;
  supplier: { id: string; name: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-teal-50 text-teal-700 border-teal-200',
  cancelled: 'bg-slate-100 text-slate-400 border-slate-200',
};

export default function APPage() {
  const [bills, setBills] = useState<BillRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: uc } = await supabase
      .from('user_companies').select('company_id').eq('is_default', true).single();
    if (!uc) { setLoading(false); return; }

    const { data } = await supabase
      .from('bills')
      .select('id,bill_number,supplier_ref,bill_date,due_date,status,total_amount,amount_paid,balance_due,supplier:suppliers(id,name)')
      .eq('company_id', uc.company_id)
      .order('bill_date', { ascending: false })
      .order('bill_number', { ascending: false });

    setBills((data ?? []) as unknown as BillRow[]);
    setLoading(false);
  }

  const filtered = bills.filter(b => {
    const matchStatus = statusFilter === 'all' || b.status === statusFilter;
    const matchSearch = !search.trim() ||
      b.bill_number.toLowerCase().includes(search.toLowerCase()) ||
      (b.supplier_ref ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (b.supplier?.name ?? '').toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const totalUnpaid = bills
    .filter(b => ['approved', 'partial'].includes(b.status))
    .reduce((s, b) => s + parseFloat(b.balance_due || '0'), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Accounts Payable</h1>
          <p className="text-slate-500 text-sm mt-0.5">Bills and supplier payments</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/ap/suppliers"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Users className="w-4 h-4" /> Suppliers
          </Link>
          <Link href="/ap/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">
            <Plus className="w-4 h-4" /> New Bill
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-slate-500 text-xs mb-1">Total Unpaid</p>
          <p className="text-xl font-bold text-amber-600">{formatMoney(totalUnpaid.toFixed(2))}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-slate-500 text-xs mb-1">Pending Approval</p>
          <p className="text-xl font-bold text-slate-700">{bills.filter(b => b.status === 'draft').length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-slate-500 text-xs mb-1">Total Bills</p>
          <p className="text-xl font-bold text-slate-700">{bills.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input type="text" placeholder="Search by bill #, supplier ref, or supplier..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['all', 'draft', 'approved', 'partial', 'paid', 'cancelled'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn(
                'px-3 py-2 rounded-lg text-xs font-medium border transition-colors capitalize',
                statusFilter === s ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 hover:text-teal-700'
              )}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading bills...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">{search || statusFilter !== 'all' ? 'No bills match your filters.' : 'No bills yet.'}</p>
          {!search && statusFilter === 'all' && (
            <Link href="/ap/new" className="inline-flex items-center gap-1.5 mt-4 text-teal-600 text-sm font-medium hover:underline">
              <Plus className="w-4 h-4" /> Record your first bill
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-2">Bill #</div>
            <div className="col-span-3">Supplier</div>
            <div className="col-span-2">Supplier Ref</div>
            <div className="col-span-1">Date</div>
            <div className="col-span-1">Due</div>
            <div className="col-span-1 text-right">Total</div>
            <div className="col-span-1 text-right">Balance</div>
            <div className="col-span-1 text-center">Status</div>
          </div>
          {filtered.map(bill => (
            <Link key={bill.id} href={`/ap/${bill.id}`}
              className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center border-t border-slate-100 text-sm hover:bg-slate-50 transition-colors">
              <div className="col-span-2 font-mono text-slate-700 text-xs font-medium">{bill.bill_number}</div>
              <div className="col-span-3 text-slate-700 text-xs truncate">{bill.supplier?.name ?? '—'}</div>
              <div className="col-span-2 text-slate-500 text-xs truncate">{bill.supplier_ref ?? '—'}</div>
              <div className="col-span-1 text-slate-500 text-xs">{formatDate(bill.bill_date)}</div>
              <div className="col-span-1 text-slate-500 text-xs">{formatDate(bill.due_date)}</div>
              <div className="col-span-1 text-right font-mono text-slate-700 text-xs">{formatMoney(bill.total_amount)}</div>
              <div className={cn('col-span-1 text-right font-mono text-xs font-medium',
                parseFloat(bill.balance_due) > 0 ? 'text-amber-700' : 'text-teal-600')}>
                {formatMoney(bill.balance_due)}
              </div>
              <div className="col-span-1 flex justify-center">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border capitalize', STATUS_STYLES[bill.status])}>
                  {bill.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
