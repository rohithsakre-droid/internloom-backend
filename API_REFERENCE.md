# API Reference — every endpoint, with example request + expected response

This replaces a Postman collection. Every endpoint in the API is listed below with
a ready-to-run `curl` command, an example request body where relevant, and the
expected response shape. Server assumed to be on port 5050 — swap the port if
you're running on 5000.

Pre-populated test data used throughout: a student `priya@vtu.ac.in` and the
seeded demo company `demo@techcorp.com` (created by `npm run seed`).

Set these once after logging in (see Auth section) and reuse them everywhere:
```bash
STUDENT_TOKEN="..."
COMPANY_TOKEN="..."
LISTING_ID="..."
APPLICATION_ID="..."
```

---

## Health

### `GET /health`
```bash
curl http://localhost:5050/health
```
**Response 200:**
```json
{ "success": true, "data": { "status": "ok" } }
```

---

## Auth

### `POST /api/auth/student/register`
```bash
curl -X POST http://localhost:5050/api/auth/student/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Priya Sharma","email":"priya@vtu.ac.in","password":"Passw0rd!"}'
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "studentId": "6a5b2afd7c5fab368a16be0",
    "message": "Registered. Verify your email with the OTP to unlock job applications.",
    "demoOtp": "880077"
  },
  "meta": null
}
```
**Error case — personal email domain (400 `INVALID_EMAIL_DOMAIN`):**
```bash
curl -X POST http://localhost:5050/api/auth/student/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@gmail.com","password":"Passw0rd!"}'
```
```json
{ "success": false, "error": { "code": "INVALID_EMAIL_DOMAIN", "message": "Please register with a college email ending in .edu, .ac.in or .edu.in. Personal email providers are not accepted." } }
```

### `POST /api/auth/student/verify-otp`
```bash
curl -X POST http://localhost:5050/api/auth/student/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@vtu.ac.in","otp":"880077"}'
```
**Response 200:**
```json
{ "success": true, "data": { "message": "Email verified successfully" }, "meta": null }
```

### `POST /api/auth/student/login`
```bash
curl -X POST http://localhost:5050/api/auth/student/login \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@vtu.ac.in","password":"Passw0rd!"}'
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi...",
    "isVerified": true
  },
  "meta": null
}
```

### `POST /api/auth/student/change-email` (auth required, student)
```bash
curl -X POST http://localhost:5050/api/auth/student/change-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{"newEmail":"priya.new@vtu.ac.in"}'
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "message": "OTP sent to new email. Your account remains active under your current email until confirmed.",
    "demoOtp": "441209"
  },
  "meta": null
}
```

### `POST /api/auth/company/register`
```bash
curl -X POST http://localhost:5050/api/auth/company/register \
  -H "Content-Type: application/json" \
  -d '{"companyName":"Acme Robotics","email":"hr@acme.com","password":"Passw0rd!"}'
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "companyId": "6a5b3000d7c5fab368a16c20",
    "message": "Company registered. Listings will be visible once admin-approved."
  },
  "meta": null
}
```

### `POST /api/auth/company/login`
```bash
curl -X POST http://localhost:5050/api/auth/company/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@techcorp.com","password":"DemoPass123!"}'
```
**Response 200:**
```json
{
  "success": true,
  "data": { "accessToken": "eyJhbGciOi...", "refreshToken": "eyJhbGciOi...", "isApproved": true },
  "meta": null
}
```

### `POST /api/auth/refresh`
```bash
curl -X POST http://localhost:5050/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI2YTViMmFmZDdjNWZhYjM2OGExNmJlMCIsInJvbGUiOiJzdHVkZW50IiwiaWF0IjoxNzg0MzU5ODcyLCJleHAiOjE3ODQ5NjQ2NzJ9.f8VVrIci01vE1l7d2cNyO7tWx5FDD_AGZDPh2YvcE6c"}'
```
**Response 200:**
```json
{ "success": true, "data": { "accessToken": "eyJhbGciOi...", "refreshToken": "eyJhbGciOi..." }, "meta": null }
```

---

## Student Profile (auth required, student)

### `GET /api/students/me`
```bash
curl http://localhost:5050/api/students/me -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "_id": "6a5b2afd7c5fab368a16be0",
    "name": "Priya Sharma",
    "collegeEmail": "priya@vtu.ac.in",
    "isVerified": true,
    "college": "BMS College of Engineering",
    "branch": "CSE",
    "graduationYear": 2026,
    "cgpa": 8.7,
    "skills": ["react.js", "javascript", "typescript"],
    "completenessScore": 100
  },
  "meta": null
}
```

