'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Plus, Copy, Check, Ban, Users, Clock, CheckCircle2, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Replace with your own email ───────────────────────────────
const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? '';

type Invite = {
  id: string;
  email: string;
  token: string;
  status: 'pending' | 'used' | 'revoked';
  note: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  used:    'bg-teal-50 text-teal-700 border-teal-200',
  revoked: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // New invite form
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Copy state per invite
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { checkAuth(); }, []);

  async function checkAuth() {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || (ADMIN_EMAIL && user.email !== ADMIN_EMAIL)) {
      setAuthorized(false);
      setLoading(false);
      return;
    }
    setAuthorized(true);
    setUserId(user.id);
    await loadInvites(supabase);
  }

  async function loadInvites(supabase?: ReturnType<typeof createClient>) {
    const sb = supabase ?? createClient();
    setLoading(true);
    const { data } = await sb
      .from('invites')
      .select('*')
      .order('created_at', { ascending: false });
    setInvites((data ?? []) as Invite[]);
    setLoading(false);
  }

  async function createInvite() {
    if (!email.trim()) { setCreateError('Email is required.'); return; }
    setCreating(true);
    setCreateError('');
    const supabase = createClient();
    const { error } = await supabase.from('invites').insert({
      email: email.trim().toLowerCase(),
      note: note.trim() || null,
      invited_by: userId,
    });
    if (error) { setCreateError(error.message); setCreating(false); return; }
    setEmail('');
    setNote('');
    setCreating(false);
    await loadInvites();
  }

  async function revokeInvite(id: string) {
    const supabase = createClient();
    await supabase.from('invites').update({ status: 'revoked' }).eq('id', id);
    setInvites(prev => prev.map(i => i.id === id ? { ...i, status: 'revoked' } : i));
  }

  function copyToken(invite: Invite) {
    const text = `Your invite code for j3accounting:\n\nEmail: ${invite.email}\nCode: ${invite.token}\n\nRegister at: ${window.location.origin}/register\nExpires: ${new Date(invite.expires_at).toLocaleDateString()}`;
    navigator.clipboard.writeText(text);
    setCopied(invite.id);
    setTimeout(() => setCopied(null), 2000);
  }

  const stats = {
    total: invites.length,
    pending: invites.filter(i => i.status === 'pending').length,
    used: invites.filter(i => i.status === 'used').length,
  };

  if (authorized === false) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 text-sm">Access denied.</p>
          <button onClick={() => router.push('/dashboard')}
            className="mt-4 text-teal-600 text-sm hover:underline">Back to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Admin — Invite Management</h1>
              <p className="text-slate-500 text-xs">j3accounting access control</p>
            </div>
          </div>
          <button onClick={() => router.push('/dashboard')}
            className="text-sm text-slate-500 hover:text-slate-900 transition-colors">
            → Dashboard
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Users, label: 'Total Invites', value: stats.total, color: 'text-slate-700' },
            { icon: Clock, label: 'Pending', value: stats.pending, color: 'text-amber-600' },
            { icon: CheckCircle2, label: 'Used (Active)', value: stats.used, color: 'text-teal-600' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
              <s.icon className={cn('w-8 h-8', s.color)} />
              <div>
                <p className="text-xs text-slate-500">{s.label}</p>
                <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Create invite */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Create New Invite</h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              placeholder="applicant@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createInvite()}
              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
            <input
              type="text"
              placeholder="Note (e.g. from j3forge waitlist)"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
            />
            <button
              onClick={createInvite}
              disabled={creating}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" /> {creating ? 'Creating…' : 'Create Invite'}
            </button>
          </div>
          {createError && (
            <p className="mt-2 text-sm text-red-600">{createError}</p>
          )}
          <p className="mt-2 text-xs text-slate-400">Invite expires in 30 days. Copy the code and send it to the applicant.</p>
        </div>

        {/* Invite list */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-12 gap-3 px-5 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <div className="col-span-3">Email</div>
            <div className="col-span-3">Invite Code</div>
            <div className="col-span-2">Note</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-2">Expires</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-slate-400">Loading…</div>
          ) : invites.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-400">No invites yet. Create one above.</div>
          ) : invites.map(inv => (
            <div key={inv.id} className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center border-t border-slate-100 text-sm hover:bg-slate-50 transition-colors">
              <div className="col-span-3 text-slate-700 text-xs truncate">{inv.email}</div>
              <div className="col-span-3 font-mono text-xs text-slate-500 truncate">{inv.token}</div>
              <div className="col-span-2 text-slate-400 text-xs truncate">{inv.note ?? '—'}</div>
              <div className="col-span-1 flex justify-center">
                <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium border capitalize', STATUS_STYLES[inv.status])}>
                  {inv.status}
                </span>
              </div>
              <div className="col-span-2 text-slate-400 text-xs">
                {inv.status === 'used' && inv.used_at
                  ? `Used ${new Date(inv.used_at).toLocaleDateString()}`
                  : new Date(inv.expires_at).toLocaleDateString()}
              </div>
              <div className="col-span-1 flex items-center justify-end gap-1">
                {inv.status === 'pending' && (
                  <>
                    <button onClick={() => copyToken(inv)} title="Copy invite message"
                      className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                      {copied === inv.id ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => revokeInvite(inv.id)} title="Revoke"
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
