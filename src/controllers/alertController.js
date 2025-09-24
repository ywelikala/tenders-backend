import AlertConfiguration from '../models/AlertConfiguration.js';
import User from '../models/User.js';
import emailService from '../services/emailService.js';
import logger from '../utils/logger.js';

// Get all alert configurations for the authenticated user
export const getUserAlerts = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user has email alerts feature
    const user = await User.findById(userId);
    if (!user.subscription.features.emailAlerts) {
      return res.status(403).json({
        success: false,
        message: 'Email alerts feature is not available in your current subscription plan. Please upgrade to Professional or Enterprise plan.'
      });
    }

    const alerts = await AlertConfiguration.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate('stats.lastMatchedTender', 'title referenceNo');

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length
      }
    });

  } catch (error) {
    logger.error('Error fetching user alerts:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert configurations'
    });
  }
};

// Get a specific alert configuration
export const getAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const alert = await AlertConfiguration.findOne({ _id: id, user: userId })
      .populate('stats.lastMatchedTender', 'title referenceNo organization.name');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert configuration not found'
      });
    }

    res.json({
      success: true,
      data: alert
    });

  } catch (error) {
    logger.error('Error fetching alert:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert configuration'
    });
  }
};

// Create a new alert configuration
export const createAlert = async (req, res) => {
  try {
    const userId = req.user.id;

    // Check if user has email alerts feature
    const user = await User.findById(userId);
    if (!user.subscription.features.emailAlerts) {
      return res.status(403).json({
        success: false,
        message: 'Email alerts feature is not available in your current subscription plan. Please upgrade to Professional or Enterprise plan.'
      });
    }

    // Check alert limits based on subscription plan
    const existingAlertsCount = await AlertConfiguration.countDocuments({ user: userId });
    const maxAlerts = getMaxAlertsForPlan(user.subscription.plan);

    if (existingAlertsCount >= maxAlerts) {
      return res.status(403).json({
        success: false,
        message: `You have reached the maximum number of alerts (${maxAlerts}) for your ${user.subscription.plan} plan.`
      });
    }

    const alertData = {
      ...req.body,
      user: userId
    };

    const alert = new AlertConfiguration(alertData);
    await alert.save();

    logger.info(`Alert configuration created for user ${userId}`, {
      alertId: alert._id,
      alertName: alert.name
    });

    res.status(201).json({
      success: true,
      data: alert,
      message: 'Alert configuration created successfully'
    });

  } catch (error) {
    logger.error('Error creating alert configuration:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create alert configuration'
    });
  }
};

// Update an alert configuration
export const updateAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const alert = await AlertConfiguration.findOne({ _id: id, user: userId });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert configuration not found'
      });
    }

    // Update alert with new data
    Object.assign(alert, req.body);
    await alert.save();

    logger.info(`Alert configuration updated`, {
      alertId: alert._id,
      userId: userId
    });

    res.json({
      success: true,
      data: alert,
      message: 'Alert configuration updated successfully'
    });

  } catch (error) {
    logger.error('Error updating alert configuration:', error);

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => ({
        field: err.path,
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update alert configuration'
    });
  }
};

// Delete an alert configuration
export const deleteAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const alert = await AlertConfiguration.findOneAndDelete({ _id: id, user: userId });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert configuration not found'
      });
    }

    logger.info(`Alert configuration deleted`, {
      alertId: alert._id,
      userId: userId
    });

    res.json({
      success: true,
      message: 'Alert configuration deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting alert configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete alert configuration'
    });
  }
};

