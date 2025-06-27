// Background service worker for ChronoFocus extension

// import { calculateSessionXP } from "./utils/xpSystem"
import type { SessionData, UserStats, XPConfig, Monster } from "./types"

console.log("🚀 Background script starting to load...")

// Global state for active timer
let isSessionActive = false
let monsterTriggerInterval: any = null
let currentTabId: number | null = null
let monstersData: Record<string, Monster> = {}

// Load monsters data
async function loadMonsters(): Promise<void> {
  try {
    const response = await fetch(chrome.runtime.getURL("monsters.json"))
    monstersData = await response.json()
    console.log("Monsters loaded:", Object.keys(monstersData))
  } catch (error) {
    console.error("Error loading monsters:", error)
    monstersData = {}
  }
}

// Load monsters on startup
loadMonsters()

// Listen for alarm events
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sessionTimer" && isSessionActive) {
    onTimerTick()
  }
})

// Timer tick function
async function onTimerTick(): Promise<void> {
  const data = await chrome.storage.local.get("currentSession")
  const currentSession: SessionData = data.currentSession

  if (!currentSession?.isActive || !currentSession.startTime) {
    console.warn("Timer tick for inactive session. Clearing alarm.")
    chrome.alarms.clear("sessionTimer")
    isSessionActive = false
    return
  }

  const elapsedSeconds = Math.floor(
    (Date.now() - currentSession.startTime) / 1000
  )
  const remainingSeconds =
    (currentSession.durationSeconds || 0) - elapsedSeconds

  // Update timer value
  currentSession.timerValue = Math.max(0, remainingSeconds)

  // Check if on a trigger site before applying damage
  const isOnTriggerSite = await checkIfOnTriggerSite(currentSession)

  // Deal damage to monster (reduced damage if on trigger site)
  const hpBeforeDamage = currentSession.currentHP
  let damageAmount = 1

  if (isOnTriggerSite) {
    // No damage when on trigger sites - monster feeds instead
    damageAmount = 0
  }

  currentSession.currentHP = Math.max(
    0,
    currentSession.currentHP - damageAmount
  )
  const hpAfterDamage = currentSession.currentHP

  // Check for monster healing from distracting sites
  await checkAndApplyMonsterHealing(currentSession)
  const hpAfterHealing = currentSession.currentHP

  console.log(
    `⚔️ Timer tick - HP: ${hpBeforeDamage} → ${hpAfterDamage} → ${hpAfterHealing}, Time: ${
      currentSession.timerValue
    }s${isOnTriggerSite ? " (feeding!)" : ""}`
  )

  // Trigger monster attack animation if damage was dealt
  if (damageAmount > 0) {
    try {
      await chrome.runtime.sendMessage({
        action: "triggerMonsterAttackAnimation",
      })
    } catch (err: any) {
      // Popup might be closed, that's fine
    }
  }

  // Check win condition
  if (currentSession.currentHP <= 0) {
    currentSession.currentHP = 0
    currentSession.battleLog.push("Victory! Monster defeated!")
    await endSession("victory")
    return
  }

  // Check time up condition
  if (remainingSeconds <= 0) {
    currentSession.battleLog.push("Time's up! Monster survived.")
    await endSession("defeat")
    return
  }

  // Save updated session
  await chrome.storage.local.set({ currentSession })

  // Send update to popup
  try {
    await chrome.runtime.sendMessage({
      action: "updatePopupBattleState",
      sessionData: currentSession,
    })
  } catch (err: any) {
    // Popup might be closed, that's fine
  }
}

// End session function
async function endSession(result: "victory" | "defeat"): Promise<void> {
  console.log(`Session ended with ${result}`)

  // Clear timer and stop trigger monitoring
  chrome.alarms.clear("sessionTimer")
  isSessionActive = false
  stopMonsterTriggerInterval()

  const storage = await chrome.storage.local.get([
    "currentSession",
    "userStats",
  ])
  const currentSession: SessionData = storage.currentSession
  let userStats: UserStats = storage.userStats

  if (!userStats) {
    userStats = {
      monstersDefeated: { scrollfiend: 0, tubewyrm: 0, tabberwock: 0 },
      totalPomodoros: 0,
      currentXP: 0,
      currentStreak: 0,
      lastActiveDate: null,
    }
  }

  // Load XP config and calculate proper XP
  const previousXP = userStats.currentXP
  let xpEarned = 0
  let xpBreakdown = null
  let pomodoroCompleted = false

  if (result === "victory") {
    try {
      // Load XP config and monsters data
      const [xpConfigResponse, monstersResponse] = await Promise.all([
        fetch(chrome.runtime.getURL("xp-config.json")),
        fetch(chrome.runtime.getURL("monsters.json")),
      ])

      const xpConfig: XPConfig = await xpConfigResponse.json()
      const monsters: Record<string, Monster> = await monstersResponse.json()

      // Get today's pomodoro count for bonus calculation
      const todayPomodoros = userStats.totalPomodoros % 100 // Simple approximation

      // Temporary simple XP calculation to test if import is the issue
      xpEarned = 100
      xpBreakdown = {
        baseXP: 100,
        bonuses: [],
        finalXP: 100,
      }
    } catch (error) {
      console.error("Error calculating XP:", error)
      // Fallback to simple XP
      xpEarned = 100
    }

    userStats.currentXP += xpEarned
    userStats.totalPomodoros += 1
    userStats.currentStreak += 1
    pomodoroCompleted = true

    if (userStats.monstersDefeated[currentSession.monsterId] !== undefined) {
      userStats.monstersDefeated[currentSession.monsterId]++
    }
  } else {
    userStats.currentStreak = 0
  }

  const outcomeData = {
    result,
    xpEarned,
    xpBreakdown,
    previousXP,
    monsterDefeatedName:
      result === "victory"
        ? monstersData[currentSession.monsterId]?.name
        : undefined,
    pomodoroCompleted,
    totalPomodoros: userStats.totalPomodoros,
    currentXP: userStats.currentXP,
    currentStreak: userStats.currentStreak,
  }

  // Mark session as inactive
  currentSession.isActive = false

  await chrome.storage.local.set({
    userStats,
    sessionOutcome: outcomeData,
  })

  // Notify popup
  try {
    await chrome.runtime.sendMessage({
      action: "sessionEnded",
      outcomeData,
    })
  } catch (err: any) {
    // Popup might be closed
  }

  // Clear session after delay (but keep outcome for popup to show)
  setTimeout(async () => {
    await chrome.storage.local.remove("currentSession")
  }, 500)
}

