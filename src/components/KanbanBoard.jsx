import React, { useState } from 'react';
import { X, Calendar, User, LayoutGrid, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
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

  const columns = ['Open', 'Sent for Review', 'ReOpen', 'Closed']; // "ReOpen" before "Closed" usually visually in workflows. Let's arrange it: Open, Sent for Review, ReOpen, Closed.
  // However user asked "the status should open, sent for review, closed, reopen".
  const orderedColumns = ['Open', 'Sent for Review', 'Closed', 'ReOpen'];

  const getColTasks = (col) => kanbanTasks.filter((t) => t.status === col);

  const userName = (id) => {
    const user = usersList?.find((u) => u.id === id);
    return user ? user.name : 'Unknown';
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'var(--bg-primary)', zIndex: 9999,
      display: 'flex', flexDirection: 'column', 
    }}>
      <style>{`
        @media (max-width: 1024px) {
          .kanban-view-container { display: none !important; }
        }
      `}</style>
      
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1.25rem 2rem', borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-secondary)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <LayoutGrid size={24} color="var(--accent-primary)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', margin: 0 }}>Kanban View</h1>
          
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '4px', marginLeft: '2rem' }}>
            <button 
              onClick={() => setFilter('mine')}
              style={{ 
                padding: '6px 16px', borderRadius: '6px', border: 'none', 
                background: filter === 'mine' ? 'var(--bg-primary)' : 'transparent',
                color: filter === 'mine' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: filter === 'mine' ? '600' : '400',
                boxShadow: filter === 'mine' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer'
              }}
            >
              My Tasks
            </button>
            <button 
              onClick={() => setFilter('review')}
              style={{ 
                padding: '6px 16px', borderRadius: '6px', border: 'none', 
                background: filter === 'review' ? 'var(--bg-primary)' : 'transparent',
                color: filter === 'review' ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: filter === 'review' ? '600' : '400',
                boxShadow: filter === 'review' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer'
              }}
            >
              Review tasks
            </button>
            {isManagerMode && (
              <button 
                onClick={() => setFilter('all')}
                style={{ 
                  padding: '6px 16px', borderRadius: '6px', border: 'none', 
                  background: filter === 'all' ? 'var(--bg-primary)' : 'transparent',
                  color: filter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: filter === 'all' ? '600' : '400',
                  boxShadow: filter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer'
                }}
              >
                All Tasks
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button 
            onClick={handleRefresh} 
            className="btn btn-secondary" 
            title="Refresh tasks"
            disabled={isRefreshing}
            style={{ opacity: isRefreshing ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <RefreshCw size={16} className={isRefreshing ? "spin-animation" : ""} />
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
            .spin-animation { animation: spin 1s linear infinite; }
          `}</style>
          <button onClick={onClose} style={{ 
            background: 'transparent', border: 'none', cursor: 'pointer', 
            color: 'var(--text-secondary)', padding: '0.5rem'
          }}>
            <X size={28} />
          </button>
        </div>
      </div>

      {/* Board */}
      <div style={{
        flex: 1, padding: '1.5rem 2rem', display: 'flex', gap: '1.5rem', 
        overflowX: 'auto', backgroundColor: 'var(--bg-primary)'
      }} className="kanban-view-container">
        
        {orderedColumns.map(status => {
          const colTasks = getColTasks(status);
          const meta = STATUS_META[status] || STATUS_META['Open'];
          
          return (
            <div 
              key={status}
              style={{
                flex: '0 0 320px', display: 'flex', flexDirection: 'column',
                backgroundColor: 'var(--bg-secondary)', borderRadius: '12px',
                padding: '1rem', border: '1px solid var(--border-color)',
              }}
            >
              <div style={{ 
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--border-color)' 
              }}>
                <h3 style={{ 
                  fontSize: '1rem', fontWeight: '600', margin: 0, 
                  color: meta.color, display: 'flex', alignItems: 'center', gap: '0.5rem' 
                }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: meta.color }} />
                  {status}
                </h3>
                <span style={{ 
                  background: 'var(--bg-tertiary)', borderRadius: '12px', 
                  padding: '2px 8px', fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)' 
                }}>
                  {colTasks.length}
                </span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
                {colTasks.map(task => (
                  <div 
                    key={task.id}
                    onClick={() => navigate(`/task/${task.id}`, { state: { fromKanban: true } })}
                    style={{
                      background: 'var(--bg-primary)', padding: '1rem', borderRadius: '8px',
                      border: '1px solid var(--border-color)', boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                      cursor: 'pointer', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', gap: '0.5rem'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-primary)' }}>{task.title}</h4>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                      {filter === 'mine' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>By:</span>
                            <span>{userName(task.assignedBy)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>Reviewer:</span>
                            <span>{userName(task.reviewer)}</span>
                          </div>
                        </>
                      )}
                      {filter === 'review' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>By:</span>
                            <span>{userName(task.assignedBy)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>To:</span>
                            <span>{userName(task.assignedTo)}</span>
                          </div>
                        </>
                      )}
                      {filter === 'all' && (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>By:</span>
                            <span>{userName(task.assignedBy)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>To:</span>
                            <span>{userName(task.assignedTo)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontWeight: 500 }}>Reviewer:</span>
                            <span>{userName(task.reviewer)}</span>
                          </div>
                        </>
                      )}
                      
                      <div style={{ height: '1px', background: 'var(--border-color)', margin: '0.2rem 0' }} />
                      
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500 }}>On:</span>
                        <span>{task.dateAssigned}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500 }}>Due:</span>
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
