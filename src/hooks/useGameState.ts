import { useState, useEffect, useCallback } from "react"
import type {
  UserStats,
  Monster,
  XPConfig,
  SessionData,
  SessionOutcome,
  ScreenType,
} from "../types"
import { loadUserStats, saveUserStats } from "../utils/storage"
import { calculateLevel, getUserTitle } from "../utils/xpSystem"

export const useGameState = () => {
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [monsters, setMonsters] = useState<Record<string, Monster>>({})
  const [xpConfig, setXPConfig] = useState<XPConfig | null>(null)
  const [currentScreen, setCurrentScreen] = useState<ScreenType>("hub")
  const [selectedMonsterId, setSelectedMonsterId] = useState<string | null>(
    null
  )
  const [currentSession, setCurrentSession] = useState<
    SessionData | SessionOutcome | null
  >(null)
  const [isLoading, setIsLoading] = useState(true)

  // Check for ongoing session on load
  useEffect(() => {
    const checkPopupState = async () => {
      try {
        console.log("🔍 Checking popup state...")
        const response = await chrome.runtime.sendMessage({
          action: "getPopupState",
        })
        console.log("📋 Popup state response:", response)

        if (response.status === "sessionActive" && response.sessionData) {
          console.log("⚔️ Setting battle screen")
          setCurrentSession(response.sessionData)
          setSelectedMonsterId(response.sessionData.monsterId)
          setCurrentScreen("battle")
        } else if (response.status === "sessionEnded" && response.outcomeData) {
          console.log("🏆 Setting result screen")
          setCurrentSession(response.outcomeData)
          setCurrentScreen("result")
          // Sync user stats from background script
          await syncUserStatsFromStorage()
        } else {
          console.log("🏠 No active session, staying on hub")
          setCurrentScreen("hub")
        }
      } catch (error) {
        console.error("Error checking popup state:", error)
      }
    }

    checkPopupState()
  }, [])

  // Function to sync user stats from chrome storage
  const syncUserStatsFromStorage = useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(["userStats"])
      if (result.userStats) {
        setUserStats(result.userStats)
      }
    } catch (error) {
      console.error("Error syncing user stats:", error)
    }
  }, [])

  // Listen for messages from background script
  useEffect(() => {
    const messageListener = async (message: any) => {
      if (message.action === "updatePopupBattleState" && message.sessionData) {
        setCurrentSession(message.sessionData)
        setCurrentScreen("battle")
      } else if (message.action === "sessionEnded" && message.outcomeData) {
        setCurrentSession(message.outcomeData)
        setCurrentScreen("result")
        // Sync user stats after session ends since background script updates them
        await syncUserStatsFromStorage()
      }
    }

    chrome.runtime.onMessage.addListener(messageListener)
    return () => chrome.runtime.onMessage.removeListener(messageListener)
  }, [syncUserStatsFromStorage])

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load monsters
        const monstersResponse = await fetch("/monsters.json")
        const monstersData = await monstersResponse.json()
        setMonsters(monstersData)

        // Load XP config
        const xpConfigResponse = await fetch("/xp-config.json")
        const xpConfigData = await xpConfigResponse.json()
        setXPConfig(xpConfigData)

        // Load user stats
        const stats = await loadUserStats()
        setUserStats(stats)
      } catch (error) {
        console.error("Error loading game data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Update user stats
  const updateUserStats = useCallback(async (newStats: UserStats) => {
    setUserStats(newStats)
    await saveUserStats(newStats)
  }, [])

  // Get user level and title
  const getUserLevel = useCallback(() => {
    if (!userStats || !xpConfig) return 1
    return calculateLevel(userStats.currentXP, xpConfig)
  }, [userStats, xpConfig])

  const getUserTitleText = useCallback(() => {
    if (!userStats || !xpConfig) return "Focus Warrior"
    const level = getUserLevel()
    return getUserTitle(level, xpConfig)
  }, [userStats, xpConfig, getUserLevel])

  return {
    userStats,
    monsters,
    xpConfig,
    currentScreen,
    selectedMonsterId,
    currentSession,
    isLoading,
    setCurrentScreen,
    setSelectedMonsterId,
    setCurrentSession,
    updateUserStats,
    getUserLevel,
    getUserTitleText,
  }
}
