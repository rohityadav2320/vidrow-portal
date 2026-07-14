'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, Check, RefreshCw, PenLine, X, ArrowRight,
  Video, UserCheck, AlertTriangle, Clock, ChevronDown, ChevronUp,
  Upload, Link as LinkIcon,
} from 'lucide-react';

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

interface Editor  { id: string; name: string; unavailable?: boolean; activeCount?: number; }
interface Client  { id: string; name: string; }
interface Pod     { id: string; name: string; color: string; }

interface UploadRow {
  scriptNum: number;
  content: Record<string, string>;
  portalId: string | null;
  portalTitle: string | null;
}

// ── Field definitions ──────────────────────────────────────────────────────
const SCRIPT_FIELDS = [
  { key: 'communication',  label: 'Communication',   placeholder: 'Core message…',               span: 2 },
  { key: 'referenceVideo', label: 'Reference Video',  placeholder: 'YouTube link or description…', span: 2 },
  { key: 'targetPersonas', label: 'Target Personas',  placeholder: 'Who is this for?',             span: 1 },
  { key: 'painPoint',      label: 'Pain Point',       placeholder: 'What problem?',                span: 1 },
  { key: 'actor',          label: 'Actor',            placeholder: 'Who appears?',                 span: 1 },
  { key: 'format',         label: 'Format',           placeholder: 'e.g. Podcast, Skit…',          span: 1 },
  { key: 'location',       label: 'Location',         placeholder: 'Where is it shot?',            span: 2 },
  { key: 'hook1',          label: 'Hook 1',           placeholder: 'First hook…',                  span: 2 },
  { key: 'hook2',          label: 'Hook 2',           placeholder: 'Second hook…',                 span: 2 },
  { key: 'hook3',          label: 'Hook 3',           placeholder: 'Third hook…',                  span: 2 },
  { key: 'story',          label: 'Story / Body',     placeholder: 'Main script body…',            span: 2 },
  { key: 'bridge',         label: 'Bridge',           placeholder: 'Transition content…',          span: 2 },
  { key: 'product',        label: 'Product',          placeholder: 'Product being promoted…',      span: 2 },
  { key: 'personalSignal', label: 'Personal Signal',  placeholder: 'Personal hook/signal…',        span: 2 },
  { key: 'trustSignal',    label: 'Trust Signal',     placeholder: 'Credibility / trust line…',    span: 2 },
  { key: 'cta',            label: 'Call to Action',   placeholder: 'CTA…',                         span: 2 },
];

// Maps column-A labels in the sheet → our field keys (case-insensitive)
const SHEET_FIELD_MAP: Record<string, string> = {
  'communication':   'communication',
  'reference video': 'referenceVideo',
  'target personas': 'targetPersonas',
  'pain point':      'painPoint',
  'actor':           'actor',
  'format':          'format',
  'location':        'location',
  'hook 1':          'hook1',
  'hook 2':          'hook2',
  'hook 3':          'hook3',
  'story':           'story',
  'bridge':          'bridge',
  'product':         'product',
  'personal signal': 'personalSignal',
  'trust signal':    'trustSignal',
  'call to action':  'cta',
  'cta':             'cta',
};

// ── CSV parser (handles quoted multi-line cells) ───────────────────────────
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuote = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 2; continue; }
      if (ch === '"') { inQuote = false; }
      else            { cell += ch; }
    } else {
      if      (ch === '"')  { inQuote = true; }
      else if (ch === ',')  { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell); cell = ''; rows.push(row); row = []; }
      else if (ch === '\r') { /* skip */ }
      else                  { cell += ch; }
    }
    i++;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return rows;
}

function parseSheetRows(rows: string[][]): Record<number, Record<string, string>> {
  const headerRow = rows[0] || [];
  const colToNum: Record<number, number> = {};
  for (let col = 1; col < headerRow.length; col++) {
    const m = String(headerRow[col] || '').trim().match(/Script\s*(\d+)/i);
    if (m) colToNum[col] = parseInt(m[1], 10);
  }
  const scripts: Record<number, Record<string, string>> = {};
  Object.values(colToNum).forEach(n => { scripts[n] = {}; });
  for (let r = 1; r < rows.length; r++) {
    const rowData = rows[r];
    const key = SHEET_FIELD_MAP[String(rowData[0] || '').trim().toLowerCase()];
    if (!key) continue;
    for (let col = 1; col < rowData.length; col++) {
      const n = colToNum[col]; if (!n) continue;
      const val = String(rowData[col] || '').trim();
      if (val) scripts[n][key] = val;
    }
  }
  return scripts;
}

