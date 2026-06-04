import { describe, it, expect } from 'vitest';

// ─── Logic helpers (mirrored from your components) ─────────────────────────

function getCanSubmit(task, uid) {
  const isAssignee  = task?.assignedTo === uid;
  const isDelegated = task?.taskType === 'delegated';
  const isLead      = task?.taskLeadId === uid;
  const isWorker    = (task?.workerIds || []).includes(uid);
  return isDelegated ? (isWorker && !isLead) : isAssignee;
}

function getCanManageDelegation(task, uid) {
  return !!(task && task.taskLeadId === uid);
}

function getCanCR(task, uid) {
  const isDelegated         = task?.taskType === 'delegated';
  const isTaskLead          = isDelegated && task?.taskLeadId === uid;
  const isAssigner          = task?.assignedBy === uid;
  const isReviewer          = task?.reviewer === uid;
  const creatorFinalReview  = isDelegated && !!task?.delegatedReviewByCreator;

  if (!task) return false;
  if (creatorFinalReview) return isAssigner;
  if (isDelegated)        return isTaskLead;
  // non-delegated: reviewer or assigner
  return isReviewer || isAssigner;
}

function showSendToCreatorBtn(task, uid) {
  const isDelegated = task?.taskType === 'delegated';
  const isTaskLead  = isDelegated && task?.taskLeadId === uid;
  return (
    isDelegated &&
    isTaskLead &&
    !task?.delegatedReviewByCreator &&
    task?.status === 'Sent for Review'
  );
}

function showAddSubmissionBtn(task, uid) {
  const isDelegated = task?.taskType === 'delegated';
  const isAssignee  = task?.assignedTo === uid;
  const isTaskLead  = isDelegated && task?.taskLeadId === uid;
  const isWorker    = (task?.workerIds || []).includes(uid);
  const activeStatus = task?.status === 'Open' || task?.status === 'ReOpen';

  if (!activeStatus) return false;
  if (isDelegated)   return isWorker && !isTaskLead;
  return isAssignee;
}

function getMyTasks(tasks, uid) {
  return tasks.filter(t =>
    (t.assignedTo === uid ||
     t.taskLeadId === uid ||
     (t.workerIds || []).includes(uid)) &&
    t.status !== 'Deleted'
  );
}

function getReviewTasks(tasks, uid) {
  return tasks.filter(t => {
    if (t.status === 'Deleted') return false;
    // For delegated tasks, restrict by stage
    if (t.taskType === 'delegated') {
      if (!t.delegatedReviewByCreator) {
        // Stage 1: only Task Lead reviews
        return t.taskLeadId === uid;
      } else {
        // Stage 2: only creator (assignedBy) reviews
        return t.assignedBy === uid;
      }
    }
    // Non-delegated: reviewer or assigner
    return t.reviewer === uid || t.assignedBy === uid;
  });
}

// ─── Test Data ─────────────────────────────────────────────────────────────
const CREATOR_ID = 'user-creator';
const LEAD_ID    = 'user-lead';
const WORKER_ID  = 'user-worker';
const OTHER_ID   = 'user-other';

const delegatedTaskOpen = {
  taskType: 'delegated',
  assignedTo: LEAD_ID,
  taskLeadId: LEAD_ID,
  assignedBy: CREATOR_ID,
  reviewer: CREATOR_ID,
  workerIds: [WORKER_ID],
  status: 'Open',
  delegatedReviewByCreator: false,
};

const delegatedTaskSentForReview = {
  ...delegatedTaskOpen,
  status: 'Sent for Review',
};

const delegatedTaskStage2 = {
  ...delegatedTaskSentForReview,
  delegatedReviewByCreator: true,
};

const delegatedTaskReOpen = {
  ...delegatedTaskOpen,
  status: 'ReOpen',
};

const normalTask = {
  taskType: 'non_delegated',
  assignedTo: WORKER_ID,
  assignedBy: CREATOR_ID,
  reviewer: CREATOR_ID,
  workerIds: [],
  status: 'Open',
  delegatedReviewByCreator: false,
};

// ─── canSubmit ─────────────────────────────────────────────────────────────
describe('canSubmit — Delegatable Task', () => {
  it('worker CAN submit', () => {
    expect(getCanSubmit(delegatedTaskOpen, WORKER_ID)).toBe(true);
  });
  it('task lead CANNOT submit', () => {
    expect(getCanSubmit(delegatedTaskOpen, LEAD_ID)).toBe(false);
  });
  it('creator CANNOT submit', () => {
    expect(getCanSubmit(delegatedTaskOpen, CREATOR_ID)).toBe(false);
  });
  it('random user CANNOT submit', () => {
    expect(getCanSubmit(delegatedTaskOpen, OTHER_ID)).toBe(false);
  });
});

