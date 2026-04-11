'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Account, AccountType } from '@/lib/types';
import { Plus, Search, ChevronDown, ChevronRight, Edit2, ToggleLeft, ToggleRight, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type AccountForm = {
  code: string;
  name: string;
  account_type: AccountType;
  sub_type: string;
  normal_balance: 'debit' | 'credit';
  description: string;
  bir_mapping: string;
  is_header: boolean;
};

const emptyForm: AccountForm = {
  code: '',
  name: '',
  account_type: 'asset',
  sub_type: '',
  normal_balance: 'debit',
  description: '',
  bir_mapping: '',
  is_header: false,
};

const TYPE_ORDER: AccountType[] = ['asset', 'liability', 'equity', 'revenue', 'expense'];

const TYPE_LABELS: Record<AccountType, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
};

const TYPE_COLORS: Record<AccountType, string> = {
  asset: 'bg-blue-50 text-blue-700 border-blue-200',
  liability: 'bg-amber-50 text-amber-700 border-amber-200',
  equity: 'bg-purple-50 text-purple-700 border-purple-200',
  revenue: 'bg-teal-50 text-teal-700 border-teal-200',
  expense: 'bg-red-50 text-red-700 border-red-200',
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<AccountType>>(new Set());

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [seeding, setSeeding] = useState(false);

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
      .from('accounts')
      .select('*')
      .eq('company_id', uc.company_id)
      .order('code');

    setAccounts(data ?? []);
    setLoading(false);
  }

  function openNew() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setModalOpen(true);
  }

  function openEdit(acct: Account) {
    setEditingId(acct.id);
    setForm({
      code: acct.code,
      name: acct.name,
      account_type: acct.account_type,
      sub_type: acct.sub_type ?? '',
      normal_balance: acct.normal_balance,
      description: acct.description ?? '',
      bir_mapping: acct.bir_mapping ?? '',
      is_header: acct.is_header,
    });
    setFormError('');
    setModalOpen(true);
  }

  async function handleSave() {
    if (!companyId) return;
    if (!form.code.trim() || !form.name.trim()) {
      setFormError('Code and name are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    const supabase = createClient();

    const payload = {
      company_id: companyId,
      code: form.code.trim(),
      name: form.name.trim(),
      account_type: form.account_type,
      sub_type: form.sub_type.trim() || null,
      normal_balance: form.normal_balance,
      description: form.description.trim() || null,
      bir_mapping: form.bir_mapping.trim() || null,
      is_header: form.is_header,
      level: form.is_header ? 1 : 2,
    };

    if (editingId) {
      const { error } = await supabase.from('accounts').update(payload).eq('id', editingId);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('accounts').insert(payload);
      if (error) { setFormError(error.message); setSaving(false); return; }
    }

    setSaving(false);
    setModalOpen(false);
    loadData();
  }

  async function seedDefaults() {
    if (!companyId) return;
    setSeeding(true);
    const supabase = createClient();
    const { error } = await supabase.rpc('seed_chart_of_accounts', { p_company_id: companyId });
    if (error) alert('Seed failed: ' + error.message);
    else await loadData();
    setSeeding(false);
  }

  async function toggleActive(acct: Account) {
    const supabase = createClient();
    await supabase.from('accounts').update({ is_active: !acct.is_active }).eq('id', acct.id);
    setAccounts(prev => prev.map(a => a.id === acct.id ? { ...a, is_active: !a.is_active } : a));
  }

  function toggleCollapse(type: AccountType) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  const filtered = search.trim()
    ? accounts.filter(a =>
        a.code.toLowerCase().includes(search.toLowerCase()) ||
        a.name.toLowerCase().includes(search.toLowerCase())
      )
    : accounts;

  const grouped = TYPE_ORDER.reduce<Record<AccountType, Account[]>>((acc, type) => {
    acc[type] = filtered.filter(a => a.account_type === type);
    return acc;
  }, {} as Record<AccountType, Account[]>);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Chart of Accounts</h1>
          <p className="text-slate-500 text-sm mt-0.5">PFRS-compliant account structure</p>
        </div>
        <div className="flex items-center gap-3">
          {accounts.length === 0 && !loading && (
            <button
              onClick={seedDefaults}
              disabled={seeding}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-teal-300 text-teal-700 bg-teal-50 text-sm font-medium hover:bg-teal-100 transition-colors disabled:opacity-60"
            >
              <BookOpen className="w-4 h-4" />
              {seeding ? 'Loading…' : 'Load Default PH Accounts'}
            </button>
          )}
          <button
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Account
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by code or name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading accounts...</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-1">Code</div>
            <div className="col-span-4">Account Name</div>
            <div className="col-span-2">Sub-Type</div>
            <div className="col-span-2">Normal Balance</div>
            <div className="col-span-2">BIR Mapping</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {TYPE_ORDER.map(type => {
            const rows = grouped[type];
            const isCollapsed = collapsed.has(type);
            return (
              <div key={type} className="border-b border-slate-100 last:border-0">
                {/* Group header */}
                <button
                  onClick={() => toggleCollapse(type)}
                  className="w-full flex items-center gap-3 px-5 py-3 bg-slate-50/70 hover:bg-slate-100/70 transition-colors"
                >
                  {isCollapsed
                    ? <ChevronRight className="w-4 h-4 text-slate-400" />
                    : <ChevronDown className="w-4 h-4 text-slate-400" />
                  }
                  <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold border', TYPE_COLORS[type])}>
                    {TYPE_LABELS[type]}
                  </span>
                  <span className="text-xs text-slate-400 ml-auto">{rows.length} accounts</span>
                </button>

                {/* Rows */}
                {!isCollapsed && rows.map(acct => (
                  <div
                    key={acct.id}
                    className={cn(
                      'grid grid-cols-12 gap-4 px-5 py-3 items-center border-t border-slate-100 text-sm hover:bg-slate-50/50 transition-colors',
                      !acct.is_active && 'opacity-50',
                      acct.is_header && 'bg-slate-50/40'
                    )}
                  >
                    <div className="col-span-1 font-mono text-slate-600 text-xs">{acct.code}</div>
                    <div className={cn('col-span-4 font-medium', acct.is_header ? 'text-slate-900 font-semibold' : 'text-slate-700', acct.level === 2 && !acct.is_header && 'pl-3')}>
                      {acct.name}
                      {acct.is_header && (
                        <span className="ml-2 text-xs text-slate-400 font-normal">Header</span>
                      )}
                    </div>
                    <div className="col-span-2 text-slate-500 text-xs capitalize">{acct.sub_type ?? '—'}</div>
                    <div className="col-span-2">
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs font-medium',
                        acct.normal_balance === 'debit' ? 'bg-blue-50 text-blue-600' : 'bg-teal-50 text-teal-600'
                      )}>
                        {acct.normal_balance}
                      </span>
                    </div>
                    <div className="col-span-2 text-slate-500 text-xs">{acct.bir_mapping ?? '—'}</div>
                    <div className="col-span-1 flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => openEdit(acct)}
                        className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
                        title="Edit"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(acct)}
                        className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                        title={acct.is_active ? 'Deactivate' : 'Activate'}
                      >
                        {acct.is_active
                          ? <ToggleRight className="w-3.5 h-3.5 text-teal-500" />
                          : <ToggleLeft className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">
                {editingId ? 'Edit Account' : 'New Account'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Account Code *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    placeholder="e.g. 1050"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Account Type *</label>
                  <select
                    value={form.account_type}
                    onChange={e => setForm(f => ({
                      ...f,
                      account_type: e.target.value as AccountType,
                      normal_balance: ['asset', 'expense'].includes(e.target.value) ? 'debit' : 'credit',
                    }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  >
                    {TYPE_ORDER.map(t => (
                      <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Account Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Petty Cash"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Sub-Type</label>
                  <input
                    type="text"
                    value={form.sub_type}
                    onChange={e => setForm(f => ({ ...f, sub_type: e.target.value }))}
                    placeholder="e.g. current, cogs"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Normal Balance</label>
                  <select
                    value={form.normal_balance}
                    onChange={e => setForm(f => ({ ...f, normal_balance: e.target.value as 'debit' | 'credit' }))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">BIR Mapping</label>
                <input
                  type="text"
                  value={form.bir_mapping}
                  onChange={e => setForm(f => ({ ...f, bir_mapping: e.target.value }))}
                  placeholder="e.g. BIR 2550M/Q"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none"
                />
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_header}
                  onChange={e => setForm(f => ({ ...f, is_header: e.target.checked }))}
                  className="w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                />
                <span className="text-sm text-slate-700">This is a header account (no transactions posted directly)</span>
              </label>

              {formError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Create Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
