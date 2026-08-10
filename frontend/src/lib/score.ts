/**
 * Candidate score presentation.
 *
 * These thresholds and colours were previously duplicated across four
 * components. They agreed on the numbers but disagreed on the colours, so the
 * same 70-scoring candidate rendered amber in the ranking table and blue in the
 * pipeline board. Amber is now canonical for the middle tier: blue is the
 * brand and interactive colour, and using it for "needs review" reads as a link
 * rather than as caution.
 *
 * Scores are ordinal. They rank candidates against each other within one
 * screening; they are not calibrated percentages. See
 * docs/scoring-engine-and-nlp.md.
 */

export type ScoreTier = "strong" | "moderate" | "weak";

export const SCORE_THRESHOLDS = {
  /** At or above this, a candidate is shortlist-worthy. */
  strong: 80,
  /** At or above this, a candidate warrants review. */
  moderate: 60,
} as const;

export function getScoreTier(score: number): ScoreTier {
  if (score >= SCORE_THRESHOLDS.strong) return "strong";
  if (score >= SCORE_THRESHOLDS.moderate) return "moderate";
  return "weak";
}

/** Badge treatment: text, border and translucent fill. */
export function getScoreBadgeClass(score: number): string {
  switch (getScoreTier(score)) {
    case "strong":
      return "text-emerald-400 border-emerald-500/20 bg-emerald-500/10";
    case "moderate":
      return "text-amber-400 border-amber-500/20 bg-amber-500/10";
    default:
      return "text-slate-400 border-slate-500/20 bg-slate-500/10";
  }
}

/** Solid fill for progress/score bars. */
export function getScoreBarClass(score: number): string {
  switch (getScoreTier(score)) {
    case "strong":
      return "bg-emerald-500";
    case "moderate":
      return "bg-amber-500";
    default:
      return "bg-slate-500";
  }
}

/**
 * Recommended next action for a score.
 *
 * Paired with colour everywhere it is used, so the tier is never communicated
 * by colour alone (WCAG 1.4.1).
 */
export function getScoreLabel(score: number): string {
  switch (getScoreTier(score)) {
    case "strong":
      return "Shortlist";
    case "moderate":
      return "Review";
    default:
      return "Pending";
  }
}

/** Count candidates at or above the shortlist threshold. */
export function countShortlisted(scores: readonly number[]): number {
  return scores.filter((s) => s >= SCORE_THRESHOLDS.strong).length;
}
