import request from 'supertest';
import fs from 'fs/promises';
import path from 'path';
import app from '../src/app.js';
import { setupTestDB, teardownTestDB, clearTestDB } from './setup.js';
import { createTestUser, createTestAdmin, createTestTender } from './helpers/testHelpers.js';

describe('Files API', () => {
  beforeAll(async () => {
    await setupTestDB();
    
    // Create uploads directory for testing
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const tendersDir = path.join(uploadsDir, 'tenders');
    
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
      await fs.mkdir(tendersDir, { recursive: true });
    } catch (error) {
      // Directory already exists, ignore
    }
  });

  afterAll(async () => {
    await teardownTestDB();
    
    // Clean up test files
    try {
      const uploadsDir = path.join(process.cwd(), 'uploads');
      await fs.rm(uploadsDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  describe('GET /api/files/tender/:tenderId/documents', () => {
    let testUser, token, tender;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
      tender = await createTestTender(testUser._id, {
        documents: [
          {
            name: 'tender_document.pdf',
            url: 'uploads/tenders/test_document.pdf',
            type: 'pdf',
            size: 1024,
            uploadedAt: new Date()
          }
        ]
      });
    });

    it('should get tender documents list without authentication', async () => {
      const response = await request(app)
        .get(`/api/files/tender/${tender._id}/documents`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.documents).toHaveLength(1);
      expect(response.body.data.documents[0].name).toBe('tender_document.pdf');
      expect(response.body.data.documents[0].type).toBe('pdf');
    });

    it('should get tender documents list with authentication', async () => {
      const response = await request(app)
        .get(`/api/files/tender/${tender._id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.documents).toHaveLength(1);
    });

    it('should return 404 for non-existent tender', async () => {
      const fakeId = '507f1f77bcf86cd799439011';
      const response = await request(app)
        .get(`/api/files/tender/${fakeId}/documents`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Tender not found');
    });

    it('should return 400 for invalid tender ID', async () => {
      const response = await request(app)
        .get('/api/files/tender/invalid-id/documents')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid tender ID');
    });
  });

  describe('POST /api/files/tender/:tenderId/documents', () => {
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

    it('should upload documents to tender by owner', async () => {
      // Create a test file buffer
      const testFileContent = Buffer.from('Test PDF content');
      
      const response = await request(app)
        .post(`/api/files/tender/${tender._id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .attach('documents', testFileContent, 'test_document.pdf')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('uploaded successfully');
      expect(response.body.data.documents).toHaveLength(1);
      expect(response.body.data.documents[0].name).toBe('test_document.pdf');
    });

    it('should not upload documents without authentication', async () => {
      const testFileContent = Buffer.from('Test PDF content');
      
      const response = await request(app)
        .post(`/api/files/tender/${tender._id}/documents`)
        .attach('documents', testFileContent, 'test_document.pdf')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should not upload documents by non-owner', async () => {
      const testFileContent = Buffer.from('Test PDF content');
      
      const response = await request(app)
        .post(`/api/files/tender/${tender._id}/documents`)
        .set('Authorization', `Bearer ${otherToken}`)
        .attach('documents', testFileContent, 'test_document.pdf')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Not authorized');
    });

    it('should upload documents by admin', async () => {
      const { token: adminToken } = await createTestAdmin();
      const testFileContent = Buffer.from('Test PDF content');
      
      const response = await request(app)
        .post(`/api/files/tender/${tender._id}/documents`)
        .set('Authorization', `Bearer ${adminToken}`)
        .attach('documents', testFileContent, 'test_document.pdf')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 400 when no files uploaded', async () => {
      const response = await request(app)
        .post(`/api/files/tender/${tender._id}/documents`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No files uploaded');
    });
  });

  describe('DELETE /api/files/tender/:tenderId/documents/:documentId', () => {
    let testUser, token, tender, documentId;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
      tender = await createTestTender(testUser._id, {
        documents: [
          {
            name: 'test_document.pdf',
            url: 'uploads/tenders/test_document.pdf',
            type: 'pdf',
            size: 1024,
            uploadedAt: new Date()
          }
        ]
      });
      documentId = tender.documents[0]._id;
    });

    it('should delete document by owner', async () => {
      const response = await request(app)
        .delete(`/api/files/tender/${tender._id}/documents/${documentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('deleted successfully');
    });

    it('should not delete document without authentication', async () => {
      const response = await request(app)
        .delete(`/api/files/tender/${tender._id}/documents/${documentId}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should not delete document by non-owner', async () => {
      const { token: otherToken } = await createTestUser({ email: 'other@example.com' });
      
      const response = await request(app)
        .delete(`/api/files/tender/${tender._id}/documents/${documentId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Not authorized');
    });

    it('should delete document by admin', async () => {
      const { token: adminToken } = await createTestAdmin();
      
      const response = await request(app)
        .delete(`/api/files/tender/${tender._id}/documents/${documentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return 404 for non-existent document', async () => {
      const fakeDocId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .delete(`/api/files/tender/${tender._id}/documents/${fakeDocId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Document not found');
    });
  });

  describe('POST /api/files/profile/image', () => {
    let testUser, token;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
    });

    it('should upload profile image', async () => {
      const testImageContent = Buffer.from('Test image content');
      
      const response = await request(app)
        .post('/api/files/profile/image')
        .set('Authorization', `Bearer ${token}`)
        .attach('image', testImageContent, 'profile.jpg')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('uploaded successfully');
      expect(response.body.data.image.name).toBe('profile.jpg');
    });

    it('should not upload profile image without authentication', async () => {
      const testImageContent = Buffer.from('Test image content');
      
      const response = await request(app)
        .post('/api/files/profile/image')
        .attach('image', testImageContent, 'profile.jpg')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should return 400 when no image uploaded', async () => {
      const response = await request(app)
        .post('/api/files/profile/image')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('No image file uploaded');
    });
  });

  describe('GET /api/files/stats', () => {
    let adminUser, adminToken;

    beforeEach(async () => {
      const result = await createTestAdmin();
      adminUser = result.user;
      adminToken = result.token;
    });

    it('should get file statistics for admin', async () => {
      // Create some test data
      const { user: testUser } = await createTestUser();
      await createTestTender(testUser._id, {
        documents: [
          {
            name: 'doc1.pdf',
            url: 'uploads/tenders/doc1.pdf',
            type: 'pdf',
            size: 1024
          },
          {
            name: 'doc2.docx',
            url: 'uploads/tenders/doc2.docx',
            type: 'doc',
            size: 2048
          }
        ]
      });

      const response = await request(app)
        .get('/api/files/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.totalFiles).toBeGreaterThanOrEqual(0);
      expect(response.body.data.totalSize).toBeGreaterThanOrEqual(0);
      expect(response.body.data.fileTypes).toBeDefined();
    });

    it('should not get file statistics without admin role', async () => {
      const { token: userToken } = await createTestUser();
      
      const response = await request(app)
        .get('/api/files/stats')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should not get file statistics without authentication', async () => {
      const response = await request(app)
        .get('/api/files/stats')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('File Download', () => {
    let testUser, token, tender, documentId;

    beforeEach(async () => {
      const result = await createTestUser();
      testUser = result.user;
      token = result.token;
      
      // Create a test file
      const testFilePath = path.join(process.cwd(), 'uploads', 'tenders', 'test_download.pdf');
      await fs.writeFile(testFilePath, 'Test PDF content for download');
      
      tender = await createTestTender(testUser._id, {
        documents: [
          {
            name: 'test_download.pdf',
            url: 'uploads/tenders/test_download.pdf',
            type: 'pdf',
            size: 1024,
            uploadedAt: new Date()
          }
        ]
      });
      documentId = tender.documents[0]._id;
    });

    afterEach(async () => {
      // Clean up test file
      try {
        const testFilePath = path.join(process.cwd(), 'uploads', 'tenders', 'test_download.pdf');
        await fs.unlink(testFilePath);
      } catch (error) {
        // Ignore cleanup errors
      }
    });

    it('should download document without authentication for public tender', async () => {
      const response = await request(app)
        .get(`/api/files/tender/${tender._id}/documents/${documentId}`)
        .expect(200);

      expect(response.headers['content-disposition']).toContain('test_download.pdf');
      expect(response.body.toString()).toBe('Test PDF content for download');
    });

    it('should download document with authentication', async () => {
      const response = await request(app)
        .get(`/api/files/tender/${tender._id}/documents/${documentId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.headers['content-disposition']).toContain('test_download.pdf');
    });

    it('should return 404 for non-existent document', async () => {
      const fakeDocId = '507f1f77bcf86cd799439011';
      
      const response = await request(app)
        .get(`/api/files/tender/${tender._id}/documents/${fakeDocId}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Document not found');
    });
  });
});