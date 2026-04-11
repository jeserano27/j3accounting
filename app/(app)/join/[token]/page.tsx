'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { BookOpen, Building2, CheckCircle2 } from 'lucide-react';

type InviteInfo = {
  company_name: string;
  invited_email: string;
  role: string;
  status: string;
  expires_at: string;
};

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', approver: 'Approver', encoder: 'Encoder', viewer: 'Viewer',
};

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState<'ok' | 'invalid_or_expired' | 'email_mismatch' | 'not_authenticated' | null>(null);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setUserEmail(user?.email ?? '');

      const { data } = await supabase.rpc('get_company_invite', { p_token: token });
      setInvite(data?.[0] ?? null);
      setLoading(false);
    }
    load();
  }, [token]);

  async function handleAccept() {
    setAccepting(true);
    const supabase = createClient();
    const { data } = await supabase.rpc('accept_company_invite', { p_token: token });
    setResult(data as typeof result);
    setAccepting(false);
    if (data === 'ok') {
      setTimeout(() => router.push('/dashboard'), 2000);
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading invite…</div>
  );

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-xs text-slate-500">J3 Accounting</p>
            <p className="text-sm font-semibold text-slate-900">Team Invitation</p>
          </div>
        </div>

        <div className="px-8 py-6">
          {!invite ? (
            <div className="text-center py-4">
              <p className="text-slate-600 font-medium">Invite not found</p>
              <p className="text-slate-400 text-sm mt-1">This invite link is invalid or has expired.</p>
            </div>
          ) : result === 'ok' ? (
            <div className="text-center py-4 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-teal-600 mx-auto" />
              <p className="text-slate-900 font-semibold">You&apos;re in!</p>
              <p className="text-slate-500 text-sm">
                You&apos;ve joined <span className="font-medium text-slate-700">{invite.company_name}</span> as {ROLE_LABELS[invite.role] ?? invite.role}.
              </p>
              <p className="text-slate-400 text-xs">Redirecting to dashboard…</p>
            </div>
          ) : (
            <>
              <div className="flex items-start gap-4 mb-6">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                  <Building2 className="w-5 h-5 text-slate-500" />
                </div>
                <div>
                  <p className="text-base font-semibold text-slate-900">{invite.company_name}</p>
                  <p className="text-sm text-slate-500">
                    You&apos;ve been invited to join as <span className="font-medium text-teal-700 capitalize">{ROLE_LABELS[invite.role] ?? invite.role}</span>
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Invited email</span>
                  <span className="text-slate-700 font-medium">{invite.invited_email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Signed in as</span>
                  <span className={userEmail === invite.invited_email ? 'text-teal-700 font-medium' : 'text-red-600 font-medium'}>
                    {userEmail || '(not signed in)'}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Role</span>
                  <span className="text-slate-700 capitalize">{ROLE_LABELS[invite.role] ?? invite.role}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Expires</span>
                  <span className="text-slate-700">{new Date(invite.expires_at).toLocaleDateString()}</span>
                </div>
              </div>

              {result === 'email_mismatch' && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  You&apos;re signed in as <strong>{userEmail}</strong> but this invite is for <strong>{invite.invited_email}</strong>. Sign in with the correct account to accept.
                </div>
              )}
              {result === 'invalid_or_expired' && (
                <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                  This invite has expired or already been used.
                </div>
              )}

              {invite.status === 'accepted' ? (
                <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 text-sm text-center">
                  This invite has already been accepted.
                </div>
              ) : invite.status === 'revoked' ? (
                <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 text-sm text-center">
                  This invite has been revoked.
                </div>
              ) : (
                <button onClick={handleAccept} disabled={accepting}
                  className="w-full py-2.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-semibold text-sm transition-colors disabled:opacity-50">
                  {accepting ? 'Accepting…' : `Accept & Join ${invite.company_name}`}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
