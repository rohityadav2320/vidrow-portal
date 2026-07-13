'use client';

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  Upload, Download, FileText, CheckCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, X, RefreshCw, PenLine,
} from 'lucide-react';

interface WritingScript {
  id: string;
  title: string;
  description?: string;
  content?: string;
  pod?: string;
  client?: string;
  writing_status: 'writing' | 'written';
  created_at: string;
}

interface ParsedRow {
  client: string;
  batchNo: string;
  scriptNo: string;
  pod: string;
  content: string;
  title: string;
}

const TEMPLATE_HEADERS = ['Client', 'Batch No', 'Script No', 'Pod', 'Script Content'];

function parseCSV(text: string): string[][] {
  const lines = text.split('\n').filter(l => l.trim());
  return lines.map(line => {
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; }
      else { current += ch; }
    }
    cols.push(current.trim());
    return cols;
  });
}

function buildTitle(client: string, batchNo: string, scriptNo: string) {
  return [client, batchNo ? `Batch${batchNo}` : '', scriptNo ? `Script${scriptNo}` : '']
    .filter(Boolean).join('_');
}

export default function WritingPage() {
  const [scripts, setScripts]     = useState<WritingScript[]>([]);
  const [pods, setPods]           = useState<{ id: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Upload state
  const [uploadMode, setUploadMode]       = useState<'create' | 'update' | null>(null);
  const [preview, setPreview]             = useState<ParsedRow[]>([]);
  const [parseError, setParseError]       = useState('');
  const [uploading, setUploading]         = useState(false);
  const [uploadResult, setUploadResult]   = useState<{ created?: number; updated?: number; skipped?: number; errors?: string[] } | null>(null);
  const fileInputRef                      = useRef<HTMLInputElement>(null);

  // Filters
  const [filterStatus, setFilterStatus]   = useState<'all' | 'writing' | 'written'>('all');
  const [filterPod, setFilterPod]         = useState('All');
  const [expandedId, setExpandedId]       = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setIsLoading(true);
    const [scriptsRes, podsRes] = await Promise.all([
      supabase.from('scripts').select('*').not('writing_status', 'is', null).order('created_at', { ascending: false }),
      supabase.from('pods').select('id, name').order('created_at'),
    ]);
    setScripts(scriptsRes.data || []);
    setPods(podsRes.data || []);
    setIsLoading(false);
  }

  // ── Download template ──────────────────────────────────────────────────────
  function downloadTemplate() {
    const rows = [TEMPLATE_HEADERS, ['Daily Bhakti', 'Batch21', '1', "Aryan's Pod", '']];
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'vidrow_scripts_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Parse uploaded file ────────────────────────────────────────────────────
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseError('');
    setPreview([]);
    setUploadResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const rows = parseCSV(text);
        if (rows.length < 2) { setParseError('Sheet is empty — at least one data row required.'); return; }

        const header = rows[0].map(h => h.toLowerCase().replace(/[^a-z]/g, ''));
        const clientIdx  = header.findIndex(h => h.includes('client'));
        const batchIdx   = header.findIndex(h => h.includes('batch'));
        const scriptIdx  = header.findIndex(h => h.includes('script') && !h.includes('content'));
        const podIdx     = header.findIndex(h => h.includes('pod'));
        const contentIdx = header.findIndex(h => h.includes('content'));

        if (clientIdx < 0 || batchIdx < 0 || scriptIdx < 0 || podIdx < 0) {
          setParseError('Missing required columns: Client, Batch No, Script No, Pod');
          return;
        }

        const parsed: ParsedRow[] = rows.slice(1).map(r => {
          const client   = r[clientIdx]  || '';
          const batchNo  = r[batchIdx]   || '';
          const scriptNo = r[scriptIdx]  || '';
          const pod      = r[podIdx]     || '';
          const content  = contentIdx >= 0 ? (r[contentIdx] || '') : '';
          return { client, batchNo, scriptNo, pod, content, title: buildTitle(client, batchNo, scriptNo) };
        }).filter(r => r.client || r.batchNo || r.scriptNo);

        if (parsed.length === 0) { setParseError('No valid rows found.'); return; }
        setPreview(parsed);
      } catch {
        setParseError('Could not parse the file. Please use the template format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  // ── Upload: Create tickets ─────────────────────────────────────────────────
  async function handleCreateTickets() {
    if (!preview.length) return;
    setUploading(true);
    const errors: string[] = [];
    let created = 0;
    let skipped = 0;

    // Fetch existing titles to detect duplicates
    const { data: existing } = await supabase.from('scripts').select('title');
    const existingTitles = new Set((existing || []).map((s: any) => s.title.toLowerCase()));

    const toInsert = preview.map(row => {
      if (!row.title) { errors.push(`Row skipped — missing title`); skipped++; return null; }
      if (existingTitles.has(row.title.toLowerCase())) {
        errors.push(`"${row.title}" already exists — skipped`);
        skipped++;
        return null;
      }
      return {
        title: row.title,
        client: row.client || null,
        pod: row.pod || null,
        status: 'pending',
        writing_status: 'writing',
      };
    }).filter(Boolean);

    if (toInsert.length > 0) {
      const { error } = await supabase.from('scripts').insert(toInsert);
      if (error) { errors.push('DB error: ' + error.message); }
      else { created = toInsert.length; }
    }

    setUploadResult({ created, skipped, errors });
    setPreview([]);
    setUploading(false);
    setUploadMode(null);
    await loadData();
  }

  // ── Upload: Update content (written scripts) ───────────────────────────────
  async function handleUpdateContent() {
    if (!preview.length) return;
    setUploading(true);
    const errors: string[] = [];
    let updated = 0;
    let skipped = 0;

    for (const row of preview) {
      if (!row.content.trim()) { skipped++; continue; }

      const { data, error } = await supabase
        .from('scripts')
        .update({ content: row.content.trim(), writing_status: 'written' })
        .ilike('title', row.title)
        .select();

      if (error) { errors.push(`"${row.title}": ${error.message}`); }
      else if (!data || data.length === 0) { errors.push(`"${row.title}" not found — skipped`); skipped++; }
      else { updated++; }
    }

    setUploadResult({ updated, skipped, errors });
    setPreview([]);
    setUploading(false);
    setUploadMode(null);
    await loadData();
  }

  // ── Derived data ───────────────────────────────────────────────────────────
  const filtered = scripts
    .filter(s => filterStatus === 'all' || s.writing_status === filterStatus)
    .filter(s => filterPod === 'All' || s.pod === filterPod);

  const writingCount = scripts.filter(s => s.writing_status === 'writing').length;
  const writtenCount = scripts.filter(s => s.writing_status === 'written').length;
  const activePods = [...new Set(scripts.map(s => s.pod).filter(Boolean))] as string[];

  return (
    <div className="p-8 max-w-5xl">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Writing</h1>
          <p className="text-gray-500 text-sm mt-0.5">Track script writing pipeline — from ticket to production-ready</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-1.5 border border-gray-300 text-gray-600 text-sm font-medium py-2 px-3 rounded-lg hover:bg-gray-50 transition">
          <RefreshCw className="w-3.5 h-3.5" />Refresh
        </button>
      </div>

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">{scripts.length}</p>
          <p className="text-xs font-semibold text-gray-500 mt-1">Total Tickets</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-4 text-center">
          <p className="text-3xl font-bold text-amber-600">{writingCount}</p>
          <p className="text-xs font-semibold text-amber-600 mt-1">Being Written</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 text-center">
          <p className="text-3xl font-bold text-green-600">{writtenCount}</p>
          <p className="text-xs font-semibold text-green-600 mt-1">Written — Ready for Editor</p>
        </div>
      </div>

      {/* ── Upload result banner ───────────────────────────────────────────── */}
      {uploadResult && (
        <div className={`rounded-xl border px-5 py-4 mb-5 flex items-start justify-between gap-3 ${
          (uploadResult.errors?.length || 0) > 0 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
        }`}>
          <div>
            {uploadResult.created !== undefined && (
              <p className="text-sm font-semibold text-green-800">✓ {uploadResult.created} ticket{uploadResult.created !== 1 ? 's' : ''} created{uploadResult.skipped ? `, ${uploadResult.skipped} skipped` : ''}</p>
            )}
            {uploadResult.updated !== undefined && (
              <p className="text-sm font-semibold text-green-800">✓ {uploadResult.updated} script{uploadResult.updated !== 1 ? 's' : ''} updated{uploadResult.skipped ? `, ${uploadResult.skipped} skipped (no content)` : ''}</p>
            )}
            {uploadResult.errors?.map((e, i) => (
              <p key={i} className="text-xs text-amber-700 mt-1">⚠ {e}</p>
            ))}
          </div>
          <button onClick={() => setUploadResult(null)} className="text-gray-400 hover:text-gray-600 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ── Action Cards ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {/* Download Template */}
        <button
          onClick={downloadTemplate}
          className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-5 text-left hover:border-blue-300 hover:bg-blue-50/30 transition group"
        >
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-blue-200 transition">
            <Download className="w-5 h-5 text-blue-600" />
          </div>
          <p className="font-semibold text-gray-900 text-sm">Download Template</p>
          <p className="text-xs text-gray-400 mt-1">Get the CSV format to fill in script targets</p>
        </button>

        {/* Upload Targets */}
        <button
          onClick={() => { setUploadMode('create'); setPreview([]); setParseError(''); setUploadResult(null); fileInputRef.current?.click(); }}
          className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-5 text-left hover:border-violet-300 hover:bg-violet-50/30 transition group"
        >
          <div className="w-9 h-9 bg-violet-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-violet-200 transition">
            <Upload className="w-5 h-5 text-violet-600" />
          </div>
          <p className="font-semibold text-gray-900 text-sm">Upload Targets</p>
          <p className="text-xs text-gray-400 mt-1">Upload sheet to create script tickets for this week</p>
        </button>

        {/* Upload Written Scripts */}
        <button
          onClick={() => { setUploadMode('update'); setPreview([]); setParseError(''); setUploadResult(null); fileInputRef.current?.click(); }}
          className="bg-white rounded-xl border-2 border-dashed border-gray-200 p-5 text-left hover:border-green-300 hover:bg-green-50/30 transition group"
        >
          <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center mb-3 group-hover:bg-green-200 transition">
            <PenLine className="w-5 h-5 text-green-600" />
          </div>
          <p className="font-semibold text-gray-900 text-sm">Upload Written Scripts</p>
          <p className="text-xs text-gray-400 mt-1">Re-upload the sheet with script content filled in</p>
        </button>
      </div>

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />

      {/* ── Parse error ───────────────────────────────────────────────────── */}
      {parseError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 mb-5 flex items-center justify-between">
          <p className="text-sm text-red-700 font-medium">⚠ {parseError}</p>
          <button onClick={() => setParseError('')}><X className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* ── Preview table ─────────────────────────────────────────────────── */}
      {preview.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <p className="font-semibold text-gray-900">
                {uploadMode === 'create' ? '📋 Preview — Create Tickets' : '✍️ Preview — Update Script Content'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {preview.length} row{preview.length > 1 ? 's' : ''} found
                {uploadMode === 'update' && ` · Only rows with content filled will be updated`}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview([])} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition">Cancel</button>
              <button
                onClick={uploadMode === 'create' ? handleCreateTickets : handleUpdateContent}
                disabled={uploading}
                className={`text-sm font-semibold text-white px-4 py-1.5 rounded-lg transition disabled:opacity-50 ${
                  uploadMode === 'create' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {uploading ? 'Processing...' : uploadMode === 'create' ? `Create ${preview.length} Tickets` : `Update Scripts`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Pod</th>
                  {uploadMode === 'update' && <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Content</th>}
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-gray-900">{row.title || <span className="text-red-400">Missing title</span>}</td>
                    <td className="px-4 py-2.5 text-gray-500 text-xs">{row.pod || '—'}</td>
                    {uploadMode === 'update' && (
                      <td className="px-4 py-2.5 text-gray-500 text-xs max-w-xs truncate">
                        {row.content ? <span className="text-green-600">✓ {row.content.substring(0, 60)}{row.content.length > 60 ? '…' : ''}</span> : <span className="text-gray-300">Empty — will skip</span>}
                      </td>
                    )}
                    <td className="px-4 py-2.5">
                      {uploadMode === 'create' ? (
                        <span className="text-xs bg-violet-100 text-violet-700 font-semibold px-2 py-0.5 rounded-full">Create ticket</span>
                      ) : row.content ? (
                        <span className="text-xs bg-green-100 text-green-700 font-semibold px-2 py-0.5 rounded-full">Update</span>
                      ) : (
                        <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Skip</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Filters ───────────────────────────────────────────────────────── */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium w-12">Status</span>
          {([
            { val: 'all', label: `All (${scripts.length})` },
            { val: 'writing', label: `✍️ Writing (${writingCount})` },
            { val: 'written', label: `✓ Written (${writtenCount})` },
          ] as const).map(s => (
            <button key={s.val} onClick={() => setFilterStatus(s.val)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterStatus === s.val ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.label}
            </button>
          ))}
        </div>
        {activePods.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 font-medium w-12">Pod</span>
            <button onClick={() => setFilterPod('All')} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterPod === 'All' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>All</button>
            {activePods.map(pod => (
              <button key={pod} onClick={() => setFilterPod(pod)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterPod === pod ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {pod} ({scripts.filter(s => s.pod === pod).length})
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Script list ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600"></div></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <PenLine className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No writing tickets yet</p>
          <p className="text-gray-300 text-sm mt-1">Download the template, fill in script targets, and upload to get started</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pod</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(script => {
                const isExpanded = expandedId === script.id;
                return (
                  <>
                    <tr key={script.id} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900 text-sm">{script.title}</p>
                        {script.description && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{script.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        {script.pod ? <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-50 text-blue-700">{script.pod}</span> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{script.client || '—'}</td>
                      <td className="px-4 py-3">
                        {script.writing_status === 'written' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700">
                            <CheckCircle className="w-3 h-3" />Written
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                            <Clock className="w-3 h-3" />Writing
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">{new Date(script.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                      <td className="px-4 py-3">
                        {script.content && (
                          <button onClick={() => setExpandedId(isExpanded ? null : script.id)} className="text-gray-400 hover:text-gray-600">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && script.content && (
                      <tr key={script.id + '-content'} className="bg-gray-50/80">
                        <td colSpan={6} className="px-6 py-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Script Content</p>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">{script.content}</p>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
