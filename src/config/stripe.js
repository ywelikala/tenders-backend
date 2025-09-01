import Stripe from 'stripe';

// Only initialize Stripe if the secret key is provided
let stripe = null;

if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
} else {
  console.warn('⚠️  Stripe Secret Key not found. Stripe functionality will be disabled.');
}

// Pricing plan configurations
export const STRIPE_PLANS = {
  basic: {
    stripePriceId: process.env.STRIPE_BASIC_PRICE_ID || 'price_1S2UhGHbXCEL5vdNZoo362PY',
    lookupKey: process.env.STRIPE_BASIC_LOOKUP_KEY || 'Lankatender_Basic_Plan-3d98604',
    name: 'Basic Plan',
    price: 2000,
    currency: 'lkr',
    features: {
      maxTenderViews: 100,
      advancedFiltering: false,
      emailAlerts: true,
      canUploadTenders: false,
      apiAccess: false,
      prioritySupport: false,
      customReports: false,
      archiveAccess: 14, // days
      alertFrequency: 'weekly'
    }
  },
  professional: {
    stripePriceId: process.env.STRIPE_PROFESSIONAL_PRICE_ID || 'price_1S2VGmHbXCEL5vdN2dqGOuPN',
    lookupKey: process.env.STRIPE_PROFESSIONAL_LOOKUP_KEY || 'Lankatender_Professional_Plan',
    name: 'Professional Plan',
    price: 5000,
    currency: 'lkr',
    features: {
      maxTenderViews: 1000,
      advancedFiltering: true,
      emailAlerts: true,
      canUploadTenders: false,
      apiAccess: false,
      prioritySupport: false,
      customReports: false,
      archiveAccess: 365, // days
      alertFrequency: 'daily'
    }
  },
  enterprise: {
    stripePriceId: process.env.STRIPE_ENTERPRISE_PRICE_ID || 'price_1S2VHaHbXCEL5vdNQKGWp7JH',
    lookupKey: process.env.STRIPE_ENTERPRISE_LOOKUP_KEY || 'Lankatender_Enterprise_Plan',
    name: 'Enterprise Plan',
    price: 10000,
    currency: 'lkr',
    features: {
      maxTenderViews: -1, // unlimited
      advancedFiltering: true,
      emailAlerts: true,
      canUploadTenders: true,
      apiAccess: true,
      prioritySupport: true,
      customReports: true,
      archiveAccess: -1, // unlimited
      alertFrequency: 'realtime'
    }
  }
};

export default stripe;