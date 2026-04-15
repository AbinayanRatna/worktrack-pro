import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

function InfoRow({ label, children, fullWidth }) {
  return (
    <div style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>{label}</span>
      <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{children}</span>
    </div>
  );
}

export default function TaskSummaryHeader({ task, userName, meta }) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!task) return null;

  return (
    <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', marginBottom: '2rem', overflow: 'hidden' }}>
      
      {/* Clickable Header Area */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          padding: '1.25rem 1.5rem', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          cursor: 'pointer',
          background: isExpanded ? 'transparent' : 'var(--bg-secondary)',
          borderBottom: isExpanded ? '1px solid var(--border-color)' : 'none',
          transition: 'background 0.2s',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <span className="status-badge" style={{ background: meta.bg, color: meta.color, fontSize: '0.75rem', padding: '3px 10px' }}>
              {task.status}
            </span>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>ID: {task.id.substring(0, 6)}</span>
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', margin: 0, color: 'var(--text-primary)' }}>{task.title}</h2>
        </div>
        <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
          {isExpanded ? (
            <>Hold up to Minimize <ChevronUp size={20} /></>
          ) : (
            <>View Task Details <ChevronDown size={20} /></>
          )}
        </div>
      </div>

      {/* Collapsible Content Area */}
      {isExpanded && (
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', fontSize: '0.9rem' }}>
            <InfoRow label="Assigned To">{userName(task.assignedTo)}</InfoRow>
            <InfoRow label="Reviewer"><span style={{ color: 'var(--status-review-color)' }}>{userName(task.reviewer)}</span></InfoRow>
            <InfoRow label="Date Assigned">{task.dateAssigned || '—'}</InfoRow>
            <InfoRow label="Due Date">{task.dueDate || '—'}</InfoRow>
            <InfoRow label="Description" fullWidth>
              <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '400px', overflowY: 'auto', paddingRight: '1rem' }}>
                {task.description}
              </div>
            </InfoRow>
          </div>
        </div>
      )}
    </div>
  );
}
