import React, { useState } from 'react';
import { X, LayoutGrid, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STATUS_META } from '../pages/Tasks';

export default function KanbanBoard({ tasks, role, uid, onClose, onRefresh, usersList }) {
  const navigate = useNavigate();
  const isManagerMode = ['Director', 'Operation Manager', 'Manager - Technical Architect'].includes(role);
  const [filter, setFilter] = useState('mine'); // 'mine' | 'review' | 'all'
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Determine which tasks to display
  const kanbanTasks = tasks.filter((t) => {
    if (isManagerMode && filter === 'all') return true;
    if (filter === 'review') return t.assignedBy === uid || t.reviewer === uid;
    return t.assignedTo === uid; 
  });

  const orderedColumns = ['Open', 'Sent for Review', 'Closed', 'ReOpen'];

  const getColTasks = (col) => kanbanTasks.filter((t) => t.status === col);

  const userName = (id) => {
    const user = usersList?.find((u) => u.id === id);
    return user ? user.name : 'Unknown';
  };

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-[var(--bg-primary)]">
      <style>{`
        @media (max-width: 1024px) {
          .kanban-view-container { display: none !important; }
        }
      `}</style>
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-color)] bg-[var(--bg-secondary)] px-8 py-5">
        <div className="flex items-center gap-4">
          <LayoutGrid size={24} color="var(--accent-primary)" />
          <h1 className="m-0 text-2xl font-bold">Kanban View</h1>
          
          <div className="ml-8 flex rounded-lg bg-[var(--bg-tertiary)] p-1">
            <button 
              onClick={() => setFilter('mine')}
              className="rounded-md border-0 px-4 py-1.5"
              style={{
                background: filter === 'mine' ? 'var(--bg-primary)' : 'transparent',
                color: filter === 'mine' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: filter === 'mine' ? '600' : '400',
                boxShadow: filter === 'mine' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              My Tasks
            </button>
            <button 
              onClick={() => setFilter('review')}
              className="rounded-md border-0 px-4 py-1.5"
              style={{ 
                background: filter === 'review' ? 'var(--bg-primary)' : 'transparent',
                color: filter === 'review' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: filter === 'review' ? '600' : '400',
                boxShadow: filter === 'review' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              Review tasks
            </button>
            {isManagerMode && (
              <button 
                onClick={() => setFilter('all')}
                className="rounded-md border-0 px-4 py-1.5"
                style={{ 
                  background: filter === 'all' ? 'var(--bg-primary)' : 'transparent',
                  color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: filter === 'all' ? '600' : '400',
                  boxShadow: filter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                All Tasks
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2.5">
          <button 
            onClick={handleRefresh} 
            className="btn btn-secondary" 
            title="Refresh tasks"
            disabled={isRefreshing}
            style={{ opacity: isRefreshing ? 0.7 : 1 }}
          >
            <RefreshCw size={16} className={isRefreshing ? "spin-animation" : ""} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
            .spin-animation { animation: spin 1s linear infinite; }
          `}</style>
          <button onClick={onClose} className="border-0 bg-transparent p-2 text-[var(--text-secondary)]">
            <X size={28} />
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="kanban-view-container flex flex-1 gap-6 overflow-x-auto bg-[var(--bg-primary)] px-8 py-6">
        
        {orderedColumns.map(status => {
          const colTasks = getColTasks(status);
          const meta = STATUS_META[status] || STATUS_META['Open'];
          
          return (
            <div 
              key={status}
              className="flex w-[320px] shrink-0 flex-col rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)] p-4"
            >
              <div className="mb-4 flex items-center justify-between border-b border-[var(--border-color)] pb-3">
                <h3 className="m-0 flex items-center gap-2 text-base font-semibold" style={{ color: meta.color }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color }} />
                  {status}
                </h3>
                <span className="rounded-xl bg-[var(--bg-tertiary)] px-2 py-[2px] text-[0.8rem] font-medium text-[var(--text-secondary)]">
                  {colTasks.length}
                </span>
              </div>
              
              <div className="flex flex-col gap-4 overflow-y-auto">
                {colTasks.map(task => (
                  <div 
                    key={task.id}
                    onClick={() => navigate(`/task/${task.id}`, { state: { fromKanban: true } })}
                    className="flex cursor-pointer flex-col gap-2 rounded-lg border border-[var(--border-color)] bg-[var(--bg-primary)] p-4 shadow-[0_2px_4px_rgba(0,0,0,0.02)] transition-all duration-200"
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <h4 className="m-0 text-[0.95rem] font-semibold text-[var(--text-primary)]">{task.title}</h4>
                    
                    <div className="mt-2 flex flex-col gap-1.5 text-[0.8rem] text-[var(--text-secondary)]">
                      {filter === 'mine' && (
                        <>
                          <div className="flex justify-between">
                            <span className="font-medium">By:</span>
                            <span>{userName(task.assignedBy)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Reviewer:</span>
                            <span>{userName(task.reviewer)}</span>
                          </div>
                        </>
                      )}
                      {filter === 'review' && (
                        <>
                          <div className="flex justify-between">
                            <span className="font-medium">By:</span>
                            <span>{userName(task.assignedBy)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">To:</span>
                            <span>{userName(task.assignedTo)}</span>
                          </div>
                        </>
                      )}
                      {filter === 'all' && (
                        <>
                          <div className="flex justify-between">
                            <span className="font-medium">By:</span>
                            <span>{userName(task.assignedBy)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">To:</span>
                            <span>{userName(task.assignedTo)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="font-medium">Reviewer:</span>
                            <span>{userName(task.reviewer)}</span>
                          </div>
                        </>
                      )}
                      
                      <div className="my-1 h-px bg-[var(--border-color)]" />
                      
                      <div className="flex justify-between">
                        <span className="font-medium">On:</span>
                        <span>{task.dateAssigned}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="font-medium">Due:</span>
                        <span>{task.dueDate}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

      </div>
    </div>
  );
}
