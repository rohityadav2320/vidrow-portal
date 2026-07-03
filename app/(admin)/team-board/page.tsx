'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Script, Editor } from '@/lib/types';
import { POD_COLORS } from '@/lib/types';
import { RefreshCw, Plus, X, CheckCircle, AlertTriangle, Clock } from 'lucide-react';

interface EditorAssignment {
  id: string;
  script_id: string;
  editor_name: string;
  status: 'assigned' | 'in_progress' | 'done';
  notes?: string;
  deadline?: string;
  completed_at?: string;
  is_revision?: boolean;
  created_at: string;
  script?: Script;
}

function getDeadlineInfo(deadline?: string) {
  if (!deadline) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(deadline);
  due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-600', bg: 'bg-red-50', overdue: true };
  if (diffDays === 0) return { label: 'Due today', color: 'text-orange-600', bg: 'bg-orange-50', overdue: false };
  if (diffDays === 1) return { label: 'Due tomorrow', color: 'text-orange-500', bg: 'bg-orange-50', overdue: false };
  if (diffDays <= 3) return { label: `${diffDays}d left`, color: 'text-yellow-600', bg: 'bg-yellow-50', overdue: false };
  return { label: `${diffDays}d left`, color: 'text-gray-500', bg: 'bg-gray-50', overdue: false };
}

export default function TeamBoardPage() {
  const [editors, setEditors] = useState<Editor[]>([]);
  const [assignments, setAssignments] = useState<EditorAssignment[]>([]);
  const [scripts, setScripts] = useState<Script[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());
  const [showAssignModal, setShowAssignModal] = useState(false);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    setIsLoading(true);
    try {
      const [editorsRes, assignmentsRes, scriptsRes] = await Promise.all([
        supabase.from('editors').select('*').eq('status', 'active').order('name'),
        supabase.from('editor_assignments').select('*').order('created_at', { ascending: false }),
        supabase.from('scripts').select('*').order('created_at', { ascending: false }),
      ]);

      const scriptsMap: Record<string, Script> = {};
      (scriptsRes.data || []).forEach((s: Script) => { scriptsMap[s.id] = s; });

      const enriched = (assignmentsRes.data || []).map((a: EditorAssignment) => ({
        ...a,
        script: scriptsMap[a.script_id],
      }));

      setEditors(editorsRes.data || []);
      setAssignments(enriched);
      setScripts(scriptsRes.data || []);
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }

  const byEditor: Record<string, EditorAssignment[]> = {};
  editors.forEach(e => { byEditor[e.name] = []; });
  assignments.forEach(a => {
    if (byEditor[a.editor_name] !== undefined) {
      byEditor[a.editor_name].push(a);
    }
  });

  const totalFree = editors.filter(e => byEditor[e.name]?.filter(a => a.status !== 'done').length === 0).length;
  const totalWorking = editors.length - totalFree;
  const totalActive = assignments.filter(a => a.status !== 'done').length;
  const overdueCount = assignments.filter(a => a.status !== 'done' && !!getDeadlineInfo(a.deadline)?.overdue).length;

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Script Assigner</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Auto-refreshes · Last updated {lastRefreshed.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            className="flex items-center gap-2 border border-gray-300 text-gray-600 text-sm font-medium py-2 px-3 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />
            Assign Script to Editor
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-6 mb-8 bg-white rounded-xl border border-gray-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-green-500"></div>
          <span className="text-sm font-semibold text-gray-700">{totalFree} Free</span>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-orange-500"></div>
          <span className="text-sm font-semibold text-gray-700">{totalWorking} Working</span>
        </div>
        <div className="w-px h-4 bg-gray-200" />
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
          <span className="text-sm font-semibold text-gray-700">{totalActive} Active videos</span>
        </div>
        {overdueCount > 0 && (
          <>
            <div className="w-px h-4 bg-gray-200" />
            <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1">
              <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
              <span className="text-sm font-bold text-red-600">{overdueCount} overdue</span>
            </div>
          </>
        )}
        <div className="w-px h-4 bg-gray-200" />
        <span className="text-sm text-gray-400">{editors.length} editors total</span>
      </div>

      {/* Editor Cards */}
      {editors.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
          <p className="text-gray-400 font-medium">No editors added yet</p>
          <p className="text-gray-400 text-sm mt-1">Go to Editors page and add your team</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {editors.map(editor => (
            <EditorCard
              key={editor.id}
              editor={editor}
              assignments={byEditor[editor.name] || []}
              onUpdate={loadData}
            />
          ))}
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <AssignModal
          editors={editors}
          scripts={scripts}
          existingAssignments={assignments}
          onClose={() => setShowAssignModal(false)}
          onAssigned={() => { setShowAssignModal(false); loadData(); }}
        />
      )}
    </div>
  );
}

