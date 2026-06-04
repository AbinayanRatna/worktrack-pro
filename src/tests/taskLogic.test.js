import { describe, it, expect } from 'vitest';
import { canDeleteTask } from '../constants/roles';

// ─── Logic helpers (mirrored from Tasks.jsx) ───────────────────────────────

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function isOverdue(task) {
  if (!task.dueDate) return false;
  if (task.status === 'Closed') return false;
  return task.dueDate < todayStr();
}

function isActiveToday(task) {
  const today = todayStr();
  if (task.status === 'Closed') return false;
  return task.dueDate === today || task.dueDate < today;
}

function getDeletedTasks(tasks, uid, role) {
  return tasks.filter((t) =>
    t.status === 'Deleted' && (
      t.assignedTo === uid ||
      t.assignedBy === uid ||
      canDeleteTask(role, t.assignedBy === uid)
    )
  );
}

// Task creation validation (mirrored from TaskDetail.jsx)
function validateTaskForm({ title, assignedTo, taskLeadId, reviewer, finalReviewer, dueDate, dateAssigned, description, isTransferable }) {
  const errors = [];

  if (!title || title.trim() === '')          errors.push('Title is required');
  if (title && title.length > 50)             errors.push('Title must be 50 characters or less');
  if (!description || description.trim() === '') errors.push('Description is required');
  if (!dueDate)                               errors.push('Due date is required');
  if (!dateAssigned)                          errors.push('Date assigned is required');
  if (dueDate && dateAssigned && dueDate < dateAssigned) errors.push('Due date cannot be before assigned date');

  if (isTransferable) {
    if (!taskLeadId)    errors.push('Task lead is required for delegated tasks');
    if (!finalReviewer) errors.push('Final reviewer is required for delegated tasks');
  } else {
    if (!assignedTo)  errors.push('Assigned to is required');
    if (!reviewer)    errors.push('Reviewer is required');
  }

  return errors;
}

// ─── Test Data ─────────────────────────────────────────────────────────────

const PAST_DATE   = '2020-01-01';
const TODAY       = todayStr();
const FUTURE_DATE = '2099-12-31';

const UID     = 'user-1';
const OTHER   = 'user-2';

// ─── isOverdue ─────────────────────────────────────────────────────────────
describe('isOverdue()', () => {
  it('returns true for past due date on Open task', () => {
    expect(isOverdue({ dueDate: PAST_DATE, status: 'Open' })).toBe(true);
  });
  it('returns true for past due date on Sent for Review task', () => {
    expect(isOverdue({ dueDate: PAST_DATE, status: 'Sent for Review' })).toBe(true);
  });
  it('returns true for past due date on ReOpen task', () => {
    expect(isOverdue({ dueDate: PAST_DATE, status: 'ReOpen' })).toBe(true);
  });
  it('returns false for Closed task even if past due date', () => {
    expect(isOverdue({ dueDate: PAST_DATE, status: 'Closed' })).toBe(false);
  });
  it('returns false for future due date', () => {
    expect(isOverdue({ dueDate: FUTURE_DATE, status: 'Open' })).toBe(false);
  });
  it('returns false for task due today', () => {
    expect(isOverdue({ dueDate: TODAY, status: 'Open' })).toBe(false);
  });
  it('returns false if no due date', () => {
    expect(isOverdue({ dueDate: null, status: 'Open' })).toBe(false);
  });
  it('returns false if due date is undefined', () => {
    expect(isOverdue({ status: 'Open' })).toBe(false);
  });
});

// ─── isActiveToday ─────────────────────────────────────────────────────────
describe('isActiveToday()', () => {
  it('returns true for task due today (Open)', () => {
    expect(isActiveToday({ dueDate: TODAY, status: 'Open' })).toBe(true);
  });
  it('returns true for overdue task (past date, not closed)', () => {
    expect(isActiveToday({ dueDate: PAST_DATE, status: 'Open' })).toBe(true);
  });
  it('returns true for overdue task with ReOpen status', () => {
    expect(isActiveToday({ dueDate: PAST_DATE, status: 'ReOpen' })).toBe(true);
  });
  it('returns true for overdue task with Sent for Review status', () => {
    expect(isActiveToday({ dueDate: PAST_DATE, status: 'Sent for Review' })).toBe(true);
  });
  it('returns false for Closed task due today', () => {
    expect(isActiveToday({ dueDate: TODAY, status: 'Closed' })).toBe(false);
  });
  it('returns false for Closed overdue task', () => {
    expect(isActiveToday({ dueDate: PAST_DATE, status: 'Closed' })).toBe(false);
  });
  it('returns false for future task', () => {
    expect(isActiveToday({ dueDate: FUTURE_DATE, status: 'Open' })).toBe(false);
  });
});

