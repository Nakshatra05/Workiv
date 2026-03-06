# Workiv API Endpoints

This document contains all the API endpoints for the Workiv application with their corresponding curl commands.

## Base URL

```text
http://localhost:3000/api
```

## Jobs API

### Create a Job Listing

**Endpoint:** `POST /api/post`  
**Description:** Create a new job listing with a company logo/image and description.

**Request Body (Form Data):**

- `image` (File): Company logo or job image (JPEG, PNG, GIF, WebP, max 25MB)
- `owner` (string): Employer wallet address
- `caption` (string): Job description (1-500 characters)

**Curl Command:**

```bash
curl -X POST http://localhost:3000/api/post \
  -F "image=@/path/to/logo.jpg" \
  -F "owner=0x1234567890abcdef..." \
  -F "caption=Senior Software Engineer - Remote - $120k-$180k"
```

### Get a Job Listing

**Endpoint:** `GET /api/post?id={jobId}`  
**Description:** Retrieve a specific job listing by ID.

**Query Parameters:**

- `id` (string): Job ID

**Curl Command:**

```bash
curl -X GET "http://localhost:3000/api/post?id=0x1234567890abcdef..."
```

### Update a Job Listing

**Endpoint:** `PUT /api/post`  
**Description:** Update an existing job listing's description.

**Request Body (Form Data):**

- `post_id` (string): Job ID to update
- `owner` (string): Owner wallet address
- `caption` (string): New job description (1-500 characters)

**Curl Command:**

```bash
curl -X PUT http://localhost:3000/api/post \
  -F "post_id=0x1234567890abcdef..." \
  -F "owner=0x1234567890abcdef..." \
  -F "caption=Updated job description!"
```

### Delete a Job Listing

**Endpoint:** `DELETE /api/post?post_id={jobId}&owner={owner}`  
**Description:** Delete a job listing (only the employer can delete their own listings).

**Query Parameters:**

- `post_id` (string): Job ID to delete
- `owner` (string): Owner wallet address

**Curl Command:**

```bash
curl -X DELETE "http://localhost:3000/api/post?post_id=0x1234567890abcdef...&owner=0x1234567890abcdef..."
```

## Job Board API

### Get Job Board

**Endpoint:** `GET /api/feed?limit={limit}`  
**Description:** Get the job board with all listings.

**Query Parameters:**

- `limit` (number, optional): Number of jobs to fetch (default: 20, max: 50)

**Curl Command:**

```bash
curl -X GET "http://localhost:3000/api/feed?limit=20"
```

### Get Real-time Job Updates

**Endpoint:** `GET /api/feed/realtime`  
**Description:** Get real-time job listing updates via Server-Sent Events.

**Curl Command:**

```bash
curl -X GET "http://localhost:3000/api/feed/realtime" \
  -H "Accept: text/event-stream" \
  -H "Cache-Control: no-cache"
```

## Profile API

### Create/Update Profile

**Endpoint:** `POST /api/profile`  
**Description:** Create or update a user profile.

**Request Body (JSON):**

```json
{
  "wallet": "0x1234567890abcdef...",
  "displayName": "John Doe",
  "bio": "Software developer",
  "avatar": "https://example.com/avatar.jpg",
  "expiresInKey": "tenYears"
}
```

**Curl Command:**

```bash
curl -X POST http://localhost:3000/api/profile \
  -H "Content-Type: application/json" \
  -d '{
    "wallet": "0x1234567890abcdef...",
    "displayName": "John Doe",
    "bio": "Software developer",
    "avatar": "https://example.com/avatar.jpg",
    "expiresInKey": "tenYears"
  }'
```

## Featured Jobs API

### Create a Featured Job

**Endpoint:** `POST /api/stories`  
**Description:** Create a new featured job listing with media content.

**Request Body (Form Data):**

- `media` (File): Media file (max 25MB)
- `author` (string): Author wallet address
- `content` (string, optional): Featured job highlight/description

**Curl Command:**

```bash
curl -X POST http://localhost:3000/api/stories \
  -F "media=@/path/to/media.jpg" \
  -F "author=0x1234567890abcdef..." \
  -F "content=Urgent hiring! Senior Developer needed"
```

### Get Featured Jobs

**Endpoint:** `GET /api/stories?author={author}&limit={limit}`  
**Description:** Get featured jobs, optionally filtered by employer.

**Query Parameters:**

- `author` (string, optional): Filter by employer wallet address
- `limit` (number, optional): Number of featured jobs to fetch (default: 20, max: 50)

**Curl Command:**

```bash
# Get all featured jobs
curl -X GET "http://localhost:3000/api/stories?limit=20"

# Get featured jobs by specific employer
curl -X GET "http://localhost:3000/api/stories?author=0x1234567890abcdef...&limit=10"
```

### Get Specific Featured Job

**Endpoint:** `GET /api/stories/{featuredJobId}`  
**Description:** Get a specific featured job by ID.

**Path Parameters:**

- `featuredJobId` (string): Featured Job ID

