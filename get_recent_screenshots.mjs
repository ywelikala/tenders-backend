import dotenv from 'dotenv';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Screenshot schema matching the one in src/models/Screenshot.js
const screenshotSchema = new mongoose.Schema({
  fileName: String,
  description: String,
  imageData: Buffer,
  metadata: mongoose.Schema.Types.Mixed,
  size: Number,
  createdAt: { type: Date, default: Date.now }
});

const Screenshot = mongoose.model('Screenshot', screenshotSchema);

async function getRecentScreenshots() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB Atlas');
    
    // Get the most recent screenshots (last 5)
    const screenshots = await Screenshot.find({})
      .sort({ createdAt: -1 })
      .limit(5);
    
    console.log(`\n📸 Found ${screenshots.length} recent screenshots:\n`);
    
    screenshots.forEach((shot, index) => {
      console.log(`${index + 1}. ID: ${shot._id}`);
      console.log(`   File: ${shot.fileName}`);
      console.log(`   Description: ${shot.description}`);
      console.log(`   Size: ${Math.round(shot.size / 1024)} KB`);
      console.log(`   Created: ${shot.createdAt}`);
      console.log(`   Step: ${shot.metadata?.step || 'unknown'}`);
      console.log(`   URL: ${shot.metadata?.url || 'unknown'}`);
      if (shot.metadata?.error) {
        console.log(`   ❌ Error: ${shot.metadata.error}`);
      }
      console.log('---');
    });
    
    // Save the 3 most recent screenshots for analysis
    const recentShots = screenshots.slice(0, 3);
    
    console.log(`\n💾 Saving ${recentShots.length} most recent screenshots for analysis...\n`);
    
    for (let i = 0; i < recentShots.length; i++) {
      const shot = recentShots[i];
      const step = shot.metadata?.step || 'unknown';
      const fileName = `screenshot_${i + 1}_${step}_${shot._id}.png`;
      const filePath = path.join(__dirname, fileName);
      
      console.log(`📷 Screenshot ${i + 1}:`);
      console.log(`   Description: ${shot.description}`);
      console.log(`   Step: ${step}`);
      console.log(`   Saving as: ${fileName}`);
      
      if (shot.imageData) {
        fs.writeFileSync(filePath, shot.imageData);
        console.log(`   ✅ Saved successfully (${Math.round(shot.size / 1024)} KB)`);
        
        // If this is the after-cloudflare-clearance screenshot, let's analyze it
        if (step === 'cloudflare-cleared') {
          console.log(`   🎯 This is the post-Cloudflare screenshot - key for analysis!`);
        }
      } else {
        console.log(`   ❌ No image data found`);
      }
      console.log('');
    }
    
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

getRecentScreenshots();