import mongoose from 'mongoose';

const tenderSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Tender title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters']
  },
  description: {
    type: String,
    required: [true, 'Tender description is required'],
    trim: true,
    maxlength: [2000, 'Description cannot exceed 2000 characters']
  },
  fullTextMarkdown: {
    type: String,
    trim: true,
    maxlength: [10000, 'Full text markdown cannot exceed 10000 characters'],
    index: 'text' // Add text index for search
  },
  referenceNo: {
    type: String,
    required: [true, 'Reference number is required'],
    trim: true,
    uppercase: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Construction',
      'Computers & Laptops',
      'Computer & IT',
      'Upkeep/Repair',
      'Medical Equipment',
      'Office Supplies',
      'Vehicles',
      'Furniture',
      'Consultancy Services',
      'Engineering Services',
      'Security Services',
      'Catering Services',
      'Cleaning Services',
      'Other'
    ]
  },
  subcategory: {
    type: String,
    trim: true
  },
  organization: {
    name: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true
    },
    type: {
      type: String,
      enum: ['government', 'private', 'semi-government', 'ngo'],
      required: [true, 'Organization type is required']
    },
    contactPerson: {
      name: String,
      email: String,
      phone: String
    }
  },
  location: {
    province: {
      type: String,
      required: [true, 'Province is required'],
      enum: [
        'Western Province',
        'Central Province',
        'Southern Province',
        'Northern Province',
        'Eastern Province',
        'North Western Province',
        'North Central Province',
        'Uva Province',
        'Sabaragamuwa Province'
      ]
    },
    district: {
      type: String,
      required: [true, 'District is required']
    },
    city: String
  },
  dates: {
    published: {
      type: Date,
      required: [true, 'Published date is required'],
      default: Date.now
    },
    closing: {
      type: Date,
      required: [true, 'Closing date is required']
    },
    opening: Date
  },
  financials: {
    estimatedValue: {
      amount: Number,
      currency: {
        type: String,
        default: 'LKR'
      }
    },
    bidBond: {
      required: {
        type: Boolean,
        default: false
      },
      amount: Number,
      percentage: Number
    },
    performanceBond: {
      required: {
        type: Boolean,
        default: false
      },
      percentage: Number
    }
  },
  eligibility: {
    criteria: [String],
    documentRequired: [String],
    experience: {
      years: Number,
      description: String
    },
    turnover: {
      minimum: Number,
      currency: {
        type: String,
        default: 'LKR'
      }
    }
  },
  documents: [{
    name: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true
    },
    type: {
      type: String,
      enum: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'image'],
      required: true
    },
    size: Number,
    uploadedAt: {
      type: Date,
      default: Date.now
    }
  }],
  status: {
    type: String,
    enum: ['draft', 'published', 'closed', 'awarded', 'cancelled'],
    default: 'published'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  visibility: {
    type: String,
    enum: ['public', 'registered', 'premium'],
    default: 'public'
  },
  tags: [String],
  statistics: {
    views: {
      type: Number,
      default: 0
    },
    downloads: {
      type: Number,
      default: 0
    },
    applications: {
      type: Number,
      default: 0
    }
  },
  seo: {
    metaTitle: String,
    metaDescription: String,
    keywords: [String]
  },
  sourceUrl: {
    type: String,
    trim: true,
    maxlength: [500, 'Source URL cannot exceed 500 characters']
  },
  sourcePage: {
    type: Number,
    min: [1, 'Source page must be at least 1']
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
tenderSchema.index({ referenceNo: 1 }, { unique: true });
tenderSchema.index({ category: 1 });
tenderSchema.index({ 'location.province': 1 });
tenderSchema.index({ 'dates.closing': 1 });
tenderSchema.index({ status: 1 });
tenderSchema.index({ visibility: 1 });
tenderSchema.index({ createdAt: -1 });
tenderSchema.index({ 'dates.published': -1 });

// Text search index
tenderSchema.index({
  title: 'text',
  description: 'text',
  fullTextMarkdown: 'text',
  'organization.name': 'text',
  tags: 'text'
});

// Compound indexes
tenderSchema.index({ category: 1, status: 1 });
tenderSchema.index({ 'location.province': 1, status: 1 });
tenderSchema.index({ status: 1, 'dates.closing': 1 });

// Virtual for days remaining
tenderSchema.virtual('daysRemaining').get(function() {
  if (this.status !== 'published') return 0;
  
  const now = new Date();
  const closing = new Date(this.dates.closing);
  const diffTime = closing - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
});

// Virtual for is closing today
tenderSchema.virtual('isClosingToday').get(function() {
  const today = new Date();
  const closing = new Date(this.dates.closing);
  
  return today.toDateString() === closing.toDateString();
});

// Virtual for is expired
tenderSchema.virtual('isExpired').get(function() {
  return new Date() > new Date(this.dates.closing);
});

// Method to increment view count
tenderSchema.methods.incrementView = function() {
  this.statistics.views += 1;
  return this.save();
};

// Method to increment download count
tenderSchema.methods.incrementDownload = function() {
  this.statistics.downloads += 1;
  return this.save();
};

// Pre-save middleware to update status based on closing date
tenderSchema.pre('save', function(next) {
  if (this.isExpired && this.status === 'published') {
    this.status = 'closed';
  }
  next();
});

// Static method to get active tenders
tenderSchema.statics.getActiveTenders = function() {
  return this.find({
    status: 'published',
    isActive: true,
    'dates.closing': { $gte: new Date() }
  });
};

// Static method to get tenders by category
tenderSchema.statics.getTendersByCategory = function(category) {
  return this.find({
    category,
    status: 'published',
    isActive: true
  });
};

// Static method to search tenders
tenderSchema.statics.searchTenders = function(query, filters = {}) {
  const searchQuery = {
    isActive: true,
    ...filters
  };
  
  if (query) {
    searchQuery.$text = { $search: query };
  }
  
  return this.find(searchQuery);
};

export default mongoose.model('Tender', tenderSchema);