// Helper function to check if current site is a trigger site
async function checkIfOnTriggerSite(
  currentSession: SessionData
): Promise<boolean> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs || tabs.length === 0) return false

    const tab = tabs[0]
    const url = tab.url
    if (!url) return false

    const currentMonster = monstersData[currentSession.monsterId]
    if (!currentMonster) return false

    // Check if current site matches monster's trigger sites
    if (currentMonster.triggerSites?.length) {
      try {
        const hostname = new URL(url).hostname.toLowerCase()
        const matchedSite = currentMonster.triggerSites.find((site: string) =>
          hostname.includes(site.toLowerCase())
        )
        return !!matchedSite
      } catch (e) {
        console.warn("Failed to parse URL:", url, e)
        return false
      }
    }

    return false
  } catch (error) {
    console.error("Error in checkIfOnTriggerSite:", error)
    return false
  }
}

// Helper function to check and apply monster healing (called from timer tick)
async function checkAndApplyMonsterHealing(currentSession: any): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tabs || tabs.length === 0) return

    const tab = tabs[0]
    const url = tab.url
    if (!url) return

    const currentMonster = monstersData[currentSession.monsterId]
    if (!currentMonster) return

    let shouldHeal = false
    let triggerReason = ""

    // Check if current site matches monster's trigger sites
    if (currentMonster.triggerSites?.length) {
      try {
        const hostname = new URL(url).hostname.toLowerCase()
        const matchedSite = currentMonster.triggerSites.find((site: string) =>
          hostname.includes(site.toLowerCase())
        )
        if (matchedSite) {
          shouldHeal = true
          triggerReason = `${currentMonster.name} feeds on ${matchedSite}!`
        }
      } catch (e) {
        console.warn("Failed to parse URL:", url, e)
      }
    }

    // Apply healing if triggered (but not every second - make it less frequent)
    if (shouldHeal && currentSession.currentHP < currentSession.maxHP) {
      // Only heal every 3 seconds to make the battle more balanced
      const currentTime = Math.floor(Date.now() / 1000)
      if (
        !currentSession.lastHealTime ||
        currentTime - currentSession.lastHealTime >= 3
      ) {
        currentSession.currentHP = Math.min(
          currentSession.maxHP,
          currentSession.currentHP + 1
        )
        currentSession.lastHealTime = currentTime

        // Check if the last log entry is a healing entry with the same reason
        const lastEntry =
          currentSession.battleLog[currentSession.battleLog.length - 1]
        const healingRegex = new RegExp(
          `^${triggerReason.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&"
          )} \\+(\\d+) HP\\.$`
        )

        if (lastEntry && healingRegex.test(lastEntry)) {
          // Increment the HP count in the last entry
          const match = lastEntry.match(healingRegex)
          if (match) {
            const newCount = parseInt(match[1], 10) + 1
            currentSession.battleLog[
              currentSession.battleLog.length - 1
            ] = `${triggerReason} +${newCount} HP.`
          }
        } else {
          // Start a new healing entry
          currentSession.battleLog.push(`${triggerReason} +1 HP.`)
        }

        console.log(
          `🩹 Monster healed! ${triggerReason} HP: ${currentSession.currentHP}/${currentSession.maxHP}`
        )
      }
    }
  } catch (error) {
    console.error("Error in checkAndApplyMonsterHealing:", error)
  }
}

function stopMonsterTriggerInterval(): void {
  if (monsterTriggerInterval) {
    clearInterval(monsterTriggerInterval)
    monsterTriggerInterval = null
    currentTabId = null
    console.log("Stopped monster trigger monitoring interval")
  }
}