**Curl Command:**

```bash
curl -X GET "http://localhost:3000/api/stories/0x1234567890abcdef..."
```

### Remove a Featured Job

**Endpoint:** `DELETE /api/stories?story_id={featuredJobId}&author={author}`  
**Description:** Remove a featured job (only the employer can remove their own featured jobs).

**Query Parameters:**

- `story_id` (string): Featured Job ID to remove
- `author` (string): Author wallet address

**Curl Command:**

```bash
curl -X DELETE "http://localhost:3000/api/stories?story_id=0x1234567890abcdef...&author=0x1234567890abcdef..."
```

## Applications API

### Submit an Application

**Endpoint:** `POST /api/post/comments`  
**Description:** Submit an application or inquiry for a job listing. Applications are stored as structured JSON, while inquiries are stored as plain text.

**Request Body (Form Data):**

- `post_id` (string): Job ID to apply to
- `author` (string): Applicant wallet address
- `content` (string): Application content - either structured JSON (for formal applications) or plain text (for inquiries)
- `parent_comment_id` (string, optional): Parent application ID for replies

#### Structured Application Format

For formal job applications, the `content` field should contain a JSON object with the following structure:

```json
{
  "type": "application",
  "coverLetter": "Your cover letter explaining why you're a good fit...",
  "experience": "3-5 years",
  "portfolioUrl": "https://your-portfolio.com",
  "linkedinUrl": "https://linkedin.com/in/yourprofile"
}
```

**Application Fields:**
- `type` (string): Must be "application" to identify this as a formal application
- `coverLetter` (string, required): Cover letter/introduction (50-2000 characters)
- `experience` (string, required): Experience level - one of: "0-1 years", "1-3 years", "3-5 years", "5-10 years", "10+ years"
- `portfolioUrl` (string, optional): Link to portfolio or personal website
- `linkedinUrl` (string, optional): LinkedIn profile URL

#### Plain Text Inquiry Format

For simple questions about a job listing, send plain text in the `content` field:

```
I have a question about the remote work policy for this position.
```

**Curl Commands:**

```bash
# Submit a structured application
curl -X POST http://localhost:3000/api/post/comments \
  -F "post_id=0x1234567890abcdef..." \
  -F "author=0x1234567890abcdef..." \
  -F 'content={"type":"application","coverLetter":"I am excited to apply for this position...","experience":"3-5 years","portfolioUrl":"https://myportfolio.com","linkedinUrl":"https://linkedin.com/in/myprofile"}'

# Submit a plain text inquiry
curl -X POST http://localhost:3000/api/post/comments \
  -F "post_id=0x1234567890abcdef..." \
  -F "author=0x1234567890abcdef..." \
  -F "content=What is the expected start date for this role?"

# Reply to an application/inquiry
curl -X POST http://localhost:3000/api/post/comments \
  -F "post_id=0x1234567890abcdef..." \
  -F "author=0x1234567890abcdef..." \
  -F "content=Thank you for your interest!" \
  -F "parent_comment_id=0x9876543210fedcba..."
```

### Get Comments

**Endpoint:** `GET /api/post/comments?post_id={postId}&limit={limit}&offset={offset}`  
**Description:** Get comments for a specific post.

**Query Parameters:**

- `post_id` (string): Post ID to get comments for
- `limit` (number, optional): Number of comments to fetch (default: 10, max: 50)
- `offset` (number, optional): Offset for pagination (default: 0)

**Curl Command:**

```bash
curl -X GET "http://localhost:3000/api/post/comments?post_id=0x1234567890abcdef...&limit=10&offset=0"
```

### Update a Comment

**Endpoint:** `PUT /api/post/comments`  
**Description:** Update an existing comment.

**Request Body (Form Data):**

- `comment_id` (string): Comment ID to update
- `author` (string): Comment author wallet address
- `content` (string): New comment content (1-1000 characters)

**Curl Command:**

```bash
curl -X PUT http://localhost:3000/api/post/comments \
  -F "comment_id=0x1234567890abcdef..." \
  -F "author=0x1234567890abcdef..." \
  -F "content=Updated comment content"
```

### Delete a Comment

**Endpoint:** `DELETE /api/post/comments?comment_id={commentId}&author={author}`  
**Description:** Delete a comment (only the author can delete their own comments).

**Query Parameters:**

- `comment_id` (string): Comment ID to delete
- `author` (string): Comment author wallet address

**Curl Command:**

```bash
curl -X DELETE "http://localhost:3000/api/post/comments?comment_id=0x1234567890abcdef...&author=0x1234567890abcdef..."
```

## Error Responses

All endpoints may return the following error responses:

- `400 Bad Request`: Invalid request parameters or body
- `403 Forbidden`: Unauthorized action (e.g., deleting someone else's content)
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

Error response format:

```json
{
  "message": "Error description"
}
```

## Success Responses

Success responses vary by endpoint but generally follow this pattern:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... },
  "txHash": "0x..." // For blockchain operations
}
```
