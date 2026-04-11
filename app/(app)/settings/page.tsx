'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Building2, User, Shield, CheckCircle2, AlertCircle, Users, Plus, Copy, Check, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';

type CompanyForm = {
  name: string;
  registered_name: string;
  tin: string;
  address: string;
  city: string;
  province: string;
  zip_code: string;
  phone: string;
  email: string;
  rdo_code: string;
  tax_type: 'vat' | 'percentage';
  fiscal_year_start: string;
  industry_preset: 'retail' | 'trading' | 'services' | 'corporate';
};

const emptyForm: CompanyForm = {
  name: '', registered_name: '', tin: '', address: '', city: '',
  province: '', zip_code: '', phone: '', email: '', rdo_code: '',
  tax_type: 'vat', fiscal_year_start: '1', industry_preset: 'services',
};

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const TABS = [
  { id: 'company', label: 'Company Profile', icon: Building2 },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'account', label: 'My Account', icon: User },
  { id: 'security', label: 'Security', icon: Shield },
] as const;

type Tab = typeof TABS[number]['id'];

type TeamMember = { user_id: string; email: string; full_name: string | null; role: string; joined_at: string };
type MemberInvite = { id: string; email: string; role: string; token: string; status: string; expires_at: string };

const ROLES = ['owner', 'approver', 'encoder', 'viewer'] as const;
const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner', approver: 'Approver', encoder: 'Encoder', viewer: 'Viewer',
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('company');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [saveMsg, setSaveMsg] = useState('');

  // Account tab
  const [userEmail, setUserEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [nameLoading, setNameLoading] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  // Team tab
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [memberInvites, setMemberInvites] = useState<MemberInvite[]>([]);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<typeof ROLES[number]>('encoder');
  const [inviteCreating, setInviteCreating] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [copiedInvite, setCopiedInvite] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState('');
  const [userRole, setUserRole] = useState('');

  // Security tab
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwStatus, setPwStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [pwMsg, setPwMsg] = useState('');

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (activeTab === 'team' && companyId) loadTeam(); }, [activeTab, companyId]);

  async function loadData() {
    const supabase = createClient();

    // Company
    const { data: uc } = await supabase
      .from('user_companies')
      .select('company_id, company:companies(*)')
      .eq('is_default', true)
      .single();

    if (uc) {
      setCompanyId(uc.company_id);
      const c = (uc.company as unknown) as Record<string, unknown>;
      setForm({
        name: (c.name as string) ?? '',
        registered_name: (c.registered_name as string) ?? '',
        tin: (c.tin as string) ?? '',
        address: (c.address as string) ?? '',
        city: (c.city as string) ?? '',
        province: (c.province as string) ?? '',
        zip_code: (c.zip_code as string) ?? '',
        phone: (c.phone as string) ?? '',
        email: (c.email as string) ?? '',
        rdo_code: (c.rdo_code as string) ?? '',
        tax_type: (c.tax_type as 'vat' | 'percentage') ?? 'vat',
        fiscal_year_start: String(c.fiscal_year_start ?? 1),
        industry_preset: (c.industry_preset as CompanyForm['industry_preset']) ?? 'services',
      });
    }

    // User
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserEmail(user.email ?? '');
      setFullName(user.user_metadata?.full_name ?? '');
      setCurrentUserId(user.id);
    }

    setLoading(false);
  }

  async function loadTeam() {
    if (!companyId) return;
    const supabase = createClient();
    const { data: members } = await supabase
      .from('company_team')
      .select('*')
      .eq('company_id', companyId);
    setTeam((members ?? []) as TeamMember[]);
    const me = (members ?? []).find((m: TeamMember) => m.user_id === currentUserId);
    setUserRole(me?.role ?? '');

    const { data: invites } = await supabase
      .from('company_member_invites')
      .select('*')
      .eq('company_id', companyId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    setMemberInvites((invites ?? []) as MemberInvite[]);
  }

  async function createMemberInvite() {
    if (!inviteEmail.trim() || !companyId) return;
    setInviteCreating(true);
    setInviteError('');
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from('company_member_invites').insert({
      company_id: companyId,
      invited_by: user!.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
    });
    if (error) { setInviteError(error.message); }
    else { setInviteEmail(''); await loadTeam(); }
    setInviteCreating(false);
  }

  async function revokeInvite(id: string) {
    const supabase = createClient();
    await supabase.from('company_member_invites').update({ status: 'revoked' }).eq('id', id);
    setMemberInvites(prev => prev.filter(i => i.id !== id));
  }

  function copyInviteLink(inv: MemberInvite) {
    const link = `${window.location.origin}/join/${inv.token}`;
    const msg = `You've been invited to join our team on J3 Accounting.\n\nRole: ${ROLE_LABELS[inv.role]}\nLink: ${link}\n\nThe link expires on ${new Date(inv.expires_at).toLocaleDateString()}.`;
    navigator.clipboard.writeText(msg);
    setCopiedInvite(inv.id);
    setTimeout(() => setCopiedInvite(null), 2000);
  }

  async function saveCompany() {
    if (!companyId || !form.name.trim()) {
      setSaveStatus('error'); setSaveMsg('Company name is required.'); return;
    }
    setSaving(true); setSaveStatus('idle');
    const supabase = createClient();
    const { error } = await supabase.from('companies').update({
      name: form.name.trim(),
      registered_name: form.registered_name.trim() || null,
      tin: form.tin.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      province: form.province.trim() || null,
      zip_code: form.zip_code.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      rdo_code: form.rdo_code.trim() || null,
      tax_type: form.tax_type,
      fiscal_year_start: parseInt(form.fiscal_year_start),
      industry_preset: form.industry_preset,
      updated_at: new Date().toISOString(),
    }).eq('id', companyId);

    setSaving(false);
    if (error) { setSaveStatus('error'); setSaveMsg(error.message); }
    else { setSaveStatus('success'); setSaveMsg('Company profile saved.'); }
    setTimeout(() => setSaveStatus('idle'), 3000);
  }

  async function saveName() {
    setNameLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ data: { full_name: fullName.trim() } });
    setNameLoading(false);
    if (!error) { setNameSaved(true); setTimeout(() => setNameSaved(false), 2500); }
  }

  async function changePassword() {
    setPwStatus('idle'); setPwMsg('');
    if (!newPw) { setPwStatus('error'); setPwMsg('New password is required.'); return; }
    if (newPw.length < 8) { setPwStatus('error'); setPwMsg('Password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwStatus('error'); setPwMsg('Passwords do not match.'); return; }
    setPwLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: newPw });
    setPwLoading(false);
    if (error) { setPwStatus('error'); setPwMsg(error.message); }
    else {
      setPwStatus('success'); setPwMsg('Password changed successfully.');
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
    }
    setTimeout(() => setPwStatus('idle'), 3500);
  }

  const F = (k: keyof CompanyForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-slate-400 text-sm">Loading settings...</div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your company and account preferences</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 flex-1 justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}>
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Company Profile ── */}
      {activeTab === 'company' && (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          {/* Business identity */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Business Identity</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Trading Name *</label>
                <input type="text" value={form.name} onChange={e => F('name', e.target.value)}
                  placeholder="e.g. J3 Trading"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Registered Name (BIR)</label>
                <input type="text" value={form.registered_name} onChange={e => F('registered_name', e.target.value)}
                  placeholder="Legal name as registered with BIR"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">TIN</label>
                <input type="text" value={form.tin} onChange={e => F('tin', e.target.value)}
                  placeholder="000-000-000-000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">RDO Code</label>
                <input type="text" value={form.rdo_code} onChange={e => F('rdo_code', e.target.value)}
                  placeholder="e.g. 047"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Industry</label>
                <select value={form.industry_preset} onChange={e => F('industry_preset', e.target.value as CompanyForm['industry_preset'])}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400">
                  <option value="services">Services</option>
                  <option value="retail">Retail</option>
                  <option value="trading">Trading</option>
                  <option value="corporate">Corporate</option>
                </select>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Contact Information</h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Address</label>
              <input type="text" value={form.address} onChange={e => F('address', e.target.value)}
                placeholder="Street address"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">City</label>
                <input type="text" value={form.city} onChange={e => F('city', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Province</label>
                <input type="text" value={form.province} onChange={e => F('province', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">ZIP Code</label>
                <input type="text" value={form.zip_code} onChange={e => F('zip_code', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Phone</label>
                <input type="text" value={form.phone} onChange={e => F('phone', e.target.value)}
                  placeholder="+63 2 XXXX XXXX"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={e => F('email', e.target.value)}
                  placeholder="accounting@company.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
              </div>
            </div>
          </div>

          {/* Tax & Fiscal */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Tax & Fiscal Settings</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Tax Type</label>
                <select value={form.tax_type} onChange={e => F('tax_type', e.target.value as 'vat' | 'percentage')}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400">
                  <option value="vat">VAT Registered (12%)</option>
                  <option value="percentage">Non-VAT / Percentage Tax (3%)</option>
                </select>
                <p className="text-xs text-slate-400 mt-1">Used as default on new invoices and bills</p>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">Fiscal Year Start</label>
                <select value={form.fiscal_year_start} onChange={e => F('fiscal_year_start', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400">
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={String(i + 1)}>{m}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">Most PH companies use January (Calendar Year)</p>
              </div>
            </div>
          </div>

          {/* Save */}
          <div className="px-6 py-4 flex items-center justify-between bg-slate-50 rounded-b-xl">
            <div className="flex items-center gap-2">
              {saveStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-teal-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> {saveMsg}
                </span>
              )}
              {saveStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" /> {saveMsg}
                </span>
              )}
            </div>
            <button onClick={saveCompany} disabled={saving}
              className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60">
              {saving ? 'Saving…' : 'Save Company Profile'}
            </button>
          </div>
        </div>
      )}

      {/* ── Team ── */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          {/* Current members */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-sm font-semibold text-slate-700">Team Members</h2>
            </div>
            {team.length === 0 ? (
              <div className="px-6 py-8 text-center text-slate-400 text-sm">No team members yet.</div>
            ) : team.map(m => (
              <div key={m.user_id} className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 hover:bg-slate-50">
                <div>
                  <p className="text-sm font-medium text-slate-800">{m.full_name || m.email}</p>
                  {m.full_name && <p className="text-xs text-slate-400">{m.email}</p>}
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn(
                    'px-2.5 py-0.5 rounded-full text-xs font-medium border',
                    m.role === 'owner' ? 'bg-violet-50 text-violet-700 border-violet-200' :
                    m.role === 'approver' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    m.role === 'encoder' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-slate-100 text-slate-600 border-slate-200'
                  )}>
                    {ROLE_LABELS[m.role] ?? m.role}
                  </span>
                  {m.user_id === currentUserId && (
                    <span className="text-xs text-slate-400">(you)</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pending invites */}
          {memberInvites.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-700">Pending Invites</h2>
              </div>
              {memberInvites.map(inv => (
                <div key={inv.id} className="flex items-center justify-between px-6 py-3.5 border-t border-slate-100 hover:bg-slate-50">
                  <div>
                    <p className="text-sm text-slate-700">{inv.email}</p>
                    <p className="text-xs text-slate-400">
                      {ROLE_LABELS[inv.role]} · Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => copyInviteLink(inv)} title="Copy invite link"
                      className="p-1.5 rounded text-slate-400 hover:text-teal-600 hover:bg-teal-50 transition-colors">
                      {copiedInvite === inv.id ? <Check className="w-3.5 h-3.5 text-teal-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => revokeInvite(inv.id)} title="Revoke"
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Invite new member — owners only */}
          {(userRole === 'owner' || team.length === 0) && (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <h2 className="text-sm font-semibold text-slate-700 mb-1">Invite a Team Member</h2>
              <p className="text-xs text-slate-400 mb-4">
                They must first have a j3accounting account. Send them the invite link after creating it.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  placeholder="colleague@email.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && createMemberInvite()}
                  className="flex-1 px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                />
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as typeof inviteRole)}
                  className="px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400"
                >
                  {ROLES.filter(r => r !== 'owner').map(r => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <button
                  onClick={createMemberInvite}
                  disabled={inviteCreating || !inviteEmail.trim()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60 whitespace-nowrap"
                >
                  <Plus className="w-4 h-4" /> {inviteCreating ? 'Creating…' : 'Create Invite'}
                </button>
              </div>
              {inviteError && <p className="mt-2 text-sm text-red-600">{inviteError}</p>}
              <div className="mt-4 bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-600">Role permissions</p>
                <p><span className="font-medium">Approver</span> — can post/approve journal entries and invoices</p>
                <p><span className="font-medium">Encoder</span> — can create drafts, encode transactions</p>
                <p><span className="font-medium">Viewer</span> — read-only access to all records</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── My Account ── */}
      {activeTab === 'account' && (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Profile</h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Email Address</label>
              <input type="email" value={userEmail} disabled
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-not-allowed" />
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed here. Contact support to update.</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Full Name</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Your full name"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
            </div>
          </div>
          <div className="px-6 py-4 flex items-center justify-between bg-slate-50 rounded-b-xl">
            <div>
              {nameSaved && (
                <span className="flex items-center gap-1.5 text-teal-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> Name updated.
                </span>
              )}
            </div>
            <button onClick={saveName} disabled={nameLoading}
              className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60">
              {nameLoading ? 'Saving…' : 'Update Name'}
            </button>
          </div>
        </div>
      )}

      {/* ── Security ── */}
      {activeTab === 'security' && (
        <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100">
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-700">Change Password</h2>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">New Password</label>
              <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                placeholder="At least 8 characters"
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">Confirm New Password</label>
              <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
                className={cn(
                  'w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2',
                  confirmPw && newPw !== confirmPw
                    ? 'border-red-300 focus:ring-red-500/30 focus:border-red-400'
                    : 'border-slate-200 focus:ring-teal-500/30 focus:border-teal-400'
                )} />
              {confirmPw && newPw !== confirmPw && (
                <p className="text-xs text-red-600 mt-1">Passwords do not match.</p>
              )}
            </div>
          </div>

          <div className="px-6 py-4 flex items-center justify-between bg-slate-50 rounded-b-xl">
            <div>
              {pwStatus === 'success' && (
                <span className="flex items-center gap-1.5 text-teal-600 text-sm">
                  <CheckCircle2 className="w-4 h-4" /> {pwMsg}
                </span>
              )}
              {pwStatus === 'error' && (
                <span className="flex items-center gap-1.5 text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4" /> {pwMsg}
                </span>
              )}
            </div>
            <button onClick={changePassword} disabled={pwLoading || (!!confirmPw && newPw !== confirmPw)}
              className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-60">
              {pwLoading ? 'Updating…' : 'Change Password'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
