/**
 * MATCHING ENGINE
 * ----------------
 * Produces a 0-100 relevance score between one student and one listing.
 *
 * Weighting (documented, not tuned by trial and error):
 *   Required skill match   -> 45 pts   (most important: can they even do the job)
 *   Preferred skill match   -> 15 pts   (nice-to-have signal)
 *   Branch/grad-year align -> 20 pts   (soft fit signal, never a hard filter)
 *   Recency of listing     -> 20 pts   (fresh listings surface first, tie-breaker-ish)
 *   -> sum = "raw" score out of 100
 *   Completeness multiplier (0.5 - 1.0) applied to the raw score, so an
 *   identical skill match on a 40%-complete profile scores meaningfully
 *   lower than on a 90%-complete profile, without ever zeroing it out.
 *
 * COMPLEXITY / SCALE NOTE (the "tricky part" in section 3.5 of the brief):
 *   For one student's GET /listings call, we:
 *     1. Build the student's skill Set ONCE (O(k), k = student's skill count)
 *     2. For each candidate listing (already filtered at the DB level to
 *        status=Active and deadline > now, using the {status,deadline} index),
 *        score it in O(r + p) where r/p = required/preferred skill counts
 *        for THAT listing (small, bounded constants in practice).
 *   Total cost per request = O(L * c) where L = listings returned (bounded by
 *   pagination) and c = a small constant — linear, not the O(n^2) trap you'd
 *   get by comparing every student against every listing on every request.
 *   We never loop over other students during a single student's request.
 *   At real scale, the next step would be precomputing/caching each
 *   student's skill Set and completeness score (invalidated on profile
 *   update) and/or moving listing search to an indexed search engine
 *   (Meilisearch/Elasticsearch) — noted here rather than built, per scope.
 */

const REQUIRED_WEIGHT = 45;
const PREFERRED_WEIGHT = 15;
const BRANCH_YEAR_WEIGHT = 20;
const RECENCY_WEIGHT = 20;
const RECENCY_FULL_SCORE_DAYS = 2; // listings <=2 days old get full recency score
const RECENCY_DECAY_WINDOW_DAYS = 28; // decays to 0 by day 30

const COMPLETENESS_FIELDS = [
  'name', 'college', 'branch', 'graduationYear', 'cgpa',
  'githubUrl', 'linkedinUrl', 'bio', 'resumeUrl',
];

/** 0-100. Documented criteria: 9 profile fields + skills array, each worth an equal share. */
function computeProfileCompleteness(student) {
  const totalFields = COMPLETENESS_FIELDS.length + 1; // +1 for skills
  let filled = 0;
  for (const field of COMPLETENESS_FIELDS) {
    if (student[field] !== undefined && student[field] !== null && student[field] !== '') filled += 1;
  }
  if (student.skills && student.skills.length > 0) filled += 1;
  return Math.round((filled / totalFields) * 100);
}

function computeMatchScore(student, listing) {
  const studentSkills = new Set((student.skills || []).map((s) => s.toLowerCase()));

  const required = listing.requiredSkills || [];
  const preferred = listing.preferredSkills || [];

  const requiredMatchCount = required.filter((s) => studentSkills.has(s)).length;
  const requiredRatio = required.length ? requiredMatchCount / required.length : 1;
  const requiredScore = requiredRatio * REQUIRED_WEIGHT;

  const preferredMatchCount = preferred.filter((s) => studentSkills.has(s)).length;
  const preferredRatio = preferred.length ? preferredMatchCount / preferred.length : 0;
  const preferredScore = preferredRatio * PREFERRED_WEIGHT;

  // Branch/grad-year alignment. If the listing expresses no preference,
  // treat it as neutral (0.5) rather than penalizing every student equally.
  let branchRatio = 0.5;
  if (listing.preferredBranches && listing.preferredBranches.length > 0) {
    const match = listing.preferredBranches
      .map((b) => b.toLowerCase())
      .includes((student.branch || '').toLowerCase());
    branchRatio = match ? 1 : 0.3; // penalized, never excluded
  }

  let yearRatio = 0.5;
  if (listing.targetGraduationYear) {
    const diff = Math.abs((student.graduationYear || 0) - listing.targetGraduationYear);
    if (diff === 0) yearRatio = 1;
    else if (diff === 1) yearRatio = 0.6;
    else yearRatio = 0.2; // still not zero — "rank lower, don't exclude"
  }
  const branchYearScore = ((branchRatio + yearRatio) / 2) * BRANCH_YEAR_WEIGHT;

  const daysSincePosted = Math.max(
    0,
    (Date.now() - new Date(listing.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const recencyRatio = Math.max(
    0,
    1 - Math.max(0, daysSincePosted - RECENCY_FULL_SCORE_DAYS) / RECENCY_DECAY_WINDOW_DAYS
  );
  const recencyScore = recencyRatio * RECENCY_WEIGHT;

  const rawScore = requiredScore + preferredScore + branchYearScore + recencyScore;

  const completeness = computeProfileCompleteness(student);
  const completenessMultiplier = 0.5 + 0.5 * (completeness / 100);

  const finalScore = rawScore * completenessMultiplier;
  return Math.round(finalScore * 100) / 100;
}

module.exports = { computeMatchScore, computeProfileCompleteness };
