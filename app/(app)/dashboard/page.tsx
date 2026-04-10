'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, FileText, Wallet, Banknote, ArrowRight, Plus } from 'lucide-react';
import { formatMoney } from '@/lib/utils';

type Stats = {
  totalAR: number;
  totalAP: number;
  overdueAR: number;
  pendingBills: number;
};

export default function DashboardPage() {
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats>({ totalAR: 0, totalAP: 0, overdueAR: 0, pendingBills: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserName(user.user_metadata?.full_name ?? user.email ?? 'User');
    }

    const { data: uc } = await supabase
      .from('user_companies')
      .select('company_id, company:companies(name)')
      .eq('is_default', true)
      .single();

    if (!uc) { setLoading(false); return; }
    setCompanyId(uc.company_id);
    setCompanyName((uc.company as { name: string } | null)?.name ?? 'Your Company');

    // AR outstanding
    const { data: arData } = await supabase
      .from('invoices')
      .select('balance_due, status')
      .eq('company_id', uc.company_id)
      .in('status', ['sent', 'partial', 'overdue'])
      .gt('balance_due', 0);

    const totalAR = (arData ?? []).reduce((s, i) => s + parseFloat(i.balance_due || '0'), 0);
    const overdueAR = (arData ?? []).filter(i => i.status === 'overdue')
      .reduce((s, i) => s + parseFloat(i.balance_due || '0'), 0);

    // AP outstanding
    const { data: apData } = await supabase
      .from('bills')
      .select('balance_due')
      .eq('company_id', uc.company_id)
      .in('status', ['approved', 'partial'])
      .gt('balance_due', 0);

    const totalAP = (apData ?? []).reduce((s, b) => s + parseFloat(b.balance_due || '0'), 0);

    // Draft bills pending approval
    const { count: pendingBills } = await supabase
      .from('bills')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', uc.company_id)
      .eq('status', 'draft');

    setStats({ totalAR, totalAP, overdueAR, pendingBills: pendingBills ?? 0 });
    setLoading(false);
  }

  const firstName = userName.split(' ')[0];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {firstName} 👋</h1>
          <p className="text-slate-500 text-sm mt-1">{companyName}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/ar/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">
            <Plus className="w-4 h-4" /> New Invoice
          </Link>
          <Link href="/ap/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors">
            <Plus className="w-4 h-4" /> New Bill
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Outstanding AR',
            value: formatMoney(stats.totalAR.toFixed(2)),
            sub: stats.overdueAR > 0 ? `${formatMoney(stats.overdueAR.toFixed(2))} overdue` : 'All current',
            subColor: stats.overdueAR > 0 ? 'text-red-500' : 'text-teal-500',
            icon: TrendingUp,
            iconColor: 'text-teal-600 bg-teal-50',
            href: '/ar',
          },
          {
            label: 'Outstanding AP',
            value: formatMoney(stats.totalAP.toFixed(2)),
            sub: stats.pendingBills > 0 ? `${stats.pendingBills} bill${stats.pendingBills !== 1 ? 's' : ''} pending approval` : 'All approved',
            subColor: stats.pendingBills > 0 ? 'text-amber-500' : 'text-teal-500',
            icon: Wallet,
            iconColor: 'text-amber-600 bg-amber-50',
            href: '/ap',
          },
          {
            label: 'Journal Entries',
            value: null,
            sub: 'View all entries',
            subColor: 'text-slate-400',
            icon: FileText,
            iconColor: 'text-blue-600 bg-blue-50',
            href: '/journal',
          },
          {
            label: 'Reports',
            value: null,
            sub: 'Income statement, aging...',
            subColor: 'text-slate-400',
            icon: Banknote,
            iconColor: 'text-violet-600 bg-violet-50',
            href: '/reports',
          },
        ].map(stat => {
          const Icon = stat.icon;
          return (
            <Link key={stat.label} href={stat.href}
              className="bg-white rounded-xl border border-slate-200 p-5 hover:border-teal-300 hover:shadow-sm transition-all group">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-500 text-sm">{stat.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.iconColor}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              {stat.value !== null && (
                <p className="text-2xl font-bold text-slate-900 mb-1">{loading ? '—' : stat.value}</p>
              )}
              <p className={`text-xs ${stat.subColor}`}>{stat.sub}</p>
            </Link>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Quick links */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'New Invoice', href: '/ar/new', desc: 'Bill a customer' },
              { label: 'New Bill', href: '/ap/new', desc: 'Record a supplier bill' },
              { label: 'New Journal Entry', href: '/journal/new', desc: 'Manual double-entry' },
              { label: 'View Reports', href: '/reports', desc: 'Financial statements' },
            ].map(a => (
              <Link key={a.label} href={a.href}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-slate-700 group-hover:text-teal-700">{a.label}</p>
                  <p className="text-xs text-slate-400">{a.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
              </Link>
            ))}
          </div>
        </div>

        {/* Shortcuts */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Module Overview</h2>
          <div className="space-y-2">
            {[
              { label: 'Chart of Accounts', href: '/coa', desc: '54 PFRS-compliant accounts pre-loaded' },
              { label: 'Customers', href: '/ar/customers', desc: 'Manage clients and credit terms' },
              { label: 'Suppliers', href: '/ap/suppliers', desc: 'Manage vendors and payment terms' },
              { label: 'Settings', href: '/settings', desc: 'Company profile and tax settings' },
            ].map(a => (
              <Link key={a.label} href={a.href}
                className="flex items-center justify-between px-4 py-3 rounded-lg border border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 transition-colors group">
                <div>
                  <p className="text-sm font-medium text-slate-700 group-hover:text-teal-700">{a.label}</p>
                  <p className="text-xs text-slate-400">{a.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-teal-500 transition-colors" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
