'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Check, RefreshCw, PenLine, X, ArrowRight, Video, UserCheck, AlertTriangle, Clock, ChevronDown, ChevronUp } from 'lucide-react';

interface Script {
  id: string;
  title: string;
  pod?: string | null;
  client?: string | null;
  writing_status?: string | null;
  script_content?: Record<string, string> | null;
  created_at: string;
  assignment?: Assignment | null;
}

interface Assignment {
  id: string;
  editor_name: string;
  status: 'assigned' | 'in_progress' | 'done';
  deadline?: string | null;
  completed_at?: string | null;
}

interface Editor { id: string; name: string; unavailable?: boolean; activeCount?: number; }
interface Client { id: string; name: string; }
interface Pod    { id: string; name: string; color: string; }

const SCRIPT_FIELDS = [
  { key: 'communication',   label: 'Main Communication',  placeholder: 'Core message of the script…',         span: 2 },
  { key: 'targetPersonas',  label: 'Target Personas',     placeholder: 'Who is this for?',                    span: 1 },
  { key: 'painPoint',       label: 'Pain Point',          placeholder: 'What problem does it address?',       span: 1 },
  { key: 'format',          label: 'Format',              placeholder: 'e.g. Object talking, Podcast…',       span: 1 },
  { key: 'actor',           label: 'Actor',               placeholder: 'Who will appear in the video?',       span: 1 },
  { key: 'referenceVideo',  label: 'Reference Video',     placeholder: 'YouTube link or description…',        span: 2 },
  { key: 'hook1',           label: 'Hook 1',              placeholder: 'First hook option…',                  span: 2 },
  { key: 'hook2',           label: 'Hook 2',              placeholder: 'Second hook option…',                 span: 2 },
  { key: 'hook3',           label: 'Hook 3',              placeholder: 'Third hook option…',                  span: 2 },
  { key: 'story',           label: 'Story / Body',        placeholder: 'Main script body…',                   span: 2 },
  { key: 'bridge',          label: 'Bridge',              placeholder: 'Transition / bridge content…',        span: 2 },
  { key: 'cta',             label: 'CTA',                 placeholder: 'Call to action…',                     span: 2 },
];

const POD_COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700', purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700', teal: 'bg-teal-100 text-teal-700',
  pink: 'bg-pink-100 text-pink-700', green: 'bg-green-100 text-green-700',
};

function daysLabel(deadline: string): { label: string; overdue: boolean } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(deadline); due.setHours(0, 0, 0, 0);
  const diff = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return { label: `${Math.abs(diff)}d late`, overdue: true };
  if (diff === 0) return { label: 'Due today', overdue: false };
  if (diff === 1) return { label: 'Due tomorrow', overdue: false };
  return { label: `${diff}d left`, overdue: false };
}

function getDisplayStatus(script: Script): string {
  const ws = script.writing_status;
  if (ws === 'writing')    return 'writing';
  if (ws === 'written')    return 'written';
  if (ws === 'production') return 'production';
  if (ws === 'editing') {
    if (script.assignment?.status === 'done') return 'done';
    return 'with_editor';
  }
  return 'pending';
}

