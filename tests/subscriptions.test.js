import request from 'supertest';
import app from '../src/app.js';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import { createTestUser, createTestAdmin, createTestSubscription } from './helpers/testHelpers.js';

describe('Subscriptions API', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('GET /api/subscriptions/plans', () => {
    it('should get all subscription plans', async () => {
      const response = await request(app)
        .get('/api/subscriptions/plans')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plans).toHaveLength(4);
      expect(response.body.data.plans[0].name).toBe('free');
      expect(response.body.data.plans[1].name).toBe('basic');
      expect(response.body.data.plans[2].name).toBe('premium');
      expect(response.body.data.plans[3].name).toBe('enterprise');
    });
  });

  describe('GET /api/subscriptions/my-subscription', () => {
    let testUser, token;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
    });

    it('should create free subscription if none exists', async () => {
      const response = await request(app)
        .get('/api/subscriptions/my-subscription')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription.plan).toBe('free');
      expect(response.body.data.subscription.status).toBe('active');
    });

    it('should get existing subscription', async () => {
      const subscription = await createTestSubscription(testUser._id, {
        plan: 'basic',
        payment: { amount: 2500 }
      });

      const response = await request(app)
        .get('/api/subscriptions/my-subscription')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.subscription.plan).toBe('basic');
      expect(response.body.data.subscription.payment.amount).toBe(2500);
    });

    it('should not get subscription without authentication', async () => {
      const response = await request(app)
        .get('/api/subscriptions/my-subscription')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/subscriptions/subscribe', () => {
    let testUser, token;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
    });

    it('should subscribe to basic plan', async () => {
      const subscriptionData = {
        planName: 'basic',
        billingCycle: 'monthly',
        paymentMethod: 'credit_card',
        transactionId: 'txn_12345'
      };

      const response = await request(app)
        .post('/api/subscriptions/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created successfully');
      expect(response.body.data.subscription.plan).toBe('basic');
      expect(response.body.data.subscription.billingCycle).toBe('monthly');
    });

    it('should upgrade existing subscription', async () => {
      // Create free subscription first
      await createTestSubscription(testUser._id);

      const subscriptionData = {
        planName: 'premium',
        billingCycle: 'yearly',
        paymentMethod: 'credit_card',
        transactionId: 'txn_67890'
      };

      const response = await request(app)
        .post('/api/subscriptions/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');
      expect(response.body.data.subscription.plan).toBe('premium');
      expect(response.body.data.subscription.billingCycle).toBe('yearly');
    });

    it('should not subscribe to non-existent plan', async () => {
      const subscriptionData = {
        planName: 'nonexistent',
        billingCycle: 'monthly',
        paymentMethod: 'credit_card',
        transactionId: 'txn_12345'
      };

      const response = await request(app)
        .post('/api/subscriptions/subscribe')
        .set('Authorization', `Bearer ${token}`)
        .send(subscriptionData)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('not found');
    });

    it('should not subscribe without authentication', async () => {
      const response = await request(app)
        .post('/api/subscriptions/subscribe')
        .send({ planName: 'basic' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/subscriptions/cancel', () => {
    let testUser, token;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
    });

    it('should cancel paid subscription', async () => {
      await createTestSubscription(testUser._id, {
        plan: 'basic',
        payment: { amount: 2500 }
      });

      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${token}`)
        .send({ reason: 'No longer needed' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('cancelled successfully');
      expect(response.body.data.subscription.status).toBe('cancelled');
    });

    it('should not cancel free plan', async () => {
      await createTestSubscription(testUser._id);

      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Cannot cancel free plan');
    });

    it('should not cancel without active subscription', async () => {
      const response = await request(app)
        .post('/api/subscriptions/cancel')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No active subscription found');
    });
  });

  describe('GET /api/subscriptions/usage', () => {
    let testUser, token;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
    });

    it('should get subscription usage', async () => {
      await createTestSubscription(testUser._id, {
        plan: 'basic',
        usage: {
          tenderViews: 25,
          tenderUploads: 2
        }
      });

      const response = await request(app)
        .get('/api/subscriptions/usage')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.plan).toBe('basic');
      expect(response.body.data.usage.tenderViews.used).toBe(25);
      expect(response.body.data.usage.tenderViews.limit).toBe(100);
      expect(response.body.data.usage.tenderUploads.used).toBe(2);
    });

    it('should return 404 if no subscription found', async () => {
      const response = await request(app)
        .get('/api/subscriptions/usage')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No subscription found');
    });
  });

  describe('GET /api/subscriptions/history', () => {
    let testUser, token;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
    });

    it('should get subscription history', async () => {
      await createTestSubscription(testUser._id, {
        plan: 'basic',
        history: [
          {
            action: 'created',
            toPlan: 'basic',
            amount: 2500,
            reason: 'Initial subscription'
          }
        ]
      });

      const response = await request(app)
        .get('/api/subscriptions/history')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.history).toHaveLength(1);
      expect(response.body.data.history[0].action).toBe('created');
      expect(response.body.data.history[0].toPlan).toBe('basic');
    });
  });

  describe('Admin Routes', () => {
    let adminUser, adminToken;

    beforeEach(async () => {
      const result = await createTestAdmin();
      adminUser = result.user;
      adminToken = result.token;
    });

    describe('POST /api/subscriptions/admin/plans', () => {
      it('should create new subscription plan', async () => {
        const planData = {
          name: 'premium',
          displayName: 'Premium Plan',
          description: 'Premium plan for testing',
          price: { monthly: 7500, yearly: 75000 },
          features: {
            maxTenderViews: 500,
            canUploadTenders: true,
            maxTenderUploads: 50,
            advancedFiltering: true,
            emailAlerts: true
          }
        };

        const response = await request(app)
          .post('/api/subscriptions/admin/plans')
          .set('Authorization', `Bearer ${adminToken}`)
          .send(planData)
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.data.plan.name).toBe('premium');
        expect(response.body.data.plan.features.maxTenderViews).toBe(500);
      });

      it('should not create plan without admin role', async () => {
        const { token: userToken } = await createTestUser();

        const response = await request(app)
          .post('/api/subscriptions/admin/plans')
          .set('Authorization', `Bearer ${userToken}`)
          .send({ name: 'test' })
          .expect(403);

        expect(response.body.success).toBe(false);
      });
    });

    describe('GET /api/subscriptions/admin/subscriptions', () => {
      it('should get all user subscriptions', async () => {
        const { user: user1 } = await createTestUser();
        const { user: user2 } = await createTestUser({ email: 'user2@example.com' });
        
        await createTestSubscription(user1._id, { plan: 'basic' });
        await createTestSubscription(user2._id, { plan: 'premium' });

        const response = await request(app)
          .get('/api/subscriptions/admin/subscriptions')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.subscriptions.length).toBeGreaterThanOrEqual(2);
        expect(response.body.data.pagination).toBeDefined();
      });

      it('should filter subscriptions by plan', async () => {
        const { user: user1 } = await createTestUser();
        const { user: user2 } = await createTestUser({ email: 'user2@example.com' });
        
        await createTestSubscription(user1._id, { plan: 'basic' });
        await createTestSubscription(user2._id, { plan: 'premium' });

        const response = await request(app)
          .get('/api/subscriptions/admin/subscriptions?plan=basic')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.subscriptions).toHaveLength(1);
        expect(response.body.data.subscriptions[0].plan).toBe('basic');
      });
    });
  });
});