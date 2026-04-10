'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TrendingUp, Users, FileText, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUserName(data.user.user_metadata?.full_name ?? data.user.email ?? 'User');
        setCompanyName(data.user.user_metadata?.company_name ?? 'Your Company');
      }
    });
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome back, {userName.split(' ')[0]} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">{companyName}</p>
      </div>

      {/* Setup banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 flex items-start gap-4">
        <AlertCircle className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-teal-900 font-semibold text-sm">Getting started</p>
          <p className="text-teal-700 text-sm mt-0.5">
            Your account is set up. Next step: go to <strong>Chart of Accounts</strong> to review your default accounts, then start recording transactions.
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: '₱0.00', icon: TrendingUp, color: 'text-teal-600 bg-teal-50' },
          { label: 'Outstanding AR', value: '₱0.00', icon: FileText, color: 'text-blue-600 bg-blue-50' },
          { label: 'Outstanding AP', value: '₱0.00', icon: Users, color: 'text-amber-600 bg-amber-50' },
          { label: 'Cash Balance', value: '₱0.00', icon: TrendingUp, color: 'text-emerald-600 bg-emerald-50' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-slate-500 text-sm">{stat.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          );
        })}
      </div>

      {/* Quick links */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'New Invoice', href: '/ar/new' },
            { label: 'New Bill', href: '/ap/new' },
            { label: 'New Journal Entry', href: '/journal/new' },
            { label: 'View Reports', href: '/reports' },
          ].map((action) => (
            <a key={action.label} href={action.href}
              className="flex items-center justify-center px-4 py-3 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-teal-300 hover:text-teal-700 transition-colors text-center">
              {action.label}
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
