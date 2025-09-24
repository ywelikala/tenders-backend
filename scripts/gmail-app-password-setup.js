import nodemailer from 'nodemailer';
import readline from 'readline';

console.log('📧 Gmail App Password Setup Helper');
console.log('==================================\n');

console.log('📋 Step 1: Enable 2-Factor Authentication');
console.log('==========================================');
console.log('1. Go to https://myaccount.google.com/security');
console.log('2. Enable 2-Factor Authentication if not already enabled');
console.log('3. This is required for app passwords\n');

console.log('📋 Step 2: Generate App Password');
console.log('================================');
console.log('1. Go to https://myaccount.google.com/apppasswords');
console.log('2. Select "Mail" as the app');
console.log('3. Select "Other" as the device and enter "Lanka Tender Portal"');
console.log('4. Copy the 16-character app password\n');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter your Gmail address: ', (email) => {
  rl.question('Enter your 16-character app password: ', async (appPassword) => {
    try {
      console.log('\n🧪 Testing SMTP connection...');

      // Create transporter with app password
      const transporter = nodemailer.createTransporter({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: email,
          pass: appPassword
        }
      });

      // Verify connection
      await transporter.verify();
      console.log('✅ SMTP connection successful!');

      // Send test email to self
      console.log('📨 Sending test email...');
      const testEmail = {
        from: email,
        to: email,
        subject: 'Lanka Tender Portal - Email Setup Test',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #ff6b35;">✅ Email Setup Successful!</h2>
            <p>Your Lanka Tender Portal email alerts are now configured and working properly.</p>
            <p><strong>Configuration:</strong></p>
            <ul>
              <li>Email Service: Gmail SMTP</li>
              <li>From Address: ${email}</li>
              <li>Authentication: App Password</li>
            </ul>
            <p>You can now use the email alert features in your tender portal.</p>
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;">
            <p style="color: #666; font-size: 12px;">
              This is an automated test email from Lanka Tender Portal.
            </p>
          </div>
        `
      };

      await transporter.sendMail(testEmail);
      console.log('✅ Test email sent successfully!');

      console.log('\n🎉 Success! Add these to your .env file:');
      console.log('==========================================');
      console.log(`SMTP_HOST=smtp.gmail.com`);
      console.log(`SMTP_PORT=587`);
      console.log(`SMTP_USER=${email}`);
      console.log(`SMTP_PASS=${appPassword}`);
      console.log(`# Remove or comment out Gmail OAuth variables if present`);

      console.log('\n📝 Next Steps:');
      console.log('==============');
      console.log('1. Copy the environment variables above to your .env file');
      console.log('2. Remove or comment out any GMAIL_* OAuth variables');
      console.log('3. Restart your backend server');
      console.log('4. Test email functionality in your app');
      console.log('5. Check your email for the test message');

    } catch (error) {
      console.error('❌ Error testing SMTP:', error.message);
      console.log('\n💡 Troubleshooting:');
      console.log('- Make sure 2FA is enabled on your Google account');
      console.log('- Double-check your app password (16 characters, no spaces)');
      console.log('- Make sure you\'re using the correct Gmail address');
      console.log('- Try generating a new app password if this one doesn\'t work');
    }

    rl.close();
  });
});