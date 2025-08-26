# Lanka Tender Stripe Integration

This document outlines the Stripe payment integration for the Lanka Tender platform.

## Features Implemented

### 1. Subscription Plans
- **Basic Plan**: LKR 2,000/month - Basic tender access, weekly emails
- **Professional Plan**: LKR 5,000/month - Advanced search, daily alerts, archive access
- **Enterprise Plan**: LKR 10,000/month - Unlimited access, team features, API access

### 2. Payment Flow
1. User selects plan on pricing page
2. Redirected to Stripe Checkout
3. Payment processed securely by Stripe
4. Webhook confirms payment and activates subscription
5. User redirected to success page

### 3. API Endpoints

#### Public Endpoints
- `GET /api/subscriptions/plans` - Get available plans
- `POST /api/subscriptions/webhook` - Stripe webhook handler

#### Protected Endpoints (Authentication Required)
- `POST /api/subscriptions/create-checkout-session` - Create payment session
- `GET /api/subscriptions/verify-session/:sessionId` - Verify payment
- `GET /api/subscriptions/current` - Get user's subscription
- `GET /api/subscriptions/usage` - Get usage statistics
- `POST /api/subscriptions/cancel` - Cancel subscription

## Setup Instructions

### 1. Stripe Account Setup
1. Create a [Stripe account](https://stripe.com)
2. Get your API keys from the Stripe Dashboard
3. Create webhook endpoint pointing to your server

### 2. Environment Variables
Copy `.env.stripe.example` to `.env` and configure:

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
FRONTEND_URL=http://localhost:8080
```

### 3. Create Stripe Products and Prices
In your Stripe Dashboard, create:

1. **Basic Plan Product**
   - Price: LKR 2,000/month
   - Recurring: Monthly
   - Copy the Price ID to `STRIPE_BASIC_PRICE_ID`

2. **Professional Plan Product**
   - Price: LKR 5,000/month
   - Recurring: Monthly
   - Copy the Price ID to `STRIPE_PROFESSIONAL_PRICE_ID`

3. **Enterprise Plan Product**
   - Price: LKR 10,000/month
   - Recurring: Monthly
   - Copy the Price ID to `STRIPE_ENTERPRISE_PRICE_ID`

### 4. Webhook Configuration
1. In Stripe Dashboard, go to Webhooks
2. Add endpoint: `https://your-domain.com/api/subscriptions/webhook`
3. Select events:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
4. Copy the webhook secret to `STRIPE_WEBHOOK_SECRET`

### 5. Frontend Configuration
Add to your frontend `.env`:

```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key_here
```

## Testing

### 1. Test Cards (Stripe Test Mode)
- **Success**: 4242 4242 4242 4242
- **Declined**: 4000 0000 0000 0002
- **Requires 3D Secure**: 4000 0025 0000 3155

### 2. Test Flow
1. Start backend: `npm run dev`
2. Start frontend: `cd ../tenders-frontend && npm run dev`
3. Navigate to pricing page
4. Click "Subscribe Now" on any plan
5. Complete payment with test card
6. Verify subscription activation

### 3. Webhook Testing
Use Stripe CLI for local webhook testing:

```bash
# Install Stripe CLI
npm install -g stripe-cli

# Login and forward webhooks
stripe login
stripe listen --forward-to localhost:3000/api/subscriptions/webhook
```

## User Model Changes

The User model now includes:

```javascript
subscription: {
  plan: String, // 'free', 'basic', 'professional', 'enterprise'
  status: String, // 'active', 'cancelled', 'past_due', etc.
  stripeSubscriptionId: String,
  nextBillingDate: Date,
  features: {
    maxTenderViews: Number,
    advancedFiltering: Boolean,
    emailAlerts: Boolean,
    // ... more features
  }
},
stripeCustomerId: String
```

## Security Considerations

1. **API Keys**: Store in environment variables, never in code
2. **Webhook Verification**: All webhooks are signature-verified
3. **Authentication**: All subscription endpoints require JWT authentication
4. **Input Validation**: All inputs are validated and sanitized

## Error Handling

The system handles:
- Invalid payment methods
- Failed payments
- Subscription cancellations
- Webhook failures
- API rate limits

## Production Deployment

1. Switch to live Stripe keys
2. Update webhook endpoints to production URLs
3. Configure production CORS origins
4. Set up proper SSL certificates
5. Monitor webhook deliveries in Stripe Dashboard

## Support

For issues related to:
- **Stripe Integration**: Check Stripe logs and webhook deliveries
- **Payment Failures**: Review Stripe Dashboard events
- **Subscription Management**: Check user subscription status in database

## Subscription Features by Plan

| Feature | Free | Basic | Professional | Enterprise |
|---------|------|-------|--------------|-----------|
| Tender Views/Month | 10 | 100 | 1,000 | Unlimited |
| Archive Access | None | 14 days | 1 year | Unlimited |
| Email Alerts | None | Weekly | Daily | Real-time |
| Advanced Search | ❌ | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ❌ | ✅ |
| Priority Support | ❌ | ❌ | ❌ | ✅ |
| Team Access | ❌ | ❌ | ❌ | ✅ (5 users) |