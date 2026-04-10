'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Plus, Search, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMoney, formatDate } from '@/lib/utils';

type EntryRow = {
  id: string;
  entry_number: string;
  entry_date: string;
  reference: string | null;
  memo: string | null;
  status: 'draft' | 'posted' | 'void';
  total_debit: string;
  total_credit: string;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  posted: 'bg-teal-50 text-teal-700 border-teal-200',
  void: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function JournalPage() {
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();

    const { data: uc } = await supabase
      .from('user_companies')
      .select('company_id')
      .eq('is_default', true)
      .single();

    if (!uc) { setLoading(false); return; }
    setCompanyId(uc.company_id);

    const { data } = await supabase
      .from('journal_entries')
      .select('id,entry_number,entry_date,reference,memo,status,total_debit,total_credit,created_at')
      .eq('company_id', uc.company_id)
      .order('entry_date', { ascending: false })
      .order('entry_number', { ascending: false });

    setEntries(data ?? []);
    setLoading(false);
  }

  const filtered = search.trim()
    ? entries.filter(e =>
        e.entry_number.toLowerCase().includes(search.toLowerCase()) ||
        (e.reference ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (e.memo ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : entries;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">General Journal</h1>
          <p className="text-slate-500 text-sm mt-0.5">All journal entries for this company</p>
        </div>
        <Link
          href="/journal/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Entry
        </Link>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by entry number, reference, or memo..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading journal entries...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">No journal entries yet.</p>
          <Link href="/journal/new" className="inline-flex items-center gap-1.5 mt-4 text-teal-600 text-sm font-medium hover:underline">
            <Plus className="w-4 h-4" /> Create your first entry
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-2">Entry #</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-2">Reference</div>
            <div className="col-span-3">Memo</div>
            <div className="col-span-1 text-right">Debit</div>
            <div className="col-span-1 text-right">Credit</div>
            <div className="col-span-1 text-right">Status</div>
          </div>

          {filtered.map(entry => (
            <Link
              key={entry.id}
              href={`/journal/${entry.id}`}
              className="grid grid-cols-12 gap-4 px-5 py-3.5 items-center border-t border-slate-100 text-sm hover:bg-slate-50 transition-colors"
            >
              <div className="col-span-2 font-mono text-slate-700 font-medium text-xs">{entry.entry_number}</div>
              <div className="col-span-2 text-slate-600 text-xs">{formatDate(entry.entry_date)}</div>
              <div className="col-span-2 text-slate-500 text-xs truncate">{entry.reference ?? '—'}</div>
              <div className="col-span-3 text-slate-600 text-xs truncate">{entry.memo ?? '—'}</div>
              <div className="col-span-1 text-right font-mono text-slate-700 text-xs">{formatMoney(entry.total_debit)}</div>
              <div className="col-span-1 text-right font-mono text-slate-700 text-xs">{formatMoney(entry.total_credit)}</div>
              <div className="col-span-1 flex justify-end">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border capitalize', STATUS_STYLES[entry.status])}>
                  {entry.status}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
