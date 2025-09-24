import cron from 'node-cron';
import alertProcessingService from './alertProcessingService.js';
import logger from '../utils/logger.js';

class SchedulerService {
  constructor() {
    this.jobs = new Map();
    this.isInitialized = false;
  }

  initialize() {
    if (this.isInitialized) {
      logger.warn('Scheduler service already initialized');
      return;
    }

    try {
      // Schedule daily summaries at 9:00 AM every day
      this.scheduleDailySummaries();

      // Schedule weekly summaries every Monday at 9:00 AM
      this.scheduleWeeklySummaries();

      // Schedule daily summaries for different times (for users who prefer different times)
      this.scheduleMultipleDailySummaryTimes();

      // Schedule cleanup tasks
      this.scheduleCleanupTasks();

      this.isInitialized = true;
      logger.info('Scheduler service initialized successfully', {
        jobCount: this.jobs.size
      });

    } catch (error) {
      logger.error('Failed to initialize scheduler service:', error);
      throw error;
    }
  }

  scheduleDailySummaries() {
    // Default daily summary at 9:00 AM
    const dailyJob = cron.schedule('0 9 * * *', async () => {
      try {
        logger.info('Starting daily summary processing at 09:00');
        const results = await alertProcessingService.processDailySummaries('09:00');
        logger.info('Daily summary processing completed', results);
      } catch (error) {
        logger.error('Error in daily summary processing at 09:00:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Colombo'
    });

    this.jobs.set('daily-09:00', dailyJob);
    dailyJob.start();
  }

  scheduleMultipleDailySummaryTimes() {
    // Additional times that users might prefer
    const times = [
      { time: '08:00', cron: '0 8 * * *' },
      { time: '10:00', cron: '0 10 * * *' },
      { time: '12:00', cron: '0 12 * * *' },
      { time: '18:00', cron: '0 18 * * *' }
    ];

    times.forEach(({ time, cron: cronExpression }) => {
      const job = cron.schedule(cronExpression, async () => {
        try {
          logger.info(`Starting daily summary processing at ${time}`);
          const results = await alertProcessingService.processDailySummaries(time);
          logger.info(`Daily summary processing completed for ${time}`, results);
        } catch (error) {
          logger.error(`Error in daily summary processing at ${time}:`, error);
        }
      }, {
        scheduled: false,
        timezone: 'Asia/Colombo'
      });

      this.jobs.set(`daily-${time}`, job);
      job.start();
    });
  }

  scheduleWeeklySummaries() {
    // Weekly summary every Monday at 9:00 AM
    const weeklyJob = cron.schedule('0 9 * * 1', async () => {
      try {
        logger.info('Starting weekly summary processing');
        const results = await alertProcessingService.processWeeklySummaries();
        logger.info('Weekly summary processing completed', results);
      } catch (error) {
        logger.error('Error in weekly summary processing:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Colombo'
    });

    this.jobs.set('weekly', weeklyJob);
    weeklyJob.start();
  }

  scheduleCleanupTasks() {
    // Cleanup old alert statistics every day at 2:00 AM
    const cleanupJob = cron.schedule('0 2 * * *', async () => {
      try {
        logger.info('Starting cleanup tasks');
        await this.cleanupOldData();
        logger.info('Cleanup tasks completed');
      } catch (error) {
        logger.error('Error in cleanup tasks:', error);
      }
    }, {
      scheduled: false,
      timezone: 'Asia/Colombo'
    });

    this.jobs.set('cleanup', cleanupJob);
    cleanupJob.start();
  }

  async cleanupOldData() {
    try {
      const { default: AlertConfiguration } = await import('../models/AlertConfiguration.js');

      // Remove inactive alerts older than 90 days
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const cleanupResult = await AlertConfiguration.deleteMany({
        isActive: false,
        updatedAt: { $lt: ninetyDaysAgo }
      });

      logger.info('Cleanup completed', {
        deletedInactiveAlerts: cleanupResult.deletedCount
      });

      return cleanupResult;

    } catch (error) {
      logger.error('Error in cleanup tasks:', error);
      throw error;
    }
  }

  // Manual trigger methods for testing
  async triggerDailySummary(time = '09:00') {
    try {
      logger.info(`Manually triggering daily summary for ${time}`);
      const results = await alertProcessingService.processDailySummaries(time);
      logger.info(`Manual daily summary completed for ${time}`, results);
      return results;
    } catch (error) {
      logger.error(`Error in manual daily summary for ${time}:`, error);
      throw error;
    }
  }

  async triggerWeeklySummary() {
    try {
      logger.info('Manually triggering weekly summary');
      const results = await alertProcessingService.processWeeklySummaries();
      logger.info('Manual weekly summary completed', results);
      return results;
    } catch (error) {
      logger.error('Error in manual weekly summary:', error);
      throw error;
    }
  }

  async triggerCleanup() {
    try {
      logger.info('Manually triggering cleanup');
      const results = await this.cleanupOldData();
      logger.info('Manual cleanup completed', results);
      return results;
    } catch (error) {
      logger.error('Error in manual cleanup:', error);
      throw error;
    }
  }

  // Get status of all scheduled jobs
  getJobStatus() {
    const status = {};
    for (const [name, job] of this.jobs) {
      status[name] = {
        running: job.running,
        scheduled: job.scheduled,
        lastDate: job.lastDate(),
        nextDate: job.nextDate()
      };
    }
    return status;
  }

  // Stop a specific job
  stopJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.stop();
      logger.info(`Job ${jobName} stopped`);
      return true;
    }
    logger.warn(`Job ${jobName} not found`);
    return false;
  }

  // Start a specific job
  startJob(jobName) {
    const job = this.jobs.get(jobName);
    if (job) {
      job.start();
      logger.info(`Job ${jobName} started`);
      return true;
    }
    logger.warn(`Job ${jobName} not found`);
    return false;
  }

  // Stop all jobs
  stopAllJobs() {
    for (const [name, job] of this.jobs) {
      job.stop();
      logger.info(`Job ${name} stopped`);
    }
    logger.info('All scheduled jobs stopped');
  }

  // Start all jobs
  startAllJobs() {
    for (const [name, job] of this.jobs) {
      job.start();
      logger.info(`Job ${name} started`);
    }
    logger.info('All scheduled jobs started');
  }

  // Graceful shutdown
  shutdown() {
    this.stopAllJobs();
    this.jobs.clear();
    this.isInitialized = false;
    logger.info('Scheduler service shut down');
  }
}

// Export singleton instance
export default new SchedulerService();