function EditorCard({ editor, assignments, onUpdate }: {
  editor: Editor & { editor_type?: string };
  assignments: EditorAssignment[];
  onUpdate: () => void;
}) {
  const active = assignments.filter(a => a.status !== 'done');
  const done = assignments.filter(a => a.status === 'done');
  const isFree = active.length === 0;
  const hasOverdue = active.some(a => getDeadlineInfo(a.deadline)?.overdue);

  async function markDone(id: string) {
    if (!confirm('Mark this video as delivered and done? This will free up the editor.')) return;
    await supabase
      .from('editor_assignments')
      .update({ status: 'done', completed_at: new Date().toISOString() })
      .eq('id', id);
    onUpdate();
  }

  async function remove(id: string) {
    if (!confirm('Remove this assignment?')) return;
    await supabase.from('editor_assignments').delete().eq('id', id);
    onUpdate();
  }

  return (
    <div className={`bg-white rounded-xl border-2 overflow-hidden ${
      hasOverdue ? 'border-red-300' : isFree ? 'border-green-200' : 'border-orange-200'
    }`}>
      {/* Header */}
      <div className={`px-4 py-3.5 ${hasOverdue ? 'bg-red-50' : isFree ? 'bg-green-50' : 'bg-orange-50'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm ${
              hasOverdue ? 'bg-red-500' : isFree ? 'bg-green-500' : 'bg-orange-500'
            }`}>
              {editor.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-bold text-gray-900 text-sm">{editor.name}</p>
                {(editor as any).editor_type && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    (editor as any).editor_type === 'contract'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-purple-100 text-purple-700'
                  }`}>
                    {(editor as any).editor_type === 'contract' ? 'Contract' : 'Freelance'}
                  </span>
                )}
              </div>
              <p className={`text-xs font-semibold mt-0.5 ${
                hasOverdue ? 'text-red-600' : isFree ? 'text-green-600' : 'text-orange-600'
              }`}>
                {hasOverdue
                  ? `⚠ OVERDUE — ${active.length} video${active.length > 1 ? 's' : ''}`
                  : isFree ? '● FREE'
                  : `● WORKING — ${active.length} video${active.length > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {active.length > 0 && (
            <span className={`text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
              hasOverdue ? 'bg-red-500' : 'bg-orange-500'
            }`}>
              {active.length}
            </span>
          )}
        </div>
      </div>

      {/* Assignments */}
      <div className="px-4 py-3 space-y-2 min-h-[60px]">
        {active.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">No videos assigned</p>
        ) : (
          active.map(a => {
            const dlInfo = getDeadlineInfo(a.deadline);
            return (
              <div key={a.id} className={`rounded-lg border-l-4 px-3 py-2.5 ${
                dlInfo?.overdue ? 'bg-red-50 border-l-red-500' :
                a.script?.pod === 'Pod 1' ? 'bg-gray-50 border-l-blue-500' :
                a.script?.pod === 'Pod 2' ? 'bg-gray-50 border-l-purple-500' :
                a.script?.pod === 'Pod 3' ? 'bg-gray-50 border-l-orange-500' :
                'bg-gray-50 border-l-gray-300'
              }`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {dlInfo?.overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                      <p className="text-sm font-semibold text-gray-900 truncate">{a.script?.title || 'Unknown'}</p>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                      {a.script?.pod && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${POD_COLORS[a.script.pod]}`}>
                          {a.script.pod}
                        </span>
                      )}
                      {a.script?.client && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700">
                          {a.script.client}
                        </span>
                      )}
                      {a.is_revision && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                          ↩ Revision
                        </span>
                      )}
                      {dlInfo && (
                        <span className={`text-xs font-semibold flex items-center gap-0.5 ${dlInfo.color}`}>
                          {dlInfo.overdue
                            ? <AlertTriangle className="w-3 h-3" />
                            : <Clock className="w-3 h-3" />
                          }
                          {dlInfo.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => remove(a.id)}
                    title="Remove"
                    className="text-gray-300 hover:text-red-400 p-1 rounded flex-shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* Mark Done Button */}
                <button
                  onClick={() => markDone(a.id)}
                  className={`mt-2.5 w-full flex items-center justify-center gap-1.5 text-white text-xs font-bold py-1.5 rounded-md transition ${
                    dlInfo?.overdue
                      ? 'bg-red-500 hover:bg-red-600'
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  {dlInfo?.overdue ? '⚠ Overdue — Mark Done Now' : 'Video Delivered — Mark Done'}
                </button>
              </div>
            );
          })
        )}

        {done.length > 0 && (
          <p className="text-xs text-gray-400 border-t border-gray-100 pt-2 mt-1">
            ✓ {done.length} completed
          </p>
        )}
      </div>
    </div>
  );
}

function AssignModal({ editors, scripts, existingAssignments, onClose, onAssigned }: {
  editors: Editor[];
  scripts: Script[];
  existingAssignments: EditorAssignment[];
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [selectedEditor, setSelectedEditor] = useState('');
  const [selectedScript, setSelectedScript] = useState('');
  const [deadline, setDeadline] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const alreadyAssigned = selectedScript
    ? existingAssignments.find(a => a.script_id === selectedScript && a.status !== 'done')
    : null;

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEditor || !selectedScript) return;
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('editor_assignments')
        .insert({
          script_id: selectedScript,
          editor_name: selectedEditor,
          status: 'assigned',
          deadline: deadline || null,
        });
      if (err) throw new Error(err.message);
      onAssigned();
    } catch (err: any) {
      setError(err.message || 'Failed to assign');
    } finally {
      setSaving(false);
    }
  }

  const editorWorkload: Record<string, number> = {};
  editors.forEach(e => { editorWorkload[e.name] = 0; });
  existingAssignments.filter(a => a.status !== 'done').forEach(a => {
    if (editorWorkload[a.editor_name] !== undefined) editorWorkload[a.editor_name]++;
  });

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Assign Script to Editor</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleAssign} className="p-6 space-y-5">
          {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

          {/* Script Select */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Script</label>
            <select
              required
              value={selectedScript}
              onChange={e => setSelectedScript(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose script...</option>
              {scripts.map(s => (
                <option key={s.id} value={s.id}>
                  {s.title}{s.pod ? ` · ${s.pod}` : ''}{s.client ? ` · ${s.client}` : ''}
                </option>
              ))}
            </select>
            {alreadyAssigned && (
              <p className="text-xs text-orange-600 mt-1.5 font-medium">
                ⚠️ Already assigned to {alreadyAssigned.editor_name}
              </p>
            )}
          </div>

          {/* Deadline */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Due Date
              <span className="text-gray-400 font-normal ml-1.5 text-xs">— when should this be delivered?</span>
            </label>
            <input
              type="date"
              min={todayStr}
              value={deadline}
              onChange={e => setDeadline(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
            />
            {!deadline && (
              <p className="text-xs text-gray-400 mt-1">Optional — set a date to get overdue alerts</p>
            )}
            {deadline && (() => {
              const d = new Date(deadline);
              const today = new Date(); today.setHours(0,0,0,0);
              const diffDays = Math.round((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              return (
                <p className={`text-xs mt-1 font-medium ${diffDays <= 1 ? 'text-orange-600' : 'text-green-600'}`}>
                  {diffDays === 0 ? '⚠ Due today' : diffDays === 1 ? '⚠ Due tomorrow' : `✓ ${diffDays} days to deliver`}
                </p>
              );
            })()}
          </div>

          {/* Editor Select */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Select Editor</label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {editors.map(e => {
                const count = editorWorkload[e.name] || 0;
                return (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => setSelectedEditor(e.name)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition text-left ${
                      selectedEditor === e.name
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center flex-shrink-0 ${
                      count === 0 ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {e.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate">{e.name}</p>
                      <p className={`text-xs font-normal ${count === 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {count === 0 ? 'Free' : `${count} video${count > 1 ? 's' : ''}`}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-50 transition">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !selectedEditor || !selectedScript}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2.5 px-4 rounded-lg transition"
            >
              {saving ? 'Assigning...' : 'Assign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
