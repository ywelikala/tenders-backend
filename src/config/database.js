import mongoose from 'mongoose';
import dotenv from 'dotenv';
import logger from '../utils/logger.js';

dotenv.config();

const connectDB = async () => {
  try {
    const mongoURI = process.env.NODE_ENV === 'test' 
      ? process.env.MONGODB_URI_TEST 
      : process.env.MONGODB_URI;
    
    // Enable mongoose debugging in development
    if (process.env.NODE_ENV === 'development') {
      mongoose.set('debug', (collectionName, method, query, doc) => {
        logger.debug('Mongoose Query', {
          collection: collectionName,
          method: method,
          query: JSON.stringify(query),
          doc: doc ? JSON.stringify(doc).substring(0, 200) : undefined
        });
      });
    }
    
    const startTime = Date.now();
    await mongoose.connect(mongoURI);
    const connectionTime = Date.now() - startTime;
    
    logger.info('Database connected successfully', {
      host: mongoose.connection.host,
      database: mongoose.connection.name,
      connectionTime: `${connectionTime}ms`,
      environment: process.env.NODE_ENV
    });
    
    if (process.env.NODE_ENV !== 'test') {
      console.log(`📦 MongoDB connected: ${mongoose.connection.host}`);
    }
  } catch (error) {
    logger.error('Database connection failed', {
      error: error.message,
      mongoURI: process.env.NODE_ENV === 'development' ? mongoURI : '[HIDDEN]'
    });
    console.error('❌ Database connection error:', error.message);
    process.exit(1);
  }
};

const disconnectDB = async () => {
  try {
    await mongoose.connection.close();
    logger.info('Database disconnected successfully');
    
    if (process.env.NODE_ENV !== 'test') {
      console.log('📦 MongoDB disconnected');
    }
  } catch (error) {
    logger.error('Database disconnection failed', { error: error.message });
    console.error('❌ Database disconnection error:', error.message);
  }
};

export { connectDB, disconnectDB };