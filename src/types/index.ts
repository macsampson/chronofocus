export interface Monster {
  id: string
  name: string
  icon: string
  description: string
  hp: number
  triggerSites?: string[]
  triggerEvent?: string
}

export interface XPConfig {
  base: {
    xpPerSession: number
    xpForStarting: number
    xpForHalfway: number
    xpPerHP: number
    minXP: number
    xpPerLevel: number
    xpPerPomodoro: number
  }
  modifiers: {
    noDistractions: number
    secondSession: number
    streakBonus: number
    minFocusCrit: number
    maxFocusCrit: number
  }
  levelCurve: {
    baseXP: number
    exponent: number
  }
  streakMultiplier: {
    perDay: number
    maxMultiplier: number
  }
  defaults: {
    level: number
    xpRequiredForLevel: number
    streakMultiplier: number
    focusCrit: number
    baseXP: number
    microXP: number
    sessionXP: number
    title: string
    currentStreak: number
    xpEarned: number
  }
  titles: Record<string, string>
  feedback: {
    startSession: string
    halfway: string
    noDistractions: string
    secondSession: string
    streakBonus: string
    focusCrit: string
    victory: string
    levelUp: string
  }
  difficultyMultipliers: Record<string, number>
}

export interface UserStats {
  monstersDefeated: Record<string, number>
  totalPomodoros: number
  currentXP: number
  currentStreak: number
  lastActiveDate: string | null
}

export interface SessionData {
  monsterId: string
  monsterName: string
  monsterIcon: string
  currentHP: number
  maxHP: number
  timerValue: number
  battleLog: string[]
  isActive?: boolean
  startTime?: number
  durationSeconds?: number
  microProgressTracked?: {
    started: boolean
    halfway: boolean
  }
}

export interface XPBonus {
  type: string
  amount: number
  message: string
}

export interface XPBreakdown {
  baseXP: number
  bonuses: XPBonus[]
  finalXP: number
}

export interface SessionOutcome {
  result: "victory" | "defeat" | "abandoned"
  xpEarned: number
  xpBreakdown?: XPBreakdown | null
  pomodoroCompleted: boolean
  totalPomodoros: number
  currentXP: number
  previousXP: number
  currentStreak: number
  monsterDefeatedName?: string
}

export interface SessionHistory {
  success: boolean
  date: string
}

export type ScreenType = "hub" | "battle" | "result"
