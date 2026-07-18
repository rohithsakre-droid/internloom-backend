# AI Usage Log

I used Claude to scaffold the initial project structure (routes/controllers/services/
models separation) and generate first-draft implementations of the auth flow, the
matching algorithm, and the race-condition-safe apply/cap logic, working from the
official problem statement. I reviewed and adjusted the matching algorithm's weightings
and the two documented schema assumptions (`preferredBranches`/`targetGraduationYear` on
Listing, since the spec asks the algorithm to score branch/year alignment without
defining the field), and verified the atomic `findOneAndUpdate` + `$expr` approach
against MongoDB's per-document atomicity guarantees for the applicant-cap race
condition. I personally tested the full flow end-to-end via curl: student
registration and OTP verification, profile completeness scoring, listing creation
and Draft->Active activation, the matching algorithm returning different live
scores for the same listing before and after completing the student's profile,
duplicate-application rejection, and the full applicant-cap auto-close and
withdrawal-reopen cycle. All business logic decisions (state machines, the
`autoClosedByCap` flag, the pending-email re-verification approach) were reviewed
by me against the problem statement's "tricky part" callouts before inclusion.
