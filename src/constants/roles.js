// ─── Role Definitions ──────────────────────────────────────────────────────
export const ROLES = [
  'Director',
  'Operation Manager',
  'Manager - Technical Architect',
  'Software Engineer',
  'Associate Software Engineer',
  'SE Intern',
];

// ─── Role Groupings ────────────────────────────────────────────────────────
/** Roles with management/overview access */
export const MANAGER_ROLES = [
  'Director',
  'Operation Manager',
  'Manager - Technical Architect',
];

/** Roles that can approve/reject signup requests */
export const APPROVER_ROLES = [
  'Director',
  'Operation Manager',
  'Manager - Technical Architect',
];

/** Roles that can change other users' roles */
export const ROLE_CHANGER_ROLES = ['Director', 'Manager - Technical Architect'];

/** Roles that can assign tasks to any user (excluding Op Manager) */
export const FULL_ASSIGN_ROLES = ['Director', 'Manager - Technical Architect'];

/** Roles where daily task tracking is enforced ("No Task Today" alerts) */
export const DAILY_TASK_ROLES = [
  'Software Engineer',
  'Associate Software Engineer',
  'SE Intern',
];

/** Roles that can close or reopen tasks (beyond the assigned reviewer) */
export const CLOSE_REOPEN_ROLES = ['Director', 'Manager - Technical Architect'];

/** Roles that can change dueDate after task creation (beyond reviewer) */
export const DATE_CHANGE_ROLES = ['Director', 'Manager - Technical Architect'];

/** Roles that can delete tasks (beyond reviewer) */
export const TASK_DELETE_ROLES = ['Director', 'Manager - Technical Architect'];

/** Roles that can BE assigned tasks (Op Manager excluded) */
export const ASSIGNABLE_ROLES = [
  'Director',
  'Manager - Technical Architect',
  'Software Engineer',
  'Associate Software Engineer',
  'SE Intern',
];

/** Additional roles a Software Engineer can assign tasks to (besides themselves) */
export const SE_ASSIGNABLE_TO = ['Associate Software Engineer', 'SE Intern'];

// ─── Permission Helper Functions ───────────────────────────────────────────

/** Can this role create/assign tasks at all? */
export function canCreateTask(role) {
  return role !== 'Operation Manager';
}

/**
 * Returns the list of users this user can assign a task TO.
 * @param {Array} users  - all users from Firestore
 * @param {{ id: string, role: string }} currentUser
 */
export function getAssignableUsers(users, currentUser) {
  if (!currentUser) return [];
  const { role, id } = currentUser;
  if (role === 'Operation Manager') return [];
  if (FULL_ASSIGN_ROLES.includes(role)) {
    return users.filter((u) => u.role !== 'Operation Manager');
  }
  if (role === 'Software Engineer') {
    return users.filter(
      (u) => u.id === id || SE_ASSIGNABLE_TO.includes(u.role)
    );
  }
  // ASE, SE Intern → only themselves
  return users.filter((u) => u.id === id);
}

/** Can this role change another user's role? */
export function canChangeRole(role) {
  return ROLE_CHANGER_ROLES.includes(role);
}

/** Can this role/user delete a task? */
export function canDeleteTask(role, isReviewer) {
  return TASK_DELETE_ROLES.includes(role) || isReviewer;
}

/** Can this role/user close or reopen a task? */
export function canCloseOrReopen(role, isReviewer) {
  return CLOSE_REOPEN_ROLES.includes(role) || isReviewer;
}

/** Can this role/user change the due date after creation? */
export function canChangeDueDate(role, isReviewer) {
  return DATE_CHANGE_ROLES.includes(role) || isReviewer;
}

/** Is this a management role? */
export function isManager(role) {
  return MANAGER_ROLES.includes(role);
}

/** Should this user's daily task presence be tracked? */
export function requiresDailyTask(role) {
  return DAILY_TASK_ROLES.includes(role);
}
