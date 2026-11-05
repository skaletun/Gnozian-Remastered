// Achievements system for Gnozian
// Tracks player milestones and unlocks achievement rewards

export type AchievementId = string;

export interface Achievement {
  id: AchievementId;
  name: string;
  description: string;
  icon: string;
  category: 'military' | 'science' | 'culture' | 'diplomacy' | 'exploration' | 'economic' | 'milestone';
  difficulty: 'easy' | 'medium' | 'hard' | 'extreme';
  progress?: number;
  maxProgress?: number;
  reward?: {
    type: 'gold' | 'science' | 'culture' | 'faith';
    amount: number;
  };
}

export interface AchievementProgress {
  id: AchievementId;
  unlocked: boolean;
  progress: number;
  maxProgress: number;
  unlockedAtTurn?: number;
  unlockedDate?: string;
}

export type AchievementsMap = Record<AchievementId, AchievementProgress>;

export const ACHIEVEMENTS: Record<AchievementId, Achievement> = {
  // Military Achievements
  FIRST_BLOOD: {
    id: 'FIRST_BLOOD',
    name: 'First Blood',
    description: 'Win your first combat',
    icon: 'sword',
    category: 'military',
    difficulty: 'easy',
  },
  WARRIOR_KING: {
    id: 'WARRIOR_KING',
    name: 'Warrior King',
    description: 'Win 10 combats',
    icon: 'crown',
    category: 'military',
    difficulty: 'medium',
    maxProgress: 10,
  },
  MILITARY_MIGHT: {
    id: 'MILITARY_MIGHT',
    name: 'Military Might',
    description: 'Have 30 military units',
    icon: 'shield',
    category: 'military',
    difficulty: 'medium',
    maxProgress: 30,
  },
  CONQUEROR: {
    id: 'CONQUEROR',
    name: 'Conqueror',
    description: 'Conquer 5 enemy cities',
    icon: 'city',
    category: 'military',
    difficulty: 'hard',
    maxProgress: 5,
  },
  WORLD_CONQUEROR: {
    id: 'WORLD_CONQUEROR',
    name: 'World Conqueror',
    description: 'Achieve Domination Victory',
    icon: 'globe',
    category: 'military',
    difficulty: 'extreme',
  },

  // Science Achievements
  SCHOLAR: {
    id: 'SCHOLAR',
    name: 'Scholar',
    description: 'Research your first technology',
    icon: 'book',
    category: 'science',
    difficulty: 'easy',
  },
  RENAISSANCE_MAN: {
    id: 'RENAISSANCE_MAN',
    name: 'Renaissance Man',
    description: 'Research 20 technologies',
    icon: 'science',
    category: 'science',
    difficulty: 'medium',
    maxProgress: 20,
  },
  TECHNOLOGICAL_SUPREMACY: {
    id: 'TECHNOLOGICAL_SUPREMACY',
    name: 'Technological Supremacy',
    description: 'Be 10 eras ahead of opponent',
    icon: 'rocket',
    category: 'science',
    difficulty: 'hard',
  },
  SPACE_PROGRAM: {
    id: 'SPACE_PROGRAM',
    name: 'Space Program',
    description: 'Achieve Science Victory',
    icon: 'space',
    category: 'science',
    difficulty: 'extreme',
  },

  // Culture Achievements
  ARTIST: {
    id: 'ARTIST',
    name: 'Artist',
    description: 'Generate 100 culture',
    icon: 'palette',
    category: 'culture',
    difficulty: 'easy',
    maxProgress: 100,
  },
  CULTURAL_ICON: {
    id: 'CULTURAL_ICON',
    name: 'Cultural Icon',
    description: 'Have cultural influence in 3 civilizations',
    icon: 'star',
    category: 'culture',
    difficulty: 'medium',
    maxProgress: 3,
  },
  CULTURAL_VICTORY: {
    id: 'CULTURAL_VICTORY',
    name: 'Cultural Victory',
    description: 'Achieve Cultural Victory',
    icon: 'crown',
    category: 'culture',
    difficulty: 'extreme',
  },

  // Diplomacy Achievements
  PEACEMAKER: {
    id: 'PEACEMAKER',
    name: 'Peacemaker',
    description: 'Sign 5 alliances',
    icon: 'peace',
    category: 'diplomacy',
    difficulty: 'medium',
    maxProgress: 5,
  },
  WORLD_LEADER: {
    id: 'WORLD_LEADER',
    name: 'World Leader',
    description: 'Achieve Diplomacy Victory',
    icon: 'temple',
    category: 'diplomacy',
    difficulty: 'extreme',
  },

  // Exploration Achievements
  EXPLORER: {
    id: 'EXPLORER',
    name: 'Explorer',
    description: 'Explore 50 tiles',
    icon: 'map',
    category: 'exploration',
    difficulty: 'easy',
    maxProgress: 50,
  },
  CARTOGRAPHER: {
    id: 'CARTOGRAPHER',
    name: 'Cartographer',
    description: 'Explore all terrain types',
    icon: 'compass',
    category: 'exploration',
    difficulty: 'medium',
    maxProgress: 11, // All terrain types
  },

  // Economic Achievements
  MERCHANT: {
    id: 'MERCHANT',
    name: 'Merchant',
    description: 'Accumulate 1000 gold',
    icon: 'gold',
    category: 'economic',
    difficulty: 'easy',
    maxProgress: 1000,
  },
  ECONOMIC_POWERHOUSE: {
    id: 'ECONOMIC_POWERHOUSE',
    name: 'Economic Powerhouse',
    description: 'Have 5000 gold in treasury',
    icon: 'gem',
    category: 'economic',
    difficulty: 'hard',
    maxProgress: 5000,
  },
  BUILDER: {
    id: 'BUILDER',
    name: 'Builder',
    description: 'Build 20 buildings',
    icon: 'hammer',
    category: 'economic',
    difficulty: 'medium',
    maxProgress: 20,
  },

  // Milestone Achievements
  FIRST_CITY: {
    id: 'FIRST_CITY',
    name: 'Settler',
    description: 'Found your first city',
    icon: 'city',
    category: 'milestone',
    difficulty: 'easy',
  },
  FIVE_CITIES: {
    id: 'FIVE_CITIES',
    name: 'City Planner',
    description: 'Found 5 cities',
    icon: 'temple',
    category: 'milestone',
    difficulty: 'medium',
    maxProgress: 5,
  },
  TEN_CITIES: {
    id: 'TEN_CITIES',
    name: 'Empire Builder',
    description: 'Found 10 cities',
    icon: 'map',
    category: 'milestone',
    difficulty: 'hard',
    maxProgress: 10,
  },
  CENTURY: {
    id: 'CENTURY',
    name: 'Century Mark',
    description: 'Reach turn 100',
    icon: 'time',
    category: 'milestone',
    difficulty: 'easy',
    maxProgress: 100,
  },
  MARATHON: {
    id: 'MARATHON',
    name: 'Marathon',
    description: 'Play 500 turns',
    icon: 'movement',
    category: 'milestone',
    difficulty: 'medium',
    maxProgress: 500,
  },
};

