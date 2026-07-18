# InternLoom Talent Matching Backend

RESTful API for the InternLoom hackathon problem statement. Node.js + Express +
MongoDB (Mongoose) + JWT auth.

## Run locally (under 5 minutes)

1. **Install dependencies**
   ```
   npm install
   ```

2. **Start MongoDB.** Either run it locally (`mongod`) or use a free MongoDB Atlas
   cluster and grab its connection string.

3. **Configure environment**
   ```
   cp .env.example .env
   ```
   Edit `.env`:
   - `MONGO_URI` — your local or Atlas connection string
   - `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — any long random strings

4. **Seed the pre-approved demo company** (required — student-visible listings only
   come from approved companies)
   ```
   npm run seed
   ```
   Logs the demo company's login credentials to the console.

5. **Start the server**
   ```
   npm start
   ```
   Health check: `GET http://localhost:5000/health`

## Response envelope

Every response is:
```json
{ "success": true, "data": {}, "meta": null }
```
or
```json
{ "success": false, "error": { "code": "SOME_CODE", "message": "..." } }
```

## Demo flow (matches the two "tricky part" scenarios you'll likely be asked to show)

1. Register a student with a `.ac.in`/`.edu` email → copy the `demoOtp` from the
   response → `POST /api/auth/student/verify-otp`.
2. Login as the seeded demo company → `POST /api/listings` (Draft) →
   `PATCH /api/listings/:id/status` to `Active`.
3. Login as the student → `GET /api/listings` — see it ranked with a `matchScore`.
4. `POST /api/listings/:listingId/apply` — apply.
5. To demo Bonus B (race condition): create a listing with `maxApplicantCap: 1`,
   fire 5 concurrent `POST /apply` calls from 5 different verified students —
   exactly one succeeds (`201`), the rest get `409 LISTING_FULL`.
6. `POST /api/applications/:id/withdraw` on the winning application — watch the
   listing flip back from `Closed` to `Active` (only because it was auto-closed by
   the cap — see `DESIGN_DECISIONS.md`).

## What's NOT built (explicitly out of scope per the problem statement)

- Admin endpoints (problem statement says these are out of scope; the schema
  already supports adding them — `Company.isApproved` exists, just no route to
  flip it besides the seed script).
- Bonus C (Audit Trail) and Bonus D (Dashboard UI) — not attempted, prioritized
  core requirements + Bonus A (rate limiting) + Bonus B (race-condition proof)
  given the time budget.
