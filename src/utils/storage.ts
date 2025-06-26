import type { UserStats, SessionHistory } from "../types"

export const generateUsername = (): string => {
  const adjectives = [
    "Focused",
    "Mighty",
    "Swift",
    "Clever",
    "Brave",
    "Noble",
    "Wise",
  ]
  const nouns = [
    "Warrior",
    "Guardian",
    "Slayer",
    "Champion",
    "Hero",
    "Knight",
    "Sage",
  ]

  const randomAdjective =
    adjectives[Math.floor(Math.random() * adjectives.length)]
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)]

  return `${randomAdjective} ${randomNoun}`
}

export const getDefaultUserStats = (): UserStats => ({
  monstersDefeated: {
    scrollfiend: 0,
    tubewyrm: 0,
    tabberwock: 0,
    testgremlin: 0,
  },
  totalPomodoros: 0,
  currentXP: 0,
  currentStreak: 0,
  lastActiveDate: null,
})

export const loadUserStats = (): UserStats => {
  try {
    const stored = localStorage.getItem("userStats")
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...getDefaultUserStats(), ...parsed }
    }
  } catch (error) {
    console.error("Error loading user stats:", error)
  }
  return getDefaultUserStats()
}

export const saveUserStats = (stats: UserStats): void => {
  try {
    localStorage.setItem("userStats", JSON.stringify(stats))
  } catch (error) {
    console.error("Error saving user stats:", error)
  }
}

export const getTodayPomodoros = (): number => {
  const today = new Date().toDateString()
  try {
    const stored = localStorage.getItem(`pomodoros_${today}`)
    return stored ? parseInt(stored, 10) : 0
  } catch (error) {
    console.error("Error getting today pomodoros:", error)
    return 0
  }
}

export const updateTodayPomodoros = (): number => {
  const today = new Date().toDateString()
  const current = getTodayPomodoros()
  const newCount = current + 1

  try {
    localStorage.setItem(`pomodoros_${today}`, newCount.toString())
  } catch (error) {
    console.error("Error updating today pomodoros:", error)
  }

  return newCount
}

export const getRecentSessionHistory = (): SessionHistory[] => {
  try {
    const stored = localStorage.getItem("sessionHistory")
    if (stored) {
      const history = JSON.parse(stored)
      return Array.isArray(history) ? history.slice(-5) : []
    }
  } catch (error) {
    console.error("Error getting session history:", error)
  }
  return []
}

export const addToSessionHistory = (success: boolean): void => {
  try {
    const history = getRecentSessionHistory()
    const newSession: SessionHistory = {
      success,
      date: new Date().toISOString(),
    }

    history.push(newSession)
    if (history.length > 5) {
      history.shift()
    }

    localStorage.setItem("sessionHistory", JSON.stringify(history))
  } catch (error) {
    console.error("Error adding to session history:", error)
  }
}

export const getMostDefeatedMonster = (
  monstersDefeated: Record<string, number>
): string => {
  let maxDefeated = 0
  let mostDefeatedId = ""

  Object.entries(monstersDefeated).forEach(([monsterId, count]) => {
    if (count > maxDefeated) {
      maxDefeated = count
      mostDefeatedId = monsterId
    }
  })

  return mostDefeatedId || "None"
}

export const updateDayStreak = (
  userStats: UserStats,
  pomodoroCompleted: boolean
): void => {
  const today = new Date().toDateString()

  if (!pomodoroCompleted) {
    return // Don't update streak if pomodoro wasn't completed
  }

  if (userStats.lastActiveDate === today) {
    return // Already counted today
  }

  if (userStats.lastActiveDate) {
    const lastDate = new Date(userStats.lastActiveDate)
    const currentDate = new Date(today)
    const timeDifference = currentDate.getTime() - lastDate.getTime()
    const daysDifference = Math.floor(timeDifference / (1000 * 3600 * 24))

    if (daysDifference === 1) {
      // Consecutive day - increment streak
      userStats.currentStreak += 1
    } else if (daysDifference > 1) {
      // Gap in days - reset streak
      userStats.currentStreak = 1
    }
    // If daysDifference === 0, it's the same day, don't change streak
  } else {
    // First ever session
    userStats.currentStreak = 1
  }

  userStats.lastActiveDate = today
}
