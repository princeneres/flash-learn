import { addDays, addMinutes } from 'date-fns';

export type CardStatus = 'new' | 'learning' | 'review' | 'relearning';

// Learning steps in minutes (Anki defaults). A new card walks through these
// short, same-day steps before it "graduates" to the day-based review schedule.
// Relearning (a lapsed review card) uses its own, shorter set of steps.
const LEARNING_STEPS_MIN = [1, 10];
const RELEARNING_STEPS_MIN = [10];
const GRADUATING_INTERVAL_DAYS = 1; // first review interval after finishing learning
const EASY_INTERVAL_DAYS = 4; // interval when "Easy" graduates a card straight away
const DEFAULT_EASE = 2.5;
const MIN_EASE = 1.3;
const LAPSE_EASE_PENALTY = 0.2; // ease drop applied when a review card lapses

export interface ReviewResult {
  status: CardStatus;
  // Whole-day interval used for the review schedule. 0 while the card is still
  // in (re)learning, where the schedule is driven by minute-based steps instead.
  interval: number;
  easeFactor: number;
  // While (re)learning this holds the current learning-step index; once the card
  // is in review it holds the SM-2 repetition count.
  repetitions: number;
  nextReview: Date;
}

const clampEase = (e: number): number => (e < MIN_EASE ? MIN_EASE : e);

/**
 * Rating-aware scheduler. Quality follows the existing convention used by the
 * study UI: <3 = Again, 3 = Hard, 4 = Good, 5 = Easy.
 *
 * New/learning/relearning cards move through minute-based steps; only after the
 * last step (or an immediate "Easy") do they graduate to the SM-2 day schedule.
 */
export const calculateReview = (
  quality: number,
  previousInterval: number,
  previousEaseFactor: number,
  previousRepetitions: number,
  previousStatus: CardStatus = 'new',
): ReviewResult => {
  const now = new Date();
  const ease = previousEaseFactor > 0 ? previousEaseFactor : DEFAULT_EASE;

  const inLearning =
    previousStatus === 'new' || previousStatus === 'learning' || previousStatus === 'relearning';

  if (inLearning) {
    const relearning = previousStatus === 'relearning';
    const steps = relearning ? RELEARNING_STEPS_MIN : LEARNING_STEPS_MIN;
    const learningStatus: CardStatus = relearning ? 'relearning' : 'learning';
    const stepIndex = previousRepetitions; // overloaded as the current step index

    // "Easy" graduates the card immediately, skipping any remaining steps.
    if (quality >= 5) {
      return {
        status: 'review',
        interval: EASY_INTERVAL_DAYS,
        easeFactor: clampEase(ease),
        repetitions: 1,
        nextReview: addDays(now, EASY_INTERVAL_DAYS),
      };
    }

    // Again restarts at the first step, Hard repeats the current one, Good advances.
    let nextIndex: number;
    if (quality < 3) nextIndex = 0;
    else if (quality === 3) nextIndex = stepIndex;
    else nextIndex = stepIndex + 1;

    if (nextIndex >= steps.length) {
      // Finished the last step → graduate to the day-based review schedule.
      return {
        status: 'review',
        interval: GRADUATING_INTERVAL_DAYS,
        easeFactor: clampEase(ease),
        repetitions: 1,
        nextReview: addDays(now, GRADUATING_INTERVAL_DAYS),
      };
    }

    return {
      status: learningStatus,
      interval: 0,
      easeFactor: clampEase(ease),
      repetitions: nextIndex,
      nextReview: addMinutes(now, steps[nextIndex]),
    };
  }

  // --- Review phase ---
  if (quality < 3) {
    // Lapse: drop the card back into relearning and shave the ease factor,
    // mirroring Anki. It re-graduates after clearing the relearning steps.
    return {
      status: 'relearning',
      interval: 0,
      easeFactor: clampEase(ease - LAPSE_EASE_PENALTY),
      repetitions: 0,
      nextReview: addMinutes(now, RELEARNING_STEPS_MIN[0]),
    };
  }

  // Passing review: classic SM-2 day schedule.
  let interval: number;
  if (previousRepetitions === 0) {
    interval = 1;
  } else if (previousRepetitions === 1) {
    interval = 6;
  } else {
    interval = Math.round(previousInterval * ease);
  }
  const easeFactor = clampEase(ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  return {
    status: 'review',
    interval,
    easeFactor,
    repetitions: previousRepetitions + 1,
    nextReview: addDays(now, interval),
  };
};

/** Projected schedule for a rating, without persisting anything. */
export const previewReview = (
  quality: number,
  card: { interval: number; easeFactor: number; repetitions: number; status: CardStatus },
): ReviewResult =>
  calculateReview(quality, card.interval, card.easeFactor, card.repetitions, card.status);
