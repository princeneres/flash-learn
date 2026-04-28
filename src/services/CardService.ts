import { 
  collection, 
  updateDoc, 
  doc, 
  getDocs, 
  query, 
  where, 
  serverTimestamp,
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calculateReview } from './srsAlgorithm';
import { GamificationService } from './GamificationService';

export interface Card {
  id: string;
  deckId: string;
  ownerId: string;
  front: string;
  back: string;
  nextReview: any; // Timestamp
  interval: number;
  easeFactor: number;
  repetitions: number;
  status: 'new' | 'learning' | 'review' | 'relearning';
  createdAt: any;
}

const COLLECTION_NAME = 'cards';

export const CardService = {
  createCard: async (ownerId: string, deckId: string, card: Partial<Card>) => {
    const batch = writeBatch(db);
    
    // Create card
    const cardRef = doc(collection(db, COLLECTION_NAME));
    batch.set(cardRef, {
      ...card,
      deckId,
      ownerId,
      nextReview: serverTimestamp(), // Available immediately
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      status: 'new',
      createdAt: serverTimestamp(),
    });

    // Increment deck card count
    const deckRef = doc(db, 'decks', deckId);
    batch.update(deckRef, { cardCount: increment(1) });

    await batch.commit();
    return cardRef.id;
  },

  getDeckCards: async (deckId: string) => {
    const q = query(
      collection(db, COLLECTION_NAME), 
      where('deckId', '==', deckId)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Card));
  },

  updateCard: async (cardId: string, data: Partial<Card>) => {
    const docRef = doc(db, COLLECTION_NAME, cardId);
    await updateDoc(docRef, data);
  },

  deleteCard: async (deckId: string, cardId: string) => {
    const batch = writeBatch(db);
    
    const cardRef = doc(db, COLLECTION_NAME, cardId);
    batch.delete(cardRef);

    const deckRef = doc(db, 'decks', deckId);
    batch.update(deckRef, { cardCount: increment(-1) });

    await batch.commit();
  },

  getDueCards: async (deckId: string) => {
    const now = new Date();
    const q = query(
      collection(db, COLLECTION_NAME),
      where('deckId', '==', deckId),
      where('nextReview', '<=', now)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Card));
  },

  processReview: async (card: Card, quality: number) => {
    const result = calculateReview(
      quality,
      card.interval,
      card.easeFactor,
      card.repetitions
    );

    const docRef = doc(db, COLLECTION_NAME, card.id);
    await updateDoc(docRef, {
      nextReview: result.nextReview,
      interval: result.interval,
      easeFactor: result.easeFactor,
      repetitions: result.repetitions,
      status: quality < 3 ? 'relearning' : 'review',
    });

    // Award points (10 points for correct, 1 for incorrect)
    const points = quality >= 3 ? 10 : 1;
    await GamificationService.awardPoints(card.ownerId, points);
    await GamificationService.updateStreak(card.ownerId);
    await GamificationService.checkAchievements(card.ownerId);
    
    return result;
  },
};
