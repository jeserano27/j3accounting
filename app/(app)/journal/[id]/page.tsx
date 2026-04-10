'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Account } from '@/lib/types';
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { cn, formatMoney, formatDate } from '@/lib/utils';

type JournalLine = {
  id: string;
  account_id: string;
  debit: string;
  credit: string;
  description: string | null;
  line_order: number;
  account?: Account;
};

type JournalEntry = {
  id: string;
  entry_number: string;
  entry_date: string;
  reference: string | null;
  memo: string | null;
  status: 'draft' | 'posted' | 'void';
  total_debit: string;
  total_credit: string;
  created_at: string;
  posted_at: string | null;
  void_reason: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-amber-50 text-amber-700 border-amber-200',
  posted: 'bg-teal-50 text-teal-700 border-teal-200',
  void: 'bg-slate-100 text-slate-500 border-slate-200 line-through',
};

export default function JournalEntryDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [lines, setLines] = useState<JournalLine[]>([]);
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [showVoidModal, setShowVoidModal] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [id]);

  async function loadData() {
    const supabase = createClient();

    const { data: entryData } = await supabase
      .from('journal_entries')
      .select('*')
      .eq('id', id)
      .single();

    if (!entryData) { setLoading(false); return; }
    setEntry(entryData);

    const { data: lineData } = await supabase
      .from('journal_lines')
      .select('*')
      .eq('entry_id', id)
      .order('line_order');

    if (lineData && lineData.length > 0) {
      const accountIds = [...new Set(lineData.map(l => l.account_id))];
      const { data: acctData } = await supabase
        .from('accounts')
        .select('*')
        .in('id', accountIds);

      const acctMap: Record<string, Account> = {};
      (acctData ?? []).forEach(a => { acctMap[a.id] = a; });
      setAccounts(acctMap);
      setLines(lineData);
    }

    setLoading(false);
  }

  async function handlePost() {
    if (!entry) return;
    setPosting(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase
      .from('journal_entries')
      .update({ status: 'posted' })
      .eq('id', entry.id);

    if (err) { setError(err.message); setPosting(false); return; }
    setPosting(false);
    loadData();
  }

  async function handleVoid() {
    if (!entry || !voidReason.trim()) return;
    setVoiding(true);
    setError('');
    const supabase = createClient();
    const { error: err } = await supabase
      .from('journal_entries')
      .update({ status: 'void', void_reason: voidReason.trim() })
      .eq('id', entry.id);

    if (err) { setError(err.message); setVoiding(false); return; }
    setVoiding(false);
    setShowVoidModal(false);
    loadData();
  }

  if (loading) {
    return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading...</div>;
  }

  if (!entry) {
    return (
      <div className="max-w-2xl mx-auto text-center py-24">
        <p className="text-slate-500">Journal entry not found.</p>
        <Link href="/journal" className="text-teal-600 text-sm hover:underline mt-4 block">Back to Journal</Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link href="/journal" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to Journal
      </Link>

      {/* Entry header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{entry.entry_number}</h1>
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize', STATUS_STYLES[entry.status])}>
                {entry.status}
              </span>
            </div>
            {entry.memo && <p className="text-slate-600 text-sm">{entry.memo}</p>}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {entry.status === 'draft' && (
              <>
                <button
                  onClick={handlePost}
                  disabled={posting}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {posting ? 'Posting…' : 'Post Entry'}
                </button>
                <button
                  onClick={() => setShowVoidModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  <AlertTriangle className="w-4 h-4" /> Void
                </button>
              </>
            )}
            {entry.status === 'posted' && (
              <button
                onClick={() => setShowVoidModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                <AlertTriangle className="w-4 h-4" /> Void Entry
              </button>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Entry Date</p>
            <p className="text-sm font-medium text-slate-900">{formatDate(entry.entry_date)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Reference</p>
            <p className="text-sm font-medium text-slate-900">{entry.reference ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Total Debit</p>
            <p className="text-sm font-mono font-semibold text-slate-900">{formatMoney(entry.total_debit)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-0.5">Total Credit</p>
            <p className="text-sm font-mono font-semibold text-slate-900">{formatMoney(entry.total_credit)}</p>
          </div>
        </div>

        {entry.void_reason && (
          <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            <span className="font-semibold">Void reason: </span>{entry.void_reason}
          </div>
        )}
      </div>

      {/* Lines */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Journal Lines</h2>
        </div>

        <div className="grid grid-cols-12 gap-4 px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <div className="col-span-2">Code</div>
          <div className="col-span-4">Account Name</div>
          <div className="col-span-3">Description</div>
          <div className="col-span-1 text-right">Debit</div>
          <div className="col-span-2 text-right">Credit</div>
        </div>

        {lines.map(line => {
          const acct = accounts[line.account_id];
          return (
            <div key={line.id} className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center border-t border-slate-100 text-sm">
              <div className="col-span-2 font-mono text-slate-500 text-xs">{acct?.code ?? '—'}</div>
              <div className="col-span-4 text-slate-700">{acct?.name ?? 'Unknown Account'}</div>
              <div className="col-span-3 text-slate-500 text-xs">{line.description ?? '—'}</div>
              <div className="col-span-1 text-right font-mono text-slate-900 text-xs">
                {parseFloat(line.debit) > 0 ? formatMoney(line.debit) : ''}
              </div>
              <div className="col-span-2 text-right font-mono text-slate-900 text-xs">
                {parseFloat(line.credit) > 0 ? formatMoney(line.credit) : ''}
              </div>
            </div>
          );
        })}

        {/* Footer totals */}
        <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <div className="col-span-9 text-sm font-semibold text-slate-700 text-right">Total</div>
          <div className="col-span-1 text-right font-mono font-bold text-slate-900 text-sm">{formatMoney(entry.total_debit)}</div>
          <div className="col-span-2 text-right font-mono font-bold text-slate-900 text-sm">{formatMoney(entry.total_credit)}</div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Void Modal */}
      {showVoidModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Void Entry</h2>
              <p className="text-sm text-slate-500 mt-1">This action cannot be undone. Please provide a reason.</p>
            </div>
            <div className="px-6 py-5">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Void Reason *</label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                rows={3}
                placeholder="Explain why this entry is being voided..."
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-400 resize-none"
              />
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setShowVoidModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={voiding || !voidReason.trim()}
                className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {voiding ? 'Voiding…' : 'Confirm Void'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
