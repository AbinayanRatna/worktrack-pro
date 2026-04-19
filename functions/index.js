const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();
const COLOMBO_TZ = 'Asia/Colombo';

function ymdInColombo(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: COLOMBO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function addDaysToYmd(ymd, days) {
  const [year, month, day] = (ymd || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function diffDays(startYmd, endYmd) {
  const [sy, sm, sd] = (startYmd || '').split('-').map(Number);
  const [ey, em, ed] = (endYmd || '').split('-').map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return null;
  const startUtc = Date.UTC(sy, sm - 1, sd);
  const endUtc = Date.UTC(ey, em - 1, ed);
  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
}

function pushToMapArray(map, key, value) {
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(value);
}

async function resolveUserEmail(uid) {
  if (!uid) return null;

  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const email = userDoc.exists ? userDoc.data()?.email : null;
    if (email) return email;
  } catch (err) {
    console.error(`Failed reading users/${uid} for email`, err);
  }

  try {
    const authUser = await admin.auth().getUser(uid);
    return authUser?.email || null;
  } catch (err) {
    console.error(`Failed reading auth user ${uid} for email`, err);
    return null;
  }
}

async function queueTaskDigestMail({ uid, tasks, kind }) {
  const email = await resolveUserEmail(uid);
  if (!email || !Array.isArray(tasks) || tasks.length === 0) return false;

  const sorted = tasks
    .map((t) => ({ title: t.title || 'Untitled Task', status: t.status || 'Open' }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const isOverdue = kind === 'overdue';
  const subject = isOverdue
    ? `Overdue Task Alert (${sorted.length})`
    : `Task Due Tomorrow Reminder (${sorted.length})`;

  const intro = isOverdue
    ? 'The due date has passed for the following task(s):'
    : 'Reminder for task(s) due tomorrow:';

  const textList = sorted.map((t) => `- ${t.title} (${t.status})`).join('\n');
  const htmlList = sorted
    .map((t) => `<li><strong>${t.title}</strong> <span style="color:#64748b">(${t.status})</span></li>`)
    .join('');

  await db.collection('mail').add({
    to: [email],
    message: {
      subject,
      text: `${intro}\n\n${textList}`,
      html: `
        <div style="font-family:Segoe UI, Tahoma, sans-serif; max-width:600px; margin:0 auto; background:#f8fafc; padding:24px; border-radius:12px;">
          <div style="background:#ffffff; padding:24px; border-radius:12px; border:1px solid #e2e8f0;">
            <h2 style="margin:0 0 12px 0; color:#0f172a; font-size:20px;">${isOverdue ? 'Overdue Task Alert' : 'Task Reminder'}</h2>
            <p style="margin:0 0 16px 0; color:#475569; font-size:14px;">${intro}</p>
            <ul style="margin:0; padding-left:20px; color:#0f172a; line-height:1.7;">
              ${htmlList}
            </ul>
          </div>
        </div>
      `,
    },
  });

  return true;
}

// Function to log task creation
exports.onTaskCreated = functions.firestore
  .document('tasks/{taskId}')
  .onCreate(async (snap, context) => {
    const newValue = snap.data();
    const taskId = context.params.taskId;
    
    const logPromise = db.collection('activity_logs').add({
      taskId: taskId,
      action: 'Task Created',
      performedBy: newValue.assignedBy || 'System',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    let mailPromise = Promise.resolve();
    const assigneeUid = newValue.assignedTo;
    
    if (assigneeUid) {
      try {
        const userRec = await admin.auth().getUser(assigneeUid).catch(() => null);
        if (userRec && userRec.email) {
          const statusColor =  '#10b981';
          mailPromise = db.collection('mail').add({
            to: [userRec.email],
            message: {
              subject: `New Task Assigned: ${newValue.title || 'Task'}`,
              text: `A new task has been assigned to you.\n\nTitle: ${newValue.title || 'N/A'}`,
              html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 30px; border-radius: 12px;">
                  <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <h2 style="color: #0f172a; margin-top: 0; font-size: 24px;">New Task Assigned</h2>
                    <p style="color: #475569; font-size: 16px; line-height: 1.5;">You have been assigned a new task in Worktrack.</p>
                    <div style="background-color: #f1f5f9; padding: 20px; border-left: 4px solid ${statusColor}; border-radius: 4px; margin: 25px 0;">
                          <h3 style="margin: 0 0 15px 0; color: #0f172a; font-size: 18px;">${newValue.title || 'N/A'}</h3>
                          <span style="display: inline-block; background-color: ${statusColor}; color: #ffffff; padding: 4px 12px; border-radius: 999px; font-size: 14px; font-weight: 600; margin-bottom: 5px;">
                            Open
                          </span>
                        </div>
                    <p style="color: #475569; font-size: 14px; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                      Please log in to the application to view the full details.
                    </p>
                  </div>
                </div>
              `
            }
          });
        }
      } catch (err) {
        console.error('Error queuing creation email:', err);
      }
    }

    return Promise.all([logPromise, mailPromise]);
  });

// Function to log task changes
exports.onTaskUpdated = functions.firestore
  .document('tasks/{taskId}')
  .onUpdate(async (change, context) => {
    const newValue = change.after.data();
    const previousValue = change.before.data();
    const taskId = context.params.taskId;

    let changes = [];
    if (newValue.status !== previousValue.status) {
      changes.push(`Status changed from ${previousValue.status} to ${newValue.status}`);

      // Handle email notifications for status transitions
      try {
        const prevStatus = previousValue.status;
        const newStatus = newValue.status;

        // 1. From Open/ReOpen -> Sent for Review
        if (newStatus === 'Sent for Review' && prevStatus !== 'Sent for Review') {
          const isDelegated = newValue.taskType === 'delegated';
          const assignerUid = newValue.assignedBy;
          const reviewerUid = newValue.reviewer;
          
          let targetUids = new Set();
          if (isDelegated && newValue.delegatedReviewByCreator) {
            if (assignerUid) targetUids.add(assignerUid);
          } else {
            if (assignerUid) targetUids.add(assignerUid);
            if (reviewerUid) targetUids.add(reviewerUid);
          }
          
          if (targetUids.size > 0) {
            let emails = [];
            for (let uid of targetUids) {
              const userRec = await admin.auth().getUser(uid).catch(() => null);
              if (userRec && userRec.email) emails.push(userRec.email);
            }
            if (emails.length > 0) {
              const statusColor ='#0e88e0' ;
              await db.collection('mail').add({
                to: emails,
                message: {
                  subject: `Action Required: Task Ready for Review - ${newValue.title || 'Task'}`,
                  text: `A task requires your review.\n\nTitle: ${newValue.title || 'N/A'}}`,
                  html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 30px; border-radius: 12px;">
                      <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <h2 style="color: #2563eb; margin-top: 0; font-size: 24px;">Task Ready for Review</h2>
                        <p style="color: #475569; font-size: 16px; line-height: 1.5;">A task in Worktrack has been submitted and requires your review.</p>
                        <div style="background-color: #f1f5f9; padding: 20px; border-left: 4px solid ${statusColor}; border-radius: 4px; margin: 25px 0;">
                          <h3 style="margin: 0 0 15px 0; color: #0f172a; font-size: 18px;">${newValue.title || 'N/A'}</h3>
                          <span style="display: inline-block; background-color: ${statusColor}; color: #ffffff; padding: 4px 12px; border-radius: 999px; font-size: 14px; font-weight: 600; margin-bottom: 5px;">
                            ${newStatus}
                          </span>
                        </div>
                        <p style="color: #475569; font-size: 14px; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                          Please log in to the Worktrack application to approve or request changes.
                        </p>
                      </div>
                    </div>
                  `
                }
              });
            }
          }
        }

        // 2. From Sent for Review -> ReOpen / Closed
        if (prevStatus === 'Sent for Review' && (newStatus === 'ReOpen' || newStatus === 'Closed')) {
          const isDelegated = newValue.taskType === 'delegated';
          const delegatedRecipients = new Set([
            ...(newValue.workerIds || []),
            newValue.taskLeadId,
            newValue.assignedTo,
          ].filter(Boolean));
          const targetUids = isDelegated ? Array.from(delegatedRecipients) : [newValue.assignedTo].filter(Boolean);

          if (targetUids.length > 0) {
            const emails = [];
            for (const targetUid of targetUids) {
              const userRec = await admin.auth().getUser(targetUid).catch(() => null);
              if (userRec && userRec.email) emails.push(userRec.email);
            }

            if (emails.length > 0) {
              const statusColor = newStatus === 'Closed' ? '#10b981' : '#ef4444';
              await db.collection('mail').add({
                to: emails,
                message: {
                  subject: `Task Update: ${newStatus} - ${newValue.title || 'Task'}`,
                  text: `Your task has been updated to ${newStatus}.\n\nTitle: ${newValue.title || 'N/A'}`,
                  html: `
                    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f8fafc; padding: 30px; border-radius: 12px;">
                      <div style="background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                        <h2 style="color: #0f172a; margin-top: 0; font-size: 24px;">Task Status Update</h2>
                        <p style="color: #475569; font-size: 16px; line-height: 1.5;">The task assigned to you has been updated.</p>
                        <div style="background-color: #f1f5f9; padding: 20px; border-left: 4px solid ${statusColor}; border-radius: 4px; margin: 25px 0;">
                          <h3 style="margin: 0 0 15px 0; color: #0f172a; font-size: 18px;">${newValue.title || 'N/A'}</h3>
                          <span style="display: inline-block; background-color: ${statusColor}; color: #ffffff; padding: 4px 12px; border-radius: 999px; font-size: 14px; font-weight: 600; margin-bottom: 5px;">
                            ${newStatus}
                          </span>
                        </div>
                        <p style="color: #475569; font-size: 14px; margin-top: 25px; padding-top: 20px; border-top: 1px solid #e2e8f0;">
                          Please review the latest feedback and comments in the application.
                        </p>
                      </div>
                    </div>
                  `
                }
              });
            }
          }
        }
      } catch (err) {
        console.error('Error queuing status email notifications:', err);
      }
    }
    
    if (changes.length > 0) {
      return db.collection('activity_logs').add({
        taskId: taskId,
        action: changes.join(', '),
        performedBy: newValue.updatedBy || 'System',
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    return null;
  });

// Daily task reminders at 8:00 AM Sri Lanka time.
// 1) Overdue digest: task is Open/ReOpen and dueDate < today.
// 2) Due-tomorrow digest: assigned & due date gap >= 2 days and dueDate is tomorrow.
exports.sendDailyTaskDigest = functions.pubsub
  .schedule('0 8 * * *')
  .timeZone(COLOMBO_TZ)
  .onRun(async () => {
    const today = ymdInColombo(new Date());
    const tomorrow = addDaysToYmd(today, 1);

    const snapshot = await db.collection('tasks')
      .where('status', 'in', ['Open', 'ReOpen'])
      .get();

    const overdueByAssignee = new Map();
    const reminderByAssignee = new Map();

    snapshot.forEach((taskDoc) => {
      const task = taskDoc.data();
      const assignedTo = task.assignedTo;
      const dueDate = task.dueDate;
      const dateAssigned = task.dateAssigned;
      const isDelegated = task.taskType === 'delegated';
      const recipients = isDelegated
        ? Array.from(new Set([...(task.workerIds || []), task.taskLeadId, assignedTo].filter(Boolean)))
        : [assignedTo].filter(Boolean);

      if (recipients.length === 0 || !dueDate) return;

      if (dueDate < today) {
        recipients.forEach((recipientUid) => pushToMapArray(overdueByAssignee, recipientUid, task));
        return;
      }

      if (dueDate !== tomorrow || !dateAssigned) return;

      const gapDays = diffDays(dateAssigned, dueDate);
      if (gapDays != null && gapDays >= 2) {
        recipients.forEach((recipientUid) => pushToMapArray(reminderByAssignee, recipientUid, task));
      }
    });

    const allAssignees = new Set([
      ...Array.from(overdueByAssignee.keys()),
      ...Array.from(reminderByAssignee.keys()),
    ]);

    let overdueMailCount = 0;
    let reminderMailCount = 0;

    for (const uid of allAssignees) {
      const overdueTasks = overdueByAssignee.get(uid) || [];
      const reminderTasks = reminderByAssignee.get(uid) || [];

      if (overdueTasks.length > 0) {
        const sent = await queueTaskDigestMail({ uid, tasks: overdueTasks, kind: 'overdue' });
        if (sent) overdueMailCount += 1;
      }

      if (reminderTasks.length > 0) {
        const sent = await queueTaskDigestMail({ uid, tasks: reminderTasks, kind: 'reminder' });
        if (sent) reminderMailCount += 1;
      }
    }

    console.log(`Daily digest complete. Overdue mails: ${overdueMailCount}, Reminder mails: ${reminderMailCount}`);
    return null;
  });

// Scheduled task to soft-delete Closed tasks older than 90 days
exports.deleteOldTasks = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 90);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);
  
  const snapshot = await db.collection('tasks')
    .where('createdAt', '<', cutoffTimestamp)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const batch = db.batch();
  let shiftedCount = 0;
  snapshot.forEach(doc => {
    const task = doc.data();
    if (task.status === 'Closed') {
      batch.update(doc.ref, {
        status: 'Deleted',
        deletedFromStatus: 'Closed',
        deletedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      shiftedCount += 1;
    }
  });

  if (shiftedCount === 0) {
    console.log('No Closed tasks older than 90 days to move into Deleted');
    return null;
  }

  await batch.commit();
  console.log(`Moved ${shiftedCount} Closed tasks older than 90 days into Deleted`);
  return null;
});
