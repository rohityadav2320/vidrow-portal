'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Layers, Building2, Pencil, Check, X } from 'lucide-react';

interface Pod {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

interface Client {
  id: string;
  name: string;
  created_at: string;
}

const COLOR_OPTIONS = [
  { value: 'blue',   label: 'Blue',   bg: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-500' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-500' },
  { value: 'teal',   label: 'Teal',   bg: 'bg-teal-500' },
  { value: 'pink',   label: 'Pink',   bg: 'bg-pink-500' },
  { value: 'green',  label: 'Green',  bg: 'bg-green-500' },
];

export const POD_COLOR_CLASSES: Record<string, { badge: string; dot: string }> = {
  blue:   { badge: 'bg-blue-100 text-blue-800 border-blue-300',     dot: 'bg-blue-500' },
  purple: { badge: 'bg-purple-100 text-purple-800 border-purple-300', dot: 'bg-purple-500' },
  orange: { badge: 'bg-orange-100 text-orange-800 border-orange-300', dot: 'bg-orange-500' },
  teal:   { badge: 'bg-teal-100 text-teal-800 border-teal-300',     dot: 'bg-teal-500' },
  pink:   { badge: 'bg-pink-100 text-pink-800 border-pink-300',     dot: 'bg-pink-500' },
  green:  { badge: 'bg-green-100 text-green-800 border-green-300',  dot: 'bg-green-500' },
};

export default function SettingsPage() {
  const [pods, setPods] = useState<Pod[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Pod form
  const [newPodName, setNewPodName] = useState('');
  const [newPodColor, setNewPodColor] = useState('blue');
  const [addingPod, setAddingPod] = useState(false);

  // Pod inline edit
  const [editingPodId, setEditingPodId] = useState<string | null>(null);
  const [editPodName, setEditPodName] = useState('');
  const [editPodColor, setEditPodColor] = useState('blue');
  const [savingPod, setSavingPod] = useState(false);

  // Client form
  const [newClientName, setNewClientName] = useState('');
  const [addingClient, setAddingClient] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setIsLoading(true);
    const [podsRes, clientsRes] = await Promise.all([
      supabase.from('pods').select('*').order('created_at'),
      supabase.from('clients').select('*').order('name'),
    ]);
    setPods(podsRes.data || []);
    setClients(clientsRes.data || []);
    setIsLoading(false);
  }

  async function handleAddPod(e: React.FormEvent) {
    e.preventDefault();
    const name = newPodName.trim();
    if (!name) return;
    setAddingPod(true);
    try {
      const { data, error } = await supabase
        .from('pods').insert({ name, color: newPodColor }).select().single();
      if (error) {
        if (error.code === '23505') alert(`Pod "${name}" already exists.`);
        else throw error;
        return;
      }
      setPods(prev => [...prev, data]);
      setNewPodName('');
      setNewPodColor('blue');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setAddingPod(false);
    }
  }

  async function handleDeletePod(pod: Pod) {
    const { count } = await supabase
      .from('scripts').select('id', { count: 'exact', head: true }).eq('pod', pod.name);
    const scriptCount = count || 0;
    const msg = scriptCount > 0
      ? `"${pod.name}" is used in ${scriptCount} script(s). Deleting will remove the pod from those scripts. Continue?`
      : `Delete pod "${pod.name}"?`;
    if (!confirm(msg)) return;
    if (scriptCount > 0) {
      await supabase.from('scripts').update({ pod: null }).eq('pod', pod.name);
    }
    await supabase.from('pods').delete().eq('id', pod.id);
    setPods(prev => prev.filter(p => p.id !== pod.id));
  }

  function startEditPod(pod: Pod) {
    setEditingPodId(pod.id);
    setEditPodName(pod.name);
    setEditPodColor(pod.color);
  }

  async function handleSavePod(pod: Pod) {
    const name = editPodName.trim();
    if (!name) return;
    if (name === pod.name && editPodColor === pod.color) { setEditingPodId(null); return; }
    setSavingPod(true);
    try {
      const { error } = await supabase
        .from('pods').update({ name, color: editPodColor }).eq('id', pod.id);
      if (error) {
        if (error.code === '23505') alert(`Pod "${name}" already exists.`);
        else throw error;
        return;
      }
      // Also update pod name on all scripts that used the old name
      if (name !== pod.name) {
        await supabase.from('scripts').update({ pod: name }).eq('pod', pod.name);
        await supabase.from('editors').update({ pod: name }).eq('pod', pod.name);
      }
      setPods(prev => prev.map(p => p.id === pod.id ? { ...p, name, color: editPodColor } : p));
      setEditingPodId(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSavingPod(false);
    }
  }

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    const name = newClientName.trim();
    if (!name) return;
    setAddingClient(true);
    try {
      const { data, error } = await supabase
        .from('clients').insert({ name }).select().single();
      if (error) {
        if (error.code === '23505') alert(`Client "${name}" already exists.`);
        else throw error;
        return;
      }
      setClients(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setNewClientName('');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setAddingClient(false);
    }
  }

  async function handleDeleteClient(client: Client) {
    const { count } = await supabase
      .from('scripts').select('id', { count: 'exact', head: true }).eq('client', client.name);
    if ((count || 0) > 0) {
      if (!confirm(`"${client.name}" is used in ${count} script(s). Delete anyway? Scripts will still show the client name.`)) return;
    } else {
      if (!confirm(`Delete client "${client.name}"?`)) return;
    }
    await supabase.from('clients').delete().eq('id', client.id);
    setClients(prev => prev.filter(c => c.id !== client.id));
  }

  if (isLoading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-400 text-sm mt-0.5">Manage pods and clients used across the portal</p>
      </div>

      {/* ── PODS ── */}
      <section className="mb-10">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-bold text-gray-900">Pods</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{pods.length}</span>
        </div>

        {/* Existing pods */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          {pods.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No pods yet — add one below</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {pods.map(pod => {
                const colors = POD_COLOR_CLASSES[pod.color] || POD_COLOR_CLASSES.blue;
                const isEditing = editingPodId === pod.id;

                if (isEditing) {
                  return (
                    <div key={pod.id} className="flex items-center gap-3 px-4 py-3 bg-blue-50/60">
                      <input
                        autoFocus
                        value={editPodName}
                        onChange={e => setEditPodName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSavePod(pod); if (e.key === 'Escape') setEditingPodId(null); }}
                        className="flex-1 px-2.5 py-1.5 border border-blue-300 rounded-lg text-sm text-gray-900 bg-white focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-1.5">
                        {COLOR_OPTIONS.map(c => (
                          <button
                            key={c.value}
                            type="button"
                            onClick={() => setEditPodColor(c.value)}
                            className={`w-5 h-5 rounded-full ${c.bg} transition ring-offset-1 ${editPodColor === c.value ? 'ring-2 ring-gray-800 scale-110' : 'hover:scale-105'}`}
                            title={c.label}
                          />
                        ))}
                      </div>
                      <button
                        onClick={() => handleSavePod(pod)}
                        disabled={savingPod || !editPodName.trim()}
                        className="p-1.5 rounded bg-green-500 hover:bg-green-600 disabled:opacity-40 text-white transition"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingPodId(null)}
                        className="p-1.5 rounded text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                }

                return (
                  <div key={pod.id} className="flex items-center gap-3 px-5 py-3.5">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${colors.dot}`} />
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${colors.badge}`}>
                      {pod.name}
                    </span>
                    <span className="flex-1 text-xs text-gray-400 capitalize">{pod.color}</span>
                    <button
                      onClick={() => startEditPod(pod)}
                      className="text-gray-300 hover:text-blue-500 transition"
                      title="Edit pod"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeletePod(pod)}
                      className="text-gray-300 hover:text-red-500 transition"
                      title="Delete pod"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add pod form */}
        <form onSubmit={handleAddPod} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add New Pod</p>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Pod Name</label>
              <input
                type="text"
                value={newPodName}
                onChange={e => setNewPodName(e.target.value)}
                placeholder="e.g. Pod 4"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Color</label>
              <div className="flex gap-1.5">
                {COLOR_OPTIONS.map(c => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setNewPodColor(c.value)}
                    className={`w-7 h-7 rounded-full ${c.bg} transition ring-offset-2 ${newPodColor === c.value ? 'ring-2 ring-gray-800 scale-110' : 'hover:scale-105'}`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>
            <button
              type="submit"
              disabled={addingPod || !newPodName.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium py-2 px-4 rounded-lg transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {addingPod ? 'Adding...' : 'Add Pod'}
            </button>
          </div>
        </form>
      </section>

      {/* ── CLIENTS ── */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="w-5 h-5 text-gray-500" />
          <h2 className="text-lg font-bold text-gray-900">Clients</h2>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{clients.length}</span>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          {clients.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No clients yet</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {clients.map(client => (
                <div key={client.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="flex-1 text-sm font-medium text-gray-800">{client.name}</span>
                  <button
                    onClick={() => handleDeleteClient(client)}
                    className="text-gray-300 hover:text-red-500 transition"
                    title="Delete client"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add client form */}
        <form onSubmit={handleAddClient} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Add New Client</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={newClientName}
              onChange={e => setNewClientName(e.target.value)}
              placeholder="Client name..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={addingClient || !newClientName.trim()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm font-medium py-2 px-4 rounded-lg transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              {addingClient ? 'Adding...' : 'Add Client'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
