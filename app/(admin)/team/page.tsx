'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { UserPlus, Mail, User, CheckCircle, Clock, Trash2, RefreshCw } from 'lucide-react';

interface TeamMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  created_at: string;
}

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviting, setIsInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => { fetchMembers(); }, []);

  async function fetchMembers() {
    setIsLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'admin')
      .order('created_at', { ascending: true });
    setMembers(data || []);
    setIsLoading(false);
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsInviting(true);

    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const json = await res.json();

      if (!res.ok) {
        setError(json.error || 'Failed to send invite');
      } else {
        setSuccess(`Invite sent to ${form.email}! They'll get an email to join the portal.`);
        setForm({ email: '', full_name: '' });
        setShowInviteForm(false);
        await fetchMembers();
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRemove(memberId: string, memberName: string) {
    if (!confirm(`Remove ${memberName} from the team? They won't be able to log in.`)) return;

    const { error } = await supabase.from('users').delete().eq('id', memberId);
    if (error) {
      alert('Failed to remove member: ' + error.message);
    } else {
      setMembers(prev => prev.filter(m => m.id !== memberId));
    }
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-gray-400 text-sm mt-0.5">Manage who has access to the Vidrow portal</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={fetchMembers}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 text-sm font-medium py-2 px-3 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowInviteForm(true); setError(''); setSuccess(''); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
          >
            <UserPlus className="w-4 h-4" />
            Invite Member
          </button>
        </div>
      </div>

      {/* Success / Error banners */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-4 mb-6 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
          <p className="text-green-800 text-sm font-medium">{success}</p>
          <button onClick={() => setSuccess('')} className="ml-auto text-green-600 text-xs hover:text-green-800">✕</button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 mb-6">
          <p className="text-red-700 text-sm font-medium">{error}</p>
          {error.includes('sb_secret') || error.includes('service_role') || error.includes('key') ? (
            <p className="text-red-600 text-xs mt-1">
              Tip: The service role key may need to be the legacy JWT format. Go to Supabase → Settings → API → "Legacy anon/service_role keys" to get it.
            </p>
          ) : null}
        </div>
      )}

      {/* Invite form modal */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">Invite Team Member</h2>
              <p className="text-sm text-gray-500 mt-0.5">They'll get an email with a link to access the portal</p>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    required
                    value={form.full_name}
                    onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                    placeholder="e.g. Riya Sharma"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="riya@example.com"
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg px-4 py-3">
                <p className="text-xs text-blue-700 font-medium">What happens next?</p>
                <p className="text-xs text-blue-600 mt-0.5">
                  They'll receive an email with a magic link. Clicking it logs them into the Vidrow portal — no password needed. They can set a password from account settings later.
                </p>
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowInviteForm(false); setError(''); }}
                  className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isInviting ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending...</>
                  ) : (
                    <><UserPlus className="w-4 h-4" /> Send Invite</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Team members list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <UserPlus className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No team members yet</p>
          <p className="text-gray-400 text-sm mt-1">Invite your first team member to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <p className="text-sm text-gray-500 font-medium">{members.length} member{members.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="divide-y divide-gray-100">
            {members.map(member => (
              <div key={member.id} className="flex items-center px-6 py-4 hover:bg-gray-50 transition">
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <span className="text-blue-700 font-bold text-sm">
                    {member.full_name?.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase() || '?'}
                  </span>
                </div>

                {/* Name + email */}
                <div className="ml-4 flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{member.full_name || '—'}</p>
                  <p className="text-xs text-gray-500 truncate">{member.email}</p>
                </div>

                {/* Status badge */}
                <div className="flex items-center gap-1.5 mr-6">
                  {member.status === 'active' ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3" /> Active
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-50 px-2.5 py-1 rounded-full">
                      <Clock className="w-3 h-3" /> Pending
                    </span>
                  )}
                </div>

                {/* Joined date */}
                <p className="text-xs text-gray-400 mr-6 hidden sm:block">
                  Joined {formatDate(member.created_at)}
                </p>

                {/* Remove button */}
                <button
                  onClick={() => handleRemove(member.id, member.full_name)}
                  className="text-gray-300 hover:text-red-500 transition"
                  title="Remove from team"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Help box */}
      <div className="mt-6 bg-gray-50 rounded-xl border border-gray-200 px-5 py-4">
        <p className="text-sm font-semibold text-gray-700 mb-1">How team login works</p>
        <ul className="text-xs text-gray-500 space-y-1 list-disc list-inside">
          <li>Invite a member by entering their name + email above</li>
          <li>They get an email with a magic link — clicking it logs them in</li>
          <li>They can add the portal to their phone's home screen (open in Safari/Chrome → Share → "Add to Home Screen")</li>
          <li>To set a permanent password, they can go to Supabase's account settings or you can share credentials directly</li>
        </ul>
      </div>
    </div>
  );
}
