import { google } from 'googleapis';
import readline from 'readline';

// Configuration - Replace with your actual values from Google Cloud Console
const GMAIL_CLIENT_ID = 'your_client_id_here';
const GMAIL_CLIENT_SECRET = 'your_client_secret_here';
const GMAIL_REDIRECT_URI = 'http://localhost:3000/auth/google/callback';

console.log('🚀 Gmail OAuth2 Setup Helper');
console.log('============================\n');

if (GMAIL_CLIENT_ID === 'your_client_id_here' || GMAIL_CLIENT_SECRET === 'your_client_secret_here') {
  console.log('❌ Please edit this script and add your actual Google OAuth credentials:');
  console.log('1. Go to https://console.cloud.google.com/');
  console.log('2. Create/select a project');
  console.log('3. Enable Gmail API');
  console.log('4. Create OAuth 2.0 credentials (Web application)');
  console.log('5. Add redirect URI: http://localhost:3000/auth/google/callback');
  console.log('6. Copy this file to gmail-oauth-setup.js');
  console.log('7. Edit gmail-oauth-setup.js with your CLIENT_ID and CLIENT_SECRET');
  console.log('\nThen run: node scripts/gmail-oauth-setup.js');
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  GMAIL_CLIENT_ID,
  GMAIL_CLIENT_SECRET,
  GMAIL_REDIRECT_URI
);

// Generate the URL for authorization
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/gmail.send'],
  prompt: 'consent' // Force consent screen to get refresh token
});

console.log('📋 Step 1: Authorization');
console.log('========================');
console.log('Go to this URL and authorize the app:');
console.log(authUrl);
console.log('\n📋 Step 2: Get Authorization Code');
console.log('=================================');
console.log('After authorization, you\'ll get a code. Paste it below:');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter the authorization code: ', async (code) => {
  try {
    console.log('\n🔄 Processing authorization code...');
    const { tokens } = await oauth2Client.getToken(code);

    if (!tokens.refresh_token) {
      console.log('❌ No refresh token received. This might happen if you\'ve already authorized this app.');
      console.log('To fix this, revoke access at: https://myaccount.google.com/permissions');
      console.log('Then run this script again.');
      rl.close();
      return;
    }

    console.log('\n🎉 Success! Add these to your .env file:');
    console.log('==========================================');
    console.log(`GMAIL_CLIENT_ID=${GMAIL_CLIENT_ID}`);
    console.log(`GMAIL_CLIENT_SECRET=${GMAIL_CLIENT_SECRET}`);
    console.log(`GMAIL_REDIRECT_URI=${GMAIL_REDIRECT_URI}`);
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log('GMAIL_USER_EMAIL=your_gmail_address@gmail.com');

    // Test the setup
    console.log('\n🧪 Testing Gmail API access...');
    oauth2Client.setCredentials(tokens);
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    const profile = await gmail.users.getProfile({ userId: 'me' });
    console.log(`✅ Connected to Gmail account: ${profile.data.emailAddress}`);
    console.log(`✅ Total messages in account: ${profile.data.messagesTotal}`);

    console.log('\n📝 Next Steps:');
    console.log('==============');
    console.log('1. Copy the environment variables above to your .env file');
    console.log('2. Update GMAIL_USER_EMAIL with the email address shown above');
    console.log('3. Restart your backend server');
    console.log('4. Test email functionality in your app');

  } catch (error) {
    console.error('❌ Error getting tokens:', error.message);
    if (error.code === 'invalid_grant') {
      console.log('💡 Try running the script again and make sure to use a fresh authorization code.');
    }
  }

  rl.close();
});