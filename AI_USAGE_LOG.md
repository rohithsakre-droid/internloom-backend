# AI Usage Log

I used Claude to scaffold the initial project structure (routes/controllers/services/
models separation) and generate first-draft implementations of the auth flow, the
matching algorithm, and the race-condition-safe apply/cap logic, working from the
official problem statement. I reviewed and adjusted the matching algorithm's weightings
and the two documented schema assumptions (`preferredBranches`/`targetGraduationYear` on
Listing, since the spec asks the algorithm to score branch/year alignment without
defining the field), verified the atomic `findOneAndUpdate` + `$expr` approach against
MongoDB's per-document atomicity guarantees for the applicant-cap race condition, and
tested [describe what you personally ran/verified once the app is running locally —
OTP flow, apply/withdraw/reopen cycle, bulk status update, rate limiter]. All business
logic decisions (state machines, the `autoClosedByCap` flag, the pending-email
re-verification approach) were reviewed by me against the problem statement's "tricky
part" callouts before inclusion.