export function createEmptyAchievements(): AchievementsMap {
  const map: AchievementsMap = {};
  for (const [id, achievement] of Object.entries(ACHIEVEMENTS)) {
    map[id] = {
      id: id as AchievementId,
      unlocked: false,
      progress: 0,
      maxProgress: achievement.maxProgress || 1,
    };
  }
  return map;
}

export function unlockAchievement(
  achievements: AchievementsMap,
  achievementId: AchievementId,
  turn: number
): AchievementsMap {
  if (!achievements[achievementId] || achievements[achievementId].unlocked) {
    return achievements;
  }
  return {
    ...achievements,
    [achievementId]: {
      ...achievements[achievementId],
      unlocked: true,
      progress: achievements[achievementId].maxProgress,
      unlockedAtTurn: turn,
      unlockedDate: new Date().toISOString(),
    },
  };
}

export function updateAchievementProgress(
  achievements: AchievementsMap,
  achievementId: AchievementId,
  progress: number
): AchievementsMap {
  const achievement = achievements[achievementId];
  if (!achievement || achievement.unlocked) {
    return achievements;
  }

  const maxProgress = achievement.maxProgress;
  const newProgress = Math.min(progress, maxProgress);

  return {
    ...achievements,
    [achievementId]: {
      ...achievement,
      progress: newProgress,
    },
  };
}

export function getProgressPercentage(achievement: AchievementProgress): number {
  if (achievement.maxProgress === 0) return achievement.unlocked ? 100 : 0;
  return Math.round((achievement.progress / achievement.maxProgress) * 100);
}
