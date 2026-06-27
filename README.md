# JobVibes Node.js API Server

A Node.js/Express API server for the JobVibes application.

## Prerequisites

Before running the application locally, make sure you have the following installed:

- **Node.js** (v14 or higher recommended)
- **MongoDB** (local installation or MongoDB Atlas account)
- **npm** or **yarn**

## Local Development Setup

### 1. Clone the Repository

```bash
cd /Users/anilrathore/Documents/Project/jobvibes/node-main/node
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Create a `.env` file in the root directory (copy from `.env.example`):

```bash
cp .env.example .env
```

Edit the `.env` file with your configuration:

#### Required Environment Variables:

- **MONGO_URI**: MongoDB connection string
  - Local: `mongodb://localhost:27017/jobvibes`
  - Cloud (Atlas): `mongodb+srv://username:password@cluster.mongodb.net/dbname`

- **PORT** (optional): Server port (defaults to 3000 if not set)
- **JWT_SECRET**: Secret key for JWT token signing
- **JWT_REFRESH_SECRET**: Secret key for refresh tokens

#### Optional Environment Variables:

- **SMTP_HOST**, **SMTP_PORT**, **SMTP_USER**, **SMTP_PASS**: For email services
- **CLOUDINARY_***: For image upload functionality
- **EMAIL_USER**, **EMAIL_PASS**: Alternative email configuration
- **SMS_OTP_API_URL**: OTP provider endpoint (default: `https://ninzasms.in.net/auth/send_sms`)
- **SMS_OTP_API_KEY**: NinzaSMS API key used in `authorization` header
- **SMS_OTP_SENDER_ID**: NinzaSMS sender id (default: `15901`)
- **SMS_OTP_ROUTE**: Optional NinzaSMS route (`waninza` for WhatsApp). Keep empty for normal SMS.
- **SMS_OTP_COUNTRY_CODE**: Prefix used when phone has 10 digits (default: `91`)
- **GOOGLE_DRIVE_CREDENTIALS_FILE**: Optional path to service account JSON (default: `src/utility/jobvibes-d2cac-f63636e29c35.json`)
- **GOOGLE_DRIVE_ROOT_FOLDER_NAME**: Root Drive folder name (default: `JobVibes-metadata`)
- **GOOGLE_DRIVE_PARENT_FOLDER_ID**: Optional parent folder ID to nest `JobVibes-metadata` under a shared folder
- **GOOGLE_DRIVE_PUBLIC_READ**: `true` or `false` for public read links (default: `true`)

### 4. Start MongoDB (if using local MongoDB)

If you're using a local MongoDB installation:

```bash
# macOS (using Homebrew)
brew services start mongodb-community

# Or run directly
mongod --dbpath /usr/local/var/mongodb
```

For MongoDB Atlas, make sure your IP is whitelisted and you have the correct connection string.

### 5. Run the Application

#### Development Mode (with auto-reload):

```bash
npm run dev
```

This uses `nodemon` to automatically restart the server when files change.

#### Production Mode:

```bash
npm start
```

### 6. Verify the Server is Running

- Server should start on `http://localhost:3000` (or your configured PORT)
- Check the health endpoint: `http://localhost:3000/health`
- Root endpoint: `http://localhost:3000/`

## Google Drive File Storage

All upload APIs now store files on Google Drive using your service account JSON.

Folder hierarchy is created automatically:

`JobVibes-metadata/users/<userId>/<category>/`

Current upload categories:
- `general-uploads` via `POST /api/v1/user/upload`
- `resumes` via `POST /api/v1/user/resume`

Before uploading files, share your Drive folder (or parent folder) with the service account email as Editor.

## API Endpoints

The API is available under `/api`:

- Health check: `GET /health`
- API routes: `GET /api/...`
- Auth routes: `POST /api/v1/auth/...`

Example endpoints:
- `POST /api/v1/auth/token-register` - Register with Firebase token
- `POST /api/v1/auth/otp` - Request OTP
- `POST /api/v1/auth/verify` - Verify OTP
- `POST /api/v1/auth/otp/resend` - Resend OTP