// Message listener
console.log("🎯 Setting up message listener...")
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  console.log("📨 Background received message:", request)

  if (request.action === "startSession") {
    ;(async () => {
      console.log("✅ Got startSession request!", request)

      // Check if monsters are loaded
      if (Object.keys(monstersData).length === 0) {
        console.error("Monsters not loaded")
        sendResponse({
          status: "error",
          message: "Error loading monsters. Please reload the extension.",
        })
        return true
      }

      const monster = monstersData[request.monsterId]
      if (!monster) {
        console.error("Invalid monsterId:", request.monsterId)
        sendResponse({ status: "error", message: "Invalid monster ID." })
        return true
      }

      // Create session data
      const sessionData = {
        monsterId: request.monsterId,
        monsterName: monster.name,
        monsterIcon: monster.icon,
        startTime: Date.now(),
        durationSeconds: monster.hp,
        currentHP: monster.hp,
        maxHP: monster.hp,
        battleLog: [`Session started against ${monster.name}!`],
        isActive: true,
        timerValue: monster.hp,
      }

      // Store session and clear any previous outcome
      chrome.storage.local.set({
        currentSession: sessionData,
        sessionOutcome: null,
      })

      // Start the timer using chrome.alarms API
      chrome.alarms.clear("sessionTimer")
      chrome.alarms.create("sessionTimer", {
        delayInMinutes: 0,
        periodInMinutes: 1 / 60,
      })
      isSessionActive = true

      // Initialize current tab ID
      try {
        const tabs = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        })
        if (tabs?.[0]) {
          currentTabId = tabs[0].id || null
        }
      } catch (error) {
        console.warn("Could not get current tab:", error)
      }

      console.log("✅ Session created and timer started:", sessionData)
      sendResponse({ status: "sessionStarted", sessionData })
    })()
    return true
  }

  if (request.action === "endSessionEarly") {
    console.log("Got endSessionEarly request")
    chrome.storage.local.get("currentSession").then(async (storage) => {
      const currentSession = storage.currentSession

      if (currentSession?.isActive) {
        currentSession.battleLog.push("Session ended early by user.")
        await chrome.storage.local.set({ currentSession })
        await endSession("defeat")
        sendResponse({ status: "sessionEndedEarly" })
      } else {
        sendResponse({ status: "noActiveSession" })
      }
    })
    return true
  }

  if (request.action === "getPopupState") {
    // Handle getPopupState
    chrome.storage.local
      .get(["currentSession", "sessionOutcome"])
      .then((storage) => {
        const currentSession = storage.currentSession
        const sessionOutcome = storage.sessionOutcome

        if (sessionOutcome) {
          sendResponse({ status: "sessionEnded", outcomeData: sessionOutcome })
        } else if (currentSession?.isActive) {
          const elapsedSeconds = Math.floor(
            (Date.now() - currentSession.startTime) / 1000
          )
          currentSession.timerValue = Math.max(
            0,
            currentSession.durationSeconds - elapsedSeconds
          )
          sendResponse({ status: "sessionActive", sessionData: currentSession })
        } else {
          sendResponse({ status: "noActiveSessionOrOutcome" })
        }
      })
    return true
  }

  sendResponse({ status: "unknown", message: "Unknown action" })
  return true
})

// Tab switching detection for Tabberwock
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const data = await chrome.storage.local.get("currentSession")
    const currentSession = data.currentSession

    if (!currentSession?.isActive) return

    const currentMonster = monstersData[currentSession.monsterId]
    if (!currentMonster || currentMonster.triggerEvent !== "tab_switch") return

    // Only trigger if this is actually a tab switch (not initial load)
    if (currentTabId !== null && currentTabId !== activeInfo.tabId) {
      if (currentSession.currentHP < currentSession.maxHP) {
        currentSession.currentHP = Math.min(
          currentSession.maxHP,
          currentSession.currentHP + 2 // Tab switching gives more HP since it's more disruptive
        )

        const triggerReason = "Tabberwock feeds on tab switching!"
        const lastEntry =
          currentSession.battleLog[currentSession.battleLog.length - 1]
        const healingRegex = /^Tabberwock feeds on tab switching! \+(\d+) HP\.$/

        if (lastEntry && healingRegex.test(lastEntry)) {
          const match = lastEntry.match(healingRegex)
          if (match) {
            const newCount = parseInt(match[1], 10) + 2
            currentSession.battleLog[
              currentSession.battleLog.length - 1
            ] = `${triggerReason} +${newCount} HP.`
          }
        } else {
          currentSession.battleLog.push(`${triggerReason} +2 HP.`)
        }

        console.log(
          `🔄 Tab switch detected! Tabberwock healed +2 HP: ${currentSession.currentHP}/${currentSession.maxHP}`
        )

        await chrome.storage.local.set({ currentSession })

        // Send update to popup
        try {
          await chrome.runtime.sendMessage({
            action: "updatePopupBattleState",
            sessionData: currentSession,
          })
        } catch (err: any) {
          // Popup might be closed, that's fine
        }
      }
    }

    currentTabId = activeInfo.tabId
  } catch (error) {
    console.error("Error in tab activation listener:", error)
  }
})

console.log("✅ Background script fully loaded and initialized.")

export {}
