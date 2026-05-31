import { addDays, addMinutes } from 'date-fns';

export type CardStatus = 'new' | 'learning' | 'review' | 'relearning';

/**
 * Per-deck tunables for the scheduler, mirroring Anki's "Deck Options". Every
 * value the algorithm reads lives here so a deck can override the behaviour
 * without touching the algorithm. Defaults reproduce the previous hardcoded
 * Anki-like behaviour, so an absent/partial config changes nothing.
 */
export interface SrsSettings {
  // Learning steps in minutes (Anki defaults). A new card walks through these
  // short, same-day steps before it "graduates" to the day-based review schedule.
  learningStepsMin: number[];
  // Relearning (a lapsed review card) uses its own, shorter set of steps.
  relearningStepsMin: number[];
  graduatingIntervalDays: number; // first review interval after finishing learning
  easyIntervalDays: number; // interval when "Easy" graduates a card straight away
  defaultEase: number;
  minEase: number;
  lapseEasePenalty: number; // ease drop applied when a review card lapses
  hardIntervalFactor: number; // "Hard" grows the interval only slightly
  hardEasePenalty: number; // ease drop applied when a review card is rated Hard
  easyIntervalBonus: number; // extra multiplier applied on top of ease for "Easy"
  easyEaseBonus: number; // ease bump applied when a review card is rated Easy
  maximumIntervalDays: number; // hard cap on the day-based interval
}

export const DEFAULT_SRS_SETTINGS: SrsSettings = {
  learningStepsMin: [1, 10],
  relearningStepsMin: [10],
  graduatingIntervalDays: 1,
  easyIntervalDays: 4,
  defaultEase: 2.5,
  minEase: 1.3,
  lapseEasePenalty: 0.2,
  hardIntervalFactor: 1.2,
  hardEasePenalty: 0.15,
  easyIntervalBonus: 1.3,
  easyEaseBonus: 0.15,
  maximumIntervalDays: 36500, // ~100 years: effectively uncapped by default
};

/**
 * Merge a stored (possibly partial or stale) settings object with the defaults,
 * dropping invalid values. Keeps the algorithm safe against decks created before
 * a field existed or against malformed JSON from the database.
 */
export const normalizeSrsSettings = (raw?: Partial<SrsSettings> | null): SrsSettings => {
  if (!raw) return { ...DEFAULT_SRS_SETTINGS };
  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback;
  const steps = (v: unknown, fallback: number[]): number[] =>
    Array.isArray(v) && v.length > 0 && v.every((n) => typeof n === 'number' && n > 0)
      ? (v as number[])
      : fallback;
  const d = DEFAULT_SRS_SETTINGS;
  return {
    learningStepsMin: steps(raw.learningStepsMin, d.learningStepsMin),
    relearningStepsMin: steps(raw.relearningStepsMin, d.relearningStepsMin),
    graduatingIntervalDays: num(raw.graduatingIntervalDays, d.graduatingIntervalDays),
    easyIntervalDays: num(raw.easyIntervalDays, d.easyIntervalDays),
    defaultEase: num(raw.defaultEase, d.defaultEase),
    minEase: num(raw.minEase, d.minEase),
    lapseEasePenalty: num(raw.lapseEasePenalty, d.lapseEasePenalty),
    hardIntervalFactor: num(raw.hardIntervalFactor, d.hardIntervalFactor),
    hardEasePenalty: num(raw.hardEasePenalty, d.hardEasePenalty),
    easyIntervalBonus: num(raw.easyIntervalBonus, d.easyIntervalBonus),
    easyEaseBonus: num(raw.easyEaseBonus, d.easyEaseBonus),
    maximumIntervalDays: num(raw.maximumIntervalDays, d.maximumIntervalDays),
  };
};

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
  settings: SrsSettings = DEFAULT_SRS_SETTINGS,
): ReviewResult => {
  const now = new Date();
  const ease = previousEaseFactor > 0 ? previousEaseFactor : settings.defaultEase;
  const clampEase = (e: number): number => (e < settings.minEase ? settings.minEase : e);
  const capInterval = (days: number): number => Math.min(days, settings.maximumIntervalDays);

  const inLearning =
    previousStatus === 'new' || previousStatus === 'learning' || previousStatus === 'relearning';

  if (inLearning) {
    const relearning = previousStatus === 'relearning';
    const steps = relearning ? settings.relearningStepsMin : settings.learningStepsMin;
    const learningStatus: CardStatus = relearning ? 'relearning' : 'learning';
    const stepIndex = previousRepetitions; // overloaded as the current step index

    // "Easy" graduates the card immediately, skipping any remaining steps.
    if (quality >= 5) {
      return {
        status: 'review',
        interval: capInterval(settings.easyIntervalDays),
        easeFactor: clampEase(ease),
        repetitions: 1,
        nextReview: addDays(now, capInterval(settings.easyIntervalDays)),
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
        interval: capInterval(settings.graduatingIntervalDays),
        easeFactor: clampEase(ease),
        repetitions: 1,
        nextReview: addDays(now, capInterval(settings.graduatingIntervalDays)),
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
      easeFactor: clampEase(ease - settings.lapseEasePenalty),
      repetitions: 0,
      nextReview: addMinutes(now, settings.relearningStepsMin[0]),
    };
  }

  // Passing review: Anki-style, grade-aware day schedule. Unlike vanilla SM-2,
  // the chosen rating (Hard/Good/Easy) drives the *current* interval too — not
  // just the next ease factor — so the three buttons predict distinct intervals.
  const baseInterval = previousInterval > 0 ? previousInterval : settings.graduatingIntervalDays;
  let interval: number;
  let easeFactor = clampEase(ease);

  if (quality === 3) {
    // Hard: barely grows the interval and shaves the ease factor.
    easeFactor = clampEase(ease - settings.hardEasePenalty);
    // Always move forward by at least one day so Hard never shrinks the interval.
    interval = Math.max(baseInterval + 1, Math.round(baseInterval * settings.hardIntervalFactor));
  } else if (quality === 4) {
    // Good: grows by the ease factor, the SM-2 default. Kept strictly above Hard
    // so the buttons predict distinct intervals even at tiny base intervals.
    const hard = Math.max(baseInterval + 1, Math.round(baseInterval * settings.hardIntervalFactor));
    interval = Math.max(hard + 1, Math.round(baseInterval * ease));
  } else {
    // Easy: grows by the ease factor plus a bonus, and bumps the ease factor.
    // Kept strictly above Good.
    easeFactor = clampEase(ease + settings.easyEaseBonus);
    const good = Math.max(baseInterval + 2, Math.round(baseInterval * ease));
    interval = Math.max(good + 1, Math.round(baseInterval * ease * settings.easyIntervalBonus));
  }

  interval = capInterval(interval);

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
  settings: SrsSettings = DEFAULT_SRS_SETTINGS,
): ReviewResult =>
  calculateReview(quality, card.interval, card.easeFactor, card.repetitions, card.status, settings);