export default function WritingPage() {
  const [scripts, setScripts]     = useState<Script[]>([]);
  const [editors, setEditors]     = useState<Editor[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
  const [pods, setPods]           = useState<Pod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterPod, setFilterPod]       = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Create form
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [formData, setFormData] = useState({ batchNo: '', scriptNos: [''], pod: '', client: '' });
  const [newClient, setNewClient] = useState('');

  // "Mark Written" modal with script details
  const [writtenModal, setWrittenModal]   = useState<Script | null>(null);
  const [scriptFields, setScriptFields]   = useState<Record<string, string>>({});
  const [writtenSaving, setWrittenSaving] = useState(false);

  // Assign to Editor modal
  const [assignScript, setAssignScript]   = useState<Script | null>(null);
  const [assignEditor, setAssignEditor]   = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assignSaving, setAssignSaving]   = useState(false);

  // Expanded content rows
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setIsLoading(true);
    const [scriptsRes, assignmentsRes, editorsRes, clientsRes, podsRes] = await Promise.all([
      supabase.from('scripts')
        .select('id, title, pod, client, writing_status, script_content, created_at')
        .not('writing_status', 'is', null)
        .order('created_at', { ascending: false }),
      supabase.from('editor_assignments')
        .select('id, script_id, editor_name, status, deadline, completed_at')
        .order('created_at', { ascending: false }),
      supabase.from('editors').select('id, name, unavailable').order('name'),
      supabase.from('clients').select('*').order('name'),
      supabase.from('pods').select('*').order('created_at'),
    ]);

    const assignmentMap: Record<string, Assignment> = {};
    const workload: Record<string, number> = {};
    for (const a of (assignmentsRes.data || [])) {
      if (!assignmentMap[a.script_id]) {
        assignmentMap[a.script_id] = { id: a.id, editor_name: a.editor_name, status: a.status, deadline: a.deadline, completed_at: a.completed_at };
      }
      if (a.status !== 'done') workload[a.editor_name] = (workload[a.editor_name] || 0) + 1;
    }

    setScripts((scriptsRes.data || []).map(s => ({ ...s, assignment: assignmentMap[s.id] || null })));
    setEditors((editorsRes.data || []).map((e: any) => ({ ...e, activeCount: workload[e.name] || 0 })));
    setClients(clientsRes.data || []);
    setPods(podsRes.data || []);
    setIsLoading(false);
  }

  async function addClient() {
    const name = newClient.trim();
    if (!name) return;
    const { data } = await supabase.from('clients').insert({ name }).select().single();
    if (data) { setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name))); setFormData(f => ({ ...f, client: data.name })); }
    setNewClient('');
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const validNos = formData.scriptNos.map(n => n.trim()).filter(Boolean);
    if (!formData.batchNo.trim() || validNos.length === 0 || !formData.pod) return;
    setSaving(true);
    const rows = validNos.map(no => ({
      title: [formData.client, `Batch${formData.batchNo.trim()}`, `Script${no}`].filter(Boolean).join('_'),
      pod: formData.pod, client: formData.client || null,
      status: 'pending' as const, writing_status: 'writing',
    }));
    await supabase.from('scripts').insert(rows);
    setFormData({ batchNo: '', scriptNos: [''], pod: '', client: '' });
    setShowForm(false); setSaving(false);
    await loadData();
  }

  function openWrittenModal(script: Script) {
    setWrittenModal(script);
    // Pre-fill if content already exists
    const existing = script.script_content || {};
    const prefilled: Record<string, string> = {};
    SCRIPT_FIELDS.forEach(f => { prefilled[f.key] = existing[f.key] || ''; });
    setScriptFields(prefilled);
  }

  async function saveWritten(skip = false) {
    if (!writtenModal) return;
    setWrittenSaving(true);
    const content: Record<string, string> = {};
    if (!skip) {
      SCRIPT_FIELDS.forEach(f => { if (scriptFields[f.key]?.trim()) content[f.key] = scriptFields[f.key].trim(); });
    }
    await supabase.from('scripts').update({
      writing_status: 'written',
      ...(Object.keys(content).length > 0 ? { script_content: content } : {}),
    }).eq('id', writtenModal.id);
    setWrittenModal(null);
    setScriptFields({});
    setWrittenSaving(false);
    await loadData();
  }

  async function advance(script: Script, toStatus: string) {
    setActionId(script.id);
    await supabase.from('scripts').update({ writing_status: toStatus }).eq('id', script.id);
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, writing_status: toStatus } : s));
    setActionId(null);
  }

  async function handleAssign() {
    if (!assignScript || !assignEditor) return;
    setAssignSaving(true);
    await Promise.all([
      supabase.from('editor_assignments').insert({ script_id: assignScript.id, editor_name: assignEditor, status: 'assigned', deadline: assignDeadline || null }),
      supabase.from('scripts').update({ writing_status: 'editing' }).eq('id', assignScript.id),
    ]);
    setAssignScript(null); setAssignEditor(''); setAssignDeadline('');
    setAssignSaving(false);
    await loadData();
  }

  const counts = {
    writing:     scripts.filter(s => getDisplayStatus(s) === 'writing').length,
    written:     scripts.filter(s => getDisplayStatus(s) === 'written').length,
    production:  scripts.filter(s => getDisplayStatus(s) === 'production').length,
    with_editor: scripts.filter(s => getDisplayStatus(s) === 'with_editor').length,
    done:        scripts.filter(s => getDisplayStatus(s) === 'done').length,
  };

  const filtered = scripts
    .filter(s => filterPod === 'All' || s.pod === filterPod)
    .filter(s => filterStatus === 'All' || getDisplayStatus(s) === filterStatus);

  const stageBadge: Record<string, string> = {
    writing: 'bg-amber-100 text-amber-700', written: 'bg-blue-100 text-blue-700',
    production: 'bg-purple-100 text-purple-700', with_editor: 'bg-indigo-100 text-indigo-700',
    done: 'bg-green-100 text-green-700',
  };
  const stageLabel: Record<string, string> = {
    writing: '✍️ Writing', written: '✓ Written', production: '🎬 Production',
    with_editor: '👤 With Editor', done: '✅ Done',
  };

  return (
    <div className="p-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Writing</h1>
          <p className="text-gray-400 text-sm mt-0.5">Full pipeline — from ticket creation to editor assignment</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition">
            <Plus className="w-4 h-4" />New Tickets
          </button>
        </div>
      </div>

      {/* Pipeline bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-4 mb-6">
        <div className="flex items-center gap-0 flex-wrap">
          {[
            { key: 'writing', label: 'Writing', count: counts.writing, dot: 'bg-amber-400' },
            { key: 'written', label: 'Written', count: counts.written, dot: 'bg-blue-400' },
            { key: 'production', label: 'Production', count: counts.production, dot: 'bg-purple-400' },
            { key: 'with_editor', label: 'With Editor', count: counts.with_editor, dot: 'bg-indigo-400' },
            { key: 'done', label: 'Done', count: counts.done, dot: 'bg-green-400' },
          ].map((stage, i) => (
            <div key={stage.key} className="flex items-center">
              <button onClick={() => setFilterStatus(stage.key === filterStatus ? 'All' : stage.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${filterStatus === stage.key ? 'bg-gray-100' : 'hover:bg-gray-50'}`}>
                <span className={`w-2.5 h-2.5 rounded-full ${stage.dot}`} />
                <span className="text-sm font-semibold text-gray-700">{stage.label}</span>
                <span className={`text-sm font-bold ${stage.count > 0 ? 'text-gray-900' : 'text-gray-300'}`}>{stage.count}</span>
              </button>
              {i < 4 && <ArrowRight className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />}
            </div>
          ))}
          <div className="ml-auto text-sm text-gray-400 font-medium">{scripts.length} total</div>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">Create Tickets</h2>
          <form onSubmit={handleCreate}>
            <div className="flex items-end gap-3 mb-4">
              <div className="w-36">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Batch No. *</label>
                <input type="text" required autoFocus value={formData.batchNo} onChange={e => setFormData({ ...formData, batchNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500" placeholder="e.g. B19" />
              </div>
              <div className="w-44">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pod *</label>
                <select required value={formData.pod} onChange={e => setFormData({ ...formData, pod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500">
                  <option value="">Select pod...</option>
                  {pods.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Client</label>
                <div className="flex gap-2">
                  <select value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500">
                    <option value="">No client</option>
                    {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <input type="text" value={newClient} onChange={e => setNewClient(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addClient(); } }}
                    placeholder="New client..." className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={addClient} disabled={!newClient.trim()} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition">+ Add</button>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Script Numbers * <span className="font-normal text-gray-400">— press Enter to add next</span></label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {formData.scriptNos.map((no, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right">{idx + 1}.</span>
                    <div className="flex-1 relative">
                      <input type="text" value={no} placeholder="e.g. S16"
                        autoFocus={idx === formData.scriptNos.length - 1 && idx > 0}
                        onChange={e => { const u = [...formData.scriptNos]; u[idx] = e.target.value; setFormData({ ...formData, scriptNos: u }); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); setFormData({ ...formData, scriptNos: [...formData.scriptNos, ''] }); }
                          if (e.key === 'Backspace' && !no && formData.scriptNos.length > 1) { setFormData({ ...formData, scriptNos: formData.scriptNos.filter((_, i) => i !== idx) }); }
                        }}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500" />
                      {formData.batchNo && no.trim() && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          → {[formData.client, `Batch${formData.batchNo}`, `Script${no.trim()}`].filter(Boolean).join('_')}
                        </span>
                      )}
                    </div>
                    {formData.scriptNos.length > 1 && (
                      <button type="button" onClick={() => setFormData({ ...formData, scriptNos: formData.scriptNos.filter((_, i) => i !== idx) })} className="text-gray-300 hover:text-red-400"><X className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setFormData({ ...formData, scriptNos: [...formData.scriptNos, ''] })} className="mt-1.5 text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" />Add another
              </button>
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving || !formData.batchNo.trim() || !formData.pod || !formData.scriptNos.filter(n => n.trim()).length}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium py-2 px-5 rounded-lg transition">
                {saving ? 'Creating…' : `Create ${formData.scriptNos.filter(n => n.trim()).length} Ticket${formData.scriptNos.filter(n => n.trim()).length !== 1 ? 's' : ''}`}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 text-sm font-medium py-2 px-4 rounded-lg hover:bg-gray-100 transition">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium w-10">Pod</span>
          <button onClick={() => setFilterPod('All')} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterPod === 'All' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
          {pods.map(p => (
            <button key={p.id} onClick={() => setFilterPod(p.name)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterPod === p.name ? `text-white ${p.color === 'blue' ? 'bg-blue-600' : p.color === 'purple' ? 'bg-purple-600' : p.color === 'orange' ? 'bg-orange-500' : p.color === 'teal' ? 'bg-teal-600' : p.color === 'pink' ? 'bg-pink-500' : 'bg-green-600'}` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.name} ({scripts.filter(s => s.pod === p.name).length})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium w-10">Stage</span>
          {[{ val: 'All', label: 'All' }, { val: 'writing', label: '✍️ Writing' }, { val: 'written', label: '✓ Written' }, { val: 'production', label: '🎬 Production' }, { val: 'with_editor', label: '👤 With Editor' }, { val: 'done', label: '✅ Done' }].map(s => (
            <button key={s.val} onClick={() => setFilterStatus(s.val)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterStatus === s.val ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <PenLine className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No tickets here</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-blue-600 text-sm font-medium hover:underline">Create new tickets →</button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Script</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pod</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Stage</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Editor / Deadline</th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider w-52">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(script => {
                const status = getDisplayStatus(script);
                const isActing = actionId === script.id;
                const podObj = pods.find(p => p.name === script.pod);
                const dl = script.assignment?.deadline ? daysLabel(script.assignment.deadline) : null;
                const isExpanded = expandedId === script.id;
                const hasContent = script.script_content && Object.keys(script.script_content).length > 0;

                return (
                  <React.Fragment key={script.id}>
                    <tr className={`transition ${status === 'done' ? 'bg-green-50/20' : status === 'with_editor' ? 'bg-indigo-50/20' : isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
                      {/* Script title + expand */}
                      <td className="px-4 py-3">
                        <div className="flex items-start gap-2">
                          {hasContent && (
                            <button onClick={() => setExpandedId(isExpanded ? null : script.id)} className="mt-0.5 text-gray-400 hover:text-gray-700 flex-shrink-0 transition">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                          <div>
                            <p className={`text-sm font-medium ${status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{script.title}</p>
                            {hasContent && (
                              <p className="text-xs text-gray-400 mt-0.5">
                                {SCRIPT_FIELDS.filter(f => script.script_content![f.key]).map(f => f.label).slice(0, 3).join(' · ')}
                                {SCRIPT_FIELDS.filter(f => script.script_content![f.key]).length > 3 && ' · …'}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Client */}
                      <td className="px-3 py-3">
                        {script.client ? <span className="text-xs font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">{script.client}</span> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      {/* Pod */}
                      <td className="px-3 py-3">
                        {script.pod ? <span className={`text-xs font-semibold px-2 py-1 rounded-full ${POD_COLOR_MAP[podObj?.color || 'blue'] || 'bg-gray-100 text-gray-700'}`}>{script.pod}</span> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      {/* Stage */}
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stageBadge[status] || 'bg-gray-100 text-gray-600'}`}>{stageLabel[status] || status}</span>
                      </td>
                      {/* Editor / deadline */}
                      <td className="px-3 py-3">
                        {script.assignment ? (
                          <div>
                            <p className="text-xs font-semibold text-gray-700">{script.assignment.editor_name}</p>
                            {dl && (
                              <p className={`text-xs mt-0.5 flex items-center gap-1 ${dl.overdue ? 'text-red-500' : 'text-gray-400'}`}>
                                {dl.overdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}{dl.label}
                              </p>
                            )}
                            {status === 'done' && script.assignment.completed_at && (
                              <p className="text-xs text-green-600 mt-0.5">Done {new Date(script.assignment.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                            )}
                          </div>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      {/* Actions */}
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-1.5">
                          {(status === 'written' || status === 'production') && (
                            <button onClick={() => advance(script, status === 'written' ? 'writing' : 'written')} disabled={isActing}
                              className="text-xs text-gray-400 hover:text-gray-600 font-medium px-2 py-1.5 rounded-lg hover:bg-gray-100 transition disabled:opacity-40">← Undo</button>
                          )}
                          {status === 'writing' && (
                            <button onClick={() => openWrittenModal(script)}
                              className="flex items-center gap-1 text-xs font-semibold text-white bg-blue-500 hover:bg-blue-600 px-3 py-1.5 rounded-lg transition">
                              <Check className="w-3.5 h-3.5" />Mark Written
                            </button>
                          )}
                          {status === 'written' && (
                            <button onClick={() => advance(script, 'production')} disabled={isActing}
                              className="flex items-center gap-1 text-xs font-semibold text-white bg-purple-500 hover:bg-purple-600 px-3 py-1.5 rounded-lg transition disabled:opacity-40">
                              {isActing ? '…' : <><Video className="w-3.5 h-3.5" />Send to Production</>}
                            </button>
                          )}
                          {status === 'production' && (
                            <button onClick={() => { setAssignScript(script); setAssignEditor(''); setAssignDeadline(''); }}
                              className="flex items-center gap-1 text-xs font-semibold text-white bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 rounded-lg transition">
                              <UserCheck className="w-3.5 h-3.5" />Assign to Editor
                            </button>
                          )}
                          {/* Edit script details if already written */}
                          {(status === 'written' || status === 'production' || status === 'with_editor') && (
                            <button onClick={() => openWrittenModal(script)} title="Edit script details"
                              className="text-xs text-gray-400 hover:text-blue-600 font-medium px-2 py-1.5 rounded-lg hover:bg-blue-50 transition">✏️</button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded script content */}
                    {isExpanded && hasContent && (
                      <tr className="bg-blue-50/30 border-b border-blue-100">
                        <td colSpan={6} className="px-6 py-5">
                          <div className="grid grid-cols-2 gap-x-10 gap-y-4">
                            {SCRIPT_FIELDS.filter(f => script.script_content![f.key]).map(f => (
                              <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{f.label}</p>
                                <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{script.script_content![f.key]}</p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Mark Written Modal ─────────────────────────────────────────────── */}
      {writtenModal && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-lg">Mark Written — Add Script Details</h3>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{writtenModal.title}</p>
              </div>
              <button onClick={() => setWrittenModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-gray-500 mb-5">Fill in what you know — all fields are optional. This will show under the script so the team knows what to produce.</p>
              <div className="grid grid-cols-2 gap-4">
                {SCRIPT_FIELDS.map(f => (
                  <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">{f.label}</label>
                    <textarea
                      value={scriptFields[f.key] || ''}
                      onChange={e => setScriptFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      rows={f.span === 2 ? 3 : 2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder-gray-300"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => saveWritten(false)} disabled={writtenSaving}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition">
                {writtenSaving ? 'Saving…' : '✓ Save & Mark Written'}
              </button>
              <button onClick={() => saveWritten(true)} disabled={writtenSaving}
                className="border border-gray-200 text-gray-600 font-semibold py-2.5 px-5 rounded-xl hover:bg-gray-50 transition text-sm">
                Skip details
              </button>
              <button onClick={() => setWrittenModal(null)} className="border border-gray-200 text-gray-500 font-semibold py-2.5 px-4 rounded-xl hover:bg-gray-50 transition text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign to Editor Modal ─────────────────────────────────────────── */}
      {assignScript && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900 text-lg">Assign to Editor</h3>
              <button onClick={() => setAssignScript(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-5 bg-gray-50 rounded-lg px-3 py-2 font-mono">{assignScript.title}</p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Editor *</label>
                <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {[...editors].sort((a, b) => (a.activeCount || 0) - (b.activeCount || 0)).filter(e => !e.unavailable).map(e => {
                    const count = e.activeCount || 0;
                    const load = count === 0 ? 'free' : count <= 3 ? 'low' : count <= 6 ? 'mid' : 'high';
                    const loadColor = { free: 'text-green-600 bg-green-50', low: 'text-blue-600 bg-blue-50', mid: 'text-amber-600 bg-amber-50', high: 'text-red-600 bg-red-50' }[load];
                    const isSelected = assignEditor === e.name;
                    return (
                      <button key={e.id} type="button" onClick={() => setAssignEditor(e.name)}
                        className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition text-left ${isSelected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-indigo-200' : 'bg-gray-100'}`}>
                          <span className={`font-bold text-sm ${isSelected ? 'text-indigo-700' : 'text-gray-600'}`}>{e.name.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`truncate font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-800'}`}>{e.name}</p>
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${loadColor}`}>{count === 0 ? 'Free' : `${count} active`}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Deadline (optional)</label>
                <input type="date" value={assignDeadline} onChange={e => setAssignDeadline(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-indigo-500" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleAssign} disabled={!assignEditor || assignSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition">
                {assignSaving ? 'Assigning…' : 'Assign'}
              </button>
              <button onClick={() => setAssignScript(null)} className="flex-1 border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
