'use client';

import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { BookOpen, Clock } from 'lucide-react';

export default function PendingPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-10">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-5">
            <Clock className="w-7 h-7 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Access Pending</h1>
          <p className="text-slate-500 text-sm leading-relaxed mb-6">
            Your account has been created but does not yet have access to the accounting system.
            This may happen if you registered without a valid invite code.
          </p>
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left mb-6">
            <p className="text-xs font-semibold text-slate-600 mb-1">What to do next</p>
            <ol className="text-sm text-slate-600 space-y-1 list-decimal list-inside">
              <li>Request access via the waitlist at j3forge</li>
              <li>Wait for the developer to review and approve</li>
              <li>You will receive an invite code by email</li>
              <li>Sign in and use the invite code to complete setup</li>
            </ol>
          </div>
          <div className="flex flex-col gap-2">
            <a href="https://j3forge.com" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors">
              <BookOpen className="w-4 h-4" /> Go to j3forge waitlist
            </a>
            <button onClick={handleSignOut}
              className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
