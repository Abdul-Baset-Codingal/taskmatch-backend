import cron from 'node-cron';
import { deleteTaskById } from '../controllers/taskController.js';
import task from '../models/task.js';

export const startTaskCleanupJob = () => {

    // Runs every minute
    cron.schedule('* * * * *', async () => {
        try {
            const now = new Date();

            // ✅ Only find pending tasks (not accepted/in-progress/completed)
            const expiredTasks = await task.find({
                offerDeadline: { $lt: now },
                status: { $in: ['pending', 'open'] }  // Only these statuses
            });

            if (expiredTasks.length > 0) {
                console.log(`[CRON] Found ${expiredTasks.length} expired task(s)`);

                for (const task of expiredTasks) {
                    const deleted = await deleteTaskById(task._id);
                    if (deleted) {
                        console.log(`[CRON] ✅ Deleted expired task: ${task.taskTitle}`);
                    }
                }
            }
        } catch (error) {
            console.error('[CRON] ❌ Error:', error);
        }
    });

    console.log('✅ Task cleanup cron job started');
};
