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

## API Endpoints

The API is available under `/api`:

- Health check: `GET /health`
- API routes: `GET /api/...`
- Auth routes: `POST /api/v1/auth/...`

Example endpoints:
- `POST /api/v1/auth/token-register` - Register with Firebase token
- `POST /api/v1/auth/otp` - Request OTP
- `POST /api/v1/auth/verify` - Verify OTP

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
- Firebase Admin SDK is used for custom token generation
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