describe('canSubmit — Non-Delegatable Task', () => {
  it('assignee CAN submit', () => {
    expect(getCanSubmit(normalTask, WORKER_ID)).toBe(true);
  });
  it('creator CANNOT submit on normal task', () => {
    expect(getCanSubmit(normalTask, CREATOR_ID)).toBe(false);
  });
  it('random user CANNOT submit on normal task', () => {
    expect(getCanSubmit(normalTask, OTHER_ID)).toBe(false);
  });
});

// ─── canManageDelegation ───────────────────────────────────────────────────
describe('canManageDelegation (Delegated Workers panel)', () => {
  it('task lead CAN manage workers', () => {
    expect(getCanManageDelegation(delegatedTaskOpen, LEAD_ID)).toBe(true);
  });
  it('creator CANNOT manage workers', () => {
    expect(getCanManageDelegation(delegatedTaskOpen, CREATOR_ID)).toBe(false);
  });
  it('worker CANNOT manage workers', () => {
    expect(getCanManageDelegation(delegatedTaskOpen, WORKER_ID)).toBe(false);
  });
  it('random user CANNOT manage workers', () => {
    expect(getCanManageDelegation(delegatedTaskOpen, OTHER_ID)).toBe(false);
  });
  it('returns false if task is null', () => {
    expect(getCanManageDelegation(null, LEAD_ID)).toBe(false);
  });
});

// ─── canCR (Review Access) ─────────────────────────────────────────────────
describe('canCR — Stage 1 (Task Lead Reviews Worker Submission)', () => {
  it('task lead CAN review at stage 1', () => {
    expect(getCanCR(delegatedTaskSentForReview, LEAD_ID)).toBe(true);
  });
  it('creator CANNOT review at stage 1', () => {
    expect(getCanCR(delegatedTaskSentForReview, CREATOR_ID)).toBe(false);
  });
  it('worker CANNOT review at stage 1', () => {
    expect(getCanCR(delegatedTaskSentForReview, WORKER_ID)).toBe(false);
  });
  it('random user CANNOT review at stage 1', () => {
    expect(getCanCR(delegatedTaskSentForReview, OTHER_ID)).toBe(false);
  });
});

describe('canCR — Stage 2 (Creator Final Review)', () => {
  it('creator CAN review at stage 2', () => {
    expect(getCanCR(delegatedTaskStage2, CREATOR_ID)).toBe(true);
  });
  it('task lead CANNOT review at stage 2', () => {
    expect(getCanCR(delegatedTaskStage2, LEAD_ID)).toBe(false);
  });
  it('worker CANNOT review at stage 2', () => {
    expect(getCanCR(delegatedTaskStage2, WORKER_ID)).toBe(false);
  });
});

describe('canCR — Non-Delegatable Task', () => {
  it('reviewer CAN review normal task', () => {
    expect(getCanCR(normalTask, CREATOR_ID)).toBe(true);
  });
  it('non-reviewer CANNOT review normal task', () => {
    expect(getCanCR(normalTask, WORKER_ID)).toBe(false);
  });
  it('returns false if task is null', () => {
    expect(getCanCR(null, CREATOR_ID)).toBe(false);
  });
});

// ─── showSendToCreatorBtn ──────────────────────────────────────────────────
describe('Send to Creator button visibility', () => {
  it('shows for task lead when status is Sent for Review', () => {
    expect(showSendToCreatorBtn(delegatedTaskSentForReview, LEAD_ID)).toBe(true);
  });
  it('hidden for task lead when status is Open (worker not submitted yet)', () => {
    expect(showSendToCreatorBtn(delegatedTaskOpen, LEAD_ID)).toBe(false);
  });
  it('hidden for task lead when status is ReOpen', () => {
    expect(showSendToCreatorBtn(delegatedTaskReOpen, LEAD_ID)).toBe(false);
  });
  it('hidden when already sent to creator (delegatedReviewByCreator = true)', () => {
    expect(showSendToCreatorBtn(delegatedTaskStage2, LEAD_ID)).toBe(false);
  });
  it('hidden for creator', () => {
    expect(showSendToCreatorBtn(delegatedTaskSentForReview, CREATOR_ID)).toBe(false);
  });
  it('hidden for worker', () => {
    expect(showSendToCreatorBtn(delegatedTaskSentForReview, WORKER_ID)).toBe(false);
  });
  it('hidden for non-delegated task', () => {
    expect(showSendToCreatorBtn({ ...normalTask, status: 'Sent for Review' }, WORKER_ID)).toBe(false);
  });
});

