# Design Decisions

## 1. Email re-verification without lockout (Section 3.1)

A verified student who changes their email is never locked out. `Student.collegeEmail`
is only ever overwritten once the *new* address is confirmed. When a student calls
`POST /api/auth/student/change-email`, we stage the new address in a separate
`pendingEmail` field and send an OTP to it — `collegeEmail` and `isVerified` are
untouched. The student keeps applying, logging in, and using the platform exactly as
before under their old, still-verified email. Only when they submit the correct OTP
via `POST /api/auth/student/verify-otp` do we swap `pendingEmail` into `collegeEmail`.
If they never verify, nothing breaks — they simply stay on the old email indefinitely.

## 2. Editing an Active listing's skills with existing applicants (Section 3.3)

Match scores are never stored or cached — they are computed at request time, always,
from whatever the listing currently contains (`services/matchingService.js`). This
means there is no staleness problem to solve: the moment a company edits
`requiredSkills` on an Active listing, every subsequent `GET /listings` for students
and every `GET /listings/:id/applicants` for the company reflects the new skills
immediately. We do keep one historical field, `matchScoreAtApplication`, snapshotted
onto the `Application` document at the moment a student applied — this is a record of
"what the score was when they applied," not a live value, and it is never used for
ranking. The tradeoff we accepted: a student could see their live rank shift after a
company edits a listing they've already applied to. We consider this correct behavior
(the listing genuinely changed) rather than a bug to hide.

## 3. Withdrawal reopening a Closed listing (Section 3.5)

The general state machine (`Listing.ALLOWED_TRANSITIONS`) forbids `Closed -> Active`
and that rule is enforced on every *company-initiated* transition via
`PATCH /listings/:id/status`. But an auto-close caused by hitting the applicant cap is
a system decision, not a company decision — and a withdrawal can legitimately undo the
condition that caused it. We resolve the contradiction with a dedicated boolean,
`autoClosedByCap`, set only when the system (not the company) closes a listing for
hitting its cap. `withdrawApplication` is the *only* code path allowed to move a
listing from `Closed` back to `Active`, and only when all of these hold: the listing is
Closed, `autoClosedByCap` is true, the count is now under the cap, and the deadline
hasn't passed. A listing closed manually by the company, or closed because its
deadline passed, can never be reopened by a withdrawal — `autoClosedByCap` is false in
both those cases.

## 4. Matching algorithm scale (Section 3.4)

The algorithm (`services/matchingService.js`) is documented as a weighted sum:
required-skill overlap (45 pts), preferred-skill overlap (15 pts), branch/grad-year
alignment (20 pts), listing recency (20 pts) — summed, then scaled by a
completeness multiplier (0.5–1.0) so an identical skill match ranks lower on an
incomplete profile without ever zeroing it out.

For a single student's `GET /listings` request we never compare across students.
We filter candidate listings at the DB level first (`{status: 'Active',
applicationDeadline: {$gt: now}}`, backed by a compound index), build the student's
skill `Set` once, then score each candidate listing in roughly constant time
(bounded by that listing's own skill-list size). Total cost is O(L) in the number of
listings returned — not O(students × listings). At real scale, the next steps would
be caching each student's skill `Set`/completeness score (invalidated on profile
edits) and moving listing search itself into an indexed search layer
(e.g. Meilisearch/Elasticsearch) rather than scoring every candidate in application
code — noted here rather than built, since it's out of scope for this submission.

## If I had one more hour

I'd move the "notify all matching students when a listing goes Active" logic
(`notifyMatchingStudents` in `listingController.js`) out of the request/response
cycle and into a queued background job — right now it's a synchronous scan over all
verified students, which is fine at hackathon scale but would add real latency to a
company's "activate listing" call as the student base grows.
