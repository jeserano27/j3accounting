'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Customer } from '@/lib/types';
import { Plus, Trash2, AlertCircle } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import Decimal from 'decimal.js';

type InvoiceLine = {
  id: string;
  description: string;
  quantity: string;
  unit_price: string;
  discount_pct: string;
  tax_rate: string;
};

function newLine(): InvoiceLine {
  return {
    id: Math.random().toString(36).slice(2),
    description: '', quantity: '1', unit_price: '', discount_pct: '0', tax_rate: '12',
  };
}

function lineAmount(l: InvoiceLine) {
  try {
    const qty = new Decimal(l.quantity || '0');
    const price = new Decimal(l.unit_price || '0');
    const disc = new Decimal(l.discount_pct || '0').div(100);
    return qty.mul(price).mul(new Decimal(1).minus(disc));
  } catch { return new Decimal(0); }
}

function lineTax(l: InvoiceLine) {
  try {
    return lineAmount(l).mul(new Decimal(l.tax_rate || '0').div(100));
  } catch { return new Decimal(0); }
}

export default function NewInvoicePage() {
  const router = useRouter();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [lines, setLines] = useState<InvoiceLine[]>([newLine(), newLine()]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const supabase = createClient();
    const { data: uc } = await supabase
      .from('user_companies').select('company_id').eq('is_default', true).single();
    if (!uc) return;
    setCompanyId(uc.company_id);
    const { data } = await supabase
      .from('customers').select('*').eq('company_id', uc.company_id).eq('is_active', true).order('name');
    setCustomers(data ?? []);
  }

  // When customer changes, auto-set due date based on payment_terms
  function handleCustomerChange(id: string) {
    setCustomerId(id);
    const cust = customers.find(c => c.id === id);
    if (cust) {
      const d = new Date(invoiceDate);
      d.setDate(d.getDate() + cust.payment_terms);
      setDueDate(d.toISOString().slice(0, 10));
    }
  }

  function updateLine(id: string, field: keyof InvoiceLine, value: string) {
    setLines(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  // Totals
  const subtotal = lines.reduce((sum, l) => sum.plus(lineAmount(l)), new Decimal(0));
  const taxTotal = lines.reduce((sum, l) => sum.plus(lineTax(l)), new Decimal(0));
  const total = subtotal.plus(taxTotal);

  async function handleSave(status: 'draft' | 'sent') {
    setError('');
    if (!companyId) { setError('Company not found.'); return; }
    if (!customerId) { setError('Please select a customer.'); return; }
    if (!invoiceDate || !dueDate) { setError('Invoice date and due date are required.'); return; }

    const validLines = lines.filter(l => l.description.trim() && parseFloat(l.unit_price || '0') > 0);
    if (validLines.length === 0) { setError('Add at least one line item with a description and price.'); return; }

    setSaving(true);
    const supabase = createClient();

    const { data: numData, error: numErr } = await supabase
      .rpc('next_invoice_number', { p_company_id: companyId });
    if (numErr) { setError(numErr.message); setSaving(false); return; }

    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .insert({
        company_id: companyId,
        customer_id: customerId,
        invoice_number: numData,
        invoice_date: invoiceDate,
        due_date: dueDate,
        status,
        subtotal: subtotal.toFixed(4),
        discount_amount: '0',
        tax_amount: taxTotal.toFixed(4),
        total_amount: total.toFixed(4),
        amount_paid: '0',
        notes: notes.trim() || null,
        terms: terms.trim() || null,
      })
      .select('id').single();

    if (invErr || !inv) { setError(invErr?.message ?? 'Failed to create invoice.'); setSaving(false); return; }

    const linePayload = validLines.map((l, i) => ({
      invoice_id: inv.id,
      description: l.description.trim(),
      quantity: parseFloat(l.quantity) || 1,
      unit_price: parseFloat(l.unit_price) || 0,
      discount_pct: parseFloat(l.discount_pct) || 0,
      tax_rate: parseFloat(l.tax_rate) || 0,
      amount: lineAmount(l).toFixed(4),
      line_order: i,
    }));

    const { error: linesErr } = await supabase.from('invoice_lines').insert(linePayload);
    if (linesErr) {
      await supabase.from('invoices').delete().eq('id', inv.id);
      setError(linesErr.message); setSaving(false); return;
    }

    router.push(`/ar/${inv.id}`);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">New Invoice</h1>
        <p className="text-slate-500 text-sm mt-0.5">Create an invoice for a customer</p>
      </div>

      {/* Invoice header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Invoice Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Customer *</label>
            <select value={customerId} onChange={e => handleCustomerChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 text-slate-700">
              <option value="">Select customer...</option>
              {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Invoice Date *</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Due Date *</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Terms</label>
            <input type="text" value={terms} onChange={e => setTerms(e.target.value)}
              placeholder="e.g. Net 30, COD..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">Notes</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Optional notes for the customer..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-sm font-semibold text-slate-700">Line Items</h2>
        </div>
        <div className="grid grid-cols-12 gap-2 px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <div className="col-span-4">Description</div>
          <div className="col-span-1 text-right">Qty</div>
          <div className="col-span-2 text-right">Unit Price</div>
          <div className="col-span-1 text-right">Disc %</div>
          <div className="col-span-1 text-right">VAT %</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-1"></div>
        </div>

        <div className="divide-y divide-slate-100">
          {lines.map(line => (
            <div key={line.id} className="grid grid-cols-12 gap-2 px-6 py-3 items-center">
              <div className="col-span-4">
                <input type="text" value={line.description}
                  onChange={e => updateLine(line.id, 'description', e.target.value)}
                  placeholder="Item or service description..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div className="col-span-1">
                <input type="number" min="0" step="1" value={line.quantity}
                  onChange={e => updateLine(line.id, 'quantity', e.target.value)}
                  className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div className="col-span-2">
                <input type="number" min="0" step="0.01" value={line.unit_price}
                  onChange={e => updateLine(line.id, 'unit_price', e.target.value)}
                  placeholder="0.00"
                  className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div className="col-span-1">
                <input type="number" min="0" max="100" step="1" value={line.discount_pct}
                  onChange={e => updateLine(line.id, 'discount_pct', e.target.value)}
                  className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm text-right focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div className="col-span-1">
                <select value={line.tax_rate} onChange={e => updateLine(line.id, 'tax_rate', e.target.value)}
                  className="w-full px-2 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400">
                  <option value="0">0%</option>
                  <option value="12">12%</option>
                </select>
              </div>
              <div className="col-span-2 text-right font-mono text-sm text-slate-700 pr-2">
                {formatMoney(lineAmount(line).toFixed(2))}
              </div>
              <div className="col-span-1 flex justify-center">
                <button onClick={() => lines.length > 1 && setLines(prev => prev.filter(l => l.id !== line.id))}
                  disabled={lines.length <= 1}
                  className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-3 border-t border-slate-100">
          <button onClick={() => setLines(prev => [...prev, newLine()])}
            className="flex items-center gap-1.5 text-sm text-teal-600 font-medium hover:text-teal-700 transition-colors">
            <Plus className="w-4 h-4" /> Add Line
          </button>
        </div>

        {/* Totals */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 space-y-2">
          <div className="flex justify-end gap-8 text-sm text-slate-600">
            <span>Subtotal</span>
            <span className="font-mono w-32 text-right">{formatMoney(subtotal.toFixed(2))}</span>
          </div>
          <div className="flex justify-end gap-8 text-sm text-slate-600">
            <span>VAT</span>
            <span className="font-mono w-32 text-right">{formatMoney(taxTotal.toFixed(2))}</span>
          </div>
          <div className="flex justify-end gap-8 text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
            <span>Total</span>
            <span className="font-mono w-32 text-right">{formatMoney(total.toFixed(2))}</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        <button onClick={() => router.push('/ar')}
          className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">
          Cancel
        </button>
        <button onClick={() => handleSave('draft')} disabled={saving}
          className="px-5 py-2 rounded-lg border border-teal-500 text-teal-700 text-sm font-medium hover:bg-teal-50 transition-colors disabled:opacity-60">
          {saving ? 'Saving…' : 'Save as Draft'}
        </button>
        <button onClick={() => handleSave('sent')} disabled={saving}
          className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60">
          {saving ? 'Saving…' : 'Save & Send'}
        </button>
      </div>
    </div>
  );
}
