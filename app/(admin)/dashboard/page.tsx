'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { Script } from '@/lib/types';
import { POD_COLORS } from '@/lib/types';
import { AlertTriangle, Clock, X } from 'lucide-react';

interface EditorAssignment {
  id: string;
  script_id: string;
  editor_name: string;
  status: 'assigned' | 'in_progress' | 'done';
  deadline?: string;
  completed_at?: string;
  is_revision?: boolean;
  created_at: string;
  script?: Script;
}

interface PodOption { id: string; name: string; color: string; }

const WEEKLY_TARGET = 400;

const POD_ACCENT: Record<string, { border: string; activeBg: string; activeText: string; dot: string }> = {
  blue:   { border: 'border-blue-200',   activeBg: 'bg-blue-600',   activeText: 'text-white', dot: 'bg-blue-500'   },
  purple: { border: 'border-purple-200', activeBg: 'bg-purple-600', activeText: 'text-white', dot: 'bg-purple-500' },
  orange: { border: 'border-orange-200', activeBg: 'bg-orange-500', activeText: 'text-white', dot: 'bg-orange-500' },
  teal:   { border: 'border-teal-200',   activeBg: 'bg-teal-600',   activeText: 'text-white', dot: 'bg-teal-500'   },
  pink:   { border: 'border-pink-200',   activeBg: 'bg-pink-500',   activeText: 'text-white', dot: 'bg-pink-500'   },
  green:  { border: 'border-green-200',  activeBg: 'bg-green-600',  activeText: 'text-white', dot: 'bg-green-500'  },
};

