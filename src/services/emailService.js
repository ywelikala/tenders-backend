import nodemailer from 'nodemailer';
import { google } from 'googleapis';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.oauth2Client = null;
    this.transporter = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      // Check if we have all required Gmail API credentials
      const requiredEnvVars = [
        'GMAIL_CLIENT_ID',
        'GMAIL_CLIENT_SECRET',
        'GMAIL_REFRESH_TOKEN',
        'GMAIL_USER_EMAIL'
      ];

      const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
      if (missingVars.length > 0) {
        logger.warn(`Gmail API credentials missing: ${missingVars.join(', ')}. Falling back to basic nodemailer.`);
        await this.initializeBasicTransporter();
        return;
      }

      // Initialize Gmail OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        'https://developers.google.com/oauthplayground' // redirect URL
      );

      this.oauth2Client.setCredentials({
        refresh_token: process.env.GMAIL_REFRESH_TOKEN
      });

      // Get access token
      const { token: accessToken } = await this.oauth2Client.getAccessToken();

      // Create transporter with Gmail OAuth2
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          type: 'OAuth2',
          user: process.env.GMAIL_USER_EMAIL,
          clientId: process.env.GMAIL_CLIENT_ID,
          clientSecret: process.env.GMAIL_CLIENT_SECRET,
          refreshToken: process.env.GMAIL_REFRESH_TOKEN,
          accessToken: accessToken
        }
      });

      this.initialized = true;
      logger.info('Gmail API email service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize Gmail API service:', error);
      // Fallback to basic transporter
      await this.initializeBasicTransporter();
    }
  }

  async initializeBasicTransporter() {
    try {
      // Basic SMTP configuration (can be configured for other email providers)
      const smtpConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: false, // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER || process.env.GMAIL_USER_EMAIL,
          pass: process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD // App password for Gmail
        }
      };

      this.transporter = nodemailer.createTransporter(smtpConfig);
      this.initialized = true;
      logger.info('Basic SMTP email service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize basic email service:', error);
      throw error;
    }
  }

  async sendAlertEmail(to, subject, tenderMatches, alertConfig) {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const htmlContent = this.generateAlertEmailHTML(tenderMatches, alertConfig);
      const textContent = this.generateAlertEmailText(tenderMatches, alertConfig);

      const mailOptions = {
        from: {
          name: 'Lanka Tender Portal',
          address: process.env.GMAIL_USER_EMAIL || process.env.FROM_EMAIL || 'noreply@lankatender.com'
        },
        to: to,
        subject: subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Mailer': 'Lanka Tender Portal Alert System',
          'X-Priority': '3' // Normal priority
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`Alert email sent successfully to ${to}`, {
        messageId: result.messageId,
        alertConfigId: alertConfig._id,
        tenderCount: tenderMatches.length
      });

      return { success: true, messageId: result.messageId };

    } catch (error) {
      logger.error(`Failed to send alert email to ${to}:`, error);
      throw error;
    }
  }

  async sendImmediateAlert(user, tender, alertConfig) {
    const subject = `🚨 New Tender Alert: ${tender.title}`;
    return this.sendAlertEmail(
      alertConfig.effectiveEmail || user.email,
      subject,
      [tender],
      alertConfig
    );
  }

  async sendDailySummary(user, tenders, alertConfigs) {
    if (tenders.length === 0) return { success: true, message: 'No tenders to send' };

    const subject = `📊 Daily Tender Summary - ${tenders.length} new matches`;

    // Group tenders by alert configuration
    const groupedTenders = this.groupTendersByAlert(tenders, alertConfigs);

    return this.sendSummaryEmail(user, subject, groupedTenders, 'daily');
  }

  async sendWeeklySummary(user, tenders, alertConfigs) {
    if (tenders.length === 0) return { success: true, message: 'No tenders to send' };

    const subject = `📈 Weekly Tender Summary - ${tenders.length} new matches`;

    // Group tenders by alert configuration
    const groupedTenders = this.groupTendersByAlert(tenders, alertConfigs);

    return this.sendSummaryEmail(user, subject, groupedTenders, 'weekly');
  }

  async sendSummaryEmail(user, subject, groupedTenders, frequency) {
    try {
      const htmlContent = this.generateSummaryEmailHTML(groupedTenders, frequency, user);
      const textContent = this.generateSummaryEmailText(groupedTenders, frequency, user);

      const mailOptions = {
        from: {
          name: 'Lanka Tender Portal',
          address: process.env.GMAIL_USER_EMAIL || process.env.FROM_EMAIL || 'noreply@lankatender.com'
        },
        to: user.email,
        subject: subject,
        text: textContent,
        html: htmlContent,
        headers: {
          'X-Mailer': 'Lanka Tender Portal Alert System',
          'X-Priority': '3'
        }
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info(`${frequency} summary email sent successfully to ${user.email}`, {
        messageId: result.messageId,
        userId: user._id,
        alertCount: Object.keys(groupedTenders).length
      });

      return { success: true, messageId: result.messageId };

    } catch (error) {
      logger.error(`Failed to send ${frequency} summary email to ${user.email}:`, error);
      throw error;
    }
  }

  groupTendersByAlert(tenders, alertConfigs) {
    const grouped = {};

    alertConfigs.forEach(config => {
      grouped[config._id] = {
        config: config,
        tenders: tenders.filter(tender => config.shouldTriggerForTender(tender))
      };
    });

    return grouped;
  }

  generateAlertEmailHTML(tenderMatches, alertConfig) {
    const tenderCards = tenderMatches.map(tender => `
      <div style="border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; margin-bottom: 20px; background-color: #ffffff;">
        <h3 style="color: #2c3e50; margin-top: 0; font-size: 18px;">
          ${tender.title}
        </h3>
        <div style="margin-bottom: 15px;">
          <span style="background-color: #f8f9fa; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #6c757d;">
            ${tender.category}
          </span>
          <span style="background-color: #e3f2fd; padding: 4px 8px; border-radius: 4px; font-size: 12px; color: #1976d2; margin-left: 8px;">
            ${tender.organization.type}
          </span>
        </div>
        <p style="color: #555555; line-height: 1.5; margin-bottom: 15px;">
          ${tender.description.substring(0, 200)}${tender.description.length > 200 ? '...' : ''}
        </p>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div>
            <strong style="color: #2c3e50;">Organization:</strong> ${tender.organization.name}<br>
            <strong style="color: #2c3e50;">Location:</strong> ${tender.location.district}, ${tender.location.province}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 12px; color: #6c757d;">Closes on</div>
            <div style="font-weight: bold; color: #e74c3c;">
              ${new Date(tender.dates.closing).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </div>
          </div>
        </div>
        ${tender.financials?.estimatedValue ? `
          <div style="margin-bottom: 10px;">
            <strong style="color: #2c3e50;">Estimated Value:</strong>
            ${tender.financials.estimatedValue.currency} ${tender.financials.estimatedValue.amount.toLocaleString()}
          </div>
        ` : ''}
        <div style="margin-top: 15px; text-align: right;">
          <a href="${process.env.FRONTEND_URL || 'https://lankatender.com'}/tenders/${tender._id}"
             style="background-color: #ff6b35; color: white; padding: 8px 16px; text-decoration: none; border-radius: 4px; font-size: 14px;">
            View Tender →
          </a>
        </div>
      </div>
    `).join('');

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Tender Alert - ${alertConfig.name}</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ff6b35, #f7931e); color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">🔔 Tender Alert</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">${alertConfig.name}</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          <p style="font-size: 16px; color: #2c3e50; margin-bottom: 25px;">
            Great news! We found ${tenderMatches.length} new tender${tenderMatches.length > 1 ? 's' : ''} that match${tenderMatches.length === 1 ? 'es' : ''} your alert criteria:
          </p>

          ${tenderCards}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; font-size: 14px; color: #6c757d;">
            This alert was sent because you have configured keyword monitoring.<br>
            <a href="${process.env.FRONTEND_URL || 'https://lankatender.com'}/alerts" style="color: #ff6b35; text-decoration: none;">
              Manage your alerts
            </a> |
            <a href="${process.env.FRONTEND_URL || 'https://lankatender.com'}/unsubscribe" style="color: #6c757d; text-decoration: none;">
              Unsubscribe
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>`;
  }

  generateAlertEmailText(tenderMatches, alertConfig) {
    let text = `TENDER ALERT: ${alertConfig.name}\n`;
    text += `${'='.repeat(50)}\n\n`;
    text += `We found ${tenderMatches.length} new tender${tenderMatches.length > 1 ? 's' : ''} that match${tenderMatches.length === 1 ? 'es' : ''} your criteria:\n\n`;

    tenderMatches.forEach((tender, index) => {
      text += `${index + 1}. ${tender.title}\n`;
      text += `   Category: ${tender.category}\n`;
      text += `   Organization: ${tender.organization.name} (${tender.organization.type})\n`;
      text += `   Location: ${tender.location.district}, ${tender.location.province}\n`;
      text += `   Closing Date: ${new Date(tender.dates.closing).toLocaleDateString()}\n`;
      if (tender.financials?.estimatedValue) {
        text += `   Estimated Value: ${tender.financials.estimatedValue.currency} ${tender.financials.estimatedValue.amount.toLocaleString()}\n`;
      }
      text += `   Link: ${process.env.FRONTEND_URL || 'https://lankatender.com'}/tenders/${tender._id}\n\n`;
    });

    text += `Manage your alerts: ${process.env.FRONTEND_URL || 'https://lankatender.com'}/alerts\n`;
    text += `Unsubscribe: ${process.env.FRONTEND_URL || 'https://lankatender.com'}/unsubscribe\n`;

    return text;
  }

  generateSummaryEmailHTML(groupedTenders, frequency, user) {
    let totalTenders = 0;
    const alertSections = Object.entries(groupedTenders).map(([alertId, data]) => {
      totalTenders += data.tenders.length;
      if (data.tenders.length === 0) return '';

      const tenderItems = data.tenders.map(tender => `
        <tr style="border-bottom: 1px solid #e9ecef;">
          <td style="padding: 12px 0;">
            <div style="font-weight: 600; color: #2c3e50; margin-bottom: 4px;">${tender.title}</div>
            <div style="font-size: 14px; color: #6c757d; margin-bottom: 4px;">${tender.organization.name}</div>
            <div style="font-size: 12px; color: #adb5bd;">
              ${tender.location.district}, ${tender.location.province} •
              Closes: ${new Date(tender.dates.closing).toLocaleDateString()}
            </div>
          </td>
          <td style="padding: 12px 0; text-align: right;">
            <a href="${process.env.FRONTEND_URL || 'https://lankatender.com'}/tenders/${tender._id}"
               style="background-color: #ff6b35; color: white; padding: 6px 12px; text-decoration: none; border-radius: 4px; font-size: 12px;">
              View
            </a>
          </td>
        </tr>
      `).join('');

      return `
        <div style="margin-bottom: 30px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px; padding-bottom: 8px; border-bottom: 2px solid #ff6b35;">
            📋 ${data.config.name} (${data.tenders.length} matches)
          </h3>
          <table style="width: 100%; border-collapse: collapse;">
            ${tenderItems}
          </table>
        </div>
      `;
    }).join('');

    if (totalTenders === 0) {
      return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${frequency} Tender Summary</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; padding: 40px; text-align: center;">
          <h2 style="color: #6c757d;">No New Matches</h2>
          <p style="color: #6c757d;">No new tenders matched your alert criteria this ${frequency.toLowerCase()}.</p>
        </div>
      </body>
      </html>`;
    }

    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${frequency} Tender Summary</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5; margin: 0; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ff6b35, #f7931e); color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 600;">📊 ${frequency.charAt(0).toUpperCase() + frequency.slice(1)} Summary</h1>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 16px;">${totalTenders} new tender matches</p>
        </div>

        <!-- Content -->
        <div style="padding: 30px 20px;">
          <p style="font-size: 16px; color: #2c3e50; margin-bottom: 25px;">
            Hello ${user.firstName || user.name || 'there'}! Here's your ${frequency.toLowerCase()} tender summary:
          </p>

          ${alertSections}
        </div>

        <!-- Footer -->
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e9ecef;">
          <p style="margin: 0; font-size: 14px; color: #6c757d;">
            <a href="${process.env.FRONTEND_URL || 'https://lankatender.com'}/alerts" style="color: #ff6b35; text-decoration: none;">
              Manage your alerts
            </a> |
            <a href="${process.env.FRONTEND_URL || 'https://lankatender.com'}/unsubscribe" style="color: #6c757d; text-decoration: none;">
              Unsubscribe
            </a>
          </p>
        </div>
      </div>
    </body>
    </html>`;
  }

  generateSummaryEmailText(groupedTenders, frequency, user) {
    let text = `${frequency.toUpperCase()} TENDER SUMMARY\n`;
    text += `${'='.repeat(50)}\n\n`;
    text += `Hello ${user.firstName || user.name || 'there'}!\n\n`;

    let totalTenders = 0;
    Object.entries(groupedTenders).forEach(([alertId, data]) => {
      totalTenders += data.tenders.length;
      if (data.tenders.length === 0) return;

      text += `${data.config.name} (${data.tenders.length} matches)\n`;
      text += `${'-'.repeat(30)}\n`;

      data.tenders.forEach((tender, index) => {
        text += `${index + 1}. ${tender.title}\n`;
        text += `   ${tender.organization.name}\n`;
        text += `   ${tender.location.district}, ${tender.location.province}\n`;
        text += `   Closes: ${new Date(tender.dates.closing).toLocaleDateString()}\n`;
        text += `   Link: ${process.env.FRONTEND_URL || 'https://lankatender.com'}/tenders/${tender._id}\n\n`;
      });
    });

    if (totalTenders === 0) {
      text += `No new tenders matched your alert criteria this ${frequency.toLowerCase()}.\n\n`;
    }

    text += `Manage your alerts: ${process.env.FRONTEND_URL || 'https://lankatender.com'}/alerts\n`;
    text += `Unsubscribe: ${process.env.FRONTEND_URL || 'https://lankatender.com'}/unsubscribe\n`;

    return text;
  }

  async testConnection() {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await this.transporter.verify();
      logger.info('Email service connection test successful');
      return { success: true, message: 'Email service is working correctly' };
    } catch (error) {
      logger.error('Email service connection test failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton instance
export default new EmailService();