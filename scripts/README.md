# Gmail OAuth Setup Scripts

## 🔒 Security Notice
**NEVER commit files containing actual OAuth credentials to version control!**

## 📋 Setup Instructions

### Option 1: OAuth2 Setup (Recommended)

1. **Copy the template:**
   ```bash
   cp gmail-oauth-setup.template.js gmail-oauth-setup.js
   ```

2. **Get Google OAuth credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select a project
   - Enable Gmail API
   - Create OAuth 2.0 credentials (Web application)
   - Add redirect URI: `http://localhost:3000/auth/google/callback`

3. **Edit `gmail-oauth-setup.js`:**
   - Replace `your_client_id_here` with your actual Client ID
   - Replace `your_client_secret_here` with your actual Client Secret

4. **Run the setup:**
   ```bash
   node scripts/gmail-oauth-setup.js
   ```

5. **Add generated variables to `.env`:**
   The script will output the environment variables you need.

### Option 2: App Password Setup (Alternative)

Use `gmail-app-password-setup.js` for simpler SMTP setup with Gmail App Passwords.

## ⚠️ Important Security Notes

- `gmail-oauth-setup.js` should be in `.gitignore`
- Only template files should be committed
- Never share your actual OAuth credentials
- Use environment variables for production deployment

## 📁 Files

- `gmail-oauth-setup.template.js` - Template with placeholder credentials (safe to commit)
- `gmail-oauth-setup.js` - Your actual setup script with real credentials (DO NOT COMMIT)
- `gmail-app-password-setup.js` - Alternative SMTP setup script (safe to commit)