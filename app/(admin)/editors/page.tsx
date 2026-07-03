'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trash2, Users, ChevronDown, ChevronUp, CheckCircle, Clock, Calendar, TrendingUp, Download } from 'lucide-react';
import type { Script } from '@/lib/types';

interface Editor {
  id: string;
  name: string;
  editor_type: 'contract' | 'freelancer';
  status: 'active' | 'inactive';
  created_at: string;
}

interface EditorAssignment {
  id: string;
  script_id: string;
  editor_name: string;
  status: 'assigned' | 'in_progress' | 'done';
  created_at: string;
  completed_at?: string;
  script?: Script;
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

export default function EditorsPage() {
  const [editors, setEditors] = useState<Editor[]>([]);
  const [assignments, setAssignments] = useState<EditorAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'contract' | 'freelancer'>('freelancer');
  const [adding, setAdding] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'contract' | 'freelancer'>('all');
  const [expandedEditor, setExpandedEditor] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'monthly'>('list');

  // Month selector
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [editorsRes, assignmentsRes, scriptsRes] = await Promise.all([
      supabase.from('editors').select('*').order('name'),
      supabase.from('editor_assignments').select('*').order('completed_at', { ascending: false }),
      supabase.from('scripts').select('*'),
    ]);

    const scriptsMap: Record<string, Script> = {};
    (scriptsRes.data || []).forEach((s: Script) => { scriptsMap[s.id] = s; });

    const enriched = (assignmentsRes.data || []).map((a: EditorAssignment) => ({
      ...a,
      script: scriptsMap[a.script_id],
    }));

    setEditors(editorsRes.data || []);
    setAssignments(enriched);
    setIsLoading(false);
  }

