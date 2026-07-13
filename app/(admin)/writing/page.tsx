'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Check, RefreshCw, PenLine, X } from 'lucide-react';

interface Script {
  id: string;
  title: string;
  pod?: string | null;
  client?: string | null;
  writing_status?: string | null;
  created_at: string;
}

interface Client { id: string; name: string; }
interface Pod    { id: string; name: string; color: string; }

const POD_COLOR_MAP: Record<string, string> = {
  blue:   'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  orange: 'bg-orange-100 text-orange-700',
  teal:   'bg-teal-100 text-teal-700',
  pink:   'bg-pink-100 text-pink-700',
  green:  'bg-green-100 text-green-700',
};

export default function WritingPage() {
  const [scripts, setScripts]   = useState<Script[]>([]);
  const [clients, setClients]   = useState<Client[]>([]);
  const [pods, setPods]         = useState<Pod[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [filterPod, setFilterPod]     = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  // Create form
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [formData, setFormData]   = useState({ batchNo: '', scriptNos: [''], pod: '', client: '' });
  const [newClient, setNewClient] = useState('');

  // Marking written
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setIsLoading(true);
    const [scriptsRes, clientsRes, podsRes] = await Promise.all([
      supabase.from('scripts').select('id, title, pod, client, writing_status, created_at')
        .not('writing_status', 'is', null)
        .order('created_at', { ascending: false }),
      supabase.from('clients').select('*').order('name'),
      supabase.from('pods').select('*').order('created_at'),
    ]);
    setScripts(scriptsRes.data || []);
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
      pod: formData.pod,
      client: formData.client || null,
      status: 'pending' as const,
      writing_status: 'writing',
    }));
    await supabase.from('scripts').insert(rows);
    setFormData({ batchNo: '', scriptNos: [''], pod: '', client: '' });
    setShowForm(false);
    setSaving(false);
    await loadData();
  }

  async function markWritten(script: Script) {
    setMarkingId(script.id);
    await supabase.from('scripts').update({ writing_status: 'written' }).eq('id', script.id);
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, writing_status: 'written' } : s));
    setMarkingId(null);
  }

  async function markWriting(script: Script) {
    setMarkingId(script.id);
    await supabase.from('scripts').update({ writing_status: 'writing' }).eq('id', script.id);
    setScripts(prev => prev.map(s => s.id === script.id ? { ...s, writing_status: 'writing' } : s));
    setMarkingId(null);
  }

  const writingCount = scripts.filter(s => s.writing_status === 'writing').length;
  const writtenCount = scripts.filter(s => s.writing_status === 'written').length;

  const filtered = scripts
    .filter(s => filterPod === 'All' || s.pod === filterPod)
    .filter(s => filterStatus === 'All' || s.writing_status === filterStatus);

  return (
    <div className="p-8 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Writing</h1>
          <p className="text-gray-400 text-sm mt-0.5">Track which scripts are being written and mark them done</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-lg transition"
          >
            <Plus className="w-4 h-4" />New Writing Tickets
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Tickets</p>
          <p className="text-4xl font-bold text-gray-900 mt-2">{scripts.length}</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Being Written</p>
          <p className="text-4xl font-bold text-amber-600 mt-2">{writingCount}</p>
          <p className="text-xs text-amber-500 mt-1">Pending from pod leaders</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-100 shadow-sm p-5">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wider">Written — Ready for Editor</p>
          <p className="text-4xl font-bold text-green-600 mt-2">{writtenCount}</p>
          <p className="text-xs text-green-500 mt-1">Ready to assign to editors</p>
        </div>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-blue-200 shadow-sm p-5 mb-6">
          <h2 className="font-bold text-gray-900 mb-4">Create Writing Tickets</h2>
          <form onSubmit={handleCreate}>
            <div className="flex items-end gap-3 mb-4">
              <div className="w-40">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Batch No. *</label>
                <input
                  type="text" required autoFocus
                  value={formData.batchNo}
                  onChange={e => setFormData({ ...formData, batchNo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g. B19"
                />
              </div>
              <div className="w-44">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Pod *</label>
                <select
                  required value={formData.pod}
                  onChange={e => setFormData({ ...formData, pod: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select pod...</option>
                  {pods.map(p => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-semibold text-gray-600 mb-1">Client</label>
                <div className="flex gap-2">
                  <select
                    value={formData.client}
                    onChange={e => setFormData({ ...formData, client: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No client</option>
                    {clients.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                  </select>
                  <input
                    type="text" value={newClient}
                    onChange={e => setNewClient(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addClient(); } }}
                    placeholder="New client..."
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                  />
                  <button type="button" onClick={addClient} disabled={!newClient.trim()} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition whitespace-nowrap">
                    + Add
                  </button>
                </div>
              </div>
            </div>

            {/* Script Numbers */}
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Script Numbers * <span className="font-normal text-gray-400">— one per row</span>
              </label>
              {formData.batchNo && formData.scriptNos.filter(Boolean).length > 0 && (
                <p className="text-xs text-blue-600 font-medium mb-2">
                  {formData.scriptNos.filter(n => n.trim()).length} ticket{formData.scriptNos.filter(n => n.trim()).length > 1 ? 's' : ''} will be created as "writing"
                </p>
              )}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {formData.scriptNos.map((no, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{idx + 1}.</span>
                    <div className="flex-1 relative">
                      <input
                        type="text"
                        value={no}
                        placeholder="e.g. S16"
                        autoFocus={idx === formData.scriptNos.length - 1 && idx > 0}
                        onChange={e => { const u = [...formData.scriptNos]; u[idx] = e.target.value; setFormData({ ...formData, scriptNos: u }); }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { e.preventDefault(); setFormData({ ...formData, scriptNos: [...formData.scriptNos, ''] }); }
                          if (e.key === 'Backspace' && !no && formData.scriptNos.length > 1) {
                            const u = formData.scriptNos.filter((_, i) => i !== idx);
                            setFormData({ ...formData, scriptNos: u });
                          }
                        }}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                      />
                      {formData.batchNo && no.trim() && (
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                          → {[formData.client, `Batch${formData.batchNo}`, `Script${no.trim()}`].filter(Boolean).join('_')}
                        </span>
                      )}
                    </div>
                    {formData.scriptNos.length > 1 && (
                      <button type="button" onClick={() => setFormData({ ...formData, scriptNos: formData.scriptNos.filter((_, i) => i !== idx) })} className="text-gray-300 hover:text-red-400 flex-shrink-0">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button type="button" onClick={() => setFormData({ ...formData, scriptNos: [...formData.scriptNos, ''] })} className="mt-2 text-xs text-blue-600 font-medium hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" />Add another script
              </button>
              <p className="text-xs text-gray-400 mt-1">Tip: press Enter on any row to quickly add the next one</p>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !formData.batchNo.trim() || !formData.pod || formData.scriptNos.filter(n => n.trim()).length === 0}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white text-sm font-medium py-2 px-5 rounded-lg transition"
              >
                {saving ? 'Creating…' : `Create ${formData.scriptNos.filter(n => n.trim()).length || ''} Ticket${formData.scriptNos.filter(n => n.trim()).length > 1 ? 's' : ''}`}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-500 text-sm font-medium py-2 px-4 rounded-lg hover:bg-gray-100 transition">
                Cancel
              </button>
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
            <button key={p.id} onClick={() => setFilterPod(p.name)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterPod === p.name ? `text-white ${p.color === 'blue' ? 'bg-blue-600' : p.color === 'purple' ? 'bg-purple-600' : p.color === 'orange' ? 'bg-orange-500' : p.color === 'teal' ? 'bg-teal-600' : p.color === 'pink' ? 'bg-pink-500' : 'bg-green-600'}` : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {p.name} ({scripts.filter(s => s.pod === p.name).length})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-400 font-medium w-10">Status</span>
          {[{ val: 'All', label: 'All' }, { val: 'writing', label: '✍️ Writing' }, { val: 'written', label: '✓ Written' }].map(s => (
            <button key={s.val} onClick={() => setFilterStatus(s.val)} className={`text-xs font-semibold px-3 py-1.5 rounded-full transition ${filterStatus === s.val ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Script list */}
      {isLoading ? (
        <div className="flex justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-300 py-16 text-center">
          <PenLine className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 font-medium">No writing tickets yet</p>
          <p className="text-gray-300 text-sm mt-1">Click "New Writing Tickets" to create some</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Script</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Pod</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-3 py-3 w-36"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(script => {
                const isWritten = script.writing_status === 'written';
                const isMarking = markingId === script.id;
                const podObj = pods.find(p => p.name === script.pod);
                return (
                  <tr key={script.id} className={`transition ${isWritten ? 'bg-green-50/30' : 'hover:bg-gray-50'}`}>
                    <td className="px-4 py-3">
                      <p className={`text-sm font-medium ${isWritten ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{script.title}</p>
                    </td>
                    <td className="px-3 py-3">
                      {script.client ? (
                        <span className="text-xs font-semibold px-2 py-1 rounded-full bg-teal-50 text-teal-700 border border-teal-200">{script.client}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3">
                      {script.pod ? (
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full ${POD_COLOR_MAP[podObj?.color || 'blue'] || 'bg-gray-100 text-gray-700'}`}>{script.pod}</span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {new Date(script.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isWritten ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {isWritten ? '✓ Written' : '✍️ Writing'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {isWritten ? (
                        <button
                          onClick={() => markWriting(script)}
                          disabled={!!isMarking}
                          className="text-xs text-gray-400 hover:text-amber-600 font-medium px-3 py-1.5 rounded-lg hover:bg-amber-50 transition disabled:opacity-40"
                        >
                          {isMarking ? '…' : '↩ Undo'}
                        </button>
                      ) : (
                        <button
                          onClick={() => markWritten(script)}
                          disabled={!!isMarking}
                          className="flex items-center gap-1.5 text-xs font-semibold text-white bg-green-500 hover:bg-green-600 px-3 py-1.5 rounded-lg transition disabled:opacity-40 ml-auto"
                        >
                          {isMarking ? '…' : <><Check className="w-3.5 h-3.5" />Mark Written</>}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
