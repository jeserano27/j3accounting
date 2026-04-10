'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  BookOpen, LayoutDashboard, List, FileText, CreditCard,
  Wallet, Receipt, Package, BarChart3, Settings,
  LogOut, Menu, X, ChevronDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/coa', label: 'Chart of Accounts', icon: List },
  { href: '/journal', label: 'General Journal', icon: FileText },
  {
    href: '/ar', label: 'Accounts Receivable', icon: CreditCard,
    children: [
      { href: '/ar', label: 'Invoices' },
      { href: '/ar/customers', label: 'Customers' },
    ],
  },
  { href: '/ap', label: 'Accounts Payable', icon: Wallet },
  { href: '/cash', label: 'Cash Book', icon: Receipt },
  { href: '/expenses', label: 'Expenses', icon: Package },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; full_name?: string } | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.replace('/login'); return; }
      setUser({ email: data.user.email!, full_name: data.user.user_metadata?.full_name });
    });
  }, [router]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen flex bg-slate-100">
      {/* Sidebar */}
      <aside className={cn(
        'fixed inset-y-0 left-0 z-50 w-64 flex flex-col bg-slate-900 border-r border-slate-800 transform transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        {/* Logo */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">J3 Accounting</p>
              <p className="text-teal-400 text-xs">Beta</p>
            </div>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.href === '/dashboard'
              ? pathname === '/dashboard'
              : pathname.startsWith(item.href);
            return (
              <div key={item.href}>
                <Link href={item.href} onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  )}>
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </Link>
                {item.children && isActive && (
                  <div className="ml-7 mt-0.5 space-y-0.5">
                    {item.children.map(child => (
                      <Link key={child.href} href={child.href} onClick={() => setSidebarOpen(false)}
                        className={cn(
                          'block px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                          pathname === child.href
                            ? 'text-teal-400'
                            : 'text-slate-500 hover:text-slate-300'
                        )}>
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User */}
        <div className="px-3 py-4 border-t border-slate-800">
          <div className="relative">
            <button onClick={() => setUserMenuOpen(o => !o)}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
              <div className="w-7 h-7 rounded-full bg-teal-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                {user?.full_name?.[0] ?? user?.email?.[0] ?? 'U'}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-white text-xs font-medium truncate">{user?.full_name ?? 'User'}</p>
                <p className="text-slate-500 text-xs truncate">{user?.email}</p>
              </div>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </button>
            {userMenuOpen && (
              <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
                <button onClick={signOut}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-300 hover:text-red-400 hover:bg-red-500/5 transition-colors">
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col lg:pl-64 min-w-0">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex items-center gap-4 px-6 h-14 bg-white border-b border-slate-200">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500 hover:text-slate-900">
            <Menu className="w-5 h-5" />
          </button>
          <div className="text-sm font-medium text-slate-600">
            {navItems.find(n => n.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(n.href))?.label ?? 'J3 Accounting'}
          </div>
        </header>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
