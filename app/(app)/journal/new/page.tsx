'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Account } from '@/lib/types';
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { cn, formatMoney } from '@/lib/utils';
import Decimal from 'decimal.js';

// ─── Types ────────────────────────────────────────────────────────────────────

type Line = {
  id: string; // local key only
  account_id: string;
  description: string;
  debit: string;
  credit: string;
};

function newLine(): Line {
  return { id: Math.random().toString(36).slice(2), account_id: '', description: '', debit: '', credit: '' };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NewJournalEntryPage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);

  // Header fields
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [memo, setMemo] = useState('');

  // Lines
  const [lines, setLines] = useState<Line[]>([newLine(), newLine(), newLine()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

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

    if (!uc) return;
    setCompanyId(uc.company_id);

    const { data } = await supabase
      .from('accounts')
      .select('*')
      .eq('company_id', uc.company_id)
      .eq('is_active', true)
      .eq('is_header', false)
      .order('code');

    setAccounts(data ?? []);
  }

  // ── Totals ──────────────────────────────────────────────────
  const totalDebit = lines.reduce((sum, l) => {
    try { return sum.plus(new Decimal(l.debit || '0')); } catch { return sum; }
  }, new Decimal(0));

  const totalCredit = lines.reduce((sum, l) => {
    try { return sum.plus(new Decimal(l.credit || '0')); } catch { return sum; }
  }, new Decimal(0));

  const isBalanced = totalDebit.eq(totalCredit) && !totalDebit.eq(0);
  const diff = totalDebit.minus(totalCredit).abs();

  // ── Line helpers ─────────────────────────────────────────────
  function updateLine(id: string, field: keyof Line, value: string) {
    setLines(prev => prev.map(l => {
      if (l.id !== id) return l;
      const updated = { ...l, [field]: value };
      // clear the other side when entering an amount
      if (field === 'debit' && value) updated.credit = '';
      if (field === 'credit' && value) updated.debit = '';
      return updated;
    }));
  }

  function addLine() {
    setLines(prev => [...prev, newLine()]);
  }

  function removeLine(id: string) {
    if (lines.length <= 2) return;
    setLines(prev => prev.filter(l => l.id !== id));
  }

  // ── Save ─────────────────────────────────────────────────────
  async function handleSave(status: 'draft' | 'posted') {
    setError('');

    if (!companyId) { setError('Company not found.'); return; }
    if (!entryDate) { setError('Entry date is required.'); return; }

    const validLines = lines.filter(l => l.account_id && (parseFloat(l.debit || '0') > 0 || parseFloat(l.credit || '0') > 0));

    if (validLines.length < 2) {
      setError('At least 2 lines with amounts are required.');
      return;
    }

    if (status === 'posted' && !isBalanced) {
      setError('Entry must be balanced (total debits = total credits) before posting.');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    // Get next entry number
    const { data: numData, error: numErr } = await supabase
      .rpc('next_journal_entry_number', { p_company_id: companyId });

    if (numErr) { setError(numErr.message); setSaving(false); return; }

    // Insert entry
    const { data: entry, error: entryErr } = await supabase
      .from('journal_entries')
      .insert({
        company_id: companyId,
        entry_number: numData,
        entry_date: entryDate,
        reference: reference.trim() || null,
        memo: memo.trim() || null,
        status,
        total_debit: totalDebit.toFixed(4),
        total_credit: totalCredit.toFixed(4),
      })
      .select('id')
      .single();

    if (entryErr || !entry) { setError(entryErr?.message ?? 'Failed to create entry.'); setSaving(false); return; }

    // Insert lines
    const linePayload = validLines.map((l, i) => ({
      entry_id: entry.id,
      account_id: l.account_id,
      debit: parseFloat(l.debit || '0'),
      credit: parseFloat(l.credit || '0'),
      description: l.description.trim() || null,
      line_order: i,
    }));

    const { error: linesErr } = await supabase.from('journal_lines').insert(linePayload);
    if (linesErr) {
      // Cleanup orphan entry
      await supabase.from('journal_entries').delete().eq('id', entry.id);
      setError(linesErr.message);
      setSaving(false);
      return;
    }

    router.push(`/journal/${entry.id}`);
  }

  const activeAccounts = accounts.filter(a => a.is_active && !a.is_header);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Journal Entry</h1>
        <p className="text-slate-500 text-sm mt-0.5">Double-entry bookkeeping — debits must equal credits</p>
      </div>

      {/* Entry header fields */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Entry Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Entry Date *</label>
            <input
              type="date"
              value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Reference</label>
            <input
              type="text"
              value={reference}
              onChange={e => setReference(e.target.value)}
              placeholder="OR #, SI #, Check #..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Memo</label>
            <input
              type="text"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              placeholder="Brief description..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
          </div>
        </div>
      </div>

      {/* Lines */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Journal Lines</h2>
        </div>

        {/* Column headers */}
        <div className="grid grid-cols-12 gap-3 px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <div className="col-span-4">Account</div>
          <div className="col-span-3">Description</div>
          <div className="col-span-2 text-right">Debit (₱)</div>
          <div className="col-span-2 text-right">Credit (₱)</div>
          <div className="col-span-1"></div>
        </div>

        <div className="divide-y divide-slate-100">
          {lines.map((line, idx) => (
            <div key={line.id} className="grid grid-cols-12 gap-3 px-6 py-3 items-center">
              <div className="col-span-4">
                <select
                  value={line.account_id}
                  onChange={e => updateLine(line.id, 'account_id', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 text-slate-700"
                >
                  <option value="">Select account...</option>
                  {['asset','liability','equity','revenue','expense'].map(type => (
                    <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1) + 's'}>
                      {activeAccounts.filter(a => a.account_type === type).map(a => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="col-span-3">
                <input
                  type="text"
                  value={line.description}
                  onChange={e => updateLine(line.id, 'description', e.target.value)}
                  placeholder="Optional note..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.debit}
                  onChange={e => updateLine(line.id, 'debit', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>
              <div className="col-span-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={line.credit}
                  onChange={e => updateLine(line.id, 'credit', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>
              <div className="col-span-1 flex justify-center">
                <button
                  onClick={() => removeLine(line.id)}
                  disabled={lines.length <= 2}
                  className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Add line */}
        <div className="px-6 py-3 border-t border-slate-100">
          <button
            onClick={addLine}
            className="flex items-center gap-1.5 text-sm text-teal-600 font-medium hover:text-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Line
          </button>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-12 gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <div className="col-span-7 flex items-center gap-2">
            {totalDebit.eq(0) && totalCredit.eq(0) ? null : isBalanced ? (
              <span className="flex items-center gap-1.5 text-teal-600 text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" /> Balanced
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-red-600 text-sm font-medium">
                <AlertCircle className="w-4 h-4" /> Difference: {formatMoney(diff.toFixed(2))}
              </span>
            )}
          </div>
          <div className="col-span-2 text-right font-semibold text-slate-900 text-sm">
            {formatMoney(totalDebit.toFixed(2))}
          </div>
          <div className="col-span-2 text-right font-semibold text-slate-900 text-sm">
            {formatMoney(totalCredit.toFixed(2))}
          </div>
          <div className="col-span-1"></div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button
          onClick={() => router.push('/journal')}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => handleSave('draft')}
          disabled={saving}
          className="px-5 py-2 rounded-lg border border-teal-500 text-teal-700 text-sm font-medium hover:bg-teal-50 transition-colors disabled:opacity-60"
        >
          {saving ? 'Saving…' : 'Save as Draft'}
        </button>
        <button
          onClick={() => handleSave('posted')}
          disabled={saving || !isBalanced}
          className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
        >
          {saving ? 'Posting…' : 'Post Entry'}
        </button>
      </div>
    </div>
  );
}