  async function addEditor(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const { data, error } = await supabase
        .from('editors')
        .insert({ name: newName.trim(), editor_type: newType, status: 'active' })
        .select()
        .single();
      if (error) throw new Error(error.message);
      setEditors([...editors, data]);
      setNewName('');
      setNewType('freelancer');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setAdding(false);
    }
  }

  async function removeEditor(id: string) {
    if (!confirm('Remove this editor?')) return;
    await supabase.from('editors').delete().eq('id', id);
    setEditors(editors.filter(e => e.id !== id));
  }

  const filtered = filterType === 'all' ? editors : editors.filter(e => e.editor_type === filterType);
  const contractCount = editors.filter(e => e.editor_type === 'contract').length;
  const freelanceCount = editors.filter(e => e.editor_type === 'freelancer').length;

  // All-time stats per editor
  function getEditorStats(name: string) {
    const all = assignments.filter(a => a.editor_name === name);
    const done = all.filter(a => a.status === 'done');
    const active = all.filter(a => a.status !== 'done');
    return { all, done, active };
  }

  // Monthly stats per editor
  function getMonthlyDone(name: string, year: number, month: number) {
    return assignments.filter(a => {
      if (a.editor_name !== name || a.status !== 'done' || !a.completed_at) return false;
      const d = new Date(a.completed_at);
      return d.getFullYear() === year && d.getMonth() === month;
    });
  }

  // Group all-time history by month for an editor
  function groupByMonth(name: string) {
    const done = assignments.filter(a => a.editor_name === name && a.status === 'done' && a.completed_at);
    const groups: Record<string, { label: string; items: EditorAssignment[] }> = {};
    done.forEach(a => {
      const d = new Date(a.completed_at!);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
      if (!groups[key]) groups[key] = { label, items: [] };
      groups[key].items.push(a);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }

  // Monthly summary: all editors sorted by videos done in selected month
  const monthlySummary = editors.map(editor => {
    const done = getMonthlyDone(editor.name, selectedYear, selectedMonth);
    return { editor, done, count: done.length };
  }).sort((a, b) => b.count - a.count);

  const totalThisMonth = monthlySummary.reduce((s, r) => s + r.count, 0);

  // Generate year options (last 3 years)
  const years = Array.from({ length: 3 }, (_, i) => now.getFullYear() - i);

  function exportMonthlyCSV() {
    const monthLabel = `${MONTHS[selectedMonth]} ${selectedYear}`;
    const rows = [
      [`Monthly Report — ${monthLabel}`],
      [],
      ['Editor', 'Type', 'Videos Done', 'Script Titles', 'Pods', 'Completed Dates'],
      ...monthlySummary.map(({ editor, done, count }) => [
        editor.name,
        editor.editor_type === 'contract' ? 'Contract' : 'Freelancer',
        count,
        done.map(a => a.script?.title || 'Unknown').join('; '),
        done.map(a => a.script?.pod || '').filter(Boolean).join('; '),
        done.map(a => a.completed_at ? new Date(a.completed_at).toLocaleDateString('en-IN') : '').join('; '),
      ]),
      [],
      ['Total', '', totalThisMonth],
    ];

    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `editor_report_${MONTHS[selectedMonth]}_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Editors</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage editors and track their monthly output</p>
        </div>
        {/* View switcher */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm font-medium">
          <button
            onClick={() => setView('list')}
            className={`px-4 py-2 flex items-center gap-1.5 transition ${view === 'list' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <Users className="w-3.5 h-3.5" />
            Editors
          </button>
          <button
            onClick={() => setView('monthly')}
            className={`px-4 py-2 flex items-center gap-1.5 border-l border-gray-200 transition ${view === 'monthly' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Monthly Report
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 mb-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex-1 text-center">
          <p className="text-2xl font-bold text-blue-700">{contractCount}</p>
          <p className="text-xs font-semibold text-blue-600 mt-0.5">Contract</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-lg px-4 py-3 flex-1 text-center">
          <p className="text-2xl font-bold text-purple-700">{freelanceCount}</p>
          <p className="text-xs font-semibold text-purple-600 mt-0.5">Freelancer</p>
        </div>
        <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 flex-1 text-center">
          <p className="text-2xl font-bold text-gray-700">{editors.length}</p>
          <p className="text-xs font-semibold text-gray-500 mt-0.5">Total</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex-1 text-center">
          <p className="text-2xl font-bold text-green-700">{assignments.filter(a => a.status === 'done').length}</p>
          <p className="text-xs font-semibold text-green-600 mt-0.5">All-Time Done</p>
        </div>
      </div>

      {/* ─── MONTHLY REPORT VIEW ─── */}
      {view === 'monthly' && (
        <div>
          {/* Month / Year picker */}
          <div className="flex items-center gap-3 mb-5">
            <Calendar className="w-4 h-4 text-gray-400" />
            <select
              value={selectedMonth}
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div className="ml-auto flex items-center gap-3">
              <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-center">
                <span className="text-2xl font-bold text-green-700">{totalThisMonth}</span>
                <span className="text-xs font-semibold text-green-600 ml-1.5">videos delivered</span>
              </div>
              <button
                onClick={exportMonthlyCSV}
                disabled={totalThisMonth === 0}
                className="flex items-center gap-1.5 border border-gray-300 text-gray-600 text-sm font-medium py-2 px-3 rounded-lg hover:bg-gray-50 disabled:opacity-40 transition"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
            </div>
          </div>

          {/* Monthly leaderboard */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {monthlySummary.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
                  <p className="text-gray-400 text-sm">No data for this month.</p>
                </div>
              ) : (
                monthlySummary.map(({ editor, done, count }, idx) => (
                  <div key={editor.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Editor + monthly count row */}
                    <div
                      className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-gray-50 transition"
                      onClick={() => setExpandedEditor(expandedEditor === editor.id + '-monthly' ? null : editor.id + '-monthly')}
                    >
                      <div className="flex items-center gap-3">
                        {/* Rank badge */}
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          idx === 0 && count > 0 ? 'bg-yellow-100 text-yellow-700' :
                          idx === 1 && count > 0 ? 'bg-gray-200 text-gray-600' :
                          idx === 2 && count > 0 ? 'bg-orange-100 text-orange-600' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {count > 0 ? `#${idx + 1}` : '—'}
                        </div>
                        <div className={`w-9 h-9 rounded-full font-bold flex items-center justify-center text-sm ${
                          editor.editor_type === 'contract' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {editor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{editor.name}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              editor.editor_type === 'contract' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {editor.editor_type === 'contract' ? 'Contract' : 'Freelancer'}
                            </span>
                          </div>
                          {count > 0 ? (
                            <p className="text-xs text-gray-400 mt-0.5">
                              {done[0]?.script?.pod && (
                                <span>Pods: {[...new Set(done.map(d => d.script?.pod).filter(Boolean))].join(', ')} · </span>
                              )}
                              Tap to see all {count} {count === 1 ? 'video' : 'videos'}
                            </p>
                          ) : (
                            <p className="text-xs text-gray-300 mt-0.5">No videos this month</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-2xl font-bold ${count > 0 ? 'text-green-600' : 'text-gray-300'}`}>{count}</p>
                          <p className="text-xs text-gray-400">videos</p>
                        </div>
                        {count > 0 && (
                          expandedEditor === editor.id + '-monthly'
                            ? <ChevronUp className="w-4 h-4 text-gray-400" />
                            : <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Expanded — list of videos this month */}
                    {expandedEditor === editor.id + '-monthly' && count > 0 && (
                      <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                          {MONTHS[selectedMonth]} {selectedYear} — {count} {count === 1 ? 'Video' : 'Videos'}
                        </p>
                        <div className="space-y-2">
                          {done.map((a, i) => (
                            <div key={a.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border-l-4 border-l-green-400">
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 font-mono w-5 text-right flex-shrink-0">{i + 1}.</span>
                                <div>
                                  <p className="text-sm font-medium text-gray-900">{a.script?.title || 'Unknown script'}</p>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    {a.script?.pod && (
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                        a.script.pod === 'Pod 1' ? 'bg-blue-100 text-blue-700' :
                                        a.script.pod === 'Pod 2' ? 'bg-purple-100 text-purple-700' :
                                        'bg-orange-100 text-orange-700'
                                      }`}>{a.script.pod}</span>
                                    )}
                                    {a.script?.topic_category && (
                                      <span className="text-xs text-gray-400">{a.script.topic_category}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0 ml-4">
                                <p className="text-xs font-semibold text-green-600">Done</p>
                                {a.completed_at && (
                                  <p className="text-xs text-gray-400">
                                    {new Date(a.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── EDITOR LIST VIEW ─── */}
      {view === 'list' && (
        <>
          {/* Add Editor */}
          <form onSubmit={addEditor} className="flex gap-2 mb-6">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Editor name..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-medium">
              <button
                type="button"
                onClick={() => setNewType('contract')}
                className={`px-3 py-2 transition ${newType === 'contract' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Contract
              </button>
              <button
                type="button"
                onClick={() => setNewType('freelancer')}
                className={`px-3 py-2 transition border-l border-gray-300 ${newType === 'freelancer' ? 'bg-purple-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
              >
                Freelancer
              </button>
            </div>
            <button
              type="submit"
              disabled={adding || !newName.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
            >
              {adding ? '...' : '+ Add'}
            </button>
          </form>

          {/* Filter */}
          <div className="flex gap-2 mb-4">
            {(['all', 'contract', 'freelancer'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-xs font-semibold px-3 py-1.5 rounded-full transition capitalize ${
                  filterType === type
                    ? type === 'contract' ? 'bg-blue-600 text-white'
                      : type === 'freelancer' ? 'bg-purple-600 text-white'
                      : 'bg-gray-900 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'all' ? `All (${editors.length})` : type === 'contract' ? `Contract (${contractCount})` : `Freelancer (${freelanceCount})`}
              </button>
            ))}
          </div>

          {/* Editor List */}
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-gray-300">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No editors yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(editor => {
                const { done, active, all } = getEditorStats(editor.name);
                const thisMonthCount = getMonthlyDone(editor.name, now.getFullYear(), now.getMonth()).length;
                const isExpanded = expandedEditor === editor.id;
                const monthGroups = groupByMonth(editor.name);

                return (
                  <div key={editor.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {/* Editor Row */}
                    <div className="flex items-center justify-between px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full font-bold flex items-center justify-center text-sm ${
                          editor.editor_type === 'contract' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                        }`}>
                          {editor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{editor.name}</p>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              editor.editor_type === 'contract' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {editor.editor_type === 'contract' ? 'Contract' : 'Freelancer'}
                            </span>
                            {active.length > 0 && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-orange-100 text-orange-700">
                                {active.length} active
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            <span className="text-green-600 font-semibold">{done.length} all-time</span>
                            {' · '}
                            <span className="text-blue-600 font-semibold">{thisMonthCount} this month</span>
                            {' · '}{all.length} total assigned
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {all.length > 0 && (
                          <button
                            onClick={() => setExpandedEditor(isExpanded ? null : editor.id)}
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition"
                          >
                            History
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                        <button
                          onClick={() => removeEditor(editor.id)}
                          className="text-gray-300 hover:text-red-500 p-2 rounded-lg hover:bg-red-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* History Panel — grouped by month */}
                    {isExpanded && all.length > 0 && (
                      <div className="border-t border-gray-100 bg-gray-50 px-5 py-4">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">Full History</p>
                          <div className="flex items-center gap-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><CheckCircle className="w-3 h-3 text-green-500" /> {done.length} done</span>
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-orange-500" /> {active.length} active</span>
                          </div>
                        </div>

                        {/* Active (in-progress) scripts */}
                        {active.length > 0 && (
                          <div className="mb-4">
                            <p className="text-xs font-semibold text-orange-600 mb-2 flex items-center gap-1.5">
                              <Clock className="w-3 h-3" /> Currently Assigned
                            </p>
                            <div className="space-y-1.5">
                              {active.map(a => (
                                <div key={a.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border-l-4 border-l-orange-400">
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{a.script?.title || 'Unknown'}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      {a.script?.pod && (
                                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                          a.script.pod === 'Pod 1' ? 'bg-blue-100 text-blue-700' :
                                          a.script.pod === 'Pod 2' ? 'bg-purple-100 text-purple-700' :
                                          'bg-orange-100 text-orange-700'
                                        }`}>{a.script.pod}</span>
                                      )}
                                      <span className="text-xs text-gray-400">
                                        Since {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                      </span>
                                    </div>
                                  </div>
                                  <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-700">In Progress</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Completed — grouped by month */}
                        {monthGroups.length > 0 && (
                          <div className="space-y-4">
                            {monthGroups.map(([key, { label, items }]) => (
                              <div key={key}>
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="text-xs font-bold text-gray-500">{label}</p>
                                  <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                    {items.length} {items.length === 1 ? 'video' : 'videos'}
                                  </span>
                                </div>
                                <div className="space-y-1.5">
                                  {items.map((a, i) => (
                                    <div key={a.id} className="flex items-center justify-between bg-white rounded-lg px-4 py-2.5 border-l-4 border-l-green-400">
                                      <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-300 font-mono w-4 text-right">{i + 1}.</span>
                                        <div>
                                          <p className="text-sm font-medium text-gray-900">{a.script?.title || 'Unknown'}</p>
                                          <div className="flex items-center gap-2 mt-0.5">
                                            {a.script?.pod && (
                                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                                a.script.pod === 'Pod 1' ? 'bg-blue-100 text-blue-700' :
                                                a.script.pod === 'Pod 2' ? 'bg-purple-100 text-purple-700' :
                                                'bg-orange-100 text-orange-700'
                                              }`}>{a.script.pod}</span>
                                            )}
                                            {a.script?.topic_category && (
                                              <span className="text-xs text-gray-400">{a.script.topic_category}</span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="text-right flex-shrink-0 ml-4">
                                        <p className="text-xs font-semibold text-green-600">Done</p>
                                        {a.completed_at && (
                                          <p className="text-xs text-gray-400">
                                            {new Date(a.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