function daysOverdue(deadline: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(deadline); due.setHours(0, 0, 0, 0);
  return Math.round((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const router = useRouter();
  const [scripts, setScripts]         = useState<Script[]>([]);
  const [assignments, setAssignments] = useState<EditorAssignment[]>([]);
  const [pods, setPods]               = useState<PodOption[]>([]);
  const [selectedPod, setSelectedPod] = useState<string | null>(null);
  const [isLoading, setIsLoading]     = useState(true);

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      setIsLoading(true);
      const [scriptsRes, assignmentsRes, podsRes] = await Promise.all([
        supabase.from('scripts').select('*').order('created_at', { ascending: false }),
        supabase.from('editor_assignments').select('*').order('created_at', { ascending: false }),
        supabase.from('pods').select('*').order('created_at'),
      ]);

      const scriptsData: Script[] = scriptsRes.data || [];
      const assignmentsData: EditorAssignment[] = assignmentsRes.data || [];

      const scriptsMap: Record<string, Script> = {};
      scriptsData.forEach(s => { scriptsMap[s.id] = s; });

      setScripts(scriptsData);
      setAssignments(assignmentsData.map(a => ({ ...a, script: scriptsMap[a.script_id] })));
      setPods(podsRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }

  // ── Pod-filtered data ──────────────────────────────────────────────────────
  const filteredScripts     = selectedPod ? scripts.filter(s => s.pod === selectedPod) : scripts;
  const filteredAssignments = selectedPod
    ? assignments.filter(a => a.script?.pod === selectedPod)
    : assignments;

  const activeAssignments  = filteredAssignments.filter(a => a.status !== 'done');
  const assignedScriptIds  = new Set(activeAssignments.map(a => a.script_id));
  const pendingScripts     = filteredScripts.filter(s => !assignedScriptIds.has(s.id));
  const withEditorCount    = activeAssignments.length;

  const overdueAssignments = activeAssignments.filter(a => a.deadline && daysOverdue(a.deadline) > 0);
  const dueSoonAssignments = activeAssignments.filter(a => {
    if (!a.deadline) return false;
    const days = daysOverdue(a.deadline);
    return days >= -1 && days <= 0;
  });

  const weekAgo       = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const doneThisWeek  = filteredAssignments.filter(a => a.status === 'done' && new Date(a.completed_at || a.created_at) > weekAgo).length;
  const totalDone     = filteredAssignments.filter(a => a.status === 'done').length;
  const progress      = Math.min((doneThisWeek / WEEKLY_TARGET) * 100, 100);

  const columns = [
    {
      label: 'Scripts Ready', sublabel: 'Not yet with any editor',
      count: pendingScripts.length, color: 'text-gray-700', bg: 'bg-gray-50',
      items: pendingScripts.slice(0, 5), key: 'pending',
    },
    {
      label: 'With Editor', sublabel: 'Being worked on',
      count: withEditorCount, color: 'text-blue-700', bg: 'bg-blue-50',
      items: activeAssignments.slice(0, 5), key: 'with_editor',
    },
    {
      label: 'Done', sublabel: 'Delivered this week',
      count: totalDone, color: 'text-green-700', bg: 'bg-green-50',
      items: filteredAssignments.filter(a => a.status === 'done').slice(0, 5), key: 'done',
    },
  ];

  const selectedPodObj = pods.find(p => p.name === selectedPod);

  return (
    <div className="p-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-400 text-sm mt-0.5">Vidrow production overview</p>
        </div>
      </div>

      {/* ── Pod Filter Tabs ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedPod(null)}
          className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full border transition ${
            !selectedPod
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          All Pods
          {!selectedPod && (
            <span className="text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{scripts.length}</span>
          )}
        </button>
        {pods.map(pod => {
          const accent = POD_ACCENT[pod.color] || POD_ACCENT.blue;
          const isActive = selectedPod === pod.name;
          const podScriptCount = scripts.filter(s => s.pod === pod.name).length;
          return (
            <button
              key={pod.id}
              onClick={() => setSelectedPod(isActive ? null : pod.name)}
              className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-full border-2 transition ${
                isActive
                  ? `${accent.activeBg} ${accent.activeText} border-transparent`
                  : `bg-white text-gray-600 ${accent.border} hover:bg-gray-50`
              }`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isActive ? 'bg-white/70' : accent.dot}`} />
              {pod.name}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-gray-100 text-gray-500'}`}>
                {podScriptCount}
              </span>
            </button>
          );
        })}

        {/* Active filter badge */}
        {selectedPod && (
          <div className="flex items-center gap-1.5 ml-2 text-sm text-gray-500">
            <span className="text-gray-400">Showing:</span>
            <span className="font-semibold text-gray-800">{selectedPod}</span>
            <button onClick={() => setSelectedPod(null)} className="text-gray-400 hover:text-gray-700 ml-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── OVERDUE ALERT BANNER ─────────────────────────────────────────── */}
      {overdueAssignments.length > 0 && (
        <div className="bg-red-600 rounded-xl p-5 mb-6 text-white">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
              <div className="bg-white/20 rounded-lg p-1.5">
                <AlertTriangle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-bold text-lg leading-tight">
                  {overdueAssignments.length} {overdueAssignments.length === 1 ? 'video is' : 'videos are'} overdue{selectedPod ? ` in ${selectedPod}` : ''}!
                </p>
                <p className="text-red-200 text-xs">These passed their deadline — mark done or reassign immediately</p>
              </div>
            </div>
            <button onClick={() => router.push('/scripts')} className="text-xs font-semibold bg-white text-red-600 px-3 py-1.5 rounded-lg hover:bg-red-50 transition flex-shrink-0">
              View all →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {overdueAssignments.map(a => (
              <div key={a.id} className="bg-white/10 hover:bg-white/20 rounded-lg px-4 py-3 flex items-center justify-between transition">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    a.script?.pod === 'Pod 1' ? 'bg-blue-300' :
                    a.script?.pod === 'Pod 2' ? 'bg-purple-300' : 'bg-orange-300'
                  }`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{a.script?.title || 'Unknown script'}</p>
                    <p className="text-red-200 text-xs mt-0.5">
                      {a.editor_name} · {a.script?.pod || ''}{a.script?.client ? ` · ${a.script.client}` : ''}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold bg-red-800/60 px-2 py-1 rounded-full flex-shrink-0 ml-3 whitespace-nowrap">
                  {daysOverdue(a.deadline!)}d late
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Due today / tomorrow */}
      {dueSoonAssignments.length > 0 && overdueAssignments.length === 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Clock className="w-5 h-5 text-orange-500 flex-shrink-0" />
            <div>
              <p className="font-semibold text-orange-800 text-sm">
                {dueSoonAssignments.length} {dueSoonAssignments.length === 1 ? 'video' : 'videos'} due today or tomorrow{selectedPod ? ` in ${selectedPod}` : ''}
              </p>
              <p className="text-orange-600 text-xs mt-0.5">
                {dueSoonAssignments.map(a => a.script?.title || 'Unknown').join(', ')}
              </p>
            </div>
          </div>
          <button onClick={() => router.push('/scripts')} className="text-xs font-semibold text-orange-700 border border-orange-300 px-3 py-1.5 rounded-lg hover:bg-orange-100 transition flex-shrink-0 ml-4">
            View →
          </button>
        </div>
      )}

      {/* ── Weekly Counter ──────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-6 text-white mb-6">
        <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider mb-3">
          Weekly Delivery Target{selectedPod ? ` · ${selectedPod}` : ''}
        </p>
        <div className="flex items-end gap-6">
          <div>
            <p className="text-5xl font-bold">{doneThisWeek}</p>
            <p className="text-blue-200 text-sm mt-1">videos done this week</p>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs text-blue-200 mb-1.5">
              <span>{progress.toFixed(0)}% of target</span>
              <span>{WEEKLY_TARGET - doneThisWeek} remaining</span>
            </div>
            <div className="bg-blue-500/40 rounded-full h-3">
              <div className="bg-white h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-blue-200 text-xs mt-1.5">Target: {WEEKLY_TARGET} videos/week</p>
          </div>
        </div>
      </div>

      {/* ── Stats Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <StatCard label="Scripts Ready"   value={pendingScripts.length} sub="Waiting for editor"   color="gray"  />
        <StatCard label="With Editors"    value={withEditorCount}        sub="Being worked on now"  color="blue"  />
        <StatCard label="Done This Week"  value={doneThisWeek}           sub={`${totalDone} total all time`} color="green" />
      </div>

      {/* ── Pod Breakdown (clickable) ────────────────────────────────────── */}
      {!selectedPod && (
        <div className="grid grid-cols-3 gap-4 mb-8">
          {pods.map(pod => {
            const podScripts    = scripts.filter(s => s.pod === pod.name);
            const podAssigned   = assignments.filter(a => a.script?.pod === pod.name && a.status !== 'done');
            const podDone       = assignments.filter(a => a.script?.pod === pod.name && a.status === 'done');
            const podOverdue    = assignments.filter(a => a.script?.pod === pod.name && a.status !== 'done' && a.deadline && daysOverdue(a.deadline) > 0);
            const accent        = POD_ACCENT[pod.color] || POD_ACCENT.blue;
            return (
              <button
                key={pod.id}
                onClick={() => setSelectedPod(pod.name)}
                className={`rounded-xl border-2 p-4 bg-white text-left transition hover:shadow-md hover:-translate-y-0.5 ${
                  podOverdue.length > 0 ? 'border-red-300' : accent.border
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${POD_COLORS[pod.name] || 'bg-gray-100 text-gray-700'}`}>{pod.name}</span>
                  <div className="flex items-center gap-1.5">
                    {podOverdue.length > 0 && (
                      <span className="flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" />{podOverdue.length} overdue
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-medium">Click to filter →</span>
                  </div>
                </div>
                <div className="flex items-end justify-between mt-3">
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{podScripts.length}</p>
                    <p className="text-xs text-gray-500 mt-0.5">total scripts</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-700">{podAssigned.length} active</p>
                    <p className="text-xs text-green-600 font-medium">{podDone.length} done</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Pipeline ────────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-gray-900">Production Pipeline</h2>
            {selectedPod && selectedPodObj && (
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${POD_COLORS[selectedPod] || 'bg-gray-100 text-gray-700'}`}>
                {selectedPod}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">Showing latest 5 per stage</p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {columns.map(col => (
            <div key={col.key} className={`rounded-xl ${col.bg} border border-gray-200 p-4`}>
              <div className="flex items-center justify-between mb-3">
                <p className={`text-xs font-bold uppercase tracking-wider ${col.color}`}>{col.label}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white shadow-sm ${col.color}`}>{col.count}</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">{col.sublabel}</p>
              <div className="space-y-2">
                {col.items.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">Nothing here</p>
                ) : (
                  col.items.map((item: any) => {
                    const script = item.script || item;
                    const pod = script.pod;
                    const isOverdue = item.deadline && daysOverdue(item.deadline) > 0;
                    return (
                      <div key={item.id} className={`bg-white rounded-lg px-3 py-2 border-l-4 shadow-sm ${
                        isOverdue ? 'border-l-red-500' :
                        pod === 'Pod 1' ? 'border-l-blue-500' :
                        pod === 'Pod 2' ? 'border-l-purple-500' :
                        pod === 'Pod 3' ? 'border-l-orange-500' :
                        'border-l-gray-300'
                      }`}>
                        <div className="flex items-center gap-1">
                          {isOverdue && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                          <p className="text-xs font-medium text-gray-900 truncate">{script.title}</p>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          {pod && !selectedPod && <span className={`text-xs px-1.5 py-0.5 rounded-full ${POD_COLORS[pod]}`}>{pod}</span>}
                          {script.client && <span className="text-xs text-teal-600 font-medium truncate">{script.client}</span>}
                          {item.editor_name && <span className="text-xs text-gray-500">{item.editor_name}</span>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {col.count > 5 && (
                <p className="text-xs text-gray-400 text-center mt-2">+{col.count - 5} more</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }: { label: string; value: number; sub: string; color: string }) {
  const colors: Record<string, string> = { gray: 'text-gray-900', blue: 'text-blue-600', yellow: 'text-yellow-600', green: 'text-green-600' };
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-4xl font-bold mt-2 ${colors[color]}`}>{value}</p>
      <p className="text-xs text-gray-400 mt-1">{sub}</p>
    </div>
  );
}
