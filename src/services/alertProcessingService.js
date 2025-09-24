import AlertConfiguration from '../models/AlertConfiguration.js';
import emailService from './emailService.js';
import logger from '../utils/logger.js';

class AlertProcessingService {
  constructor() {
    this.processingQueue = [];
    this.isProcessing = false;
  }

  // Process a single tender against all active alert configurations
  async processTenderAlerts(tender, options = {}) {
    const { isNewTender = true, isUpdate = false } = options;

    try {
      logger.info('Processing tender alerts', {
        tenderId: tender._id,
        tenderTitle: tender.title,
        isNewTender,
        isUpdate
      });

      // Get all active immediate alerts
      const immediateAlerts = await AlertConfiguration.findImmediateAlerts();

      if (immediateAlerts.length === 0) {
        logger.debug('No immediate alerts configured');
        return { processed: 0, emailsSent: 0 };
      }

      const results = {
        processed: 0,
        emailsSent: 0,
        errors: []
      };

      // Process each alert configuration
      for (const alert of immediateAlerts) {
        try {
          // Check if user has valid subscription for email alerts
          if (!alert.user || !alert.user.subscription?.features?.emailAlerts) {
            logger.debug(`Skipping alert - user doesn't have email alerts feature`, {
              alertId: alert._id,
              userId: alert.user?._id
            });
            continue;
          }

          // Check if alert should trigger for this tender
          if (alert.shouldTriggerForTender(tender)) {
            logger.info('Alert triggered for tender', {
              alertId: alert._id,
              alertName: alert.name,
              tenderId: tender._id,
              userId: alert.user._id
            });

            // Update alert statistics
            await alert.updateStats(tender);

            // Send immediate email alert
            if (alert.emailSettings.enabled && alert.emailSettings.frequency === 'immediate') {
              try {
                await emailService.sendImmediateAlert(alert.user, tender, alert);
                await alert.incrementEmailSent();
                results.emailsSent++;

                logger.info('Immediate alert email sent successfully', {
                  alertId: alert._id,
                  userId: alert.user._id,
                  tenderId: tender._id
                });
              } catch (emailError) {
                logger.error('Failed to send immediate alert email', {
                  alertId: alert._id,
                  userId: alert.user._id,
                  tenderId: tender._id,
                  error: emailError.message
                });
                results.errors.push({
                  alertId: alert._id,
                  type: 'email',
                  error: emailError.message
                });
              }
            }

            results.processed++;
          }
        } catch (alertError) {
          logger.error('Error processing individual alert', {
            alertId: alert._id,
            tenderId: tender._id,
            error: alertError.message
          });
          results.errors.push({
            alertId: alert._id,
            type: 'processing',
            error: alertError.message
          });
        }
      }

      logger.info('Tender alert processing completed', {
        tenderId: tender._id,
        totalAlertsProcessed: results.processed,
        emailsSent: results.emailsSent,
        errors: results.errors.length
      });

      return results;

    } catch (error) {
      logger.error('Error in processTenderAlerts', {
        tenderId: tender._id,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Process daily summary alerts
  async processDailySummaries(time = '09:00') {
    try {
      logger.info(`Processing daily summaries for ${time}`);

      // Get all daily alerts scheduled for this time
      const dailyAlerts = await AlertConfiguration.findDailyAlerts(time);

      if (dailyAlerts.length === 0) {
        logger.debug(`No daily alerts scheduled for ${time}`);
        return { processed: 0, emailsSent: 0 };
      }

      const results = {
        processed: 0,
        emailsSent: 0,
        errors: []
      };

      // Get tenders from the last 24 hours
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const recentTenders = await this.getRecentTenders(yesterday);

      if (recentTenders.length === 0) {
        logger.info('No recent tenders for daily summaries');
        return results;
      }

      // Process each user's daily alerts
      const userAlerts = this.groupAlertsByUser(dailyAlerts);

      for (const [userId, alerts] of userAlerts.entries()) {
        try {
          const user = alerts[0].user; // All alerts belong to the same user

          // Find matching tenders for all user's alerts
          const matchingTenders = [];
          for (const alert of alerts) {
            const matches = recentTenders.filter(tender => alert.shouldTriggerForTender(tender));
            matchingTenders.push(...matches);
          }

          // Remove duplicates
          const uniqueTenders = this.removeDuplicateTenders(matchingTenders);

          if (uniqueTenders.length > 0) {
            // Send daily summary email
            await emailService.sendDailySummary(user, uniqueTenders, alerts);

            // Update statistics for all triggered alerts
            for (const alert of alerts) {
              const alertMatches = uniqueTenders.filter(tender => alert.shouldTriggerForTender(tender));
              if (alertMatches.length > 0) {
                for (const tender of alertMatches) {
                  await alert.updateStats(tender);
                }
                await alert.incrementEmailSent();
              }
            }

            results.emailsSent++;
            logger.info('Daily summary sent successfully', {
              userId,
              tenderCount: uniqueTenders.length,
              alertCount: alerts.length
            });
          }

          results.processed++;
        } catch (userError) {
          logger.error('Error processing daily summary for user', {
            userId,
            error: userError.message
          });
          results.errors.push({
            userId,
            type: 'daily_summary',
            error: userError.message
          });
        }
      }

      logger.info('Daily summary processing completed', {
        time,
        usersProcessed: results.processed,
        emailsSent: results.emailsSent,
        errors: results.errors.length
      });

      return results;

    } catch (error) {
      logger.error('Error in processDailySummaries', {
        time,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Process weekly summary alerts (typically runs on Mondays)
  async processWeeklySummaries() {
    try {
      logger.info('Processing weekly summaries');

      // Get all weekly alerts
      const weeklyAlerts = await AlertConfiguration.findWeeklyAlerts();

      if (weeklyAlerts.length === 0) {
        logger.debug('No weekly alerts configured');
        return { processed: 0, emailsSent: 0 };
      }

      const results = {
        processed: 0,
        emailsSent: 0,
        errors: []
      };

      // Get tenders from the last 7 days
      const lastWeek = new Date();
      lastWeek.setDate(lastWeek.getDate() - 7);

      const weeklyTenders = await this.getRecentTenders(lastWeek);

      if (weeklyTenders.length === 0) {
        logger.info('No recent tenders for weekly summaries');
        return results;
      }

      // Process each user's weekly alerts
      const userAlerts = this.groupAlertsByUser(weeklyAlerts);

      for (const [userId, alerts] of userAlerts.entries()) {
        try {
          const user = alerts[0].user;

          // Find matching tenders for all user's alerts
          const matchingTenders = [];
          for (const alert of alerts) {
            const matches = weeklyTenders.filter(tender => alert.shouldTriggerForTender(tender));
            matchingTenders.push(...matches);
          }

          // Remove duplicates
          const uniqueTenders = this.removeDuplicateTenders(matchingTenders);

          if (uniqueTenders.length > 0) {
            // Send weekly summary email
            await emailService.sendWeeklySummary(user, uniqueTenders, alerts);

            // Update statistics for all triggered alerts
            for (const alert of alerts) {
              const alertMatches = uniqueTenders.filter(tender => alert.shouldTriggerForTender(tender));
              if (alertMatches.length > 0) {
                for (const tender of alertMatches) {
                  await alert.updateStats(tender);
                }
                await alert.incrementEmailSent();
              }
            }

            results.emailsSent++;
            logger.info('Weekly summary sent successfully', {
              userId,
              tenderCount: uniqueTenders.length,
              alertCount: alerts.length
            });
          }

          results.processed++;
        } catch (userError) {
          logger.error('Error processing weekly summary for user', {
            userId,
            error: userError.message
          });
          results.errors.push({
            userId,
            type: 'weekly_summary',
            error: userError.message
          });
        }
      }

      logger.info('Weekly summary processing completed', {
        usersProcessed: results.processed,
        emailsSent: results.emailsSent,
        errors: results.errors.length
      });

      return results;

    } catch (error) {
      logger.error('Error in processWeeklySummaries', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  // Queue tender for processing (useful for high-volume scenarios)
  async queueTenderForProcessing(tender, options = {}) {
    this.processingQueue.push({ tender, options, timestamp: new Date() });

    if (!this.isProcessing) {
      this.processQueue();
    }
  }

  // Process the queued tenders
  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.processingQueue.length > 0) {
        const { tender, options } = this.processingQueue.shift();
        await this.processTenderAlerts(tender, options);

        // Small delay to prevent overwhelming the email service
        await this.delay(100);
      }
    } catch (error) {
      logger.error('Error processing alert queue', error);
    } finally {
      this.isProcessing = false;
    }
  }

  // Helper method to get recent tenders
  async getRecentTenders(since) {
    const { default: Tender } = await import('../models/Tender.js');

    return Tender.find({
      status: 'published',
      isActive: true,
      'dates.published': { $gte: since }
    })
    .sort({ 'dates.published': -1 })
    .lean();
  }

  // Helper method to group alerts by user
  groupAlertsByUser(alerts) {
    const userMap = new Map();

    for (const alert of alerts) {
      const userId = alert.user._id.toString();
      if (!userMap.has(userId)) {
        userMap.set(userId, []);
      }
      userMap.get(userId).push(alert);
    }

    return userMap;
  }

  // Helper method to remove duplicate tenders
  removeDuplicateTenders(tenders) {
    const seen = new Set();
    return tenders.filter(tender => {
      const id = tender._id.toString();
      if (seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }

  // Helper method to add delay
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Get processing statistics
  getStats() {
    return {
      queueLength: this.processingQueue.length,
      isProcessing: this.isProcessing,
      timestamp: new Date()
    };
  }
}

// Export singleton instance
export default new AlertProcessingService();