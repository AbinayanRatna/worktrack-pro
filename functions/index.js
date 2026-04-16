const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

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

        // 1. From Open/ReOpen -> Sent for Review (Notify Assigner & Reviewer)
        if (newStatus === 'Sent for Review' && prevStatus !== 'Sent for Review') {
          const assignerUid = newValue.assignedBy;
          const reviewerUid = newValue.reviewer;
          
          let targetUids = new Set();
          if (assignerUid) targetUids.add(assignerUid);
          if (reviewerUid) targetUids.add(reviewerUid);
          
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

        // 2. From Sent for Review -> ReOpen / Closed (Notify Assignee)
        if (prevStatus === 'Sent for Review' && (newStatus === 'ReOpen' || newStatus === 'Closed')) {
          const assigneeUid = newValue.assignedTo;
          if (assigneeUid) {
            const userRec = await admin.auth().getUser(assigneeUid).catch(() => null);
            if (userRec && userRec.email) {
              const statusColor = newStatus === 'Closed' ? '#10b981' : '#ef4444';
              await db.collection('mail').add({
                to: [userRec.email],
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

// Scheduled task to auto-update overdue tasks
exports.markOverdueTasks = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const now = admin.firestore.Timestamp.now();
  
  const snapshot = await db.collection('tasks')
    .where('dueDate', '<', now)
    .where('status', 'not-in', ['Completed'])
    .get();

  const batch = db.batch();
  snapshot.forEach(doc => {
    batch.update(doc.ref, { status: 'Overdue' });
  });

  await batch.commit();
  console.log(`Marked ${snapshot.size} tasks as overdue`);
  return null;
});

// Scheduled task to auto-delete tasks older than 60 days
exports.deleteOldTasks = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 60);
  const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);
  
  const snapshot = await db.collection('tasks')
    .where('createdAt', '<', cutoffTimestamp)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const batch = db.batch();
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
  });

  await batch.commit();
  console.log(`Deleted ${snapshot.size} tasks older than 60 days`);
  return null;
});
