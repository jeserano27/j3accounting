'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, Plus, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn, formatMoney, formatDate } from '@/lib/utils';

type Bill = {
  id: string; company_id: string; supplier_id: string; bill_number: string;
  supplier_ref: string | null; bill_date: string; due_date: string; status: string;
  subtotal: string; tax_amount: string; total_amount: string;
  amount_paid: string; balance_due: string; notes: string | null;
  supplier: { id: string; name: string; email: string | null } | null;
};

type BillLine = {
  id: string; description: string; quantity: string; unit_price: string;
  tax_rate: string; amount: string; line_order: number;
};

type ApPayment = {
  id: string; payment_date: string; amount: string;
  payment_method: string; reference: string | null;
};

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  partial: 'bg-amber-50 text-amber-700 border-amber-200',
  paid: 'bg-teal-50 text-teal-700 border-teal-200',
  cancelled: 'bg-slate-100 text-slate-400 border-slate-200',
};

const PAYMENT_METHODS = ['cash', 'check', 'bank_transfer', 'gcash', 'other'] as const;

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [bill, setBill] = useState<Bill | null>(null);
  const [lines, setLines] = useState<BillLine[]>([]);
  const [payments, setPayments] = useState<ApPayment[]>([]);
  const [loading, setLoading] = useState(true);

  const [payModalOpen, setPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payMethod, setPayMethod] = useState<typeof PAYMENT_METHODS[number]>('cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payError, setPayError] = useState('');
  const [payingSaving, setPayingSaving] = useState(false);

  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { loadData(); }, [id]);

  async function loadData() {
    const supabase = createClient();
    const { data: b } = await supabase
      .from('bills').select('*, supplier:suppliers(id,name,email)').eq('id', id).single();
    if (!b) { setLoading(false); return; }
    setBill((b as unknown) as Bill);

    const { data: lineData } = await supabase
      .from('bill_lines').select('*').eq('bill_id', id).order('line_order');
    setLines(lineData ?? []);

    const { data: payData } = await supabase
      .from('ap_payments').select('*').eq('bill_id', id).order('payment_date', { ascending: false });
    setPayments(payData ?? []);

    setLoading(false);
  }

  async function handleApprove() {
    const supabase = createClient();
    await supabase.from('bills').update({ status: 'approved' }).eq('id', id);
    loadData();
  }

  async function handlePayment() {
    setPayError('');
    if (!bill) return;
    const amount = parseFloat(payAmount);
    if (!amount || amount <= 0) { setPayError('Enter a valid amount.'); return; }
    if (amount > parseFloat(bill.balance_due)) {
      setPayError(`Amount exceeds balance due (${formatMoney(bill.balance_due)}).`); return;
    }
    setPayingSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from('ap_payments').insert({
      company_id: bill.company_id,
      bill_id: id,
      supplier_id: bill.supplier_id,
      payment_date: payDate,
      amount: amount.toFixed(4),
      payment_method: payMethod,
      reference: payRef.trim() || null,
      notes: payNotes.trim() || null,
    });
    if (error) { setPayError(error.message); setPayingSaving(false); return; }
    setPayingSaving(false);
    setPayModalOpen(false);
    setPayAmount(''); setPayRef(''); setPayNotes('');
    loadData();
  }

  async function handleCancel() {
    setCancelling(true);
    const supabase = createClient();
    await supabase.from('bills').update({ status: 'cancelled' }).eq('id', id);
    setCancelling(false); setCancelModalOpen(false); loadData();
  }

  if (loading) return <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading...</div>;
  if (!bill) return (
    <div className="max-w-2xl mx-auto text-center py-24">
      <p className="text-slate-500">Bill not found.</p>
      <Link href="/ap" className="text-teal-600 text-sm hover:underline mt-4 block">Back to AP</Link>
    </div>
  );

  const balanceDue = parseFloat(bill.balance_due);
  const canPay = ['approved', 'partial'].includes(bill.status) && balanceDue > 0;
  const canCancel = ['draft', 'approved'].includes(bill.status);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link href="/ap" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to AP
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-bold text-slate-900 font-mono">{bill.bill_number}</h1>
              <span className={cn('px-2.5 py-0.5 rounded-full text-xs font-semibold border capitalize', STATUS_STYLES[bill.status])}>
                {bill.status}
              </span>
            </div>
            <p className="text-slate-600 text-sm font-medium">{bill.supplier?.name}</p>
            {bill.supplier_ref && <p className="text-slate-500 text-xs mt-0.5">Supplier ref: {bill.supplier_ref}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {bill.status === 'draft' && (
              <button onClick={handleApprove}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors">
                <CheckCircle2 className="w-4 h-4" /> Approve
              </button>
            )}
            {canPay && (
              <button onClick={() => { setPayAmount(bill.balance_due); setPayModalOpen(true); }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">
                <Plus className="w-4 h-4" /> Record Payment
              </button>
            )}
            {canCancel && (
              <button onClick={() => setCancelModalOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors">
                <XCircle className="w-4 h-4" /> Cancel
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <div><p className="text-xs text-slate-500 mb-0.5">Bill Date</p><p className="text-sm font-medium text-slate-900">{formatDate(bill.bill_date)}</p></div>
          <div><p className="text-xs text-slate-500 mb-0.5">Due Date</p><p className="text-sm font-medium text-slate-900">{formatDate(bill.due_date)}</p></div>
          <div><p className="text-xs text-slate-500 mb-0.5">Total Amount</p><p className="text-sm font-mono font-semibold text-slate-900">{formatMoney(bill.total_amount)}</p></div>
          <div><p className="text-xs text-slate-500 mb-0.5">Balance Due</p>
            <p className={cn('text-sm font-mono font-bold', balanceDue > 0 ? 'text-amber-700' : 'text-teal-600')}>{formatMoney(bill.balance_due)}</p>
          </div>
        </div>
        {bill.notes && <p className="mt-4 text-sm text-slate-600 bg-slate-50 rounded-lg px-4 py-2.5">{bill.notes}</p>}
      </div>

      {/* Lines */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200"><h2 className="text-sm font-semibold text-slate-700">Line Items</h2></div>
        <div className="grid grid-cols-12 gap-4 px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
          <div className="col-span-5">Description</div>
          <div className="col-span-1 text-right">Qty</div>
          <div className="col-span-2 text-right">Unit Price</div>
          <div className="col-span-2 text-right">VAT</div>
          <div className="col-span-2 text-right">Amount</div>
        </div>
        {lines.map(line => (
          <div key={line.id} className="grid grid-cols-12 gap-4 px-6 py-3.5 items-center border-t border-slate-100 text-sm">
            <div className="col-span-5 text-slate-700">{line.description}</div>
            <div className="col-span-1 text-right text-slate-600 text-xs">{line.quantity}</div>
            <div className="col-span-2 text-right font-mono text-slate-600 text-xs">{formatMoney(line.unit_price)}</div>
            <div className="col-span-2 text-right text-slate-500 text-xs">{parseFloat(line.tax_rate) > 0 ? `${line.tax_rate}%` : '0%'}</div>
            <div className="col-span-2 text-right font-mono font-medium text-slate-900 text-xs">{formatMoney(line.amount)}</div>
          </div>
        ))}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 space-y-1.5">
          <div className="flex justify-end gap-8 text-sm text-slate-600"><span>Subtotal</span><span className="font-mono w-32 text-right">{formatMoney(bill.subtotal)}</span></div>
          <div className="flex justify-end gap-8 text-sm text-slate-600"><span>VAT</span><span className="font-mono w-32 text-right">{formatMoney(bill.tax_amount)}</span></div>
          <div className="flex justify-end gap-8 text-base font-bold text-slate-900 pt-2 border-t border-slate-200"><span>Total</span><span className="font-mono w-32 text-right">{formatMoney(bill.total_amount)}</span></div>
        </div>
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200"><h2 className="text-sm font-semibold text-slate-700">Payment History</h2></div>
          <div className="grid grid-cols-12 gap-4 px-6 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-3">Date</div><div className="col-span-3">Method</div>
            <div className="col-span-3">Reference</div><div className="col-span-3 text-right">Amount</div>
          </div>
          {payments.map(p => (
            <div key={p.id} className="grid grid-cols-12 gap-4 px-6 py-3 items-center border-t border-slate-100 text-sm">
              <div className="col-span-3 text-slate-600 text-xs">{formatDate(p.payment_date)}</div>
              <div className="col-span-3 capitalize text-slate-600 text-xs">{p.payment_method.replace('_', ' ')}</div>
              <div className="col-span-3 text-slate-500 text-xs">{p.reference ?? '—'}</div>
              <div className="col-span-3 text-right font-mono text-teal-700 font-semibold text-xs">{formatMoney(p.amount)}</div>
            </div>
          ))}
          <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end gap-8 text-sm">
            <span className="text-slate-600">Amount Paid</span>
            <span className="font-mono font-bold text-teal-700 w-32 text-right">{formatMoney(bill.amount_paid)}</span>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {payModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Record Payment</h2>
              <button onClick={() => setPayModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Amount (₱) *</label>
                  <input type="number" min="0.01" step="0.01" value={payAmount} onChange={e => setPayAmount(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                  <p className="text-xs text-slate-400 mt-1">Balance due: {formatMoney(bill.balance_due)}</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">Payment Date *</label>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Payment Method</label>
                <select value={payMethod} onChange={e => setPayMethod(e.target.value as typeof payMethod)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400">
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Reference</label>
                <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)}
                  placeholder="Check #, transaction ID..."
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              {payError && (
                <div className="flex items-start gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {payError}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setPayModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">Cancel</button>
              <button onClick={handlePayment} disabled={payingSaving}
                className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60">
                {payingSaving ? 'Saving…' : 'Record Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="px-6 py-5 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-900">Cancel Bill</h2>
              <p className="text-sm text-slate-500 mt-1">This will mark the bill as cancelled. Are you sure?</p>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 rounded-b-2xl">
              <button onClick={() => setCancelModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors">Keep Bill</button>
              <button onClick={handleCancel} disabled={cancelling}
                className="px-5 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-60">
                {cancelling ? 'Cancelling…' : 'Cancel Bill'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