// ─── showAddSubmissionBtn ──────────────────────────────────────────────────
describe('Add Submission button visibility', () => {
  it('shows for worker on delegated task (Open)', () => {
    expect(showAddSubmissionBtn(delegatedTaskOpen, WORKER_ID)).toBe(true);
  });
  it('shows for worker on delegated task (ReOpen)', () => {
    expect(showAddSubmissionBtn(delegatedTaskReOpen, WORKER_ID)).toBe(true);
  });
  it('hidden for task lead on delegated task', () => {
    expect(showAddSubmissionBtn(delegatedTaskOpen, LEAD_ID)).toBe(false);
  });
  it('hidden for creator on delegated task', () => {
    expect(showAddSubmissionBtn(delegatedTaskOpen, CREATOR_ID)).toBe(false);
  });
  it('hidden when status is Sent for Review', () => {
    expect(showAddSubmissionBtn(delegatedTaskSentForReview, WORKER_ID)).toBe(false);
  });
  it('shows for assignee on normal task (Open)', () => {
    expect(showAddSubmissionBtn(normalTask, WORKER_ID)).toBe(true);
  });
  it('hidden for non-assignee on normal task', () => {
    expect(showAddSubmissionBtn(normalTask, CREATOR_ID)).toBe(false);
  });
});

// ─── myTasks filter ────────────────────────────────────────────────────────
describe('myTasks filter', () => {
  const tasks = [delegatedTaskOpen, normalTask];

  it('task lead sees delegated task', () => {
    expect(getMyTasks(tasks, LEAD_ID)).toContain(delegatedTaskOpen);
  });
  it('worker sees delegated task', () => {
    expect(getMyTasks(tasks, WORKER_ID)).toContain(delegatedTaskOpen);
  });
  it('worker sees normal task they are assigned to', () => {
    expect(getMyTasks(tasks, WORKER_ID)).toContain(normalTask);
  });
  it('creator does NOT see tasks in myTasks', () => {
    expect(getMyTasks(tasks, CREATOR_ID)).toHaveLength(0);
  });
  it('random user sees no tasks', () => {
    expect(getMyTasks(tasks, OTHER_ID)).toHaveLength(0);
  });
  it('deleted tasks are excluded', () => {
    const deletedTask = { ...delegatedTaskOpen, status: 'Deleted' };
    expect(getMyTasks([deletedTask], LEAD_ID)).toHaveLength(0);
  });
  it('task lead sees their own task even after worker submits', () => {
    expect(getMyTasks([delegatedTaskSentForReview], LEAD_ID)).toContain(delegatedTaskSentForReview);
  });
});

// ─── reviewTasks filter ────────────────────────────────────────────────────
describe('reviewTasks filter', () => {
  it('task lead sees task at stage 1 (Sent for Review)', () => {
    expect(getReviewTasks([delegatedTaskSentForReview], LEAD_ID))
      .toContain(delegatedTaskSentForReview);
  });
  it('creator does NOT see task at stage 1', () => {
    expect(getReviewTasks([delegatedTaskSentForReview], CREATOR_ID)).toHaveLength(0);
  });
  it('creator sees task at stage 2', () => {
    expect(getReviewTasks([delegatedTaskStage2], CREATOR_ID))
      .toContain(delegatedTaskStage2);
  });
  it('task lead does NOT see task at stage 2', () => {
    expect(getReviewTasks([delegatedTaskStage2], LEAD_ID)).toHaveLength(0);
  });
  it('worker never sees tasks in reviewTasks', () => {
    expect(getReviewTasks([delegatedTaskSentForReview, delegatedTaskStage2], WORKER_ID))
      .toHaveLength(0);
  });
  it('deleted tasks are excluded', () => {
    const deleted = { ...delegatedTaskSentForReview, status: 'Deleted' };
    expect(getReviewTasks([deleted], LEAD_ID)).toHaveLength(0);
  });
  it('creator sees normal task they assigned', () => {
    const sentNormal = { ...normalTask, status: 'Sent for Review' };
    expect(getReviewTasks([sentNormal], CREATOR_ID)).toContain(sentNormal);
  });
});