### `PUT /api/students/me`
```bash
curl -X PUT http://localhost:5050/api/students/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $STUDENT_TOKEN" \
  -d '{
    "college": "BMS College of Engineering",
    "branch": "CSE",
    "graduationYear": 2026,
    "cgpa": 8.7,
    "skills": ["React.js", "JavaScript", "TypeScript"],
    "githubUrl": "https://github.com/priya",
    "linkedinUrl": "https://linkedin.com/in/priya",
    "bio": "Full-stack dev",
    "resumeUrl": "https://example.com/resume.pdf"
  }'
```
**Response 200:** same shape as `GET /api/students/me` above, with updated fields.

### `DELETE /api/students/me`
```bash
curl -X DELETE http://localhost:5050/api/students/me -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 200 (no active applications):**
```json
{ "success": true, "data": { "message": "Profile deleted" }, "meta": null }
```
**Response 409 (blocked by an active application):**
```json
{ "success": false, "error": { "code": "ACTIVE_APPLICATIONS_EXIST", "message": "Cannot delete profile: you have 1 pending/active application(s). Withdraw them first." } }
```

---

## Company Profile (auth required, company)

### `GET /api/companies/me`
```bash
curl http://localhost:5050/api/companies/me -H "Authorization: Bearer $COMPANY_TOKEN"
```
**Response 200:**
```json
{
  "success": true,
  "data": {
    "_id": "6a5b22dd69495f3960378da0",
    "companyName": "TechCorp Demo Pvt Ltd",
    "companyEmail": "demo@techcorp.com",
    "isApproved": true,
    "description": "Seeded demo company for InternLoom hackathon judging.",
    "website": "https://example.com"
  },
  "meta": null
}
```

### `PUT /api/companies/me`
```bash
curl -X PUT http://localhost:5050/api/companies/me \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COMPANY_TOKEN" \
  -d '{"description":"We build robots.","website":"https://acme.com"}'
```
**Response 200:** same shape as `GET /api/companies/me`, with updated fields.

---

## Listings

### `POST /api/listings` (company)
```bash
curl -X POST http://localhost:5050/api/listings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COMPANY_TOKEN" \
  -d '{
    "title": "Frontend Intern",
    "description": "Build UI with React",
    "requiredSkills": ["React.js", "JavaScript"],
    "preferredSkills": ["TypeScript"],
    "preferredBranches": ["CSE", "ECE"],
    "targetGraduationYear": 2026,
    "stipend": 20000,
    "location": "remote",
    "applicationDeadline": "2026-12-31T00:00:00.000Z",
    "maxApplicantCap": 5
  }'
```
**Response 201:**
```json
{
  "success": true,
  "data": {
    "_id": "6a5b2fc8d7c5fab368a16be8",
    "company": "6a5b22dd69495f3960378da0",
    "title": "Frontend Intern",
    "status": "Draft",
    "currentApplicantCount": 0,
    "autoClosedByCap": false
  },
  "meta": null
}
```

### `GET /api/listings/mine` (company)
```bash
curl http://localhost:5050/api/listings/mine -H "Authorization: Bearer $COMPANY_TOKEN"
```
**Response 200:** array of the company's own listings, same shape as above.

### `PUT /api/listings/:id` (company)
```bash
curl -X PUT http://localhost:5050/api/listings/$LISTING_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COMPANY_TOKEN" \
  -d '{"requiredSkills":["React.js","JavaScript","MongoDB"]}'
```
**Response 200:** the updated listing document.
**Response 400 (editing a Closed listing):**
```json
{ "success": false, "error": { "code": "LISTING_CLOSED", "message": "Cannot edit a closed listing" } }
```

### `PATCH /api/listings/:id/status` (company)
```bash
curl -X PATCH http://localhost:5050/api/listings/$LISTING_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COMPANY_TOKEN" \
  -d '{"status":"Active"}'
```
**Response 200:** the listing with `"status":"Active"`.
**Response 400 (illegal transition, e.g. Draft -> Closed):**
```json
{ "success": false, "error": { "code": "INVALID_TRANSITION", "message": "Cannot move listing from Draft to Closed" } }
```

### `GET /api/listings/:id/applicants` (company)
```bash
curl http://localhost:5050/api/listings/$LISTING_ID/applicants -H "Authorization: Bearer $COMPANY_TOKEN"
```
**Response 200:**
```json
{
  "success": true,
  "data": [
    {
      "applicationId": "6a5b31e9d7c5fab368a16bfb",
      "status": "Submitted",
      "matchScoreAtApplication": 100,
      "liveMatchScore": 100,
      "student": { "id": "6a5b2afd7c5fab368a16be0", "name": "Priya Sharma", "branch": "CSE", "skills": ["react.js","javascript","typescript"] }
    }
  ],
  "meta": null
}
```

### `GET /api/listings` (student — ranked by live match score)
```bash
curl http://localhost:5050/api/listings -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 200:**
```json
{
  "success": true,
  "data": [
    { "_id": "6a5b2fc8d7c5fab368a16be8", "title": "Frontend Intern", "status": "Active", "matchScore": 100 }
  ],
  "meta": { "page": 1, "limit": 10, "total": 1, "totalPages": 1 }
}
```

