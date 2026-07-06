'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Script, Client } from '@/lib/types';
import {
  Plus, Trash2, Building2, AlertTriangle, Clock, Search, X, Download,
  Pencil, Check, RotateCcw, UserCheck, Users,
} from 'lucide-react';

const POD_COLOR_MAP: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-800',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
  teal:   'bg-teal-100 text-teal-800',
  pink:   'bg-pink-100 text-pink-800',
  green:  'bg-green-100 text-green-800',
};

interface PodOption { id: string; name: string; color: string; }

function getDeadlineInfo(deadline?: string, isDone?: boolean) {
  if (!deadline) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(deadline); due.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (isDone) return { label: due.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }), color: 'text-gray-400', overdue: false };
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, color: 'text-red-600', overdue: true };
  if (diffDays === 0) return { label: 'Due today', color: 'text-orange-600', overdue: false };
  if (diffDays === 1) return { label: 'Due tomorrow', color: 'text-orange-500', overdue: false };
  if (diffDays <= 3) return { label: `${diffDays}d left`, color: 'text-yellow-600', overdue: false };
  return { label: `${diffDays}d left`, color: 'text-gray-500', overdue: false };
}

export default function ScriptsPage() {
  const [scripts, setScripts]           = useState<Script[]>([]);
  const [clients, setClients]           = useState<Client[]>([]);
  const [editorStatuses, setEditorStatuses] = useState<Record<string, { editor_name: string; status: string; completed_at?: string; deadline?: string; is_revision?: boolean }>>({});
  const [pods, setPods]                 = useState<PodOption[]>([]);
  const [editors, setEditors]           = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading]       = useState(true);

  // Form
  const [showForm, setShowForm]         = useState(false);
  const [formData, setFormData]         = useState({ batchNo: '', scriptNo: '', pod: '', description: '', client: '' });
  const [newClientName, setNewClientName] = useState('');
  const [addingClient, setAddingClient] = useState(false);
  const [saving, setSaving]             = useState(false);

  // Filters
  const [filterPod, setFilterPod]       = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterClient, setFilterClient] = useState('All');
  const [search, setSearch]             = useState('');

  // Inline edit
  const [editingId, setEditingId]       = useState<string | null>(null);
  const [editData, setEditData]         = useState({ title: '', pod: '', client: '', description: '', editorName: '' });
  const [editSaving, setEditSaving]     = useState(false);

  // Revision
  const [revisionScript, setRevisionScript]   = useState<Script | null>(null);
  const [revisionEditor, setRevisionEditor]   = useState('');
  const [revisionDeadline, setRevisionDeadline] = useState('');
  const [revisionSaving, setRevisionSaving]   = useState(false);

  // ── NEW: post-create assign banner ──────────────────────────────────────
  const [justCreatedScript, setJustCreatedScript] = useState<Script | null>(null);

  // ── NEW: assign modal (used for both post-create & bulk) ─────────────────
  const [assignModal, setAssignModal]   = useState<{ scripts: Script[]; mode: 'single' | 'bulk' } | null>(null);
  const [assignEditor, setAssignEditor] = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assigning, setAssigning]       = useState(false);

  // ── NEW: bulk selection ──────────────────────────────────────────────────
  const [selectedIds, setSelectedIds]   = useState<Set<string>>(new Set());

  useEffect(() => { loadScripts(); }, []);

  async function loadScripts() {
    setIsLoading(true);
    const [scriptsRes, assignmentsRes, clientsRes, editorsRes, podsRes] = await Promise.all([
      supabase.from('scripts').select('*').order('created_at', { ascending: false }),
      supabase.from('editor_assignments').select('*'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('editors').select('id, name').eq('status', 'active').order('name'),
      supabase.from('pods').select('*').order('created_at'),
    ]);
    const statusMap: Record<string, { editor_name: string; status: string; completed_at?: string; deadline?: string; is_revision?: boolean }> = {};
    (assignmentsRes.data || []).forEach((a: any) => {
      const existing = statusMap[a.script_id];
      const priority: Record<string, number> = { in_progress: 3, assigned: 2, done: 1 };
      if (!existing || (priority[a.status] || 0) > (priority[existing.status] || 0)) {
        statusMap[a.script_id] = { editor_name: a.editor_name, status: a.status, completed_at: a.completed_at, deadline: a.deadline, is_revision: a.is_revision };
      }
    });
    setScripts(scriptsRes.data || []);
    setEditorStatuses(statusMap);
    setClients(clientsRes.data || []);
    setEditors(editorsRes.data || []);
    setPods(podsRes.data || []);
    setIsLoading(false);
  }

  async function handleAddClient() {
    const name = newClientName.trim();
    if (!name) return;
    setAddingClient(true);
    try {
      const { data, error } = await supabase.from('clients').insert({ name }).select().single();
      if (error) { if (error.code === '23505') alert(`Client "${name}" already exists.`); else throw error; return; }
      setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setFormData(f => ({ ...f, client: name }));
      setNewClientName('');
    } catch (err: any) { alert('Error: ' + err.message); } finally { setAddingClient(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.batchNo.trim() || !formData.scriptNo.trim() || !formData.pod) return;
    const parts = [formData.client, formData.batchNo.trim() ? `Batch${formData.batchNo.trim()}` : '', formData.scriptNo.trim() ? `Script${formData.scriptNo.trim()}` : ''].filter(Boolean);
    const generatedTitle = parts.join('_');
    const duplicate = scripts.find(s => s.title.trim().toLowerCase() === generatedTitle.toLowerCase() && s.pod === formData.pod);
    if (duplicate) { alert(`"${generatedTitle}" already exists in ${formData.pod}.`); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.from('scripts')
        .insert({ title: generatedTitle, pod: formData.pod, description: formData.description || null, client: formData.client || null, status: 'pending' })
        .select().single();
      if (error) { if (error.code === '23505') alert(`"${generatedTitle}" already exists.`); else throw error; return; }
      setScripts([data, ...scripts]);
      setFormData({ batchNo: '', scriptNo: '', pod: '', description: '', client: '' });
      setNewClientName('');
      setShowForm(false);
      setJustCreatedScript(data);   // ← show assign banner
    } catch (err: any) { alert('Failed to create: ' + err.message); } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this script? Its assignment history will also be removed.')) return;
    const { data: { session } } = await supabase.auth.getSession();
    const res = await fetch(`/api/scripts/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token ?? ''}` } });
    const json = await res.json();
    if (!res.ok) { alert('Failed to delete: ' + json.error); return; }
    setScripts(scripts.filter(s => s.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
  }

  function startEdit(script: Script) {
    setEditingId(script.id);
    setEditData({
      title: script.title,
      pod: script.pod || '',
      client: script.client || '',
      description: (script as any).description || '',
      editorName: editorStatuses[script.id]?.editor_name || '',  // ← prefill current editor
    });
  }

  async function handleUpdate(id: string) {
    if (!editData.title.trim() || !editData.pod) return;
    setEditSaving(true);
    try {
      const { data, error } = await supabase.from('scripts')
        .update({ title: editData.title.trim(), pod: editData.pod, client: editData.client || null, description: editData.description.trim() || null })
        .eq('id', id).select().single();
      if (error) throw error;

      // If editor was changed, insert a new assignment
      const currentEditorName = editorStatuses[id]?.editor_name || '';
      let needsReload = false;
      if (editData.editorName && editData.editorName !== currentEditorName) {
        const { error: aErr } = await supabase.from('editor_assignments').insert({
          script_id: id,
          editor_name: editData.editorName,
          status: 'assigned',
        });
        if (aErr) throw aErr;
        needsReload = true;
      }

      setScripts(scripts.map(s => s.id === id ? { ...s, ...data } : s));
      setEditingId(null);
      if (needsReload) await loadScripts();
    } catch (err: any) { alert('Failed to save: ' + err.message); } finally { setEditSaving(false); }
  }

  // ── Assign modal handler (single + bulk) ─────────────────────────────────
  async function handleAssign() {
    if (!assignModal || !assignEditor) return;
    setAssigning(true);
    try {
      const inserts = assignModal.scripts.map(s => ({
        script_id: s.id,
        editor_name: assignEditor,
        status: 'assigned',
        deadline: assignDeadline || null,
      }));
      const { error } = await supabase.from('editor_assignments').insert(inserts);
      if (error) throw error;
      setAssignModal(null);
      setAssignEditor('');
      setAssignDeadline('');
      setSelectedIds(new Set());
      setJustCreatedScript(null);
      await loadScripts();
    } catch (err: any) { alert('Failed: ' + err.message); } finally { setAssigning(false); }
  }

  function getRealStatus(scriptId: string) {
    const a = editorStatuses[scriptId];
    if (!a) return 'pending';
    if (a.status === 'done') return 'done';
    if (a.is_revision) return 'revision';
    if (a.status === 'in_progress') return 'editing';
    if (a.status === 'assigned') return 'with_editor';
    return 'pending';
  }

  async function sendForRevision() {
    if (!revisionScript || !revisionEditor) return;
    setRevisionSaving(true);
    try {
      const { error } = await supabase.from('editor_assignments').insert({ script_id: revisionScript.id, editor_name: revisionEditor, status: 'assigned', is_revision: true, deadline: revisionDeadline || null });
      if (error) throw error;
      setRevisionScript(null); setRevisionEditor(''); setRevisionDeadline('');
      await loadScripts();
    } catch (err: any) { alert('Failed: ' + err.message); } finally { setRevisionSaving(false); }
  }

  // ── Bulk selection helpers ────────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(s => s.id)));
    }
  }

  const overdueCount = scripts.filter(s => {
    const status = getRealStatus(s.id);
    if (status === 'done') return false;
    const deadline = editorStatuses[s.id]?.deadline;
    return !!getDeadlineInfo(deadline, false)?.overdue;
  }).length;

  const filtered = scripts
    .filter(s => !search || s.title.toLowerCase().includes(search.toLowerCase()))
    .filter(s => filterPod === 'All' || s.pod === filterPod)
    .filter(s => {
      if (filterStatus === 'All') return true;
      if (filterStatus === 'overdue') {
        const status = getRealStatus(s.id);
        if (status === 'done') return false;
        const deadline = editorStatuses[s.id]?.deadline;
        return !!getDeadlineInfo(deadline, false)?.overdue;
      }
      return getRealStatus(s.id) === filterStatus;
    })
    .filter(s => filterClient === 'All' || s.client === filterClient);

  const activeClients = [...new Set(scripts.map(s => s.client).filter(Boolean))] as string[];

  function exportCSV() {
    const rows = [
      ['Title', 'Client', 'Pod', 'Description', 'Status', 'Editor', 'Deadline', 'Completed On', 'Created On'],
      ...filtered.map(s => {
        const realStatus = getRealStatus(s.id);
        const a = editorStatuses[s.id];
        const statusLabel = realStatus === 'done' ? 'Done' : realStatus === 'editing' ? 'Editing' : realStatus === 'with_editor' ? 'With Editor' : 'Pending';
        return [s.title, s.client || '', s.pod || '', (s as any).description || '', statusLabel, a?.editor_name || '', a?.deadline || '', a?.completed_at ? new Date(a.completed_at).toLocaleDateString('en-IN') : '', new Date(s.created_at).toLocaleDateString('en-IN')];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `scripts_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 pb-24">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scripts</h1>
          <div className="flex items-center gap-3 mt-0.5">
            <p className="text-gray-500 text-sm">{scripts.length} total · {clients.length} clients</p>
            {overdueCount > 0 && (
              <button onClick={() => setFilterStatus('overdue')} className="flex items-center gap-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full hover:bg-red-100 transition">
                <AlertTriangle className="w-3 h-3" />{overdueCount} overdue
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} disabled={filtered.length === 0} className="flex items-center gap-1.5 border border-gray-300 text-gray-600 text-sm font-medium py-2 px-3 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition">
            <Download className="w-4 h-4" />Export CSV
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search scripts..." className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white w-56 focus:ring-2 focus:ring-blue-500 focus:w-72 transition-all" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X className="w-3.5 h-3.5" /></button>}
          </div>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition">
            <Plus className="w-4 h-4" />New Script
          </button>
        </div>
      </div>

      {/* ── Create Form ─────────────────────────────────────────────────── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">New Script</h2>
          <form onSubmit={handleCreate}>
            <div className="flex items-end gap-3 mb-2">
              <div className="w-36">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Batch No. *</label>
                <input type="text" required autoFocus value={formData.batchNo} onChange={e => setFormData({ ...formData, batchNo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500" placeholder="e.g. B19" />
              </div>
              <div className="w-36">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Script No. *</label>
                <input type="text" required value={formData.scriptNo} onChange={e => setFormData({ ...formData, scriptNo: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500" placeholder="e.g. S16" />
              </div>
              <div className="w-40">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pod *</label>
                <select required value={formData.pod} onChange={e => setFormData({ ...formData, pod: e.target.value })} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500">
                  <option value="">Select pod...</option>
                  {pods.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
            </div>
            {(formData.batchNo || formData.scriptNo) && (
              <p className="text-xs text-gray-400 mb-3">Will be saved as: <span className="font-semibold text-gray-600">{[formData.client, formData.batchNo ? `Batch${formData.batchNo}` : '', formData.scriptNo ? `Script${formData.scriptNo}` : ''].filter(Boolean).join('_') || '—'}</span></p>
            )}
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Description <span className="font-normal text-gray-400">(optional)</span></label>
              <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 resize-none" placeholder="Brief notes about this script..." />
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Client</label>
              <div className="flex gap-2">
                <select value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })} className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500">
                  <option value="">No client</option>
                  {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                <input type="text" value={newClientName} onChange={e => setNewClientName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddClient(); } }} className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500" placeholder="New client..." />
                <button type="button" onClick={handleAddClient} disabled={addingClient || !newClientName.trim()} className="flex items-center gap-1 bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-gray-700 text-xs font-semibold py-2 px-3 rounded-lg transition whitespace-nowrap">
                  <Building2 className="w-3.5 h-3.5" />{addingClient ? '...' : '+ Add'}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1.5">After creating, you can assign to an editor right here on this page</p>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium py-2 px-5 rounded-lg transition">
                {saving ? 'Creating...' : 'Create Script'}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setNewClientName(''); }} className="text-gray-500 hover:text-gray-700 text-sm py-2 px-3 rounded-lg hover:bg-gray-100 transition">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* ── Post-create assign banner ────────────────────────────────────── */}
      {justCreatedScript && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5 mb-4 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <Check className="w-4 h-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-blue-900 truncate">{justCreatedScript.title}</p>
            <p className="text-xs text-blue-500">Script created — assign it to an editor now</p>
          </div>
          <button
            onClick={() => { setAssignModal({ scripts: [justCreatedScript], mode: 'single' }); setAssignEditor(''); setAssignDeadline(''); }}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition whitespace-nowrap"
          >
            <UserCheck className="w-3.5 h-3.5" />Assign to Editor
          </button>
          <button onClick={() => setJustCreatedScript(null)} className="text-blue-400 hover:text-blue-600 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="space-y-2 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium w-10">Pod</span>
          <button onClick={() => setFilterPod('All')} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterPod === 'All' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
          {pods.map(pod => (
            <button key={pod.id} onClick={() => setFilterPod(pod.name)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterPod === pod.name ? `text-white ${pod.color === 'blue' ? 'bg-blue-600' : pod.color === 'purple' ? 'bg-purple-600' : pod.color === 'orange' ? 'bg-orange-500' : pod.color === 'teal' ? 'bg-teal-600' : pod.color === 'pink' ? 'bg-pink-500' : 'bg-green-600'}` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {pod.name} ({scripts.filter(s => s.pod === pod.name).length})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium w-10">Status</span>
          {[{ val: 'All', label: 'All' }, { val: 'pending', label: 'Pending' }, { val: 'with_editor', label: 'With Editor' }, { val: 'revision', label: '↩ Revision' }, { val: 'editing', label: 'Editing' }, { val: 'done', label: 'Done' }, { val: 'overdue', label: '🚨 Overdue', red: true }].map(s => (
            <button key={s.val} onClick={() => setFilterStatus(s.val)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterStatus === s.val ? (s.red ? 'bg-red-600 text-white' : 'bg-gray-900 text-white') : (s.red ? 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}`}>
              {s.label} {s.val === 'overdue' && overdueCount > 0 ? `(${overdueCount})` : ''}
            </button>
          ))}
        </div>
        {activeClients.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-medium w-10">Client</span>
            <button onClick={() => setFilterClient('All')} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterClient === 'All' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
            {activeClients.map(c => (
              <button key={c} onClick={() => setFilterClient(c)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterClient === c ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {c} ({scripts.filter(s => s.client === c).length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Scripts Table ────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <p className="text-gray-400 font-medium">No scripts found</p>
          {filterStatus === 'overdue' && <p className="text-green-500 text-sm mt-2 font-medium">✓ No overdue scripts!</p>}
          <button onClick={() => { setFilterPod('All'); setFilterStatus('All'); setFilterClient('All'); }} className="mt-3 text-blue-600 text-sm font-medium hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {/* Checkbox — select all */}
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pod</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Deadline</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Editor</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-3 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(script => {
                const realStatus = getRealStatus(script.id);
                const assignment = editorStatuses[script.id];
                const dlInfo = getDeadlineInfo(assignment?.deadline, realStatus === 'done');
                const isEditing = editingId === script.id;
                const isSelected = selectedIds.has(script.id);

                if (isEditing) {
                  return (
                    <tr key={script.id} className="bg-blue-50/60">
                      <td className="px-3 py-2"></td>
                      {/* Title + description */}
                      <td className="px-3 py-2">
                        <input
                          autoFocus
                          value={editData.title}
                          onChange={e => setEditData({ ...editData, title: e.target.value })}
                          onKeyDown={e => { if (e.key === 'Enter') handleUpdate(script.id); if (e.key === 'Escape') setEditingId(null); }}
                          className="w-full px-2.5 py-1.5 border border-blue-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                        />
                        <input
                          value={editData.description}
                          onChange={e => setEditData({ ...editData, description: e.target.value })}
                          placeholder="Description (optional)"
                          className="w-full mt-1 px-2.5 py-1 border border-blue-200 rounded-lg text-xs text-gray-600 bg-white focus:ring-2 focus:ring-blue-400 placeholder-gray-300"
                        />
                      </td>
                      {/* Client */}
                      <td className="px-3 py-2">
                        <select value={editData.client} onChange={e => setEditData({ ...editData, client: e.target.value })} className="w-full px-2.5 py-1.5 border border-blue-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500">
                          <option value="">No client</option>
                          {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </td>
                      {/* Pod */}
                      <td className="px-3 py-2">
                        <select value={editData.pod} onChange={e => setEditData({ ...editData, pod: e.target.value })} className="w-full px-2.5 py-1.5 border border-blue-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500">
                          <option value="">No pod</option>
                          {pods.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                        </select>
                      </td>
                      {/* Deadline + Status — hint */}
                      <td colSpan={2} className="px-3 py-2 text-xs text-gray-400">
                        Enter to save · Esc to cancel
                      </td>
                      {/* Editor — new select */}
                      <td className="px-3 py-2">
                        <select
                          value={editData.editorName}
                          onChange={e => setEditData({ ...editData, editorName: e.target.value })}
                          className="w-full px-2.5 py-1.5 border border-blue-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Unassigned</option>
                          {editors.map(ed => <option key={ed.id} value={ed.name}>{ed.name}</option>)}
                        </select>
                      </td>
                      {/* Created — empty */}
                      <td className="px-3 py-2"></td>
                      {/* Save / cancel */}
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => handleUpdate(script.id)} disabled={editSaving || !editData.title.trim() || !editData.pod} className="p-1.5 rounded bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white transition">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={script.id} className={`hover:bg-gray-50 transition ${isSelected ? 'bg-blue-50/50' : dlInfo?.overdue ? 'bg-red-50/40' : ''}`}>
                    {/* Checkbox */}
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(script.id)}
                        className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
                      />
                    </td>
                    {/* Title */}
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        {dlInfo?.overdue && <AlertTriangle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />}
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{script.title}</p>
                          {(script as any).description && <p className="text-xs text-gray-400 mt-0.5 max-w-[200px] truncate">{(script as any).description}</p>}
                        </div>
                      </div>
                    </td>
                    {/* Client */}
                    <td className="px-3 py-3">
                      {script.client ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                          <Building2 className="w-3 h-3" />{script.client}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    {/* Pod */}
                    <td className="px-3 py-3">
                      {script.pod ? (
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${POD_COLOR_MAP[pods.find(p => p.name === script.pod)?.color || 'blue'] || 'bg-gray-100 text-gray-700'}`}>
                          {script.pod}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    {/* Deadline */}
                    <td className="px-3 py-3">
                      {dlInfo ? (
                        <div className={`flex items-center gap-1 ${dlInfo.color}`}>
                          {dlInfo.overdue ? <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> : <Clock className="w-3.5 h-3.5 flex-shrink-0" />}
                          <span className="text-xs font-semibold">{dlInfo.label}</span>
                        </div>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                        realStatus === 'done' ? 'bg-green-100 text-green-700' :
                        realStatus === 'revision' ? 'bg-amber-100 text-amber-700' :
                        realStatus === 'editing' ? 'bg-yellow-100 text-yellow-700' :
                        realStatus === 'with_editor' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {realStatus === 'done' ? '✓ Done' : realStatus === 'revision' ? '↩ Revision' : realStatus === 'editing' ? 'Editing' : realStatus === 'with_editor' ? 'With Editor' : 'Pending'}
                      </span>
                    </td>
                    {/* Editor column */}
                    <td className="px-3 py-3">
                      {assignment ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-indigo-700 font-bold text-xs">{assignment.editor_name.charAt(0).toUpperCase()}</span>
                          </div>
                          <span className="text-xs font-medium text-gray-700 truncate max-w-[80px]">{assignment.editor_name}</span>
                          {realStatus === 'done' && assignment.completed_at && (
                            <span className="text-xs text-gray-400 hidden xl:inline">· {new Date(assignment.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => { setAssignModal({ scripts: [script], mode: 'single' }); setAssignEditor(''); setAssignDeadline(''); }}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 px-2.5 py-1 rounded-full transition whitespace-nowrap"
                        >
                          <UserCheck className="w-3 h-3" />Assign
                        </button>
                      )}
                    </td>
                    {/* Created */}
                    <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(script.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-3 text-right">
                      <div className="flex items-center justify-end gap-0.5">
                        {realStatus === 'done' && (
                          <button onClick={() => { setRevisionScript(script); setRevisionEditor(assignment?.editor_name || ''); setRevisionDeadline(''); }} title="Send for Revision" className="text-amber-400 hover:text-amber-600 p-1.5 rounded hover:bg-amber-50 transition">
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => startEdit(script)} className="text-gray-400 hover:text-blue-500 p-1.5 rounded hover:bg-blue-50 transition">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(script.id)} className="text-gray-400 hover:text-red-500 p-1.5 rounded hover:bg-red-50 transition">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Bulk action floating bar ─────────────────────────────────────── */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
          <span className="text-sm font-medium">{selectedIds.size} script{selectedIds.size > 1 ? 's' : ''} selected</span>
          <button
            onClick={() => { setAssignModal({ scripts: scripts.filter(s => selectedIds.has(s.id)), mode: 'bulk' }); setAssignEditor(''); setAssignDeadline(''); }}
            className="flex items-center gap-1.5 bg-blue-500 hover:bg-blue-400 text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition"
          >
            <Users className="w-4 h-4" />Assign to Editor
          </button>
          <button onClick={() => setSelectedIds(new Set())} className="text-gray-400 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Assign Modal (single or bulk) ────────────────────────────────── */}
      {assignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Assign to Editor</h2>
                {assignModal.mode === 'bulk' ? (
                  <p className="text-sm text-gray-400 mt-0.5">{assignModal.scripts.length} scripts selected</p>
                ) : (
                  <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs">{assignModal.scripts[0]?.title}</p>
                )}
              </div>
              <button onClick={() => setAssignModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {assignModal.mode === 'bulk' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex flex-wrap gap-1">
                  {assignModal.scripts.map(s => (
                    <span key={s.id} className="text-xs bg-white border border-blue-200 text-blue-700 font-medium px-2 py-0.5 rounded-full">{s.title}</span>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Select Editor</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {editors.map(ed => (
                    <button
                      key={ed.id}
                      type="button"
                      onClick={() => setAssignEditor(ed.name)}
                      className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition text-left ${assignEditor === ed.name ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center justify-center flex-shrink-0">
                        {ed.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate">{ed.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  Deadline <span className="text-gray-400 font-normal text-xs">(optional)</span>
                </label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={assignDeadline}
                  onChange={e => setAssignDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAssignModal(null)} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button
                  onClick={handleAssign}
                  disabled={assigning || !assignEditor}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-2"
                >
                  <UserCheck className="w-4 h-4" />
                  {assigning ? 'Assigning...' : assignModal.mode === 'bulk' ? `Assign ${assignModal.scripts.length} Scripts` : 'Assign Script'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Revision Modal ───────────────────────────────────────────────── */}
      {revisionScript && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Send for Revision</h2>
                <p className="text-sm text-gray-400 mt-0.5 truncate max-w-xs">{revisionScript.title}</p>
              </div>
              <button onClick={() => setRevisionScript(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                ↩ This video needs changes. Assign it back to an editor — history of the original submission is preserved.
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Assign to Editor</label>
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
                  {editors.map(e => (
                    <button key={e.id} type="button" onClick={() => setRevisionEditor(e.name)} className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 text-sm font-medium transition text-left ${revisionEditor === e.name ? 'border-amber-500 bg-amber-50 text-amber-700' : 'border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50'}`}>
                      <div className="w-7 h-7 rounded-full bg-amber-100 text-amber-700 font-bold text-xs flex items-center justify-center flex-shrink-0">{e.name.charAt(0).toUpperCase()}</div>
                      <span className="truncate">{e.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">New Deadline <span className="text-gray-400 font-normal ml-1 text-xs">(optional)</span></label>
                <input type="date" min={new Date().toISOString().split('T')[0]} value={revisionDeadline} onChange={e => setRevisionDeadline(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-amber-500" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setRevisionScript(null)} className="flex-1 border border-gray-300 text-gray-700 font-medium py-2.5 px-4 rounded-lg hover:bg-gray-50 transition">Cancel</button>
                <button onClick={sendForRevision} disabled={revisionSaving || !revisionEditor} className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 text-white font-medium py-2.5 px-4 rounded-lg transition flex items-center justify-center gap-2">
                  <RotateCcw className="w-4 h-4" />{revisionSaving ? 'Sending...' : 'Send for Revision'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
