import type {
  XPConfig,
  Monster,
  SessionData,
  UserStats,
  XPBreakdown,
} from "../types"

export const calculateLevel = (totalXP: number, xpConfig: XPConfig): number => {
  if (!xpConfig?.levelCurve) return xpConfig.defaults.level
  let level = 1
  while (getXPRequiredForLevel(level, xpConfig) <= totalXP) {
    level++
  }
  return level - 1
}

export const getXPRequiredForLevel = (
  level: number,
  xpConfig: XPConfig
): number => {
  if (!xpConfig?.levelCurve) return xpConfig.defaults.xpRequiredForLevel
  return Math.floor(
    xpConfig.levelCurve.baseXP * Math.pow(level, xpConfig.levelCurve.exponent)
  )
}

export const calculateXPForCurrentLevel = (
  totalXP: number,
  xpConfig: XPConfig
): number => {
  const currentLevel = calculateLevel(totalXP, xpConfig)
  const xpForCurrentLevel = getXPRequiredForLevel(currentLevel, xpConfig)
  return totalXP - xpForCurrentLevel
}

export const calculateXPForNextLevel = (
  totalXP: number,
  xpConfig: XPConfig
): number => {
  const currentLevel = calculateLevel(totalXP, xpConfig)
  const xpForNextLevel = getXPRequiredForLevel(currentLevel + 1, xpConfig)
  const xpForCurrentLevel = getXPRequiredForLevel(currentLevel, xpConfig)
  return xpForNextLevel - xpForCurrentLevel
}

export const getUserTitle = (level: number, xpConfig: XPConfig): string => {
  if (!xpConfig?.titles) return xpConfig.defaults.title

  let userTitle = xpConfig.titles["1"]

  Object.entries(xpConfig.titles).forEach(([reqLevel, title]) => {
    if (level >= parseInt(reqLevel)) {
      userTitle = title
    }
  })

  return userTitle
}

export const calculateStreakMultiplier = (
  streakDays: number,
  xpConfig: XPConfig
): number => {
  if (!xpConfig?.streakMultiplier) return xpConfig.defaults.streakMultiplier
  const multiplier = 1 + streakDays * xpConfig.streakMultiplier.perDay
  return Math.min(multiplier, xpConfig.streakMultiplier.maxMultiplier)
}

export const generateFocusCrit = (xpConfig: XPConfig): number => {
  if (!xpConfig?.modifiers) return xpConfig.defaults.focusCrit
  const min = xpConfig.modifiers.minFocusCrit
  const max = xpConfig.modifiers.maxFocusCrit
  return Math.random() * (max - min) + min
}

export const calculateMonsterBaseXP = (
  monsterId: string,
  monsters: Record<string, Monster>,
  xpConfig: XPConfig
): number => {
  if (!xpConfig?.base || !monsters) return xpConfig.defaults.baseXP

  const monster = monsters[monsterId]
  if (!monster) return xpConfig.base.xpPerSession

  let baseXP = monster.hp * xpConfig.base.xpPerHP

  if (xpConfig.difficultyMultipliers?.[monsterId]) {
    baseXP *= xpConfig.difficultyMultipliers[monsterId]
  }

  baseXP = Math.max(baseXP, xpConfig.base.minXP)
  return Math.floor(baseXP)
}

export const calculateSessionXP = (
  sessionData: SessionData,
  userStats: UserStats,
  monsters: Record<string, Monster>,
  xpConfig: XPConfig,
  todayPomodoros: number
): XPBreakdown => {
  if (!xpConfig?.base || !xpConfig?.modifiers) {
    return {
      finalXP: xpConfig.defaults.sessionXP,
      bonuses: [],
      baseXP: xpConfig.defaults.baseXP,
    }
  }

  let baseXP = calculateMonsterBaseXP(sessionData.monsterId, monsters, xpConfig)
  const bonuses: Array<{ type: string; amount: number; message: string }> = []

  // Check for no distractions
  const hadDistractions = sessionData.battleLog?.some(
    (log) => log.includes("healed") || log.includes("Distracted")
  )

  if (!hadDistractions) {
    const bonus = Math.floor(baseXP * xpConfig.modifiers.noDistractions)
    baseXP += bonus
    bonuses.push({
      type: "noDistractions",
      amount: bonus,
      message: xpConfig.feedback.noDistractions.replace(
        "{bonus}",
        bonus.toString()
      ),
    })
  }

  // Check for second session of the day
  if (todayPomodoros === 1) {
    const bonus = Math.floor(baseXP * xpConfig.modifiers.secondSession)
    baseXP += bonus
    bonuses.push({
      type: "secondSession",
      amount: bonus,
      message: xpConfig.feedback.secondSession.replace(
        "{bonus}",
        bonus.toString()
      ),
    })
  }

  // Apply streak bonus
  if (userStats.currentStreak > 0) {
    const streakMultiplier = calculateStreakMultiplier(
      userStats.currentStreak,
      xpConfig
    )
    const bonus = Math.floor(baseXP * (streakMultiplier - 1))
    baseXP += bonus
    bonuses.push({
      type: "streakBonus",
      amount: bonus,
      message: xpConfig.feedback.streakBonus
        .replace("{streak}", userStats.currentStreak.toString())
        .replace("{bonus}", bonus.toString()),
    })
  }

  // Apply focus crit
  const critMultiplier = generateFocusCrit(xpConfig)
  if (critMultiplier > 1) {
    const originalXP = baseXP
    baseXP = Math.floor(baseXP * critMultiplier)
    const bonus = baseXP - originalXP
    bonuses.push({
      type: "focusCrit",
      amount: bonus,
      message: xpConfig.feedback.focusCrit.replace(
        "{multiplier}",
        critMultiplier.toFixed(2)
      ),
    })
  }

  return {
    finalXP: baseXP,
    bonuses,
    baseXP: calculateMonsterBaseXP(sessionData.monsterId, monsters, xpConfig),
  }
}
