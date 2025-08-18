import request from 'supertest';
import app from '../src/app.js';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import { 
  createTestUser, 
  createTestAdmin,
  createTestTender, 
  sampleTenderData, 
  invalidTenderData 
} from './helpers/testHelpers.js';

describe('Tenders API', () => {
  beforeAll(async () => {
    await setupTestDB();
  });

  afterAll(async () => {
    await teardownTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('GET /api/tenders', () => {
    let testUser, token, tender;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
      tender = await createTestTender(testUser._id);
    });

    it('should get tenders without authentication', async () => {
      const response = await request(app)
        .get('/api/tenders')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenders).toHaveLength(1);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should get tenders with authentication', async () => {
      const response = await request(app)
        .get('/api/tenders')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenders).toHaveLength(1);
    });

    it('should filter tenders by category', async () => {
      const response = await request(app)
        .get('/api/tenders?category=Computers & Laptops')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenders).toHaveLength(1);
      expect(response.body.data.tenders[0].category).toBe('Computers & Laptops');
    });

    it('should filter tenders by province', async () => {
      const response = await request(app)
        .get('/api/tenders?province=Western Province')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenders).toHaveLength(1);
    });

    it('should search tenders by text', async () => {
      const response = await request(app)
        .get('/api/tenders?search=desktop computers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenders).toHaveLength(1);
    });

    it('should paginate results', async () => {
      // Create additional tenders
      for (let i = 0; i < 5; i++) {
        await createTestTender(testUser._id, { referenceNo: `T00${i + 2}` });
      }

      const response = await request(app)
        .get('/api/tenders?page=1&limit=3')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenders).toHaveLength(3);
      expect(response.body.data.pagination.current).toBe(1);
      expect(response.body.data.pagination.hasNext).toBe(true);
    });
  });

  describe('GET /api/tenders/:id', () => {
    let testUser, token, tender;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
      tender = await createTestTender(testUser._id);
    });

    it('should get single tender without authentication', async () => {
      const response = await request(app)
        .get(`/api/tenders/${tender._id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tender.title).toBe(tender.title);
      expect(response.body.data.tender.createdBy).toBeDefined();
    });

    it('should get single tender with authentication', async () => {
      const response = await request(app)
        .get(`/api/tenders/${tender._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tender.title).toBe(tender.title);
    });

    it('should return 404 for non-existent tender', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/tenders/${fakeId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Tender not found');
    });

    it('should return 400 for invalid tender ID', async () => {
      const response = await request(app)
        .get('/api/tenders/invalid-id')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid tender ID');
    });
  });

  describe('POST /api/tenders', () => {
    let testUser, token;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
    });

    it('should create tender with valid data', async () => {
      const response = await request(app)
        .post('/api/tenders')
        .set('Authorization', `Bearer ${token}`)
        .send(sampleTenderData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('created successfully');
      expect(response.body.data.tender.title).toBe(sampleTenderData.title);
      expect(response.body.data.tender.createdBy).toBeDefined();
    });

    it('should not create tender without authentication', async () => {
      const response = await request(app)
        .post('/api/tenders')
        .send(sampleTenderData)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('No token provided');
    });

    it('should not create tender with invalid data', async () => {
      const response = await request(app)
        .post('/api/tenders')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidTenderData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Validation error');
      expect(response.body.errors).toBeDefined();
    });

    it('should not create tender with duplicate reference number', async () => {
      await createTestTender(testUser._id);

      const response = await request(app)
        .post('/api/tenders')
        .set('Authorization', `Bearer ${token}`)
        .send({
          ...sampleTenderData,
          referenceNo: 'T001' // Same as existing tender
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('already exists');
    });
  });

  describe('PUT /api/tenders/:id', () => {
    let testUser, token, tender, otherUser, otherToken;

    beforeEach(async () => {
      const result1 = await createTestUser();
      testUser = result1.user;
      token = result1.token;
      tender = await createTestTender(testUser._id);

      const result2 = await createTestUser({ email: 'other@example.com' });
      otherUser = result2.user;
      otherToken = result2.token;
    });

    it('should update tender by owner', async () => {
      const updateData = {
        title: 'Updated Tender Title',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/tenders/${tender._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('updated successfully');
      expect(response.body.data.tender.title).toBe('Updated Tender Title');
    });

    it('should not update tender by non-owner', async () => {
      const response = await request(app)
        .put(`/api/tenders/${tender._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'Unauthorized Update' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Not authorized');
    });

    it('should update tender by admin', async () => {
      const { token: adminToken } = await createTestAdmin();

      const response = await request(app)
        .put(`/api/tenders/${tender._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Admin Updated Title' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tender.title).toBe('Admin Updated Title');
    });

    it('should not update tender without authentication', async () => {
      const response = await request(app)
        .put(`/api/tenders/${tender._id}`)
        .send({ title: 'No Auth Update' })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/tenders/:id', () => {
    let testUser, token, tender, otherUser, otherToken;

    beforeEach(async () => {
      const result1 = await createTestUser();
      testUser = result1.user;
      token = result1.token;
      tender = await createTestTender(testUser._id);

      const result2 = await createTestUser({ email: 'other@example.com' });
      otherUser = result2.user;
      otherToken = result2.token;
    });

    it('should delete tender by owner', async () => {
      const response = await request(app)
        .delete(`/api/tenders/${tender._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should not delete tender by non-owner', async () => {
      const response = await request(app)
        .delete(`/api/tenders/${tender._id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Not authorized');
    });

    it('should delete tender by admin', async () => {
      const { token: adminToken } = await createTestAdmin();

      const response = await request(app)
        .delete(`/api/tenders/${tender._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should not delete tender without authentication', async () => {
      const response = await request(app)
        .delete(`/api/tenders/${tender._id}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/tenders/stats', () => {
    let testUser, token;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;

      // Create test tenders with different statuses
      await createTestTender(testUser._id, { status: 'published' });
      await createTestTender(testUser._id, { 
        status: 'closed', 
        referenceNo: 'T002',
        dates: {
          published: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          closing: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
        }
      });
    });

    it('should get tender statistics', async () => {
      const response = await request(app)
        .get('/api/tenders/stats')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalTenders).toBeGreaterThan(0);
      expect(response.body.data.liveTenders).toBeDefined();
      expect(response.body.data.closedTenders).toBeDefined();
      expect(response.body.data.categoryStats).toBeDefined();
    });
  });

  describe('GET /api/tenders/user/my-tenders', () => {
    let testUser, token, otherUser;

    beforeEach(async () => {
      const result1 = await createTestUser();
      testUser = result1.user;
      token = result1.token;

      const result2 = await createTestUser({ email: 'other@example.com' });
      otherUser = result2.user;

      // Create tenders for both users
      await createTestTender(testUser._id);
      await createTestTender(testUser._id, { referenceNo: 'T002' });
      await createTestTender(otherUser._id, { referenceNo: 'T003' });
    });

    it('should get only user\'s own tenders', async () => {
      const response = await request(app)
        .get('/api/tenders/user/my-tenders')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.tenders).toHaveLength(2);
      expect(response.body.data.pagination).toBeDefined();
    });

    it('should not get tenders without authentication', async () => {
      const response = await request(app)
        .get('/api/tenders/user/my-tenders')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });
});