// Toggle alert active status
export const toggleAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const alert = await AlertConfiguration.findOne({ _id: id, user: userId });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert configuration not found'
      });
    }

    alert.isActive = !alert.isActive;
    await alert.save();

    logger.info(`Alert configuration ${alert.isActive ? 'activated' : 'deactivated'}`, {
      alertId: alert._id,
      userId: userId
    });

    res.json({
      success: true,
      data: alert,
      message: `Alert configuration ${alert.isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    logger.error('Error toggling alert status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to toggle alert status'
    });
  }
};

// Test an alert configuration against existing tenders
export const testAlert = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { limit = 10 } = req.query;

    const alert = await AlertConfiguration.findOne({ _id: id, user: userId });

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert configuration not found'
      });
    }

    // Import Tender model dynamically to avoid circular dependency
    const { default: Tender } = await import('../models/Tender.js');

    // Get recent published tenders
    const tenders = await Tender.find({ status: 'published' })
      .sort({ 'dates.published': -1 })
      .limit(100)
      .lean();

    // Test the alert against these tenders
    const matchingTenders = tenders
      .filter(tender => alert.shouldTriggerForTender(tender))
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      data: {
        matchingTenders,
        matchCount: matchingTenders.length,
        totalTested: tenders.length
      },
      message: `Found ${matchingTenders.length} matching tenders out of ${tenders.length} tested`
    });

  } catch (error) {
    logger.error('Error testing alert configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test alert configuration'
    });
  }
};

// Send test email for an alert
export const sendTestEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const alert = await AlertConfiguration.findOne({ _id: id, user: userId }).populate('user');

    if (!alert) {
      return res.status(404).json({
        success: false,
        message: 'Alert configuration not found'
      });
    }

    // Create a mock tender for testing
    const mockTender = {
      _id: 'test-tender-id',
      title: 'Test Tender - Sample Construction Project',
      description: 'This is a test tender notification to verify your email alert configuration is working correctly.',
      category: 'Construction',
      organization: {
        name: 'Test Organization',
        type: 'government'
      },
      location: {
        province: 'Western',
        district: 'Colombo',
        city: 'Colombo'
      },
      dates: {
        closing: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      },
      financials: {
        estimatedValue: {
          amount: 5000000,
          currency: 'LKR'
        }
      }
    };

    // Send test email
    const result = await emailService.sendImmediateAlert(alert.user, mockTender, alert);

    logger.info(`Test email sent for alert configuration`, {
      alertId: alert._id,
      userId: userId,
      success: result.success
    });

    res.json({
      success: true,
      data: result,
      message: 'Test email sent successfully'
    });

  } catch (error) {
    logger.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email'
    });
  }
};

// Get alert statistics and summary
export const getAlertStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const alerts = await AlertConfiguration.find({ user: userId });

    const stats = {
      totalAlerts: alerts.length,
      activeAlerts: alerts.filter(a => a.isActive).length,
      inactiveAlerts: alerts.filter(a => !a.isActive).length,
      totalMatches: alerts.reduce((sum, a) => sum + a.stats.totalMatches, 0),
      totalEmailsSent: alerts.reduce((sum, a) => sum + a.stats.emailsSent, 0),
      alertsByFrequency: {
        immediate: alerts.filter(a => a.emailSettings.frequency === 'immediate').length,
        daily: alerts.filter(a => a.emailSettings.frequency === 'daily').length,
        weekly: alerts.filter(a => a.emailSettings.frequency === 'weekly').length
      },
      recentMatches: alerts
        .filter(a => a.stats.lastMatchedAt)
        .sort((a, b) => new Date(b.stats.lastMatchedAt) - new Date(a.stats.lastMatchedAt))
        .slice(0, 5)
        .map(a => ({
          alertName: a.name,
          lastMatchedAt: a.stats.lastMatchedAt,
          totalMatches: a.stats.totalMatches
        }))
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    logger.error('Error fetching alert statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch alert statistics'
    });
  }
};

// Helper function to determine max alerts based on subscription plan
function getMaxAlertsForPlan(plan) {
  switch (plan) {
    case 'professional':
      return 10; // Professional plan allows 10 alerts
    case 'enterprise':
      return -1; // Enterprise plan allows unlimited alerts
    default:
      return 0; // Free and basic plans don't have email alerts
  }
}

export default {
  getUserAlerts,
  getAlert,
  createAlert,
  updateAlert,
  deleteAlert,
  toggleAlert,
  testAlert,
  sendTestEmail,
  getAlertStats
};