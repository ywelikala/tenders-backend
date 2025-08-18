import jwt from 'jsonwebtoken';
import User from '../../src/models/User.js';
import Tender from '../../src/models/Tender.js';
import { UserSubscription } from '../../src/models/Subscription.js';

// Generate JWT token for testing
export const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

// Create test user
export const createTestUser = async (userData = {}) => {
  const defaultUserData = {
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    role: 'supplier'
  };

  const user = await User.create({ ...defaultUserData, ...userData });
  const token = generateToken(user._id);
  
  return { user, token };
};

// Create test admin user
export const createTestAdmin = async (userData = {}) => {
  const adminData = {
    email: 'admin@example.com',
    password: 'password123',
    firstName: 'Admin',
    lastName: 'User',
    role: 'admin'
  };

  const user = await User.create({ ...adminData, ...userData });
  const token = generateToken(user._id);
  
  return { user, token };
};

// Create test tender
export const createTestTender = async (createdBy, tenderData = {}) => {
  const defaultTenderData = {
    title: 'Test Tender for Desktop Computers',
    description: 'Purchase of 10 desktop computers for office use',
    referenceNo: 'T001',
    category: 'Computers & Laptops',
    organization: {
      name: 'Test Organization',
      type: 'government'
    },
    location: {
      province: 'Western Province',
      district: 'Colombo'
    },
    dates: {
      published: new Date(),
      closing: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    },
    createdBy
  };

  return await Tender.create({ ...defaultTenderData, ...tenderData });
};

// Create test subscription
export const createTestSubscription = async (userId, subscriptionData = {}) => {
  const defaultSubscriptionData = {
    user: userId,
    plan: 'free',
    status: 'active',
    startDate: new Date(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    payment: {
      amount: 0,
      currency: 'LKR'
    }
  };

  const mergedData = { ...defaultSubscriptionData, ...subscriptionData };
  
  // Add payment method if amount > 0
  if (mergedData.payment.amount > 0 && !mergedData.payment.method) {
    mergedData.payment.method = 'credit_card';
  }

  return await UserSubscription.create(mergedData);
};

// Sample tender data for testing
export const sampleTenderData = {
  title: 'Purchase of Office Furniture',
  description: 'Procurement of office chairs, desks and filing cabinets for government office',
  referenceNo: 'T002',
  category: 'Furniture',
  organization: {
    name: 'Ministry of Public Administration',
    type: 'government',
    contactPerson: {
      name: 'John Doe',
      email: 'john.doe@mpa.gov.lk',
      phone: '+94711234567'
    }
  },
  location: {
    province: 'Central Province',
    district: 'Kandy',
    city: 'Kandy'
  },
  dates: {
    published: new Date(),
    closing: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000) // 45 days from now
  },
  financials: {
    estimatedValue: {
      amount: 500000,
      currency: 'LKR'
    },
    bidBond: {
      required: true,
      percentage: 2
    }
  },
  eligibility: {
    criteria: ['Valid business registration', 'Tax compliance certificate'],
    documentRequired: ['Company profile', 'Financial statements'],
    experience: {
      years: 2,
      description: 'Minimum 2 years experience in furniture supply'
    }
  },
  tags: ['furniture', 'office', 'government']
};

// Sample user registration data
export const sampleUserData = {
  email: 'newuser@example.com',
  password: 'password123',
  firstName: 'New',
  lastName: 'User',
  company: 'Test Company Ltd',
  phone: '+94771234567',
  role: 'supplier'
};

// Sample invalid data for validation testing
export const invalidUserData = {
  email: 'invalid-email',
  password: '123', // too short
  firstName: '', // required field empty
  lastName: 'User'
};

export const invalidTenderData = {
  title: '', // required field empty
  description: 'Test description',
  referenceNo: 'T003',
  category: 'InvalidCategory', // invalid category
  organization: {
    name: 'Test Org'
    // missing required type field
  },
  location: {
    province: 'InvalidProvince', // invalid province
    district: 'Test District'
  },
  dates: {
    closing: new Date(Date.now() - 24 * 60 * 60 * 1000) // past date
  }
};