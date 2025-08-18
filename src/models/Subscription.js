import mongoose from 'mongoose';

const subscriptionPlanSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Plan name is required'],
    enum: ['free', 'basic', 'premium', 'enterprise']
  },
  displayName: {
    type: String,
    required: [true, 'Display name is required']
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  price: {
    monthly: {
      type: Number,
      required: [true, 'Monthly price is required'],
      min: 0
    },
    yearly: {
      type: Number,
      required: [true, 'Yearly price is required'],
      min: 0
    }
  },
  features: {
    maxTenderViews: {
      type: Number,
      required: [true, 'Max tender views is required'],
      min: -1 // -1 means unlimited
    },
    canUploadTenders: {
      type: Boolean,
      required: [true, 'Can upload tenders flag is required']
    },
    maxTenderUploads: {
      type: Number,
      default: 0,
      min: -1 // -1 means unlimited
    },
    advancedFiltering: {
      type: Boolean,
      required: [true, 'Advanced filtering flag is required']
    },
    emailAlerts: {
      type: Boolean,
      required: [true, 'Email alerts flag is required']
    },
    prioritySupport: {
      type: Boolean,
      default: false
    },
    apiAccess: {
      type: Boolean,
      default: false
    },
    customReports: {
      type: Boolean,
      default: false
    },
    bulkDownloads: {
      type: Boolean,
      default: false
    }
  },
  limits: {
    documentsPerTender: {
      type: Number,
      default: 5,
      min: -1 // -1 means unlimited
    },
    maxFileSize: {
      type: Number,
      default: 10485760, // 10MB
      min: 0
    },
    savedSearches: {
      type: Number,
      default: 0,
      min: -1 // -1 means unlimited
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const userSubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'User is required']
  },
  plan: {
    type: String,
    required: [true, 'Plan is required'],
    enum: ['free', 'basic', 'premium', 'enterprise']
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'suspended', 'expired'],
    default: 'active'
  },
  billingCycle: {
    type: String,
    enum: ['monthly', 'yearly'],
    default: 'monthly'
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required'],
    default: Date.now
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  nextBillingDate: {
    type: Date
  },
  payment: {
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: 0
    },
    currency: {
      type: String,
      default: 'LKR'
    },
    method: {
      type: String,
      enum: ['credit_card', 'bank_transfer', 'paypal', 'stripe'],
      required: function() {
        return this.amount > 0;
      }
    },
    transactionId: String,
    paymentDate: Date
  },
  usage: {
    currentPeriodStart: {
      type: Date,
      default: Date.now
    },
    currentPeriodEnd: {
      type: Date
    },
    tenderViews: {
      type: Number,
      default: 0
    },
    tenderUploads: {
      type: Number,
      default: 0
    },
    documentsDownloaded: {
      type: Number,
      default: 0
    },
    apiCalls: {
      type: Number,
      default: 0
    }
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  cancellation: {
    cancelledAt: Date,
    reason: String,
    refundAmount: Number,
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'denied', 'not_applicable']
    }
  },
  history: [{
    action: {
      type: String,
      enum: ['created', 'upgraded', 'downgraded', 'renewed', 'cancelled', 'suspended', 'reactivated']
    },
    fromPlan: String,
    toPlan: String,
    date: {
      type: Date,
      default: Date.now
    },
    reason: String,
    amount: Number
  }],
  metadata: {
    promotionCode: String,
    referralCode: String,
    notes: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for SubscriptionPlan
subscriptionPlanSchema.index({ name: 1 }, { unique: true });
subscriptionPlanSchema.index({ isActive: 1 });
subscriptionPlanSchema.index({ sortOrder: 1 });

// Indexes for UserSubscription
userSubscriptionSchema.index({ user: 1 });
userSubscriptionSchema.index({ plan: 1 });
userSubscriptionSchema.index({ status: 1 });
userSubscriptionSchema.index({ endDate: 1 });
userSubscriptionSchema.index({ nextBillingDate: 1 });

// Virtual for days remaining
userSubscriptionSchema.virtual('daysRemaining').get(function() {
  if (this.status !== 'active') return 0;
  
  const now = new Date();
  const end = new Date(this.endDate);
  const diffTime = end - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
});

// Virtual for is expired
userSubscriptionSchema.virtual('isExpired').get(function() {
  return new Date() > new Date(this.endDate);
});

// Method to check if user can perform action
userSubscriptionSchema.methods.canPerformAction = async function(action) {
  if (this.status !== 'active' || this.isExpired) {
    return false;
  }
  
  const SubscriptionPlan = mongoose.model('SubscriptionPlan');
  const plan = await SubscriptionPlan.findOne({ name: this.plan });
  
  if (!plan) return false;
  
  switch (action) {
    case 'view_tender':
      if (this.plan === 'free') {
        return this.usage.tenderViews < plan.features.maxTenderViews;
      }
      return true;
      
    case 'upload_tender':
      if (!plan.features.canUploadTenders) return false;
      if (plan.features.maxTenderUploads > 0) {
        return this.usage.tenderUploads < plan.features.maxTenderUploads;
      }
      return true;
      
    case 'advanced_filtering':
      return plan.features.advancedFiltering;
      
    case 'email_alerts':
      return plan.features.emailAlerts;
      
    case 'api_access':
      return plan.features.apiAccess;
      
    default:
      return false;
  }
};

// Method to increment usage
userSubscriptionSchema.methods.incrementUsage = function(type) {
  if (this.usage[type] !== undefined) {
    this.usage[type] += 1;
  }
  return this.save();
};

// Method to reset usage for new billing period
userSubscriptionSchema.methods.resetUsage = function() {
  this.usage.tenderViews = 0;
  this.usage.tenderUploads = 0;
  this.usage.documentsDownloaded = 0;
  this.usage.apiCalls = 0;
  this.usage.currentPeriodStart = new Date();
  
  // Set current period end based on billing cycle
  const endDate = new Date();
  if (this.billingCycle === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }
  this.usage.currentPeriodEnd = endDate;
  
  return this.save();
};

// Pre-save middleware to update status if expired
userSubscriptionSchema.pre('save', function(next) {
  if (this.isExpired && this.status === 'active') {
    this.status = 'expired';
  }
  next();
});

// Static method to get active subscriptions needing renewal
userSubscriptionSchema.statics.getSubscriptionsForRenewal = function(daysBeforeExpiry = 7) {
  const renewalDate = new Date();
  renewalDate.setDate(renewalDate.getDate() + daysBeforeExpiry);
  
  return this.find({
    status: 'active',
    autoRenew: true,
    endDate: { $lte: renewalDate }
  }).populate('user');
};

export const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
export const UserSubscription = mongoose.model('UserSubscription', userSubscriptionSchema);