// ─── deletedTasks filter ───────────────────────────────────────────────────
describe('deletedTasks filter', () => {
  const deletedTask1 = { id: 't1', status: 'Deleted', assignedTo: UID,   assignedBy: OTHER };
  const deletedTask2 = { id: 't2', status: 'Deleted', assignedTo: OTHER, assignedBy: UID   };
  const deletedTask3 = { id: 't3', status: 'Deleted', assignedTo: OTHER, assignedBy: OTHER };
  const openTask     = { id: 't4', status: 'Open',    assignedTo: UID,   assignedBy: OTHER };

  it('user sees deleted task they are assigned to', () => {
    const result = getDeletedTasks([deletedTask1], UID, 'Software Engineer');
    expect(result).toContain(deletedTask1);
  });
  it('user sees deleted task they created (assignedBy)', () => {
    const result = getDeletedTasks([deletedTask2], UID, 'Software Engineer');
    expect(result).toContain(deletedTask2);
  });
  it('user does NOT see deleted task with no relation', () => {
    const result = getDeletedTasks([deletedTask3], UID, 'Software Engineer');
    expect(result).toHaveLength(0);
  });
  it('Director sees all deleted tasks', () => {
    const result = getDeletedTasks([deletedTask1, deletedTask2, deletedTask3], UID, 'Director');
    expect(result).toHaveLength(3);
  });
  it('Manager - Technical Architect sees all deleted tasks', () => {
    const result = getDeletedTasks([deletedTask1, deletedTask2, deletedTask3], UID, 'Manager - Technical Architect');
    expect(result).toHaveLength(3);
  });
  it('non-deleted tasks are excluded', () => {
    const result = getDeletedTasks([openTask], UID, 'Software Engineer');
    expect(result).toHaveLength(0);
  });
  it('multiple deleted tasks visible to correct user', () => {
    const result = getDeletedTasks([deletedTask1, deletedTask2, deletedTask3], UID, 'Software Engineer');
    expect(result).toContain(deletedTask1);
    expect(result).toContain(deletedTask2);
    expect(result).not.toContain(deletedTask3);
  });
});

// ─── Task Creation Validation ──────────────────────────────────────────────
describe('Task Creation Validation — Non-Delegatable', () => {
  const validTask = {
    title: 'Fix login bug',
    description: 'Fix the eye icon logic',
    assignedTo: 'user-1',
    reviewer: 'user-2',
    dueDate: FUTURE_DATE,
    dateAssigned: TODAY,
    isTransferable: false,
  };

  it('valid task returns no errors', () => {
    expect(validateTaskForm(validTask)).toHaveLength(0);
  });
  it('missing title returns error', () => {
    expect(validateTaskForm({ ...validTask, title: '' })).toContain('Title is required');
  });
  it('title over 50 chars returns error', () => {
    const longTitle = 'A'.repeat(51);
    expect(validateTaskForm({ ...validTask, title: longTitle })).toContain('Title must be 50 characters or less');
  });
  it('title exactly 50 chars is valid', () => {
    const maxTitle = 'A'.repeat(50);
    expect(validateTaskForm({ ...validTask, title: maxTitle })).toHaveLength(0);
  });
  it('missing description returns error', () => {
    expect(validateTaskForm({ ...validTask, description: '' })).toContain('Description is required');
  });
  it('missing assignedTo returns error', () => {
    expect(validateTaskForm({ ...validTask, assignedTo: '' })).toContain('Assigned to is required');
  });
  it('missing reviewer returns error', () => {
    expect(validateTaskForm({ ...validTask, reviewer: '' })).toContain('Reviewer is required');
  });
  it('missing due date returns error', () => {
    expect(validateTaskForm({ ...validTask, dueDate: '' })).toContain('Due date is required');
  });
  it('missing date assigned returns error', () => {
    expect(validateTaskForm({ ...validTask, dateAssigned: '' })).toContain('Date assigned is required');
  });
  it('due date before assigned date returns error', () => {
    expect(validateTaskForm({ ...validTask, dueDate: PAST_DATE, dateAssigned: TODAY }))
      .toContain('Due date cannot be before assigned date');
  });
  it('due date same as assigned date is valid', () => {
    expect(validateTaskForm({ ...validTask, dueDate: TODAY, dateAssigned: TODAY }))
      .toHaveLength(0);
  });
  it('due date after assigned date is valid', () => {
    expect(validateTaskForm({ ...validTask, dueDate: FUTURE_DATE, dateAssigned: TODAY }))
      .toHaveLength(0);
  });
  it('multiple missing fields returns multiple errors', () => {
    const errors = validateTaskForm({ ...validTask, title: '', description: '', assignedTo: '' });
    expect(errors.length).toBeGreaterThan(1);
  });
});

describe('Task Creation Validation — Delegatable', () => {
  const validDelegatedTask = {
    title: 'Implement profile page',
    description: 'Create a user profile page',
    taskLeadId: 'user-lead',
    finalReviewer: 'user-creator',
    dueDate: FUTURE_DATE,
    dateAssigned: TODAY,
    isTransferable: true,
  };

  it('valid delegated task returns no errors', () => {
    expect(validateTaskForm(validDelegatedTask)).toHaveLength(0);
  });
  it('missing taskLeadId returns error', () => {
    expect(validateTaskForm({ ...validDelegatedTask, taskLeadId: '' }))
      .toContain('Task lead is required for delegated tasks');
  });
  it('missing finalReviewer returns error', () => {
    expect(validateTaskForm({ ...validDelegatedTask, finalReviewer: '' }))
      .toContain('Final reviewer is required for delegated tasks');
  });
  it('delegated task does not require assignedTo', () => {
    const errors = validateTaskForm({ ...validDelegatedTask, assignedTo: '' });
    expect(errors).not.toContain('Assigned to is required');
  });
  it('delegated task does not require reviewer field', () => {
    const errors = validateTaskForm({ ...validDelegatedTask, reviewer: '' });
    expect(errors).not.toContain('Reviewer is required');
  });
  it('due date before assigned date returns error on delegated task', () => {
    expect(validateTaskForm({ ...validDelegatedTask, dueDate: PAST_DATE, dateAssigned: TODAY }))
      .toContain('Due date cannot be before assigned date');
  });
  it('title over 50 chars returns error on delegated task', () => {
    const longTitle = 'A'.repeat(51);
    expect(validateTaskForm({ ...validDelegatedTask, title: longTitle }))
      .toContain('Title must be 50 characters or less');
  });
});