import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(process.cwd(), 'uploads');
const tendersDir = path.join(uploadsDir, 'tenders');
const profilesDir = path.join(uploadsDir, 'profiles');

[uploadsDir, tendersDir, profilesDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = uploadsDir;
    
    // Determine upload path based on route
    if (req.route.path.includes('tender')) {
      uploadPath = tendersDir;
    } else if (req.route.path.includes('profile')) {
      uploadPath = profilesDir;
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Generate unique filename
    const uniqueSuffix = uuidv4();
    const fileExtension = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, fileExtension);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    
    cb(null, `${sanitizedBaseName}_${uniqueSuffix}${fileExtension}`);
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Define allowed file types
  const allowedTypes = {
    document: /\.(pdf|doc|docx|xls|xlsx)$/i,
    image: /\.(jpg|jpeg|png|gif|bmp|webp)$/i,
    any: /\.(pdf|doc|docx|xls|xlsx|jpg|jpeg|png|gif|bmp|webp)$/i
  };
  
  // Default to any if not specified
  const filterType = req.fileFilterType || 'any';
  const allowedPattern = allowedTypes[filterType];
  
  if (allowedPattern.test(file.originalname)) {
    // Additional MIME type validation
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/bmp',
      'image/webp'
    ];
    
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. MIME type ${file.mimetype} not allowed.`), false);
    }
  } else {
    cb(new Error(`Invalid file type. Only ${filterType} files are allowed.`), false);
  }
};

// Create multer instances
const createUploadMiddleware = (options = {}) => {
  const {
    maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB default
    maxFiles = 5,
    fileTypes = 'any'
  } = options;
  
  return multer({
    storage,
    fileFilter: (req, file, cb) => {
      req.fileFilterType = fileTypes;
      fileFilter(req, file, cb);
    },
    limits: {
      fileSize: maxFileSize,
      files: maxFiles
    }
  });
};

// Specific upload middlewares
export const uploadTenderDocuments = createUploadMiddleware({
  maxFiles: 10,
  fileTypes: 'document'
});

export const uploadProfileImage = createUploadMiddleware({
  maxFiles: 1,
  fileTypes: 'image',
  maxFileSize: 5 * 1024 * 1024 // 5MB for profile images
});

export const uploadAnyFile = createUploadMiddleware();

// Error handling middleware for multer
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          message: `File too large. Maximum size is ${process.env.MAX_FILE_SIZE || '10MB'}`
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          message: 'Too many files. Maximum allowed files exceeded'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          message: 'Unexpected file field'
        });
      default:
        return res.status(400).json({
          success: false,
          message: `Upload error: ${error.message}`
        });
    }
  }
  
  if (error.message.includes('Invalid file type')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
};

// Utility function to delete uploaded files
export const deleteUploadedFiles = async (files) => {
  if (!files || !Array.isArray(files)) return;
  
  const deletePromises = files.map(file => {
    return new Promise((resolve) => {
      fs.unlink(file.path, (err) => {
        if (err) {
          console.error(`Error deleting file ${file.path}:`, err);
        }
        resolve();
      });
    });
  });
  
  await Promise.all(deletePromises);
};

// Utility function to get file type from extension
export const getFileType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.doc', '.docx'].includes(ext)) return 'doc';
  if (['.xls', '.xlsx'].includes(ext)) return 'xls';
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) return 'image';
  
  return 'other';
};

// Middleware to process uploaded files for tender documents
export const processTenderDocuments = (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return next();
  }
  
  // Process uploaded files
  req.processedDocuments = req.files.map(file => ({
    name: file.originalname,
    url: path.relative(process.cwd(), file.path).replace(/\\/g, '/'),
    type: getFileType(file.originalname),
    size: file.size,
    uploadedAt: new Date()
  }));
  
  next();
};

// Middleware to validate file requirements
export const validateFileRequirements = (req, res, next) => {
  // Check if files are required but not provided
  if (req.body.requiresDocuments === 'true' && (!req.files || req.files.length === 0)) {
    return res.status(400).json({
      success: false,
      message: 'At least one document is required for this tender'
    });
  }
  
  next();
};