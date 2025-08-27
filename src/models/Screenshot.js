import mongoose from 'mongoose';

const screenshotSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: [true, 'Filename is required'],
    trim: true
  },
  originalName: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true
  },
  contentType: {
    type: String,
    required: [true, 'Content type is required'],
    enum: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
  },
  size: {
    type: Number,
    required: [true, 'File size is required']
  },
  imageData: {
    type: Buffer,
    required: [true, 'Image data is required']
  },
  source: {
    type: String,
    required: [true, 'Source is required'],
    enum: ['tender-scraper', 'manual-upload', 'other'],
    default: 'tender-scraper'
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  metadata: {
    userAgent: String,
    url: String,
    timestamp: Date,
    environment: {
      type: String,
      enum: ['local', 'cloud-run', 'development', 'production'],
      default: 'production'
    },
    error: String,
    cloudRunJobName: String,
    cloudRunJobId: String,
    scraperVersion: String
  },
  tags: [{
    type: String,
    trim: true
  }],
  isPublic: {
    type: Boolean,
    default: false
  },
  viewCount: {
    type: Number,
    default: 0
  },
  lastViewed: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      // Don't include the binary data in JSON responses by default
      if (ret.imageData) {
        delete ret.imageData;
        ret.hasImageData = true;
      }
      return ret;
    }
  },
  toObject: { virtuals: true }
});

// Indexes for performance
screenshotSchema.index({ source: 1, createdAt: -1 });
screenshotSchema.index({ 'metadata.environment': 1 });
screenshotSchema.index({ 'metadata.cloudRunJobName': 1 });
screenshotSchema.index({ tags: 1 });
screenshotSchema.index({ createdAt: -1 });

// Virtual for file size in human readable format
screenshotSchema.virtual('sizeFormatted').get(function() {
  const bytes = this.size;
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = 2;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
});

// Method to increment view count
screenshotSchema.methods.incrementViewCount = function() {
  this.viewCount += 1;
  this.lastViewed = new Date();
  return this.save();
};

// Static method to clean old screenshots (optional cleanup)
screenshotSchema.statics.cleanupOldScreenshots = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return await this.deleteMany({
    createdAt: { $lt: cutoffDate },
    isPublic: false
  });
};

// Static method to get screenshots by environment
screenshotSchema.statics.getByEnvironment = function(environment, limit = 50) {
  return this.find({ 'metadata.environment': environment })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-imageData'); // Exclude image data for list view
};

// Static method to get recent scraper screenshots
screenshotSchema.statics.getRecentScraperScreenshots = function(limit = 20) {
  return this.find({ source: 'tender-scraper' })
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('-imageData'); // Exclude image data for list view
};

export default mongoose.model('Screenshot', screenshotSchema);