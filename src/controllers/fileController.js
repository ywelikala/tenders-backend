import fs from 'fs/promises';
import path from 'path';
import Tender from '../models/Tender.js';
import { UserSubscription } from '../models/Subscription.js';

// @desc    Upload tender documents
// @route   POST /api/files/tender/:tenderId/documents
// @access  Private
export const uploadTenderDocuments = async (req, res) => {
  try {
    const { tenderId } = req.params;

    // Find tender
    const tender = await Tender.findById(tenderId);
    if (!tender || !tender.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Tender not found'
      });
    }

    // Check ownership or admin role
    if (tender.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to upload documents for this tender'
      });
    }

    // Check if files were uploaded
    if (!req.processedDocuments || req.processedDocuments.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    // Add documents to tender
    tender.documents.push(...req.processedDocuments);
    tender.updatedBy = req.user.id;
    await tender.save();

    res.status(200).json({
      success: true,
      message: 'Documents uploaded successfully',
      data: {
        documents: req.processedDocuments,
        totalDocuments: tender.documents.length
      }
    });
  } catch (error) {
    console.error('Upload tender documents error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid tender ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while uploading documents'
    });
  }
};

// @desc    Download tender document
// @route   GET /api/files/tender/:tenderId/documents/:documentId
// @access  Private
export const downloadTenderDocument = async (req, res) => {
  try {
    const { tenderId, documentId } = req.params;

    // Find tender
    const tender = await Tender.findById(tenderId);
    if (!tender || !tender.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Tender not found'
      });
    }

    // Check visibility permissions
    if (tender.visibility === 'registered' && !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to download documents'
      });
    }

    if (tender.visibility === 'premium') {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Premium subscription required to download documents'
        });
      }

      const subscription = await UserSubscription.findOne({ user: req.user.id });
      if (!subscription || !['premium', 'enterprise'].includes(subscription.plan)) {
        return res.status(403).json({
          success: false,
          message: 'Premium subscription required to download documents'
        });
      }
    }

    // Find document
    const document = tender.documents.id(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Check if file exists
    const filePath = path.join(process.cwd(), document.url);
    try {
      await fs.access(filePath);
    } catch (error) {
      return res.status(404).json({
        success: false,
        message: 'File not found on server'
      });
    }

    // Increment download count
    await tender.incrementDownload();

    // Track user document download if authenticated
    if (req.user) {
      const subscription = await UserSubscription.findOne({ user: req.user.id });
      if (subscription) {
        await subscription.incrementUsage('documentsDownloaded');
      }
    }

    // Set appropriate headers
    res.setHeader('Content-Disposition', `attachment; filename="${document.name}"`);
    res.setHeader('Content-Type', 'application/octet-stream');

    // Stream file
    const fileStream = await fs.readFile(filePath);
    res.send(fileStream);
  } catch (error) {
    console.error('Download tender document error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid tender or document ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while downloading document'
    });
  }
};

// @desc    Delete tender document
// @route   DELETE /api/files/tender/:tenderId/documents/:documentId
// @access  Private
export const deleteTenderDocument = async (req, res) => {
  try {
    const { tenderId, documentId } = req.params;

    // Find tender
    const tender = await Tender.findById(tenderId);
    if (!tender || !tender.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Tender not found'
      });
    }

    // Check ownership or admin role
    if (tender.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete documents from this tender'
      });
    }

    // Find document
    const document = tender.documents.id(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Delete file from filesystem
    const filePath = path.join(process.cwd(), document.url);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Error deleting file:', error);
      // Continue even if file deletion fails
    }

    // Remove document from tender
    tender.documents.pull(documentId);
    tender.updatedBy = req.user.id;
    await tender.save();

    res.status(200).json({
      success: true,
      message: 'Document deleted successfully'
    });
  } catch (error) {
    console.error('Delete tender document error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid tender or document ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while deleting document'
    });
  }
};

// @desc    Get tender documents list
// @route   GET /api/files/tender/:tenderId/documents
// @access  Public (with restrictions based on visibility)
export const getTenderDocuments = async (req, res) => {
  try {
    const { tenderId } = req.params;

    // Find tender
    const tender = await Tender.findById(tenderId);
    if (!tender || !tender.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Tender not found'
      });
    }

    // Check visibility permissions
    if (tender.visibility === 'registered' && !req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to view documents'
      });
    }

    if (tender.visibility === 'premium') {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Premium subscription required to view documents'
        });
      }

      const subscription = await UserSubscription.findOne({ user: req.user.id });
      if (!subscription || !['premium', 'enterprise'].includes(subscription.plan)) {
        return res.status(403).json({
          success: false,
          message: 'Premium subscription required to view documents'
        });
      }
    }

    // Return documents list (without file contents)
    const documents = tender.documents.map(doc => ({
      _id: doc._id,
      name: doc.name,
      type: doc.type,
      size: doc.size,
      uploadedAt: doc.uploadedAt
    }));

    res.status(200).json({
      success: true,
      data: {
        documents,
        count: documents.length
      }
    });
  } catch (error) {
    console.error('Get tender documents error:', error);
    
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid tender ID'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error while fetching documents'
    });
  }
};

// @desc    Upload profile image
// @route   POST /api/files/profile/image
// @access  Private
export const uploadProfileImage = async (req, res) => {
  try {
    // Check if file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file uploaded'
      });
    }

    // Process uploaded file
    const imageData = {
      name: req.file.originalname,
      url: path.relative(process.cwd(), req.file.path).replace(/\\/g, '/'),
      type: getFileType(req.file.originalname),
      size: req.file.size,
      uploadedAt: new Date()
    };

    // TODO: Update user profile with image URL
    // await User.findByIdAndUpdate(req.user.id, { profileImage: imageData.url });

    res.status(200).json({
      success: true,
      message: 'Profile image uploaded successfully',
      data: {
        image: imageData
      }
    });
  } catch (error) {
    console.error('Upload profile image error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while uploading profile image'
    });
  }
};

// @desc    Get file storage statistics
// @route   GET /api/files/stats
// @access  Private (Admin only)
export const getFileStats = async (req, res) => {
  try {
    // Get all tenders with documents
    const tendersWithDocs = await Tender.find({
      isActive: true,
      'documents.0': { $exists: true }
    }).select('documents');

    let totalFiles = 0;
    let totalSize = 0;
    const fileTypes = {};

    tendersWithDocs.forEach(tender => {
      tender.documents.forEach(doc => {
        totalFiles++;
        totalSize += doc.size || 0;
        
        if (fileTypes[doc.type]) {
          fileTypes[doc.type]++;
        } else {
          fileTypes[doc.type] = 1;
        }
      });
    });

    res.status(200).json({
      success: true,
      data: {
        totalFiles,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        fileTypes,
        tendersWithDocuments: tendersWithDocs.length
      }
    });
  } catch (error) {
    console.error('Get file stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching file statistics'
    });
  }
};

// Utility function to format bytes
const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Import getFileType function
const getFileType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  
  if (['.pdf'].includes(ext)) return 'pdf';
  if (['.doc', '.docx'].includes(ext)) return 'doc';
  if (['.xls', '.xlsx'].includes(ext)) return 'xls';
  if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext)) return 'image';
  
  return 'other';
};