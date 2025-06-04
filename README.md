# Cloud Storage App

A simple cloud storage application built with Node.js, Fastify, PostgreSQL, and S3-compatible storage.

## Features

- 📁 File and folder management with drag-and-drop UI
- ☁️ S3-compatible cloud storage integration
- 🗄️ PostgreSQL database for metadata
- 📱 Responsive web interface with Tailwind CSS
- 🔄 Real-time file operations (upload, download, delete, rename)
- 📂 Hierarchical folder structure like Google Drive
- 🔐 JWT-based authentication with login/register
- 👤 User management with bcrypt password hashing
- 🎭 Demo mode for testing without registration

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database
- S3-compatible storage service (AWS S3, MinIO, etc.)

## Setup

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Environment Configuration:**
   Copy `.env.example` to `.env` and configure:
   ```env
   DATABASE_URL=postgresql://username:password@localhost:5432/cloud_storage
   S3_ENDPOINT=https://your-s3-compatible-endpoint.com
   S3_REGION=us-east-1
   S3_ACCESS_KEY_ID=your-access-key
   S3_SECRET_ACCESS_KEY=your-secret-key
   S3_BUCKET_NAME=your-bucket-name
   PORT=3000
   ```

3. **Database Setup:**
   Create your PostgreSQL database and run the schema:
   ```bash
   psql -d cloud_storage -f database/schema.sql
   ```

4. **Start the server:**
   ```bash
   npm start
   ```

5. **Access the application:**
   Open http://localhost:3000 in your browser

## Project Structure

```
├── server.js              # Main application server
├── routes/
│   ├── files.js           # File operations API
│   └── folders.js         # Folder operations API
├── services/
│   └── s3Service.js       # S3 storage service
├── database/
│   ├── db.js              # Database connection
│   └── schema.sql         # Database schema
├── static/                # Frontend files
│   ├── index.html         # Main UI
│   └── app.js             # Frontend JavaScript
└── .env.example           # Environment template
```

## Database Schema

The application uses three main tables:

- **users**: User management with JWT authentication
- **folders**: Hierarchical folder structure with path tracking
- **files**: File metadata with S3 key references

## API Endpoints

- `GET /api/browse?path=` - List files and folders
- `POST /api/folder` - Create new folder
- `POST /api/upload?path=` - Upload files
- `GET /api/file/:id/download` - Download file
- `DELETE /api/file/:id` - Delete file
- `DELETE /api/folder/:id` - Delete folder

## Production Deployment

1. Set `NODE_ENV=production` in your environment
2. Use a process manager like PM2: `pm2 start server.js`
3. Set up reverse proxy with Nginx
4. Configure SSL certificates
5. Use connection pooling for PostgreSQL
6. Implement proper authentication and authorization

## Security Features

- **JWT Authentication**: Secure token-based authentication with HTTP-only cookies
- **User Isolation**: Each user has their own isolated file system
- **Password Security**: Bcrypt hashing with 12 rounds for password storage
- **Input Validation**: Server-side validation for all user inputs
- **Database Security**: Prepared statements to prevent SQL injection
- **Session Management**: Secure cookie configuration with proper flags

## Additional Security Considerations

- Use HTTPS in production
- Implement rate limiting for API endpoints
- Add CORS configuration for your domain
- Use environment variables for all sensitive data
- Regular security updates for dependencies
- Implement file upload restrictions (size, type, etc.)

## Technologies Used

- **Backend**: Node.js, Fastify
- **Database**: PostgreSQL
- **Storage**: S3-compatible (AWS S3, MinIO, etc.)
- **Frontend**: HTML5, Tailwind CSS, Vanilla JavaScript
- **File Upload**: Multipart form data with drag-and-drop
