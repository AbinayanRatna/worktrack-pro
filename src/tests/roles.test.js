import { describe, it, expect } from 'vitest';
import {
  canCreateTask,
  canChangeRole,
  canDeleteTask,
  canCloseOrReopen,
  canChangeDueDate,
  isManager,
  requiresDailyTask,
  getAssignableUsers,
  MANAGER_ROLES,
  DAILY_TASK_ROLES,
  ASSIGNABLE_ROLES,
} from '../constants/roles';

// ─── isManager ─────────────────────────────────────────────────────────────
describe('isManager', () => {
  it('returns true for Director', () => {
    expect(isManager('Director')).toBe(true);
  });
  it('returns true for Operation Manager', () => {
    expect(isManager('Operation Manager')).toBe(true);
  });
  it('returns true for Manager - Technical Architect', () => {
    expect(isManager('Manager - Technical Architect')).toBe(true);
  });
  it('returns false for Software Engineer', () => {
    expect(isManager('Software Engineer')).toBe(false);
  });
  it('returns false for Associate Software Engineer', () => {
    expect(isManager('Associate Software Engineer')).toBe(false);
  });
  it('returns false for SE Intern', () => {
    expect(isManager('SE Intern')).toBe(false);
  });
});

// ─── requiresDailyTask ─────────────────────────────────────────────────────
describe('requiresDailyTask', () => {
  it('returns true for Software Engineer', () => {
    expect(requiresDailyTask('Software Engineer')).toBe(true);
  });
  it('returns true for Associate Software Engineer', () => {
    expect(requiresDailyTask('Associate Software Engineer')).toBe(true);
  });
  it('returns true for SE Intern', () => {
    expect(requiresDailyTask('SE Intern')).toBe(true);
  });
  it('returns false for Director', () => {
    expect(requiresDailyTask('Director')).toBe(false);
  });
  it('returns false for Operation Manager', () => {
    expect(requiresDailyTask('Operation Manager')).toBe(false);
  });
  it('returns false for Manager - Technical Architect', () => {
    expect(requiresDailyTask('Manager - Technical Architect')).toBe(false);
  });
});

// ─── canCreateTask ─────────────────────────────────────────────────────────
describe('canCreateTask', () => {
  it('returns true for all roles', () => {
    const roles = [
      'Director', 'Operation Manager', 'Manager - Technical Architect',
      'Software Engineer', 'Associate Software Engineer', 'SE Intern',
    ];
    roles.forEach(role => {
      expect(canCreateTask(role)).toBe(true);
    });
  });
});

// ─── canChangeRole ─────────────────────────────────────────────────────────
describe('canChangeRole', () => {
  it('returns true for Director', () => {
    expect(canChangeRole('Director')).toBe(true);
  });
  it('returns true for Operation Manager', () => {
    expect(canChangeRole('Operation Manager')).toBe(true);
  });
  it('returns true for Manager - Technical Architect', () => {
    expect(canChangeRole('Manager - Technical Architect')).toBe(true);
  });
  it('returns false for Software Engineer', () => {
    expect(canChangeRole('Software Engineer')).toBe(false);
  });
  it('returns false for SE Intern', () => {
    expect(canChangeRole('SE Intern')).toBe(false);
  });
});

// ─── canDeleteTask ─────────────────────────────────────────────────────────
describe('canDeleteTask', () => {
  it('returns true for Director regardless of assigner', () => {
    expect(canDeleteTask('Director', false)).toBe(true);
  });
  it('returns true for Manager - Technical Architect', () => {
    expect(canDeleteTask('Manager - Technical Architect', false)).toBe(true);
  });
  it('returns true for task assigner (any role)', () => {
    expect(canDeleteTask('Software Engineer', true)).toBe(true);
  });
  it('returns true for SE Intern who is assigner', () => {
    expect(canDeleteTask('SE Intern', true)).toBe(true);
  });
  it('returns false for Software Engineer who is not assigner', () => {
    expect(canDeleteTask('Software Engineer', false)).toBe(false);
  });
  it('returns false for Operation Manager who is not assigner', () => {
    expect(canDeleteTask('Operation Manager', false)).toBe(false);
  });
  it('returns false for SE Intern who is not assigner', () => {
    expect(canDeleteTask('SE Intern', false)).toBe(false);
  });
});