## OTP API Documentation

### 1) Send OTP

- URL: `POST /api/v1/auth/otp`
- Provider Call: `POST https://ninzasms.in.net/auth/send_sms`

Provider payload sent by backend:

```json
{
  "sender_id": "15901",
  "variables_values": "123456",
  "numbers": "919876543210"
}
```

NinzaSMS response format:

```json
{
  "status": 1,
  "msg": "OTP Sent Successfully via NinzaSMS"
}
```

Request body:

```json
{
  "phone": "9876543210"
}
```

Success response:

```json
{
  "status": true,
  "statusCode": 200,
  "message": "OTP sent successfully",
  "data": {
    "phone": "9876543210",
    "ttl": 300
  }
}
```

### 2) Verify OTP (returns login token + user keys)

- URL: `POST /api/v1/auth/verify`

Request body:

```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

Success response:

```json
{
  "status": true,
  "statusCode": 200,
  "message": "OTP verified",
  "data": {
    "id": "USER_ID",
    "phone_number": "9876543210",
    "role": "candidate",
    "tokens": {
      "accessToken": "ACCESS_TOKEN",
      "refreshToken": "REFRESH_TOKEN",
      "expiresIn": 2592000
    }
  }
}
```

### 3) Resend OTP

- URL: `POST /api/v1/auth/otp/resend`

Request body:

```json
{
  "phone": "9876543210"
}
```

### 4) Send Email OTP (separate API)

- URL: `POST /api/v1/auth/otp_send_email`

Request body:

```json
{
  "email": "user@example.com"
}
```

Success response:

```json
{
  "status": true,
  "statusCode": 200,
  "message": "OTP sent to email",
  "data": {
    "email": "user@example.com",
    "ttl": 900
  }
}
```

### 5) Verify Email OTP (separate API)

- URL: `POST /api/v1/auth/otp_verify_email`

Request body:

```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

Success response:

```json
{
  "status": true,
  "statusCode": 200,
  "message": "OTP verified successfully",
  "data": {
    "emailVerified": true
  }
}
```

### 6) Resend Email OTP (separate API)

- URL: `POST /api/v1/auth/otp_resend_email`

Request body:

```json
{
  "email": "user@example.com"
}
```

Success response:

```json
{
  "status": true,
  "statusCode": 200,
  "message": "OTP sent to email",
  "data": {
    "email": "user@example.com",
    "ttl": 900
  }
}
```

## Troubleshooting

### MongoDB Connection Issues

1. **Check MongoDB is running:**
   ```bash
   # macOS
   brew services list | grep mongodb
   ```

2. **Verify connection string in `.env`:**
   - Make sure `MONGO_URI` is correctly formatted
   - Check MongoDB logs for connection errors

3. **Check connection status:**
   - Visit `http://localhost:3000/health` to see MongoDB connection state

### Port Already in Use

If you get an `EADDRINUSE` error:

```bash
# Find process using the port
lsof -i :3000

# Kill the process
kill -9 <PID>
```

Or change the `PORT` in your `.env` file.

### Module Not Found Errors

```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Project Structure

```
node/
├── app.js                 # Main application entry point
├── src/
│   ├── api/              # API routes and controllers
│   │   ├── controllers/  # Request handlers
│   │   ├── routes/       # Route definitions
│   │   ├── services/     # Business logic
│   │   └── middleware/   # Authentication and validation
│   ├── models/           # MongoDB schemas
│   ├── utility/          # Helper functions
│   └── connections/      # Database connections
└── package.json
```

## Development Notes

- The server uses Express.js framework
- MongoDB connection is non-blocking (server starts even if DB isn't ready)
- JWT tokens are used for authentication
- OTP login is handled through external SMS OTP provider API
- Environment variables are loaded using `dotenv`

## Production Deployment

For production deployment (e.g., Google Cloud Run), make sure to:

1. Set all required environment variables in your deployment platform
2. Use secure, randomly generated JWT secrets
3. Use a production MongoDB instance (MongoDB Atlas recommended)
4. Configure proper CORS settings
5. Set up proper logging and monitoring

## License

ISC