function parseSheetUrl(url: string): { sheetId: string; gid: string } | null {
  const idMatch  = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  const gidMatch = url.match(/[#&?]gid=(\d+)/);
  if (!idMatch) return null;
  return { sheetId: idMatch[1], gid: gidMatch ? gidMatch[1] : '' };
}

// ── Helpers ────────────────────────────────────────────────────────────────
const POD_COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-100 text-blue-700', purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700', teal: 'bg-teal-100 text-teal-700',
  pink: 'bg-pink-100 text-pink-700', green: 'bg-green-100 text-green-700',
};

function daysLabel(deadline: string): { label: string; overdue: boolean } {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due   = new Date(deadline); due.setHours(0, 0, 0, 0);
  const diff  = Math.round((due.getTime() - today.getTime()) / 86400000);
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

// ══════════════════════════════════════════════════════════════════════════
export default function WritingPage() {
  const [scripts, setScripts]     = useState<Script[]>([]);
  const [editors, setEditors]     = useState<Editor[]>([]);
  const [clients, setClients]     = useState<Client[]>([]);
  const [pods, setPods]           = useState<Pod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [filterPod, setFilterPod]       = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Create form
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [formData, setFormData]     = useState({ batchNo: '', count: '1', pod: '', client: '' });
  const [newClient, setNewClient]   = useState('');
  const [createError, setCreateError] = useState('');
  const [nextStart, setNextStart]   = useState(1);

  // Mark Written modal
  const [writtenModal, setWrittenModal]   = useState<Script | null>(null);
  const [scriptFields, setScriptFields]   = useState<Record<string, string>>({});
  const [writtenSaving, setWrittenSaving] = useState(false);

  // Assign to Editor modal
  const [assignScript, setAssignScript]     = useState<Script | null>(null);
  const [assignEditor, setAssignEditor]     = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assignSaving, setAssignSaving]     = useState(false);

  // Google Sheet upload modal
  const [showUpload, setShowUpload]     = useState(false);
  const [uploadUrl, setUploadUrl]       = useState('');
  const [uploadClient, setUploadClient] = useState('');
  const [uploadBatch, setUploadBatch]   = useState('');
  const [uploadStep, setUploadStep]     = useState<1 | 2>(1);
  const [uploadRows, setUploadRows]     = useState<UploadRow[]>([]);
  const [fetchError, setFetchError]     = useState('');
  const [fetching, setFetching]         = useState(false);
  const [uploading, setUploading]       = useState(false);

  // Expanded rows & action spinner
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionId, setActionId]     = useState<string | null>(null);

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
      if (!assignmentMap[a.script_id])
        assignmentMap[a.script_id] = { id: a.id, editor_name: a.editor_name, status: a.status, deadline: a.deadline, completed_at: a.completed_at };
      if (a.status !== 'done') workload[a.editor_name] = (workload[a.editor_name] || 0) + 1;
    }
    setScripts((scriptsRes.data || []).map(s => ({ ...s, assignment: assignmentMap[s.id] || null })));
    setEditors((editorsRes.data || []).map((e: any) => ({ ...e, activeCount: workload[e.name] || 0 })));
    setClients(clientsRes.data || []);
    setPods(podsRes.data || []);
    setIsLoading(false);
  }

  // ── Create tickets ────────────────────────────────────────────────────────
  async function addClient() {
    const name = newClient.trim(); if (!name) return;
    const { data } = await supabase.from('clients').insert({ name }).select().single();
    if (data) { setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name))); setFormData(f => ({ ...f, client: data.name })); }
    setNewClient('');
  }

  async function lookupNextStart() {
    const batch = formData.batchNo.trim(); if (!batch) { setNextStart(1); return; }
    const prefix = [formData.client, `Batch${batch}`, 'Script'].filter(Boolean).join('_');
    const { data } = await supabase.from('scripts').select('title').like('title', `${prefix}%`);
    let max = 0;
    for (const s of (data || [])) { const m = s.title.match(/_Script(\d+)$/); if (m) max = Math.max(max, parseInt(m[1], 10)); }
    setNextStart(max + 1);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setCreateError('');
    const n = parseInt(formData.count, 10);
    if (!formData.batchNo.trim() || !formData.pod || !n || n < 1) return;
    setSaving(true);
    const prefix = [formData.client, `Batch${formData.batchNo.trim()}`].filter(Boolean).join('_');
    const { data: existing } = await supabase.from('scripts').select('title').like('title', `${prefix}_Script%`);
    let max = 0;
    for (const s of (existing || [])) { const m = s.title.match(/_Script(\d+)$/); if (m) max = Math.max(max, parseInt(m[1], 10)); }
    const startFrom = max + 1;
    const rows = Array.from({ length: n }, (_, i) => ({
      title: `${prefix}_Script${startFrom + i}`,
      pod: formData.pod, client: formData.client || null,
      status: 'pending' as const, writing_status: 'writing',
    }));
    const { data: dupes } = await supabase.from('scripts').select('title').in('title', rows.map(r => r.title));
    if (dupes && dupes.length > 0) { setCreateError(`Already exist: ${dupes.map(d => d.title).join(', ')}`); setSaving(false); return; }
    await supabase.from('scripts').insert(rows);
    setFormData({ batchNo: '', count: '1', pod: '', client: '' }); setNextStart(1);
    setShowForm(false); setSaving(false); await loadData();
  }

  // ── Mark Written modal ────────────────────────────────────────────────────
  function openWrittenModal(script: Script) {
    setWrittenModal(script);
    const existing = script.script_content || {};
    const prefilled: Record<string, string> = {};
    SCRIPT_FIELDS.forEach(f => { prefilled[f.key] = existing[f.key] || ''; });
    setScriptFields(prefilled);
  }

  async function saveWritten(skip = false) {
    if (!writtenModal) return; setWrittenSaving(true);
    const content: Record<string, string> = {};
    if (!skip) SCRIPT_FIELDS.forEach(f => { if (scriptFields[f.key]?.trim()) content[f.key] = scriptFields[f.key].trim(); });
    await supabase.from('scripts').update({
      writing_status: 'written',
      ...(Object.keys(content).length > 0 ? { script_content: content } : {}),
    }).eq('id', writtenModal.id);
    setWrittenModal(null); setScriptFields({}); setWrittenSaving(false); await loadData();
  }

  // ── Advance / assign ──────────────────────────────────────────────────────
  async function advance(script: Script, toStatus: string) {
    setActionId(script.id);
    await supabase.from('scripts').update({ writing_status: toStatus }).eq('id', script.id);
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, writing_status: toStatus } : s));
    setActionId(null);
  }

  async function handleAssign() {
    if (!assignScript || !assignEditor) return; setAssignSaving(true);
    await Promise.all([
      supabase.from('editor_assignments').insert({ script_id: assignScript.id, editor_name: assignEditor, status: 'assigned', deadline: assignDeadline || null }),
      supabase.from('scripts').update({ writing_status: 'editing' }).eq('id', assignScript.id),
    ]);
    setAssignScript(null); setAssignEditor(''); setAssignDeadline(''); setAssignSaving(false); await loadData();
  }

  // ── Google Sheet upload ───────────────────────────────────────────────────
  async function fetchSheet() {
    setFetchError(''); setFetching(true);
    const parsed = parseSheetUrl(uploadUrl.trim());
    if (!parsed) { setFetchError('Not a valid Google Sheets URL.'); setFetching(false); return; }
    if (!uploadBatch.trim()) { setFetchError('Enter the batch name.'); setFetching(false); return; }

    const params = new URLSearchParams({ sheetId: parsed.sheetId, ...(parsed.gid ? { gid: parsed.gid } : {}) });
    const res = await fetch(`/api/fetch-sheet?${params}`);
    if (!res.ok) { const j = await res.json().catch(() => ({})); setFetchError(j.error || 'Failed to fetch sheet.'); setFetching(false); return; }

    const csv = await res.text();
    const rows = parseCSV(csv);
    const scripts = parseSheetRows(rows);
    const nums = Object.keys(scripts).map(Number).sort((a, b) => a - b);
    if (nums.length === 0) { setFetchError('No scripts found in this sheet. Check that row 1 has "Script 1", "Script 2", etc.'); setFetching(false); return; }

    const prefix = [uploadClient, `Batch${uploadBatch.trim()}`].filter(Boolean).join('_');
    const expectedTitles = nums.map(n => `${prefix}_Script${n}`);
    const { data: portalScripts } = await supabase.from('scripts').select('id, title').in('title', expectedTitles);
    const titleMap: Record<string, { id: string; title: string }> = {};
    for (const s of (portalScripts || [])) titleMap[s.title] = s;

    const uploadRowData: UploadRow[] = nums.map(n => {
      const expectedTitle = `${prefix}_Script${n}`;
      const match = titleMap[expectedTitle];
      return { scriptNum: n, content: scripts[n], portalId: match?.id || null, portalTitle: match?.title || null };
    });

    setUploadRows(uploadRowData);
    setUploadStep(2);
    setFetching(false);
  }

  async function confirmUpload() {
    setUploading(true);
    const toUpdate = uploadRows.filter(r => Object.keys(r.content).length > 0 && r.portalId);
    await Promise.all(toUpdate.map(r =>
      supabase.from('scripts').update({ script_content: r.content, writing_status: 'written' }).eq('id', r.portalId!)
    ));
    setUploading(false);
    closeUploadModal();
    await loadData();
  }

  function closeUploadModal() {
    setShowUpload(false); setUploadUrl(''); setUploadClient(''); setUploadBatch('');
    setUploadStep(1); setUploadRows([]); setFetchError('');
  }

  // ── Derived state ─────────────────────────────────────────────────────────
  const counts = {
    writing:     scripts.filter(s => getDisplayStatus(s) === 'writing').length,
    written:     scripts.filter(s => getDisplayStatus(s) === 'written').length,
    production:  scripts.filter(s => getDisplayStatus(s) === 'production').length,
    with_editor: scripts.filter(s => getDisplayStatus(s) === 'with_editor').length,
    done:        scripts.filter(s => getDisplayStatus(s) === 'done').length,
  };

  const filtered = scripts
    .filter(s => filterPod    === 'All' || s.pod === filterPod)
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="p-8 pb-24">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Writing</h1>
          <p className="text-gray-400 text-sm mt-0.5">Full pipeline — ticket creation to editor assignment</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 border border-green-300 bg-green-50 hover:bg-green-100 text-green-700 text-sm font-medium py-2 px-4 rounded-lg transition">
            <Upload className="w-4 h-4" />Upload Sheet
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition">
            <Plus className="w-4 h-4" />New Tickets
          </button>
        </div>
      </div>

      {/* Pipeline bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 py-4 mb-6">
        <div className="flex items-center gap-0 flex-wrap">
          {[
            { key: 'writing',     label: 'Writing',     count: counts.writing,     dot: 'bg-amber-400' },
            { key: 'written',     label: 'Written',     count: counts.written,     dot: 'bg-blue-400' },
            { key: 'production',  label: 'Production',  count: counts.production,  dot: 'bg-purple-400' },
            { key: 'with_editor', label: 'With Editor', count: counts.with_editor, dot: 'bg-indigo-400' },
            { key: 'done',        label: 'Done',        count: counts.done,        dot: 'bg-green-400' },
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
                <input type="text" required autoFocus value={formData.batchNo}
                  onChange={e => setFormData({ ...formData, batchNo: e.target.value })}
                  onBlur={lookupNextStart}
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
                  <select value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })} onBlur={lookupNextStart}
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
            <div className="mb-2 flex items-end gap-4">
              <div className="w-44">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Number of Tickets *</label>
                <input type="number" min="1" max="200" required value={formData.count}
                  onChange={e => { setCreateError(''); setFormData({ ...formData, count: e.target.value }); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500" placeholder="e.g. 20" />
              </div>
              {formData.batchNo && parseInt(formData.count) > 0 && formData.pod && (
                <p className="text-xs text-gray-400 pb-2.5">
                  Will create <span className="font-semibold text-gray-700">{parseInt(formData.count) || 0}</span> tickets:&nbsp;
                  <span className="font-mono text-gray-600">
                    {[formData.client, `Batch${formData.batchNo}`, `Script${nextStart}`].filter(Boolean).join('_')}
                    {parseInt(formData.count) > 1 && <> → Script{nextStart + parseInt(formData.count) - 1}</>}
                  </span>
                  {nextStart > 1 && <span className="ml-2 text-blue-500 font-medium">(continuing from #{nextStart})</span>}
                </p>
              )}
            </div>
            {createError && (
              <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-2.5 rounded-lg">
                <span className="mt-0.5 flex-shrink-0">⚠️</span><span>{createError}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={saving || !formData.batchNo.trim() || !formData.pod || !parseInt(formData.count)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium py-2 px-5 rounded-lg transition">
                {saving ? 'Creating…' : `Create ${parseInt(formData.count) || 0} Ticket${parseInt(formData.count) !== 1 ? 's' : ''}`}
              </button>
              <button type="button" onClick={() => { setShowForm(false); setCreateError(''); setNextStart(1); }}
                className="text-gray-500 text-sm font-medium py-2 px-4 rounded-lg hover:bg-gray-100 transition">Cancel</button>
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
            <button key={s.val} onClick={() => setFilterStatus(s.val)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterStatus === s.val ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{s.label}</button>
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
                const status    = getDisplayStatus(script);
                const isActing  = actionId === script.id;
                const podObj    = pods.find(p => p.name === script.pod);
                const dl        = script.assignment?.deadline ? daysLabel(script.assignment.deadline) : null;
                const isExpanded = expandedId === script.id;
                const hasContent = script.script_content && Object.keys(script.script_content).length > 0;
                return (
                  <React.Fragment key={script.id}>
                    <tr className={`transition ${status === 'done' ? 'bg-green-50/20' : status === 'with_editor' ? 'bg-indigo-50/20' : isExpanded ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
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
                      <td className="px-3 py-3">
                        {script.client ? <span className="text-xs font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">{script.client}</span> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        {script.pod ? <span className={`text-xs font-semibold px-2 py-1 rounded-full ${POD_COLOR_MAP[podObj?.color || 'blue'] || 'bg-gray-100 text-gray-700'}`}>{script.pod}</span> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${stageBadge[status] || 'bg-gray-100 text-gray-600'}`}>{stageLabel[status] || status}</span>
                      </td>
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
                          {(status === 'written' || status === 'production' || status === 'with_editor') && (
                            <button onClick={() => openWrittenModal(script)} title="Edit script details"
                              className="text-xs text-gray-400 hover:text-blue-600 font-medium px-2 py-1.5 rounded-lg hover:bg-blue-50 transition">✏️</button>
                          )}
                        </div>
                      </td>
                    </tr>
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

      {/* ── Google Sheet Upload Modal ──────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-green-600" />Upload from Google Sheet
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {uploadStep === 1 ? 'Paste the sheet URL and tell us which batch to update' : 'Review what will be marked as Written'}
                </p>
              </div>
              <button onClick={closeUploadModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Step 1 — URL + batch */}
            {uploadStep === 1 && (
              <div className="px-6 py-5 space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-700">
                  <strong>Before uploading:</strong> Make sure the Google Sheet is set to <em>"Anyone with the link can view"</em> (Share → Change to anyone with the link).
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Google Sheets URL *</label>
                  <input type="url" value={uploadUrl} onChange={e => { setUploadUrl(e.target.value); setFetchError(''); }}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500" />
                  <p className="text-xs text-gray-400 mt-1">Navigate to the specific tab in Google Sheets first, then copy the URL — it will contain the correct tab ID.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Client (in portal)</label>
                    <select value={uploadClient} onChange={e => setUploadClient(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500">
                      <option value="">No client</option>
                      {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Batch No. (as in portal) *</label>
                    <input type="text" value={uploadBatch} onChange={e => { setUploadBatch(e.target.value); setFetchError(''); }}
                      placeholder="e.g. B1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-green-500" />
                    <p className="text-xs text-gray-400 mt-1">Portal tickets must be named <span className="font-mono">{uploadClient || 'Client'}_Batch{uploadBatch || 'X'}_Script1</span></p>
                  </div>
                </div>
                {fetchError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-2.5 rounded-lg">
                    <span className="mt-0.5 flex-shrink-0">⚠️</span><span>{fetchError}</span>
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <button onClick={fetchSheet} disabled={fetching || !uploadUrl.trim() || !uploadBatch.trim()}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition">
                    {fetching ? 'Fetching sheet…' : 'Fetch & Preview'}
                  </button>
                  <button onClick={closeUploadModal} className="border border-gray-200 text-gray-600 font-semibold py-2.5 px-5 rounded-xl hover:bg-gray-50 transition text-sm">Cancel</button>
                </div>
              </div>
            )}

            {/* Step 2 — Preview */}
            {uploadStep === 2 && (
              <div className="px-6 py-5">
                {(() => {
                  const withContent  = uploadRows.filter(r => Object.keys(r.content).length > 0);
                  const matched      = withContent.filter(r => r.portalId);
                  const notMatched   = withContent.filter(r => !r.portalId);
                  const emptyInSheet = uploadRows.filter(r => Object.keys(r.content).length === 0);
                  return (
                    <>
                      <div className="flex gap-4 mb-4">
                        <div className="flex-1 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-green-700">{matched.length}</p>
                          <p className="text-xs text-green-600 font-semibold mt-0.5">Will be marked Written</p>
                        </div>
                        <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-amber-600">{notMatched.length}</p>
                          <p className="text-xs text-amber-600 font-semibold mt-0.5">In sheet but not in portal</p>
                        </div>
                        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-gray-500">{emptyInSheet.length}</p>
                          <p className="text-xs text-gray-500 font-semibold mt-0.5">Empty (skipped)</p>
                        </div>
                      </div>

                      <div className="border border-gray-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Sheet</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Portal Ticket</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Fields</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {uploadRows.map(r => {
                              const hasContent = Object.keys(r.content).length > 0;
                              return (
                                <tr key={r.scriptNum} className={!hasContent ? 'opacity-40' : ''}>
                                  <td className="px-3 py-2 font-mono text-xs text-gray-700">Script {r.scriptNum}</td>
                                  <td className="px-3 py-2 text-xs">
                                    {r.portalTitle
                                      ? <span className="text-gray-700 font-medium">{r.portalTitle}</span>
                                      : <span className="text-red-400 italic">not found in portal</span>}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-500">{Object.keys(r.content).length} fields</td>
                                  <td className="px-3 py-2">
                                    {!hasContent
                                      ? <span className="text-xs text-gray-400">skip (empty)</span>
                                      : r.portalId
                                        ? <span className="text-xs font-semibold text-green-600">✓ Mark Written</span>
                                        : <span className="text-xs font-semibold text-amber-600">⚠ No ticket</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {notMatched.length > 0 && (
                        <p className="text-xs text-amber-600 mt-3">
                          {notMatched.length} script(s) in the sheet don't have a matching portal ticket. Create the tickets first, then re-upload.
                        </p>
                      )}
                    </>
                  );
                })()}

                <div className="flex gap-3 mt-5">
                  <button onClick={confirmUpload}
                    disabled={uploading || uploadRows.filter(r => Object.keys(r.content).length > 0 && r.portalId).length === 0}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition">
                    {uploading ? 'Updating…' : `Mark ${uploadRows.filter(r => Object.keys(r.content).length > 0 && r.portalId).length} Scripts as Written`}
                  </button>
                  <button onClick={() => setUploadStep(1)} className="border border-gray-200 text-gray-600 font-semibold py-2.5 px-5 rounded-xl hover:bg-gray-50 transition text-sm">← Back</button>
                </div>
              </div>
            )}
          </div>
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
              <p className="text-sm text-gray-500 mb-5">All fields optional. Will show under the script for the production team.</p>
              <div className="grid grid-cols-2 gap-4">
                {SCRIPT_FIELDS.map(f => (
                  <div key={f.key} className={f.span === 2 ? 'col-span-2' : ''}>
                    <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">{f.label}</label>
                    <textarea value={scriptFields[f.key] || ''} onChange={e => setScriptFields(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder} rows={f.span === 2 ? 3 : 2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none placeholder-gray-300" />
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
                className="border border-gray-200 text-gray-600 font-semibold py-2.5 px-5 rounded-xl hover:bg-gray-50 transition text-sm">Skip details</button>
              <button onClick={() => setWrittenModal(null)}
                className="border border-gray-200 text-gray-500 font-semibold py-2.5 px-4 rounded-xl hover:bg-gray-50 transition text-sm">Cancel</button>
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
                    const load  = count === 0 ? 'free' : count <= 3 ? 'low' : count <= 6 ? 'mid' : 'high';
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
