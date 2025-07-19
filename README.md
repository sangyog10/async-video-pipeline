# Video Editor with Express Server and JWT Authentication

We can use it to resize the dimension of video, extract audio from the video, download the resized video and audio.

## Features

- **User Authentication**: Secure JWT-based authentication system
- **User Registration**: Create new user accounts with email validation
- **User Login**: Authenticate with username/password
- **Protected Routes**: Secure video editing features behind authentication
- **Video Processing**: Resize videos, extract audio, and download processed files
- **Password Security**: Bcrypt password hashing for secure storage

## Requirements

You need to have ffmpeg installed to run it locally.

## Installation

To install the dependencies:

```bash
npm install
```

## Running the Application

To start the Express server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

For cluster mode:

```bash
npm run cluster
```

The server will start on port 8008 by default.

## API Endpoints

### Authentication Routes

#### Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "your_username",
  "email": "your_email@example.com",
  "password": "your_password",
  "name": "Your Full Name"
}
```

#### Login User
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "your_username",
  "password": "your_password"
}
```

#### Logout User
```http
POST /api/auth/logout
```

### Protected User Routes (Require Authentication)

#### Get User Info
```http
GET /api/user
Authorization: Bearer <your_jwt_token>
```

#### Update User Info
```http
PUT /api/user
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "email": "updated@example.com"
}
```

### Protected Video Routes (Require Authentication)

#### Get User Videos
```http
GET /api/videos
Authorization: Bearer <your_jwt_token>
```

#### Upload Video
```http
POST /api/upload-video
Authorization: Bearer <your_jwt_token>
filename: <filename_header>
Content-Type: video/mp4 (or video content)
```

#### Extract Audio from Video
```http
PATCH /api/video/extract-audio?videoId=<video_id>
Authorization: Bearer <your_jwt_token>
```

#### Resize Video
```http
PUT /api/video/resize
Authorization: Bearer <your_jwt_token>
Content-Type: application/json

{
  "videoId": "video_id",
  "width": 1280,
  "height": 720
}
```

#### Get Video Asset
```http
GET /api/get-video-asset?videoId=<video_id>&type=<thumbnail|original|audio|resize>&dimensions=<width>x<height>
```

## Authentication

The application now uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Default User (for testing)
- Username: `sangyog`
- Password: `sangyog`
- Email: `sangyog@example.com`

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: Bcrypt with salt rounds for password security
- **Input Validation**: Express-validator for request validation
- **Rate Limiting**: Prevent abuse with request rate limiting
- **Security Headers**: Helmet.js for security headers
- **CORS**: Cross-origin resource sharing configuration

## Environment Variables

You can configure the following environment variables:

- `PORT`: Server port (default: 8008)
- `JWT_SECRET`: Secret key for JWT tokens (change in production!)
- `JWT_EXPIRES_IN`: Token expiration time (default: 24h)
- `NODE_ENV`: Environment (development/production)
