'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import type { Script, Assignment } from '@/lib/types';
import { ChevronDown, AlertCircle } from 'lucide-react';

type PipelineStatus = 'pending' | 'assigned' | 'in_progress' | 'received' | 'delivered';

interface PipelineColumn {
  id: PipelineStatus;
  title: string;
  color: string;
  scripts: Script[];
}

export function KanbanBoard() {
  const [columns, setColumns] = useState<PipelineColumn[]>([
    { id: 'pending', title: 'Scripts', color: 'bg-gray-100', scripts: [] },
    { id: 'assigned', title: 'Assigned to Creators', color: 'bg-blue-50', scripts: [] },
    { id: 'in_progress', title: 'Videos In Progress', color: 'bg-yellow-50', scripts: [] },
    { id: 'received', title: 'Editing', color: 'bg-purple-50', scripts: [] },
    { id: 'delivered', title: 'Delivered', color: 'bg-green-50', scripts: [] },
  ]);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedScript, setSelectedScript] = useState<Script | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadScripts();
  }, []);

  async function loadScripts() {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('scripts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group scripts by status
      const grouped = columns.map(col => ({
        ...col,
        scripts: (data || []).filter(s => s.status === col.id),
      }));

      setColumns(grouped);
    } catch (error) {
      console.error('Failed to load scripts:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function isOverdue(deadline?: string): boolean {
    if (!deadline) return false;
    return new Date(deadline) < new Date();
  }

  function daysUntil(deadline?: string): number | null {
    if (!deadline) return null;
    const days = Math.ceil(
      (new Date(deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    return days;
  }

  function getUrgencyColor(deadline?: string): string {
    if (!deadline) return 'text-gray-600';
    const days = daysUntil(deadline);
    if (days === null) return 'text-gray-600';
    if (days < 0) return 'text-red-600 font-semibold';
    if (days <= 2) return 'text-red-500';
    if (days <= 5) return 'text-yellow-600';
    return 'text-green-600';
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Production Pipeline</h2>
          <p className="text-sm text-gray-600 mt-1">Drag and drop scripts between stages</p>
        </div>
        <button
          onClick={() => {
            setSelectedScript(null);
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
        >
          + Add Script
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading pipeline...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-5 gap-4 overflow-x-auto pb-4">
          {columns.map(column => (
            <div
              key={column.id}
              className={`flex-shrink-0 w-80 ${column.color} rounded-lg p-4 min-h-[600px]`}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">
                  {column.title}
                  <span className="ml-2 text-sm bg-gray-300 text-gray-700 px-2 py-1 rounded-full">
                    {column.scripts.length}
                  </span>
                </h3>
              </div>

              <div className="space-y-3">
                {column.scripts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">No scripts here</p>
                  </div>
                ) : (
                  column.scripts.map(script => (
                    <div
                      key={script.id}
                      onClick={() => {
                        setSelectedScript(script);
                        setShowModal(true);
                      }}
                      className="bg-white rounded-lg p-3 cursor-pointer hover:shadow-md transition border-l-4 border-blue-500"
                    >
                      <h4 className="font-medium text-gray-900 truncate">{script.title}</h4>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {script.description || 'No description'}
                      </p>

                      {script.assigned_deadline && (
                        <div className={`text-xs mt-2 flex items-center gap-1 ${getUrgencyColor(script.assigned_deadline)}`}>
                          {isOverdue(script.assigned_deadline) && (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          <span>
                            {isOverdue(script.assigned_deadline) ? (
                              `Overdue by ${Math.abs(daysUntil(script.assigned_deadline) || 0)} days`
                            ) : (
                              `${daysUntil(script.assigned_deadline) || 0} days left`
                            )}
                          </span>
                        </div>
                      )}

                      <div className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-200">
                        Created: {new Date(script.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Script Detail Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedScript ? 'Script Details' : 'Create New Script'}
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-500 hover:text-gray-700 text-2xl"
                >
                  ×
                </button>
              </div>

              {selectedScript ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Title</label>
                    <p className="mt-1 text-gray-900">{selectedScript.title}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Description</label>
                    <p className="mt-1 text-gray-900">{selectedScript.description}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Category</label>
                    <p className="mt-1 text-gray-900">{selectedScript.topic_category}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Status</label>
                    <p className="mt-1 text-gray-900 capitalize">{selectedScript.status}</p>
                  </div>
                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => setShowModal(false)}
                      className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    // Handle create script
                    setShowModal(false);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                      Title
                    </label>
                    <input
                      type="text"
                      id="title"
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Script title"
                    />
                  </div>
                  <div>
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      rows={3}
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="Script details..."
                    />
                  </div>
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                      Category
                    </label>
                    <input
                      type="text"
                      id="category"
                      className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Tutorial, Product Demo"
                    />
                  </div>
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      type="submit"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition"
                    >
                      Create Script
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-2 px-4 rounded-lg transition"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
