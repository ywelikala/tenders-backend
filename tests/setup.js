import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { SubscriptionPlan } from '../src/models/Subscription.js';

let mongoServer;

// Setup before all tests
export const setupTestDB = async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri);
  
  // Create default subscription plans
  await createDefaultPlans();
};

// Cleanup after all tests
export const teardownTestDB = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  await mongoServer.stop();
};

// Clear database between tests
export const clearTestDB = async () => {
  const collections = mongoose.connection.collections;
  
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
  
  // Recreate default plans
  await createDefaultPlans();
};

// Create default subscription plans for testing
const createDefaultPlans = async () => {
  const defaultPlans = [
    {
      name: 'free',
      displayName: 'Free Plan',
      description: 'Basic access with limited features',
      price: { monthly: 0, yearly: 0 },
      features: {
        maxTenderViews: 10,
        canUploadTenders: false,
        maxTenderUploads: 0,
        advancedFiltering: false,
        emailAlerts: false,
        prioritySupport: false,
        apiAccess: false,
        customReports: false,
        bulkDownloads: false
      },
      limits: {
        documentsPerTender: 2,
        maxFileSize: 5242880, // 5MB
        savedSearches: 0
      },
      sortOrder: 1
    },
    {
      name: 'basic',
      displayName: 'Basic Plan',
      description: 'Enhanced features for small businesses',
      price: { monthly: 2500, yearly: 25000 },
      features: {
        maxTenderViews: 100,
        canUploadTenders: true,
        maxTenderUploads: 5,
        advancedFiltering: true,
        emailAlerts: true,
        prioritySupport: false,
        apiAccess: false,
        customReports: false,
        bulkDownloads: false
      },
      limits: {
        documentsPerTender: 5,
        maxFileSize: 10485760, // 10MB
        savedSearches: 5
      },
      sortOrder: 2
    },
    {
      name: 'premium',
      displayName: 'Premium Plan',
      description: 'Full features for growing businesses',
      price: { monthly: 5000, yearly: 50000 },
      features: {
        maxTenderViews: -1, // unlimited
        canUploadTenders: true,
        maxTenderUploads: 25,
        advancedFiltering: true,
        emailAlerts: true,
        prioritySupport: true,
        apiAccess: true,
        customReports: true,
        bulkDownloads: true
      },
      limits: {
        documentsPerTender: 10,
        maxFileSize: 52428800, // 50MB
        savedSearches: 20
      },
      sortOrder: 3
    },
    {
      name: 'enterprise',
      displayName: 'Enterprise Plan',
      description: 'Complete solution for large organizations',
      price: { monthly: 10000, yearly: 100000 },
      features: {
        maxTenderViews: -1, // unlimited
        canUploadTenders: true,
        maxTenderUploads: -1, // unlimited
        advancedFiltering: true,
        emailAlerts: true,
        prioritySupport: true,
        apiAccess: true,
        customReports: true,
        bulkDownloads: true
      },
      limits: {
        documentsPerTender: -1, // unlimited
        maxFileSize: 104857600, // 100MB
        savedSearches: -1 // unlimited
      },
      sortOrder: 4
    }
  ];

  await SubscriptionPlan.insertMany(defaultPlans);
};