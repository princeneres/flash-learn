import { 
  doc, 
  updateDoc, 
  increment, 
  getDoc, 
  setDoc, 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { toast } from '../components/ui/use-toast';
import i18n from '../i18n';

const todayKey = (d: Date = new Date()) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const dayDiff = (a: string, b: string) => {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

export const GamificationService = {
  awardPoints: async (userId: string, points: number) => {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      points: increment(points),
      'stats.totalReviews': increment(1),
    });
  },

  updateStreak: async (userId: string) => {
    const userRef = doc(db, 'users', userId);
    const snap = await getDoc(userRef);
    if (!snap.exists()) return { streak: 0, changed: false };

    const data = snap.data();
    const today = todayKey();
    const last: string | null = data.stats?.lastStudyDate ?? null;
    const prev: number = data.stats?.streak ?? 0;

    if (last === today) {
      return { streak: prev, changed: false };
    }

    let next: number;
    if (last && dayDiff(last, today) === 1) {
      next = prev + 1;
    } else {
      next = 1;
    }

    await updateDoc(userRef, {
      'stats.streak': next,
      'stats.lastStudyDate': today,
    });
    return { streak: next, changed: true };
  },

  checkAchievements: async (userId: string) => {
    // This would check conditions and unlock achievements
    // For simplicity, we'll just log it or do a simple check
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const data = userSnap.data();
      const reviews = data.stats?.totalReviews || 0;

      if (reviews === 10) {
        await GamificationService.unlockAchievement(userId, 'first_10_reviews', 'Rookie Reviewer');
      }
      if (reviews === 100) {
        await GamificationService.unlockAchievement(userId, '100_reviews', 'Centurion');
      }
    }
  },

  unlockAchievement: async (userId: string, achievementId: string, title: string) => {
    const achievementRef = doc(db, 'users', userId, 'achievements', achievementId);
    const snap = await getDoc(achievementRef);
    
    if (!snap.exists()) {
      await setDoc(achievementRef, {
        id: achievementId,
        title,
        unlockedAt: new Date().toISOString(),
      });
      toast({ title: i18n.t('gamification.achievement', { title }) });
    }
  },

  getLeaderboard: async () => {
    const q = query(
      collection(db, 'users'),
      orderBy('points', 'desc'),
      limit(50)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ 
      id: doc.id, 
      ...doc.data() 
    }));
  }
};
