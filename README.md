# InternLoom Talent Matching Backend

RESTful API for the InternLoom hackathon problem statement. Node.js + Express +
MongoDB (Mongoose) + JWT auth.

See [API_REFERENCE.md](./API_REFERENCE.md) for every endpoint with example
requests and responses (Postman-collection equivalent, pre-populated with test data).

## Run locally (under 5 minutes)

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Start MongoDB.** Run it locally:
   ```bash
   mongod --dbpath ~/mongodb-data
   ```
   (Use whatever `--dbpath` folder you want MongoDB to store its data files in —
   create it first with `mkdir -p ~/mongodb-data` if it doesn't exist. Leave this
   running in its own terminal tab.)

3. **Configure environment**
   ```bash
   cp .env.example .env
   ```
   Edit `.env`:
   - `MONGO_URI` — `mongodb://127.0.0.1:27017/internloom` for local Mongo
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — any long random strings

4. **Seed the pre-approved demo company** (required — student-visible listings only
   come from approved companies)
   ```bash
   npm run seed
   ```
   Logs the demo company's login credentials to the console
   (`demo@techcorp.com` / `DemoPass123!`).

5. **Start the server** (in a new terminal tab, leave `mongod` running in its own)
   ```bash
   npm start
   ```
   Health check:
   ```bash
   curl http://localhost:5000/health
   ```
   Expected: `{"success":true,"data":{"status":"ok"}}`

   If port 5000 is already in use (common on macOS — AirPlay Receiver squats on
   it), set `PORT=5050` in `.env` and use that port in the commands below instead.

## Response envelope

Every response is:
```json
{ "success": true, "data": {}, "meta": null }
```
or
```json
{ "success": false, "error": { "code": "SOME_CODE", "message": "..." } }
```

## Demo script (curl) — walk through this top to bottom

Assumes the server is on port 5050 — swap back to 5000 in every URL below if you
didn't change the port.

**1. Register a student**
```bash
curl -X POST http://localhost:5050/api/auth/student/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Priya Sharma","email":"priya@vtu.ac.in","password":"Passw0rd!"}'
```
Copy the `demoOtp` from the response.

**2. Verify the OTP** (replace `123456` with the real one, keep it quoted as a string)
```bash
curl -X POST http://localhost:5050/api/auth/student/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@vtu.ac.in","otp":"123456"}'
```

**3. Log in as the student and save the token**
```bash
STUDENT_TOKEN=$(curl -s -X POST http://localhost:5050/api/auth/student/login \
  -H "Content-Type: application/json" \
  -d '{"email":"priya@vtu.ac.in","password":"Passw0rd!"}' \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
```

**4. Log in as the seeded demo company and save the token**
```bash
COMPANY_TOKEN=$(curl -s -X POST http://localhost:5050/api/auth/company/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@techcorp.com","password":"DemoPass123!"}' \
  | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
```

**5. Fill in the student's profile** (drives the completeness score and match score)
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

**6. Create a listing as the company** (starts in Draft)
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
Copy the `_id` from the response.

```bash
LISTING_ID="paste_the_id_here"
```

**7. Activate the listing** (Draft -> Active)
```bash
curl -X PATCH http://localhost:5050/api/listings/$LISTING_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COMPANY_TOKEN" \
  -d '{"status":"Active"}'
```

**8. View it as the student — ranked, with a live match score**
```bash
curl http://localhost:5050/api/listings -H "Authorization: Bearer $STUDENT_TOKEN"
```

**9. Apply to it**
```bash
curl -X POST http://localhost:5050/api/listings/$LISTING_ID/apply \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```

**10. Try applying again — proves duplicate-application rejection, not a crash**
```bash
curl -X POST http://localhost:5050/api/listings/$LISTING_ID/apply \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```
Expected: `409 ALREADY_APPLIED`.

**11. View applicants as the company, sorted by live match score**
```bash
curl http://localhost:5050/api/listings/$LISTING_ID/applicants \
  -H "Authorization: Bearer $COMPANY_TOKEN"
```

## Demo script — the cap / auto-close / reopen cycle (Section 3.5 tricky part)

Create a second listing with `maxApplicantCap: 1` so hitting the cap is instant:
```bash
curl -X POST http://localhost:5050/api/listings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COMPANY_TOKEN" \
  -d '{
    "title": "Backend Intern - Cap Test",
    "description": "Testing cap logic",
    "requiredSkills": ["Node.js"],
    "location": "remote",
    "applicationDeadline": "2026-12-31T00:00:00.000Z",
    "maxApplicantCap": 1
  }'
```
```bash
CAP_LISTING_ID="paste_the_new_id_here"

curl -X PATCH http://localhost:5050/api/listings/$CAP_LISTING_ID/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $COMPANY_TOKEN" \
  -d '{"status":"Active"}'

curl -X POST http://localhost:5050/api/listings/$CAP_LISTING_ID/apply \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```
Copy the `applicationId`, then check the listing auto-closed:
```bash
CAP_APP_ID="paste_the_application_id_here"

curl http://localhost:5050/api/listings/$CAP_LISTING_ID \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```
Expect `"status":"Closed","autoClosedByCap":true`. Now withdraw and watch it reopen:
```bash
curl -X POST http://localhost:5050/api/applications/$CAP_APP_ID/withdraw \
  -H "Authorization: Bearer $STUDENT_TOKEN"

curl http://localhost:5050/api/listings/$CAP_LISTING_ID \
  -H "Authorization: Bearer $STUDENT_TOKEN"
```
Expect `"status":"Active","autoClosedByCap":false` — the one sanctioned exception
to "Closed never goes back to Active." See `DESIGN_DECISIONS.md` for the reasoning.

## What's NOT built (explicitly out of scope per the problem statement)

- Admin endpoints (problem statement says these are out of scope; the schema
  already supports adding them — `Company.isApproved` exists, just no route to
  flip it besides the seed script).
- A frontend/UI (Bonus D) — this track's deliverable is the backend API itself;
  the demo is API calls plus explanation, per the problem statement's own
  Section 7 ("What Judges Will Do in the Demo").
- Bonus C (Audit Trail) — not attempted, prioritized core requirements +
  Bonus A (rate limiting) given the time budget.
