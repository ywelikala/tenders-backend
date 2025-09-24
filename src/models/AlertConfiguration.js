import mongoose from 'mongoose';

const alertConfigurationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Alert name is required'],
    trim: true,
    maxlength: [100, 'Alert name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Keywords to match against tender titles and descriptions
  keywords: [{
    term: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    matchType: {
      type: String,
      enum: ['exact', 'contains', 'starts_with', 'ends_with'],
      default: 'contains'
    }
  }],
  // Categories to match
  categories: [{
    type: String,
    trim: true
  }],
  // Locations to match
  locations: {
    provinces: [{
      type: String,
      trim: true
    }],
    districts: [{
      type: String,
      trim: true
    }],
    cities: [{
      type: String,
      trim: true
    }]
  },
  // Organization types to match
  organizationTypes: [{
    type: String,
    enum: ['government', 'private', 'semi-government', 'ngo']
  }],
  // Value range filters
  estimatedValue: {
    min: {
      type: Number,
      min: 0
    },
    max: {
      type: Number,
      min: 0
    },
    currency: {
      type: String,
      default: 'LKR'
    }
  },
  // Email configuration
  emailSettings: {
    enabled: {
      type: Boolean,
      default: true
    },
    frequency: {
      type: String,
      enum: ['immediate', 'daily', 'weekly'],
      default: 'immediate'
    },
    // Custom email address (if different from user email)
    customEmail: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
    },
    lastSentAt: {
      type: Date
    },
    dailySummaryTime: {
      type: String,
      default: '09:00', // 24-hour format
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Please enter valid time in HH:MM format']
    }
  },
  // Alert statistics
  stats: {
    totalMatches: {
      type: Number,
      default: 0
    },
    emailsSent: {
      type: Number,
      default: 0
    },
    lastMatchedTender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tender'
    },
    lastMatchedAt: {
      type: Date
    }
  },
  // Advanced filters
  advancedFilters: {
    // Exclude keywords (negative matching)
    excludeKeywords: [{
      type: String,
      trim: true,
      lowercase: true
    }],
    // Minimum days until closing
    minDaysUntilClosing: {
      type: Number,
      min: 0
    },
    // Maximum days until closing
    maxDaysUntilClosing: {
      type: Number,
      min: 0
    },
    // Tender status filters
    includedStatuses: [{
      type: String,
      enum: ['draft', 'published', 'closed', 'awarded', 'cancelled']
    }],
    // Priority filters
    includedPriorities: [{
      type: String,
      enum: ['low', 'medium', 'high', 'urgent']
    }]
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient querying
alertConfigurationSchema.index({ user: 1, isActive: 1 });
alertConfigurationSchema.index({ 'keywords.term': 1 });
alertConfigurationSchema.index({ categories: 1 });
alertConfigurationSchema.index({ 'locations.provinces': 1 });
alertConfigurationSchema.index({ 'locations.districts': 1 });
alertConfigurationSchema.index({ createdAt: -1 });
alertConfigurationSchema.index({ 'emailSettings.frequency': 1, 'emailSettings.enabled': 1 });

// Virtual for getting effective email address
alertConfigurationSchema.virtual('effectiveEmail').get(function() {
  return this.emailSettings.customEmail || this.user?.email;
});

// Method to check if alert should trigger for a tender
alertConfigurationSchema.methods.shouldTriggerForTender = function(tender) {
  if (!this.isActive) return false;

  // Check keywords matching
  if (this.keywords.length > 0) {
    const keywordMatch = this.keywords.some(keyword => {
      const term = keyword.term.toLowerCase();
      const title = tender.title.toLowerCase();
      const description = (tender.description || '').toLowerCase();
      const fullText = (tender.fullTextMarkdown || '').toLowerCase();

      const textToSearch = `${title} ${description} ${fullText}`;

      switch (keyword.matchType) {
        case 'exact':
          return textToSearch.includes(` ${term} `) ||
                 textToSearch.startsWith(`${term} `) ||
                 textToSearch.endsWith(` ${term}`) ||
                 textToSearch === term;
        case 'starts_with':
          return textToSearch.includes(` ${term}`) || textToSearch.startsWith(term);
        case 'ends_with':
          return textToSearch.includes(`${term} `) || textToSearch.endsWith(term);
        case 'contains':
        default:
          return textToSearch.includes(term);
      }
    });

    if (!keywordMatch) return false;
  }

  // Check exclude keywords
  if (this.advancedFilters.excludeKeywords.length > 0) {
    const title = tender.title.toLowerCase();
    const description = (tender.description || '').toLowerCase();
    const fullText = (tender.fullTextMarkdown || '').toLowerCase();
    const textToSearch = `${title} ${description} ${fullText}`;

    const hasExcludedKeyword = this.advancedFilters.excludeKeywords.some(keyword =>
      textToSearch.includes(keyword.toLowerCase())
    );

    if (hasExcludedKeyword) return false;
  }

  // Check categories
  if (this.categories.length > 0 && !this.categories.includes(tender.category)) {
    return false;
  }

  // Check locations
  const locations = this.locations;
  if (locations.provinces.length > 0 && !locations.provinces.includes(tender.location.province)) {
    return false;
  }
  if (locations.districts.length > 0 && !locations.districts.includes(tender.location.district)) {
    return false;
  }
  if (locations.cities.length > 0 && tender.location.city && !locations.cities.includes(tender.location.city)) {
    return false;
  }

  // Check organization types
  if (this.organizationTypes.length > 0 && !this.organizationTypes.includes(tender.organization.type)) {
    return false;
  }

  // Check estimated value range
  if (this.estimatedValue.min || this.estimatedValue.max) {
    const tenderValue = tender.financials?.estimatedValue?.amount;
    if (tenderValue) {
      if (this.estimatedValue.min && tenderValue < this.estimatedValue.min) return false;
      if (this.estimatedValue.max && tenderValue > this.estimatedValue.max) return false;
    }
  }

  // Check days until closing
  if (this.advancedFilters.minDaysUntilClosing || this.advancedFilters.maxDaysUntilClosing) {
    const closingDate = new Date(tender.dates.closing);
    const now = new Date();
    const daysUntilClosing = Math.ceil((closingDate - now) / (1000 * 60 * 60 * 24));

    if (this.advancedFilters.minDaysUntilClosing && daysUntilClosing < this.advancedFilters.minDaysUntilClosing) {
      return false;
    }
    if (this.advancedFilters.maxDaysUntilClosing && daysUntilClosing > this.advancedFilters.maxDaysUntilClosing) {
      return false;
    }
  }

  // Check tender status
  if (this.advancedFilters.includedStatuses.length > 0 && !this.advancedFilters.includedStatuses.includes(tender.status)) {
    return false;
  }

  // Check tender priority
  if (this.advancedFilters.includedPriorities.length > 0 && !this.advancedFilters.includedPriorities.includes(tender.priority)) {
    return false;
  }

  return true;
};

// Method to update statistics
alertConfigurationSchema.methods.updateStats = function(tender) {
  this.stats.totalMatches += 1;
  this.stats.lastMatchedTender = tender._id;
  this.stats.lastMatchedAt = new Date();
  return this.save();
};

// Method to increment email sent count
alertConfigurationSchema.methods.incrementEmailSent = function() {
  this.stats.emailsSent += 1;
  this.emailSettings.lastSentAt = new Date();
  return this.save();
};

// Static method to find alerts that should be processed
alertConfigurationSchema.statics.findActiveAlertsForUser = function(userId) {
  return this.find({
    user: userId,
    isActive: true,
    'emailSettings.enabled': true
  }).populate('user', 'email subscription');
};

// Static method to find alerts for immediate processing
alertConfigurationSchema.statics.findImmediateAlerts = function() {
  return this.find({
    isActive: true,
    'emailSettings.enabled': true,
    'emailSettings.frequency': 'immediate'
  }).populate('user', 'email subscription');
};

// Static method to find alerts for daily processing
alertConfigurationSchema.statics.findDailyAlerts = function(time = '09:00') {
  return this.find({
    isActive: true,
    'emailSettings.enabled': true,
    'emailSettings.frequency': 'daily',
    'emailSettings.dailySummaryTime': time
  }).populate('user', 'email subscription');
};

// Static method to find alerts for weekly processing (every Monday)
alertConfigurationSchema.statics.findWeeklyAlerts = function() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  return this.find({
    isActive: true,
    'emailSettings.enabled': true,
    'emailSettings.frequency': 'weekly',
    $or: [
      { 'emailSettings.lastSentAt': { $lte: oneWeekAgo } },
      { 'emailSettings.lastSentAt': { $exists: false } }
    ]
  }).populate('user', 'email subscription');
};

export default mongoose.model('AlertConfiguration', alertConfigurationSchema);