### `GET /api/listings/:id` (either role)
```bash
curl http://localhost:5050/api/listings/$LISTING_ID -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 200:** the full listing document with populated `company.companyName`.

### `POST /api/listings/:listingId/apply` (student)
```bash
curl -X POST http://localhost:5050/api/listings/$LISTING_ID/apply -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 201:**
```json
{ "success": true, "data": { "applicationId": "6a5b31e9d7c5fab368a16bfb", "matchScore": 100, "status": "Submitted" }, "meta": null }
```
**Response 409 (already applied):**
```json
{ "success": false, "error": { "code": "ALREADY_APPLIED", "message": "You have already applied to this listing" } }
```
**Response 409 (cap reached):**
```json
{ "success": false, "error": { "code": "LISTING_FULL", "message": "This listing just reached its applicant cap" } }
```

---

## Applications

### `GET /api/applications/mine` (student)
```bash
curl http://localhost:5050/api/applications/mine -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 200:** array of the student's own applications, each with populated `listing.title`.

### `POST /api/applications/:id/withdraw` (student)
```bash
curl -X POST http://localhost:5050/api/applications/$APPLICATION_ID/withdraw -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 200:**
```json
{ "success": true, "data": { "message": "Application withdrawn" }, "meta": null }
```
**Response 400 (not in Submitted state):**
```json
{ "success": false, "error": { "code": "CANNOT_WITHDRAW", "message": "Only applications in Submitted state can be withdrawn" } }
```

### `PATCH /api/applications/:id/status` (company)
```bash
curl -X PATCH http://localhost:5050/api/applications/$APPLICATION_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COMPANY_TOKEN" \
  -d '{"status":"Under Review"}'
```
**Response 200:** the updated application document.
**Response 400 (illegal transition):**
```json
{ "success": false, "error": { "code": "INVALID_TRANSITION", "message": "Cannot move application from Rejected to Shortlisted" } }
```

### `PATCH /api/applications/bulk-status` (company)
```bash
curl -X PATCH http://localhost:5050/api/applications/bulk-status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COMPANY_TOKEN" \
  -d '{"listingId":"'"$LISTING_ID"'","fromStatus":"Submitted","toStatus":"Rejected","olderThanDays":7}'
```
**Response 200:**
```json
{ "success": true, "data": { "updatedCount": 3 }, "meta": null }
```

---

## Notifications (auth required, either role)

### `GET /api/notifications`
```bash
curl "http://localhost:5050/api/notifications?page=1&limit=20" -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 200:**
```json
{
  "success": true,
  "data": [
    { "_id": "6a5b3400d7c5fab368a16c30", "type": "NEW_APPLICANT", "message": "A new student applied to \"Frontend Intern\".", "isRead": false }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

### `GET /api/notifications?isRead=false`
```bash
curl "http://localhost:5050/api/notifications?isRead=false" -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 200:** same shape, filtered to unread only.

### `PATCH /api/notifications/:id/read`
```bash
curl -X PATCH http://localhost:5050/api/notifications/6a5b3400d7c5fab368a16c30/read -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 200:** the notification with `"isRead":true`.

### `PATCH /api/notifications/read-all`
```bash
curl -X PATCH http://localhost:5050/api/notifications/read-all -H "Authorization: Bearer $STUDENT_TOKEN"
```
**Response 200:**
```json
{ "success": true, "data": { "updatedCount": 4 }, "meta": null }
```

---

## Cross-cutting behavior (not a single endpoint, but worth showing)

**Rate limiting (Bonus A)** — after 100 requests from the same IP within 15 minutes,
every endpoint returns:
```json
{ "success": false, "error": { "code": "RATE_LIMITED", "message": "Too many requests. Try again in N seconds." } }
```
with an HTTP `429` status and a `Retry-After` header.

**Unknown route:**
```bash
curl http://localhost:5050/api/nonexistent
```
```json
{ "success": false, "error": { "code": "ROUTE_NOT_FOUND", "message": "No route for GET /api/nonexistent" } }
```

**Malformed ObjectId in a URL param:**
```bash
curl http://localhost:5050/api/listings/not-a-real-id -H "Authorization: Bearer $STUDENT_TOKEN"
```
```json
{ "success": false, "error": { "code": "INVALID_ID", "message": "Invalid identifier: not-a-real-id" } }
```
