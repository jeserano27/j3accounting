'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Plus, Search, Edit2, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';

type Supplier = {
  id: string; company_id: string; name: string; email: string | null;
  phone: string | null; address: string | null; city: string | null;
  tin: string | null; payment_terms: number; is_active: boolean;
  notes: string | null; created_at: string;
};

type SupplierForm = {
  name: string; email: string; phone: string; address: string;
  city: string; tin: string; payment_terms: string; notes: string;
};

const emptyForm: SupplierForm = {
  name: '', email: '', phone: '', address: '', city: '', tin: '', payment_terms: '30', notes: '',
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: uc } = await supabase
      .from('user_companies').select('company_id').eq('is_default', true).single();
    if (!uc) { setLoading(false); return; }
    setCompanyId(uc.company_id);
    const { data } = await supabase
      .from('suppliers').select('*').eq('company_id', uc.company_id).order('name');
    setSuppliers(data ?? []);
    setLoading(false);
  }

  function openNew() { setEditingId(null); setForm(emptyForm); setFormError(''); setModalOpen(true); }
  function openEdit(s: Supplier) {
    setEditingId(s.id);
    setForm({ name: s.name, email: s.email ?? '', phone: s.phone ?? '', address: s.address ?? '',
      city: s.city ?? '', tin: s.tin ?? '', payment_terms: String(s.payment_terms), notes: s.notes ?? '' });
    setFormError(''); setModalOpen(true);
  }

  async function handleSave() {
    if (!companyId || !form.name.trim()) { setFormError('Name is required.'); return; }
    setSaving(true); setFormError('');
    const supabase = createClient();
    const payload = {
      company_id: companyId,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      tin: form.tin.trim() || null,
      payment_terms: parseInt(form.payment_terms) || 30,
      notes: form.notes.trim() || null,
    };
    if (editingId) {
      const { error } = await supabase.from('suppliers').update(payload).eq('id', editingId);
      if (error) { setFormError(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from('suppliers').insert(payload);
      if (error) { setFormError(error.message); setSaving(false); return; }
    }
    setSaving(false); setModalOpen(false); loadData();
  }

  async function toggleActive(s: Supplier) {
    const supabase = createClient();
    await supabase.from('suppliers').update({ is_active: !s.is_active }).eq('id', s.id);
    setSuppliers(prev => prev.map(x => x.id === s.id ? { ...x, is_active: !x.is_active } : x));
  }

  const filtered = search.trim()
    ? suppliers.filter(s =>
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
        (s.tin ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : suppliers;

  const F = (k: keyof SupplierForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-slate-500 text-sm mt-0.5">Manage your vendors and payment terms</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Supplier
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input type="text" placeholder="Search by name, email, or TIN..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <p className="text-slate-500 text-sm">{search ? 'No suppliers found.' : 'No suppliers yet.'}</p>
          {!search && (
            <button onClick={openNew} className="inline-flex items-center gap-1.5 mt-4 text-teal-600 text-sm font-medium hover:underline">
              <Plus className="w-4 h-4" /> Add your first supplier
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-4 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-3">Name</div>
            <div className="col-span-3">Email</div>
            <div className="col-span-2">Phone</div>
            <div className="col-span-2">TIN</div>
            <div className="col-span-1 text-center">Terms</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          {filtered.map(s => (
            <div key={s.id} className={cn(
              'grid grid-cols-12 gap-4 px-5 py-3.5 items-center border-t border-slate-100 text-sm hover:bg-slate-50 transition-colors',
              !s.is_active && 'opacity-50'
            )}>
              <div className="col-span-3 font-medium text-slate-900">{s.name}</div>
              <div className="col-span-3 text-slate-500 text-xs truncate">{s.email ?? '—'}</div>
              <div className="col-span-2 text-slate-500 text-xs">{s.phone ?? '—'}</div>
              <div className="col-span-2 text-slate-500 text-xs font-mono">{s.tin ?? '—'}</div>
              <div className="col-span-1 text-center text-xs text-slate-600">Net {s.payment_terms}d</div>
              <div className="col-span-1 flex items-center justify-end gap-1">
                <button onClick={() => openEdit(s)} className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => toggleActive(s)} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
                  {s.is_active ? <ToggleRight className="w-3.5 h-3.5 text-teal-500" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 sticky top-0 bg-white rounded-t-2xl">
              <h2 className="text-lg font-bold text-slate-900">{editingId ? 'Edit Supplier' : 'New Supplier'}</h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Supplier Name *</label>
                <input type="text" value={form.name} onChange={e => F('name', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
                  <input type="email" value={form.email} onChange={e => F('email', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone</label>
                  <input type="text" value={form.phone} onChange={e => F('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Address</label>
                  <input type="text" value={form.address} onChange={e => F('address', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">City</label>
                  <input type="text" value={form.city} onChange={e => F('city', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">TIN</label>
                  <input type="text" value={form.tin} onChange={e => F('tin', e.target.value)}
                    placeholder="000-000-000"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Payment Terms (days)</label>
                  <input type="number" min="0" value={form.payment_terms} onChange={e => F('payment_terms', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Notes</label>
                <textarea value={form.notes} onChange={e => F('notes', e.target.value)} rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 resize-none" />
              </div>
              {formError && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{formError}</p>}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl sticky bottom-0">
              <button onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving}
                className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60">
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Add Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