// ─── canCloseOrReopen ──────────────────────────────────────────────────────
describe('canCloseOrReopen', () => {
  it('returns true if user is the reviewer', () => {
    expect(canCloseOrReopen('Software Engineer', true, false)).toBe(true);
  });
  it('returns true if user is the assigner', () => {
    expect(canCloseOrReopen('SE Intern', false, true)).toBe(true);
  });
  it('returns true if user is both reviewer and assigner', () => {
    expect(canCloseOrReopen('Director', true, true)).toBe(true);
  });
  it('returns false if neither reviewer nor assigner', () => {
    expect(canCloseOrReopen('Software Engineer', false, false)).toBe(false);
  });
  it('returns false for Director if neither reviewer nor assigner', () => {
    expect(canCloseOrReopen('Director', false, false)).toBe(false);
  });
});

// ─── canChangeDueDate ──────────────────────────────────────────────────────
describe('canChangeDueDate', () => {
  it('returns true for Director', () => {
    expect(canChangeDueDate('Director', false)).toBe(true);
  });
  it('returns true for Operation Manager', () => {
    expect(canChangeDueDate('Operation Manager', false)).toBe(true);
  });
  it('returns true for Manager - Technical Architect', () => {
    expect(canChangeDueDate('Manager - Technical Architect', false)).toBe(true);
  });
  it('returns true for reviewer regardless of role', () => {
    expect(canChangeDueDate('SE Intern', true)).toBe(true);
  });
  it('returns false for Software Engineer who is not reviewer', () => {
    expect(canChangeDueDate('Software Engineer', false)).toBe(false);
  });
  it('returns false for SE Intern who is not reviewer', () => {
    expect(canChangeDueDate('SE Intern', false)).toBe(false);
  });
});

// ─── getAssignableUsers ────────────────────────────────────────────────────
describe('getAssignableUsers', () => {
  const allUsers = [
    { id: 'u1', role: 'Director' },
    { id: 'u2', role: 'Operation Manager' },
    { id: 'u3', role: 'Manager - Technical Architect' },
    { id: 'u4', role: 'Software Engineer' },
    { id: 'u5', role: 'Associate Software Engineer' },
    { id: 'u6', role: 'SE Intern' },
  ];

  it('Director can assign to everyone except Operation Manager', () => {
    const result = getAssignableUsers(allUsers, { id: 'u1', role: 'Director' });
    expect(result.some(u => u.role === 'Operation Manager')).toBe(false);
    expect(result.length).toBe(5);
  });

  it('Operation Manager can assign to everyone except Operation Manager', () => {
    const result = getAssignableUsers(allUsers, { id: 'u2', role: 'Operation Manager' });
    expect(result.some(u => u.role === 'Operation Manager')).toBe(false);
    expect(result.length).toBe(5);
  });

  it('Software Engineer can assign to themselves, ASE, and SE Intern', () => {
    const result = getAssignableUsers(allUsers, { id: 'u4', role: 'Software Engineer' });
    const roles = result.map(u => u.role);
    expect(roles).toContain('Software Engineer');
    expect(roles).toContain('Associate Software Engineer');
    expect(roles).toContain('SE Intern');
    expect(roles).not.toContain('Director');
    expect(roles).not.toContain('Operation Manager');
  });

  it('SE Intern can only assign to themselves', () => {
    const result = getAssignableUsers(allUsers, { id: 'u6', role: 'SE Intern' });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('u6');
  });

  it('returns empty array if currentUser is null', () => {
    expect(getAssignableUsers(allUsers, null)).toHaveLength(0);
  });
});