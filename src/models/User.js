import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: function() {
      // Password is not required for social logins
      return !this.googleId && !this.facebookId;
    },
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  firstName: {
    type: String,
    required: function() {
      // Name fields not required for social logins if 'name' field is provided
      return !this.googleId && !this.facebookId && !this.name;
    },
    trim: true,
    maxlength: [50, 'First name cannot exceed 50 characters']
  },
  lastName: {
    type: String,
    required: function() {
      // Name fields not required for social logins if 'name' field is provided
      return !this.googleId && !this.facebookId && !this.name;
    },
    trim: true,
    maxlength: [50, 'Last name cannot exceed 50 characters']
  },
  company: {
    type: String,
    trim: true,
    maxlength: [100, 'Company name cannot exceed 100 characters']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^\+?[\d\s\-\(\)]{10,}$/, 'Please enter a valid phone number']
  },
  role: {
    type: String,
    enum: ['buyer', 'supplier', 'admin'],
    default: 'supplier'
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: {
    type: String,
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'basic', 'professional', 'enterprise'],
      default: 'free'
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'cancelled', 'suspended', 'past_due', 'cancelling'],
      default: 'active'
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date
    },
    nextBillingDate: {
      type: Date
    },
    lastPaymentDate: {
      type: Date
    },
    stripeSubscriptionId: {
      type: String
    },
    features: {
      maxTenderViews: {
        type: Number,
        default: 10
      },
      canUploadTenders: {
        type: Boolean,
        default: false
      },
      advancedFiltering: {
        type: Boolean,
        default: false
      },
      emailAlerts: {
        type: Boolean,
        default: false
      },
      apiAccess: {
        type: Boolean,
        default: false
      },
      prioritySupport: {
        type: Boolean,
        default: false
      },
      customReports: {
        type: Boolean,
        default: false
      },
      archiveAccess: {
        type: Number,
        default: 0 // days
      },
      alertFrequency: {
        type: String,
        enum: ['none', 'weekly', 'daily', 'realtime'],
        default: 'none'
      }
    }
  },
  stripeCustomerId: {
    type: String
  },
  usage: {
    tenderViewsThisMonth: {
      type: Number,
      default: 0
    },
    lastTenderView: {
      type: Date
    },
    totalTendersUploaded: {
      type: Number,
      default: 0
    }
  },
  preferences: {
    categories: [{
      type: String
    }],
    locations: [{
      type: String
    }],
    emailNotifications: {
      newTenders: {
        type: Boolean,
        default: true
      },
      tenderUpdates: {
        type: Boolean,
        default: true
      },
      subscriptionUpdates: {
        type: Boolean,
        default: true
      }
    }
  },
  lastLogin: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Social login fields
  googleId: {
    type: String,
    sparse: true // Allow multiple null values but ensure uniqueness for non-null values
  },
  facebookId: {
    type: String,
    sparse: true // Allow multiple null values but ensure uniqueness for non-null values
  },
  profilePicture: {
    type: String
  },
  name: {
    type: String, // For social logins that provide full name
    trim: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1 });
userSchema.index({ 'subscription.plan': 1 });
userSchema.index({ createdAt: -1 });

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Check if user can view tender based on subscription
userSchema.methods.canViewTender = function() {
  if (this.subscription.plan === 'free') {
    return this.usage.tenderViewsThisMonth < this.subscription.features.maxTenderViews;
  }
  return true;
};

// Increment tender view count
userSchema.methods.incrementTenderView = function() {
  this.usage.tenderViewsThisMonth += 1;
  this.usage.lastTenderView = new Date();
  return this.save();
};

// Reset monthly usage (to be called by cron job)
userSchema.methods.resetMonthlyUsage = function() {
  this.usage.tenderViewsThisMonth = 0;
  return this.save();
};

export default mongoose.model('User', userSchema);