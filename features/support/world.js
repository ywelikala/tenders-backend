import { setWorldConstructor, Before, After, BeforeAll, AfterAll } from '@cucumber/cucumber';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { expect } from 'chai';
import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/User.js';
import Tender from '../../src/models/Tender.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mongoServer;

// Custom World class for Cucumber
class CustomWorld {
  constructor({ attach, log, parameters }) {
    this.attach = attach;
    this.log = log;
    this.parameters = parameters;
    this.app = app;
    this.request = request(app);
    this.response = null;
    this.user = null;
    this.token = null;
    this.testData = {};
    this.expect = expect;
  }

  // Helper method to create a test user
  async createTestUser(userData = {}) {
    const defaultUser = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'ValidPassword123',
      firstName: 'Test',
      lastName: 'User',
      role: 'user'
    };

    const user = new User({ ...defaultUser, ...userData });
    await user.save();
    return user;
  }

  // Helper method to create a JWT token for a user
  createAuthToken(user) {
    const payload = {
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    };
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
  }

  // Helper method to authenticate as a user
  async authenticateAs(userData = {}) {
    const user = await this.createTestUser(userData);
    this.user = user;
    this.token = this.createAuthToken(user);
    return { user, token: this.token };
  }

  // Helper method to create test tenders
  async createTestTenders(count = 1, ownerUser = null, customData = {}) {
    const tenders = [];
    const owner = ownerUser || (await this.createTestUser());

    for (let i = 0; i < count; i++) {
      const defaultTender = {
        title: `Test Tender ${i + 1}`,
        description: `This is a test tender description ${i + 1}`,
        category: 'IT Services',
        location: 'Colombo',
        budget: 100000 + (i * 10000),
        currency: 'LKR',
        openingDate: new Date(),
        closingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
        status: 'active',
        eligibilityCriteria: ['Valid business registration', 'Tax compliance'],
        contactInformation: {
          contactPerson: 'Test Contact',
          email: 'contact@example.com',
          phone: '+94712345678'
        },
        submissionRequirements: ['Technical proposal', 'Financial proposal'],
        owner: owner._id,
        organization: 'Test Organization',
        refId: `TND-${Date.now()}-${i + 1}`
      };

      const tender = new Tender({ ...defaultTender, ...customData });
      await tender.save();
      tenders.push(tender);
    }

    return tenders;
  }

  // Helper method to clean database
  async cleanDatabase() {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }

  // Helper method to create test files
  createTestFile(filename = 'test-file.txt', content = 'Test file content') {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    const filePath = path.join(uploadsDir, filename);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  // Helper method to clean test files
  cleanTestFiles() {
    const uploadsDir = path.join(__dirname, '../../uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      files.forEach(file => {
        if (file.startsWith('test-')) {
          fs.unlinkSync(path.join(uploadsDir, file));
        }
      });
    }
  }
}

setWorldConstructor(CustomWorld);

// Global test setup
BeforeAll(async function () {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing';
  process.env.JWT_EXPIRES_IN = '24h';
  
  // Start in-memory MongoDB
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  // Connect to test database
  await mongoose.connect(mongoUri);
  
  console.log('🧪 Test environment initialized');
});

// Global test cleanup
AfterAll(async function () {
  // Close database connection
  await mongoose.disconnect();
  
  // Stop in-memory MongoDB
  if (mongoServer) {
    await mongoServer.stop();
  }
  
  console.log('🧹 Test environment cleaned up');
});

// Before each scenario
Before(async function () {
  // Clean database before each test
  await this.cleanDatabase();
  
  // Reset test data
  this.response = null;
  this.user = null;
  this.token = null;
  this.testData = {};
});

// After each scenario
After(async function () {
  // Clean up test files
  this.cleanTestFiles();
  
  // Log scenario result
  if (this.response && this.response.status >= 400) {
    this.log(`❌ Response Status: ${this.response.status}`);
    this.log(`❌ Response Body: ${JSON.stringify(this.response.body, null, 2)}`);
  }
});