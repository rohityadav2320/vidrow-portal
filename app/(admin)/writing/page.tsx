'use client';

import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Plus, Check, RefreshCw, PenLine, X, ArrowRight,
  Video, UserCheck, AlertTriangle, Clock, ChevronDown, ChevronUp,
  Upload,
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
  scriptTitle: string;
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
  'prod. type':      'productionType',
  'prod type':       'productionType',
  'production type': 'productionType',
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

function parseSheetRows(rows: string[][]): Record<string, Record<string, string>> {
  const headerRow = rows[0] || [];
  const colToTitle: Record<number, string> = {};
  for (let col = 1; col < headerRow.length; col++) {
    const title = String(headerRow[col] || '').trim();
    if (title) colToTitle[col] = title;
  }
  const scripts: Record<string, Record<string, string>> = {};
  Object.values(colToTitle).forEach(t => { scripts[t] = {}; });
  for (let r = 1; r < rows.length; r++) {
    const rowData = rows[r];
    const key = SHEET_FIELD_MAP[String(rowData[0] || '').trim().toLowerCase()];
    if (!key) continue;
    for (let col = 1; col < rowData.length; col++) {
      const t = colToTitle[col]; if (!t) continue;
      const val = String(rowData[col] || '').trim();
      if (val) scripts[t][key] = val;
    }
  }
  return scripts;
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
  const [formData, setFormData]     = useState({ count: '1', pod: '', client: '' });
  const [newClient, setNewClient]   = useState('');
  const [createError, setCreateError] = useState('');
  const [nextStart, setNextStart]   = useState(1);

  // Mark Written modal
  const [writtenModal, setWrittenModal]   = useState<Script | null>(null);
  const [scriptFields, setScriptFields]   = useState<Record<string, string>>({});
  const [writtenSaving, setWrittenSaving] = useState(false);

  // Send to Production modal
  const [productionModal, setProductionModal] = useState<Script | null>(null);
  const [productionDetails, setProductionDetails] = useState({ type: '', name: '', notes: '' });
  const [productionSaving, setProductionSaving] = useState(false);

  // Assign to Editor modal
  const [assignScript, setAssignScript]     = useState<Script | null>(null);
  const [assignEditor, setAssignEditor]     = useState('');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assignSaving, setAssignSaving]     = useState(false);

  // Sheet file upload modal
  const [showUpload, setShowUpload]         = useState(false);
  const [uploadStep, setUploadStep]         = useState<1 | 2>(1);
  const [uploadRows, setUploadRows]         = useState<UploadRow[]>([]);
  const [parseError, setParseError]         = useState('');
  const [uploading, setUploading]           = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [xlsxSheetNames, setXlsxSheetNames] = useState<string[]>([]);
  const [xlsxSelectedSheet, setXlsxSelectedSheet] = useState('');
  const [xlsxWorkbook, setXlsxWorkbook]     = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  async function lookupNextStart(overridePod?: string, overrideClient?: string) {
    const pod = overridePod ?? formData.pod; if (!pod) { setNextStart(1); return; }
    const client = (overrideClient ?? formData.client).trim();
    const podInitial = pod.charAt(0).toUpperCase();
    const prefix = client ? `${client}_${podInitial}` : podInitial;
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const { data } = await supabase.from('scripts').select('title').like('title', `${prefix}%`);
    let max = 0;
    const re = new RegExp(`^${escaped}(\\d+)$`);
    for (const s of (data || [])) { const m = s.title.match(re); if (m) max = Math.max(max, parseInt(m[1], 10)); }
    setNextStart(max + 1);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setCreateError('');
    const n = parseInt(formData.count, 10);
    if (!formData.pod || !n || n < 1) return;
    setSaving(true);
    const client = formData.client.trim();
    const podInitial = formData.pod.charAt(0).toUpperCase();
    const prefix = client ? `${client}_${podInitial}` : podInitial;
    const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const { data: existing } = await supabase.from('scripts').select('title').like('title', `${prefix}%`);
    const re = new RegExp(`^${escaped}(\\d+)$`);
    let max = 0;
    for (const s of (existing || [])) { const m = s.title.match(re); if (m) max = Math.max(max, parseInt(m[1], 10)); }
    const startFrom = max + 1;
    const rows = Array.from({ length: n }, (_, i) => ({
      title: `${prefix}${startFrom + i}`,
      pod: formData.pod, client: client || null,
      status: 'pending' as const, writing_status: 'writing',
    }));
    const { data: dupes } = await supabase.from('scripts').select('title').in('title', rows.map(r => r.title));
    if (dupes && dupes.length > 0) { setCreateError(`Already exist: ${dupes.map(d => d.title).join(', ')}`); setSaving(false); return; }
    await supabase.from('scripts').insert(rows);
    setFormData({ count: '1', pod: '', client: '' }); setNextStart(1);
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

  // ── Send to Production modal ──────────────────────────────────────────────
  function openProductionModal(script: Script) {
    const existing = script.script_content || {};
    setProductionDetails({
      type:  existing.productionType  || '',
      name:  existing.productionName  || '',
      notes: existing.productionNotes || '',
    });
    setProductionModal(script);
  }

  async function saveProduction(skip = false) {
    if (!productionModal) return;
    setProductionSaving(true);
    const existing = productionModal.script_content || {};
    const updated = skip ? existing : {
      ...existing,
      ...(productionDetails.type  ? { productionType:  productionDetails.type }  : {}),
      ...(productionDetails.name  ? { productionName:  productionDetails.name }  : {}),
      ...(productionDetails.notes ? { productionNotes: productionDetails.notes } : {}),
    };
    await supabase.from('scripts').update({
      writing_status: 'production',
      script_content: Object.keys(updated).length > 0 ? updated : null,
    }).eq('id', productionModal.id);
    setProductionModal(null);
    setProductionDetails({ type: '', name: '', notes: '' });
    setProductionSaving(false);
    await loadData();
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

  // ── Sheet file upload ─────────────────────────────────────────────────────
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setParseError(''); setUploadFileName(file.name);
    setXlsxSheetNames([]); setXlsxSelectedSheet(''); setXlsxWorkbook(null);

    if (file.name.endsWith('.csv')) {
      const csvText = await file.text();
      await processCSV(csvText);
    } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      try {
        const XLSX = await import('xlsx');
        const buf  = await file.arrayBuffer();
        const wb   = XLSX.read(buf, { type: 'array' });
        if (wb.SheetNames.length === 1) {
          // Only one tab — parse directly
          const csvText = XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
          await processCSV(csvText);
        } else {
          // Multiple tabs — let user pick
          setXlsxWorkbook(wb);
          setXlsxSheetNames(wb.SheetNames);
          setXlsxSelectedSheet(wb.SheetNames[0]);
        }
      } catch {
        setParseError('Could not read Excel file. Try downloading as CSV instead.');
      }
    } else {
      setParseError('Only .csv or .xlsx files are supported.');
    }
  }

  async function handleSheetTabConfirm() {
    if (!xlsxWorkbook || !xlsxSelectedSheet) return;
    const XLSX = await import('xlsx');
    const ws   = xlsxWorkbook.Sheets[xlsxSelectedSheet];
    if (!ws) { setParseError('Could not read that sheet tab.'); return; }
    const csvText = XLSX.utils.sheet_to_csv(ws);
    setXlsxSheetNames([]); setXlsxWorkbook(null);
    await processCSV(csvText);
  }

  async function processCSV(csvText: string) {
    const rows    = parseCSV(csvText);
    const scripts = parseSheetRows(rows);
    const titles  = Object.keys(scripts);
    if (titles.length === 0) {
      setParseError('No scripts found. Make sure row 1 has script titles like "Bachatt_N38".'); return;
    }
    const { data: portalScripts } = await supabase.from('scripts').select('id, title').in('title', titles);
    const titleMap: Record<string, { id: string }> = {};
    for (const s of (portalScripts || [])) titleMap[s.title] = s;
    setUploadRows(titles.map(t => {
      const m = titleMap[t];
      return { scriptTitle: t, content: scripts[t], portalId: m?.id || null, portalTitle: m ? t : null };
    }));
    setUploadStep(2);
  }

  async function confirmUpload() {
    setUploading(true);
    const toUpdate = uploadRows.filter(r => Object.keys(r.content).length > 0 && r.portalId);
    await Promise.all(toUpdate.map(r =>
      supabase.from('scripts').update({ script_content: r.content, writing_status: 'written' }).eq('id', r.portalId!)
    ));
    setUploading(false); closeUploadModal(); await loadData();
  }

  function closeUploadModal() {
    setShowUpload(false);
    setUploadStep(1); setUploadRows([]); setParseError(''); setUploadFileName('');
    setXlsxSheetNames([]); setXlsxSelectedSheet(''); setXlsxWorkbook(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
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
              <div className="w-44">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pod *</label>
                <select required autoFocus value={formData.pod}
                  onChange={e => { const p = e.target.value; setFormData(f => ({ ...f, pod: p })); lookupNextStart(p, formData.client); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500">
                  <option value="">Select pod...</option>
                  {pods.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Client</label>
                <div className="flex gap-2">
                  <select value={formData.client}
                    onChange={e => setFormData(f => ({ ...f, client: e.target.value }))}
                    onBlur={() => lookupNextStart()}
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
                  onChange={e => { setCreateError(''); setFormData(f => ({ ...f, count: e.target.value })); }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500" placeholder="e.g. 20" />
              </div>
              {formData.pod && parseInt(formData.count) > 0 && (() => {
                const client = formData.client.trim();
                const initial = formData.pod.charAt(0).toUpperCase();
                const prefix = client ? `${client}_${initial}` : initial;
                return (
                  <p className="text-xs text-gray-400 pb-2.5">
                    Will create <span className="font-semibold text-gray-700">{parseInt(formData.count) || 0}</span> tickets:&nbsp;
                    <span className="font-mono text-gray-600">
                      {prefix}{nextStart}
                      {parseInt(formData.count) > 1 && <> → {prefix}{nextStart + parseInt(formData.count) - 1}</>}
                    </span>
                    {nextStart > 1 && <span className="ml-2 text-blue-500 font-medium">(continuing from #{nextStart})</span>}
                  </p>
                );
              })()}
            </div>
            {createError && (
              <div className="mb-3 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-2.5 rounded-lg">
                <span className="mt-0.5 flex-shrink-0">⚠️</span><span>{createError}</span>
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={saving || !formData.pod || !parseInt(formData.count)}
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
                            <button onClick={() => openProductionModal(script)}
                              className="flex items-center gap-1 text-xs font-semibold text-white bg-purple-500 hover:bg-purple-600 px-3 py-1.5 rounded-lg transition">
                              <Video className="w-3.5 h-3.5" />Send to Production
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
                          {/* Production details banner */}
                          {(script.script_content!.productionType || script.script_content!.productionName || script.script_content!.productionNotes) && (
                            <div className="flex items-start gap-4 bg-purple-50 border border-purple-200 rounded-xl px-4 py-3 mb-5">
                              <Video className="w-4 h-4 text-purple-500 flex-shrink-0 mt-0.5" />
                              <div className="flex gap-6 flex-wrap">
                                {script.script_content!.productionType && (
                                  <div>
                                    <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">Type</p>
                                    <p className="text-sm font-semibold text-purple-800">{script.script_content!.productionType}</p>
                                  </div>
                                )}
                                {script.script_content!.productionName && (
                                  <div>
                                    <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">Creator / House</p>
                                    <p className="text-sm font-semibold text-purple-800">{script.script_content!.productionName}</p>
                                  </div>
                                )}
                                {script.script_content!.productionNotes && (
                                  <div>
                                    <p className="text-xs font-bold text-purple-400 uppercase tracking-wider">Notes</p>
                                    <p className="text-sm text-purple-700">{script.script_content!.productionNotes}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
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

      {/* ── Sheet File Upload Modal ────────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <Upload className="w-5 h-5 text-green-600" />Upload Script Sheet
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {uploadStep === 1 ? 'Download the sheet as CSV or XLSX, then upload here' : 'Review what will be marked as Written'}
                </p>
              </div>
              <button onClick={closeUploadModal} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            {/* Step 1 — file upload */}
            {uploadStep === 1 && (
              <div className="px-6 py-5 space-y-5">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700 leading-relaxed">
                  <strong>How to download from Google Sheets:</strong><br />
                  Open the sheet → pick the batch tab → <strong>File → Download → CSV (.csv)</strong><br />
                  The portal matches scripts by their title (e.g. <span className="font-mono">Bachatt_N38</span>) from row 1 of your sheet.
                </div>

                {/* File drop zone */}
                <div>
                  <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Sheet File (CSV or XLSX)</label>
                  <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-green-300 hover:border-green-400 hover:bg-green-50 rounded-xl px-6 py-8 cursor-pointer transition">
                    <Upload className="w-8 h-8 text-green-500" />
                    <span className="text-sm font-semibold text-gray-700">
                      {uploadFileName ? uploadFileName : 'Click to select CSV or XLSX file'}
                    </span>
                    <span className="text-xs text-gray-400">Row 1 must have script titles like Bachatt_N38, Bachatt_N39…</span>
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
                      onChange={handleFileSelect} />
                  </label>
                </div>

                {/* XLSX tab picker — shown when xlsx has multiple tabs */}
                {xlsxSheetNames.length > 0 && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-4">
                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-2">Multiple tabs found — pick the batch tab</p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {xlsxSheetNames.map(name => (
                        <button key={name} type="button" onClick={() => setXlsxSelectedSheet(name)}
                          className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${xlsxSelectedSheet === name ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400'}`}>
                          {name}
                        </button>
                      ))}
                    </div>
                    <button onClick={handleSheetTabConfirm} disabled={!xlsxSelectedSheet}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white font-semibold py-2 rounded-lg text-sm transition">
                      Use "{xlsxSelectedSheet}" tab →
                    </button>
                  </div>
                )}

                {parseError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs font-medium px-3 py-2.5 rounded-lg">
                    <span className="mt-0.5 flex-shrink-0">⚠️</span><span>{parseError}</span>
                  </div>
                )}

                <button onClick={closeUploadModal}
                  className="w-full border border-gray-200 text-gray-600 font-semibold py-2.5 rounded-xl hover:bg-gray-50 transition text-sm">
                  Cancel
                </button>
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
                      {uploadFileName && <p className="text-xs text-gray-400 mb-4 font-mono">📄 {uploadFileName}</p>}
                      <div className="flex gap-3 mb-4">
                        <div className="flex-1 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-green-700">{matched.length}</p>
                          <p className="text-xs text-green-600 font-semibold mt-0.5">Will be marked Written</p>
                        </div>
                        <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-amber-600">{notMatched.length}</p>
                          <p className="text-xs text-amber-600 font-semibold mt-0.5">Not in portal yet</p>
                        </div>
                        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-center">
                          <p className="text-2xl font-bold text-gray-400">{emptyInSheet.length}</p>
                          <p className="text-xs text-gray-500 font-semibold mt-0.5">Empty (not written yet)</p>
                        </div>
                      </div>

                      <div className="border border-gray-100 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Script</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Portal Ticket</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Fields found</th>
                              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500">Result</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {uploadRows.map(r => {
                              const hasContent = Object.keys(r.content).length > 0;
                              return (
                                <tr key={r.scriptTitle} className={!hasContent ? 'opacity-35' : ''}>
                                  <td className="px-3 py-2 font-mono text-xs text-gray-700">{r.scriptTitle}</td>
                                  <td className="px-3 py-2 text-xs">
                                    {r.portalTitle ? <span className="text-gray-700">{r.portalTitle}</span> : <span className="text-red-400 italic">not found</span>}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-gray-500">{Object.keys(r.content).length}</td>
                                  <td className="px-3 py-2 text-xs font-semibold">
                                    {!hasContent ? <span className="text-gray-400">skip</span>
                                      : r.portalId ? <span className="text-green-600">✓ Mark Written</span>
                                      : <span className="text-amber-600">⚠ No ticket</span>}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {notMatched.length > 0 && (
                        <p className="text-xs text-amber-600 mt-3">
                          {notMatched.length} script(s) have content but no portal ticket — create the tickets first, then re-upload.
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
                  <button onClick={() => { setUploadStep(1); setUploadFileName(''); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                    className="border border-gray-200 text-gray-600 font-semibold py-2.5 px-5 rounded-xl hover:bg-gray-50 transition text-sm">← Back</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Send to Production Modal ──────────────────────────────────────── */}
      {productionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  <Video className="w-5 h-5 text-purple-500" />Send to Production
                </h3>
                <p className="text-xs text-gray-400 mt-0.5 font-mono">{productionModal.title}</p>
              </div>
              <button onClick={() => setProductionModal(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Production Type</label>
                <div className="flex flex-wrap gap-2">
                  {['Creator', 'Production House', 'AI Video', 'Internal'].map(t => (
                    <button key={t} type="button" onClick={() => setProductionDetails(p => ({ ...p, type: p.type === t ? '' : t }))}
                      className={`text-sm font-semibold px-4 py-2 rounded-full border-2 transition ${productionDetails.type === t ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-200 text-gray-600 hover:border-purple-300'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">
                  {productionDetails.type === 'Creator' ? 'Creator Name' : productionDetails.type === 'Production House' ? 'Production House Name' : productionDetails.type === 'AI Video' ? 'AI Tool / Platform' : 'Name / Details'}
                </label>
                <input type="text" value={productionDetails.name}
                  onChange={e => setProductionDetails(p => ({ ...p, name: e.target.value }))}
                  placeholder={productionDetails.type === 'Creator' ? 'e.g. Raghav Sharma' : productionDetails.type === 'Production House' ? 'e.g. Studio XYZ' : productionDetails.type === 'AI Video' ? 'e.g. HeyGen, Synthesia' : 'Enter name…'}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-500" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1.5">Notes (optional)</label>
                <textarea value={productionDetails.notes}
                  onChange={e => setProductionDetails(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Any instructions, links, or additional info…"
                  rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-purple-500 resize-none" />
              </div>
            </div>

            <div className="px-6 pb-6 flex gap-3">
              <button onClick={() => saveProduction(false)} disabled={productionSaving}
                className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl transition">
                {productionSaving ? 'Saving…' : '🎬 Send to Production'}
              </button>
              <button onClick={() => saveProduction(true)} disabled={productionSaving}
                className="border border-gray-200 text-gray-600 font-semibold py-2.5 px-4 rounded-xl hover:bg-gray-50 transition text-sm">
                Skip details
              </button>
            </div>
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
