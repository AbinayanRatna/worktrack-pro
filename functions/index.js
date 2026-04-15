const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// Function to log task creation
exports.onTaskCreated = functions.firestore
  .document('tasks/{taskId}')
  .onCreate(async (snap, context) => {
    const newValue = snap.data();
    const taskId = context.params.taskId;
    
    return db.collection('activity_logs').add({
      taskId: taskId,
      action: 'Task Created',
      performedBy: newValue.assignedBy || 'System',
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
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
