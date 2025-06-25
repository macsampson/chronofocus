// --- Constants ---
const TICK_INTERVAL_MS = 1000 // 1 second
const HP_DAMAGE_PER_SECOND = 1

// XP System Configuration
let XP_CONFIG = null

// Failsafe function to get defaults when XP_CONFIG is null
function getXPDefault(key) {
  if (!XP_CONFIG || !XP_CONFIG.defaults) {
    console.error(
      "XP_CONFIG not loaded properly, extension may not function correctly"
    )
    return null
  }
  return XP_CONFIG.defaults[key]
}

// Load XP configuration
async function loadXPConfig() {
  try {
    const response = await fetch(chrome.runtime.getURL("xp-config.json"))
    XP_CONFIG = await response.json()
    console.log("Background: XP Config loaded:", XP_CONFIG)
  } catch (error) {
    console.error("Background: Error loading XP config:", error)
    XP_CONFIG = null
  }
}

// --- State (managed via chrome.storage.local) ---
// 'currentSession': { monsterId, monsterName, monsterIcon, startTime, durationSeconds, currentHP, maxHP, battleLog, isActive }
// 'userStats': { monstersDefeated: { scrollfiend: 0, ... }, totalPomodoros: 0, currentXP: 0, currentStreak: 0 }
// 'blockedSites': [...]

// --- Globals (for active timer interval) ---
let sessionTimerInterval = null

// --- Initialization ---
chrome.runtime.onInstalled.addListener(async (details) => {
  // Added details argument
  console.log("FocusForge extension installed/updated. Reason:", details.reason)

  // Load XP configuration and monsters
  await Promise.all([loadXPConfig(), loadMonsters()])
  // Initialize or ensure structure of userStats and other settings
  const currentData = await chrome.storage.local.get([
    "userStats",
    "blockedSites",
    "currentSession",
    "sessionOutcome",
  ])

  const defaultStats = {
    monstersDefeated: { scrollfiend: 0, tubewyrm: 0, tabberwock: 0 },
    totalPomodoros: 0,
    currentXP: 0,
    currentStreak: 0,
  }

  const newStorage = {}
  if (!currentData.userStats || details.reason === "install") {
    // Ensure fresh stats on new install or if missing
    newStorage.userStats = defaultStats
  } else {
    // Merge existing stats with defaults to ensure all keys are present if new ones were added in an update
    newStorage.userStats = { ...defaultStats, ...currentData.userStats }
    // Ensure sub-objects like monstersDefeated are also well-structured
    newStorage.userStats.monstersDefeated = {
      ...defaultStats.monstersDefeated,
      ...(currentData.userStats.monstersDefeated || {}),
    }
  }

  if (!currentData.blockedSites || details.reason === "install") {
    newStorage.blockedSites = [
      "youtube.com",
      "x.com",
      "reddit.com",
      "instagram.com",
      "facebook.com",
      "netflix.com",
      "twitch.tv",
      "tiktok.com",
    ]
  } else {
    newStorage.blockedSites = currentData.blockedSites // Preserve existing blocked sites if user could edit them
  }

  // Always clear session-related data on install/update for a clean state
  newStorage.currentSession = null
  newStorage.sessionOutcome = null

  await chrome.storage.local.set(newStorage)
  console.log("Storage initialized/verified:", newStorage)
})

// Load configurations on startup
chrome.runtime.onStartup.addListener(async () => {
  console.log("Extension startup - loading configurations")
  await Promise.all([loadXPConfig(), loadMonsters()])
})

// --- XP System Functions ---
async function getTodayPomodoros() {
  const today = new Date().toDateString()
  const result = await chrome.storage.local.get(`pomodoros_${today}`)
  const todayPomodoros = parseInt(result[`pomodoros_${today}`] || 0, 10)
  return todayPomodoros
}

function generateFocusCrit() {
  if (!XP_CONFIG || !XP_CONFIG.modifiers) return getXPDefault("focusCrit")
  const min = XP_CONFIG.modifiers.minFocusCrit
  const max = XP_CONFIG.modifiers.maxFocusCrit
  return Math.random() * (max - min) + min
}

function calculateMonsterBaseXP(monsterId) {
  if (!XP_CONFIG || !XP_CONFIG.base || !MONSTERS_DATA)
    return getXPDefault("baseXP")

  const monster = MONSTERS_DATA[monsterId]
  if (!monster) return XP_CONFIG.base.xpPerSession

  // Calculate base XP from monster HP
  let baseXP = monster.hp * XP_CONFIG.base.xpPerHP

  // Apply difficulty multiplier if configured
  if (
    XP_CONFIG.difficultyMultipliers &&
    XP_CONFIG.difficultyMultipliers[monsterId]
  ) {
    baseXP *= XP_CONFIG.difficultyMultipliers[monsterId]
  }

  // Ensure minimum XP
  baseXP = Math.max(baseXP, XP_CONFIG.base.minXP)

  return Math.floor(baseXP)
}

async function calculateSessionXP(sessionData, userStats) {
  if (!XP_CONFIG || !XP_CONFIG.base || !XP_CONFIG.modifiers)
    return {
      finalXP: getXPDefault("sessionXP"),
      bonuses: [],
      baseXP: getXPDefault("baseXP"),
    }

  // Calculate base XP based on monster difficulty (health)
  let baseXP = calculateMonsterBaseXP(sessionData.monsterId)
  let bonuses = []

  // Check for no distractions (no healing events in battle log)
  const hadDistractions =
    sessionData.battleLog &&
    sessionData.battleLog.some(
      (log) => log.includes("healed") || log.includes("Distracted")
    )

  if (!hadDistractions) {
    const bonus = Math.floor(baseXP * XP_CONFIG.modifiers.noDistractions)
    baseXP += bonus
    bonuses.push({
      type: "noDistractions",
      amount: bonus,
      message: XP_CONFIG.feedback.noDistractions.replace("{bonus}", bonus),
    })
  }

  // Check for second session today
  const todayPomodoros = await getTodayPomodoros()
  if (todayPomodoros >= 1) {
    const bonus = Math.floor(baseXP * XP_CONFIG.modifiers.secondSession)
    baseXP += bonus
    bonuses.push({
      type: "secondSession",
      amount: bonus,
      message: XP_CONFIG.feedback.secondSession.replace("{bonus}", bonus),
    })
  }

  // Check for streak bonus (>3 days)
  const currentStreak =
    userStats?.currentStreak ?? XP_CONFIG.defaults.currentStreak
  if (currentStreak > 3) {
    const bonus = Math.floor(baseXP * XP_CONFIG.modifiers.streakBonus)
    baseXP += bonus
    bonuses.push({
      type: "streakBonus",
      amount: bonus,
      message: XP_CONFIG.feedback.streakBonus
        .replace("{streak}", currentStreak)
        .replace("{bonus}", bonus),
    })
  }

  // Apply focus crit multiplier
  const critMultiplier = generateFocusCrit()
  const finalXP = Math.floor(baseXP * critMultiplier)

  if (critMultiplier > 1.0) {
    bonuses.push({
      type: "focusCrit",
      amount: finalXP - baseXP,
      multiplier: critMultiplier.toFixed(2),
      message: XP_CONFIG.feedback.focusCrit.replace(
        "{multiplier}",
        critMultiplier.toFixed(2)
      ),
    })
  }

  return {
    finalXP,
    bonuses,
    baseXP: calculateMonsterBaseXP(sessionData.monsterId),
  }
}

function awardMicroXP(type, sessionData) {
  if (!XP_CONFIG || !XP_CONFIG.base) return XP_CONFIG.defaults.microXP

  switch (type) {
    case "start":
      return XP_CONFIG.base.xpForStarting
    case "halfway":
      return XP_CONFIG.base.xpForHalfway
    default:
      return XP_CONFIG.defaults.microXP
  }
}

// --- Helper Functions ---
async function updatePopup() {
  const { currentSession } = await chrome.storage.local.get("currentSession")
  if (currentSession && currentSession.isActive) {
    // Calculate remaining time for the popup
    const elapsedSeconds = Math.floor(
      (Date.now() - currentSession.startTime) / 1000
    )
    currentSession.timerValue = Math.max(
      0,
      currentSession.durationSeconds - elapsedSeconds
    )

    chrome.runtime
      .sendMessage({
        action: "updatePopupBattleState",
        sessionData: currentSession,
      })
      .catch((err) => {
        if (err.message.includes("Receiving end does not exist")) {
          // Popup is not open, this is fine.
        } else {
          console.warn("Error sending update to popup:", err)
        }
      })
  }
}

async function endSession(result) {
  // result: 'victory' or 'defeat'
  console.log(`Session ended with ${result}.`)

  // Clear any active grace period timers immediately
  if (typeof gracePeriodTimers !== "undefined") {
    Object.values(gracePeriodTimers).forEach((timerId) => clearTimeout(timerId))
    gracePeriodTimers = {}
  }

  // Clear all intervals and timers
  if (sessionTimerInterval) {
    clearInterval(sessionTimerInterval)
    sessionTimerInterval = null
  }
  stopMonsterTriggerInterval()

  const { currentSession, userStats } = await chrome.storage.local.get([
    "currentSession",
    "userStats",
  ])
  if (!currentSession) {
    console.error("endSession called but no currentSession found in storage.")
    return
  }

  let xpEarned = 0
  let monsterDefeatedName =
    MONSTERS_DATA[currentSession.monsterId]?.name || "a monster"
  let pomodoroCompletedThisSession = false

  if (!userStats) {
    // Initialize userStats if it's somehow missing
    console.warn("userStats was missing in endSession. Initializing.")
    userStats = {
      monstersDefeated: { scrollfiend: 0, tubewyrm: 0, tabberwock: 0 },
      totalPomodoros: 0,
      currentXP: 0,
      currentStreak: 0,
    }
  }
  if (!userStats.monstersDefeated)
    userStats.monstersDefeated = { scrollfiend: 0, tubewyrm: 0, tabberwock: 0 }

  // Store previous XP for animation
  const previousXP = userStats.currentXP
  let xpBreakdown = null

  if (result === "victory") {
    // Calculate XP with new system
    xpBreakdown = await calculateSessionXP(currentSession, userStats)
    xpEarned = xpBreakdown.finalXP

    userStats.currentXP += xpEarned
    userStats.totalPomodoros += 1
    pomodoroCompletedThisSession = true
    userStats.currentStreak += 1
    if (userStats.monstersDefeated[currentSession.monsterId] !== undefined) {
      userStats.monstersDefeated[currentSession.monsterId]++
    } else {
      userStats.monstersDefeated[currentSession.monsterId] = 1
    }

    // Add XP breakdown messages to battle log
    currentSession.battleLog.push(`Victory! ${monsterDefeatedName} defeated.`)

    if (XP_CONFIG && XP_CONFIG.feedback) {
      currentSession.battleLog.push(
        XP_CONFIG.feedback.victory
          .replace("{monster}", monsterDefeatedName)
          .replace("{xp}", xpEarned)
      )

      // Add bonus messages
      xpBreakdown.bonuses.forEach((bonus) => {
        currentSession.battleLog.push(bonus.message)
      })
    }
  } else {
    // result === 'defeat' (either by timer running out or early end)
    userStats.currentStreak = 0
    currentSession.battleLog.push(`Defeat! ${monsterDefeatedName} survived.`)

    // Check if defeat was due to timer running out (full session duration passed)
    const elapsedSeconds = Math.floor(
      (Date.now() - currentSession.startTime) / 1000
    )
    // currentSession.durationSeconds might be slightly off due to timing, check if close
    if (
      elapsedSeconds >= currentSession.durationSeconds - 2 &&
      currentSession.currentHP > 0
    ) {
      // Check if this was not an "ended early" scenario
      const endedEarly = currentSession.battleLog.some((log) =>
        log.includes("Session ended early by user.")
      )
      if (!endedEarly) {
        userStats.totalPomodoros += 1 // Count as a completed Pomodoro duration
        pomodoroCompletedThisSession = true
        const durationMinutes = Math.round(currentSession.durationSeconds / 60)
        currentSession.battleLog.push(
          `Full ${durationMinutes} minutes completed. Pomodoro counted.`
        )
      }
    }
  }

  const outcomeData = {
    result: result,
    xpEarned: xpEarned,
    xpBreakdown: xpBreakdown,
    previousXP: previousXP,
    monsterDefeatedName: result === "victory" ? monsterDefeatedName : null,
    pomodoroCompleted: pomodoroCompletedThisSession,
    // Pass updated stats for immediate display on result screen
    totalPomodoros: userStats.totalPomodoros,
    currentXP: userStats.currentXP,
    currentStreak: userStats.currentStreak,
  }

  // Mark session as inactive before saving its final state
  currentSession.isActive = false

  await chrome.storage.local.set({
    userStats: userStats,
    // currentSession is now effectively a historical record of the ended session
    // It will be removed by the setTimeout below.
    // Or, we could choose to store it differently if we want a session history.
    // For now, sessionOutcome is the primary record for the result screen.
    sessionOutcome: outcomeData,
  })

  // Notify popup about session end
  chrome.runtime
    .sendMessage({ action: "sessionEnded", outcomeData: outcomeData })
    .catch((err) => {
      if (!err.message.includes("Receiving end does not exist")) {
        console.warn("Could not send sessionEnded to popup:", err)
      }
    })

  // Clear the 'currentSession' which marks an *active* session.
  // 'sessionOutcome' remains for the result screen.
  setTimeout(async () => {
    await chrome.storage.local.remove("currentSession")
    console.log("Active session marker (currentSession) cleared from storage.")
  }, 500) // Delay to allow popup to process if it was using currentSession details
}

// --- Main Timer Tick Function ---
async function onTimerTick() {
  const data = await chrome.storage.local.get("currentSession") // Only get currentSession
  if (!data || !data.currentSession || !data.currentSession.isActive) {
    // Check data and data.currentSession
    console.warn("Timer tick for inactive/missing session. Clearing interval.")
    clearInterval(sessionTimerInterval)
    sessionTimerInterval = null
    stopMonsterTriggerInterval() // Ensure monster trigger interval is also stopped
    return
  }

  let { currentSession } = data
  const elapsedSeconds = Math.floor(
    (Date.now() - currentSession.startTime) / 1000
  )
  const remainingSeconds = currentSession.durationSeconds - elapsedSeconds

  // Track micro-progress milestones
  if (!currentSession.microProgressTracked) {
    currentSession.microProgressTracked = {
      started: false,
      halfway: false,
    }
  }

  // Award starting XP (only once)
  if (!currentSession.microProgressTracked.started && elapsedSeconds >= 1) {
    currentSession.microProgressTracked.started = true
    const startXP = awardMicroXP("start", currentSession)
    if (startXP > 0 && XP_CONFIG && XP_CONFIG.feedback) {
      currentSession.battleLog.push(XP_CONFIG.feedback.startSession)
    }
  }

  // Award halfway XP (only once)
  const halfwayPoint = Math.floor(currentSession.durationSeconds / 2)
  if (
    !currentSession.microProgressTracked.halfway &&
    elapsedSeconds >= halfwayPoint
  ) {
    currentSession.microProgressTracked.halfway = true
    const halfwayXP = awardMicroXP("halfway", currentSession)
    if (halfwayXP > 0 && XP_CONFIG && XP_CONFIG.feedback) {
      currentSession.battleLog.push(XP_CONFIG.feedback.halfway)
    }
  }

  // Deal damage
  currentSession.currentHP -= HP_DAMAGE_PER_SECOND
  if (!currentSession.battleLog) currentSession.battleLog = []
  // currentSession.battleLog.push(`Monster took ${HP_DAMAGE_PER_SECOND} damage.`); // Too noisy

  if (currentSession.currentHP <= 0) {
    currentSession.currentHP = 0
    await chrome.storage.local.set({ currentSession }) // Save final HP
    endSession("victory")
    return
  }

  if (remainingSeconds <= 0) {
    await chrome.storage.local.set({ currentSession }) // Save final state before loss
    endSession("defeat") // Time's up, monster still has HP
    return
  }

  await chrome.storage.local.set({ currentSession })
  updatePopup() // Send state to popup
}

// --- Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  ;(async () => {
    if (request.action === "startSession") {
      console.log("Background: Received startSession request", request)

      // Check both timer interval and storage for active session
      const { currentSession } = await chrome.storage.local.get(
        "currentSession"
      )
      if (sessionTimerInterval || (currentSession && currentSession.isActive)) {
        console.warn(
          "Session already in progress. Cleaning up and allowing new session."
        )
        // Force cleanup of any existing session
        if (sessionTimerInterval) {
          clearInterval(sessionTimerInterval)
          sessionTimerInterval = null
        }
        stopMonsterTriggerInterval()
        // Clear storage
        await chrome.storage.local.set({
          currentSession: null,
          sessionOutcome: null,
        })
      }

      // Check if monsters loaded successfully
      if (Object.keys(MONSTERS_DATA).length === 0) {
        console.error("Monsters not loaded")
        sendResponse({
          status: "error",
          message: "Error loading monsters. Please reload the extension.",
        })
        return
      }

      const monster = MONSTERS_DATA[request.monsterId] // Need monster data here
      console.log("Monster:", monster)
      if (!monster) {
        console.error("Invalid monsterId:", request.monsterId)
        sendResponse({ status: "error", message: "Invalid monster ID." })
        return
      }

      // Session duration and HP both equal monster.hp for perfect timing
      const sessionDuration = request.sessionDuration || monster.hp
      const sessionHP = monster.hp

      const newSession = {
        monsterId: request.monsterId,
        monsterName: monster.name,
        monsterIcon: monster.icon,
        startTime: Date.now(),
        durationSeconds: sessionDuration,
        currentHP: sessionHP,
        maxHP: sessionHP,
        battleLog: [`Session started against ${monster.name}!`],
        isActive: true,
      }

      await chrome.storage.local.set({
        currentSession: newSession,
        sessionOutcome: null,
      })
      sessionTimerInterval = setInterval(onTimerTick, TICK_INTERVAL_MS)
      startMonsterTriggerInterval() // Start monster trigger monitoring

      // Initialize current tab ID for Tabberwock tracking
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          currentTabId = tabs[0].id
        }
      })

      console.log(
        "Session started in background. Timer ID:",
        sessionTimerInterval
      )
      sendResponse({ status: "sessionStarted", sessionData: newSession })
      updatePopup() // Initial popup update
    } else if (request.action === "endSessionEarly") {
      console.log("Background: Received endSessionEarly request")
      const { currentSession } = await chrome.storage.local.get(
        "currentSession"
      )
      if (currentSession && currentSession.isActive) {
        if (!currentSession.battleLog) currentSession.battleLog = []
        currentSession.battleLog.push("Session ended early by user.")
        await chrome.storage.local.set({ currentSession })
        endSession("defeat") // Ending early is a defeat
        sendResponse({ status: "sessionEndedEarly" })
      } else {
        sendResponse({ status: "noActiveSession" })
      }
    } else if (request.action === "getPopupState") {
      // This allows popup to query state if it reopens
      const { currentSession, sessionOutcome } = await chrome.storage.local.get(
        ["currentSession", "sessionOutcome"]
      )
      if (sessionOutcome) {
        sendResponse({ status: "sessionEnded", outcomeData: sessionOutcome })
      } else if (currentSession && currentSession.isActive) {
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
    } else if (request.action === "forceCleanup") {
      console.log("Background: Received forceCleanup request")
      // Force cleanup of all session state
      if (sessionTimerInterval) {
        clearInterval(sessionTimerInterval)
        sessionTimerInterval = null
      }
      stopMonsterTriggerInterval()

      await chrome.storage.local.set({
        currentSession: null,
        sessionOutcome: null,
      })

      sendResponse({ status: "cleanupComplete" })
    }
  })()
  return true // Indicates asynchronous response.
})

// --- Tab & Site Monitoring ---
let monsterTriggerInterval = null // Interval for checking monster-specific triggers
let currentTabId = null // Track current tab for Tabberwock

async function checkMonsterTriggersAndApplyHealing() {
  // Get the currently active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs || tabs.length === 0) return
    const tab = tabs[0]
    const url = tab.url
    const { currentSession } = await chrome.storage.local.get([
      "currentSession",
    ])
    if (!currentSession || !currentSession.isActive) return
    if (!url) return

    // Get current monster data
    const currentMonster = MONSTERS_DATA[currentSession.monsterId]
    if (!currentMonster) return

    let shouldHeal = false
    let triggerReason = ""

    // Check if current site matches monster's trigger sites
    if (currentMonster.triggerSites && currentMonster.triggerSites.length > 0) {
      try {
        const hostname = new URL(url).hostname.toLowerCase()
        const matchedSite = currentMonster.triggerSites.find((site) =>
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

    // Apply healing if triggered
    if (shouldHeal && currentSession.currentHP < currentSession.maxHP) {
      currentSession.currentHP = Math.min(
        currentSession.maxHP,
        currentSession.currentHP + 1
      )
      if (!currentSession.battleLog) currentSession.battleLog = []

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
        const newCount = parseInt(match[1], 10) + 1
        currentSession.battleLog[
          currentSession.battleLog.length - 1
        ] = `${triggerReason} +${newCount} HP.`
      } else {
        // Start a new healing entry
        currentSession.battleLog.push(`${triggerReason} +1 HP.`)
      }

      await chrome.storage.local.set({ currentSession })
      updatePopup()
    }
  })
}

// Tab switching detection for Tabberwock
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const { currentSession } = await chrome.storage.local.get(["currentSession"])
  if (!currentSession || !currentSession.isActive) return

  const currentMonster = MONSTERS_DATA[currentSession.monsterId]
  if (!currentMonster || currentMonster.triggerEvent !== "tab_switch") return

  // Only trigger if this is actually a tab switch (not initial load)
  if (currentTabId !== null && currentTabId !== activeInfo.tabId) {
    if (currentSession.currentHP < currentSession.maxHP) {
      currentSession.currentHP = Math.min(
        currentSession.maxHP,
        currentSession.currentHP + 2 // Tab switching gives more HP since it's more disruptive
      )
      if (!currentSession.battleLog) currentSession.battleLog = []

      const triggerReason = "Tabberwock feeds on tab switching!"
      const lastEntry =
        currentSession.battleLog[currentSession.battleLog.length - 1]
      const healingRegex = /^Tabberwock feeds on tab switching! \+(\d+) HP\.$/

      if (lastEntry && healingRegex.test(lastEntry)) {
        const match = lastEntry.match(healingRegex)
        const newCount = parseInt(match[1], 10) + 2
        currentSession.battleLog[
          currentSession.battleLog.length - 1
        ] = `${triggerReason} +${newCount} HP.`
      } else {
        currentSession.battleLog.push(`${triggerReason} +2 HP.`)
      }

      await chrome.storage.local.set({ currentSession })
      updatePopup()
    }
  }

  currentTabId = activeInfo.tabId
})

function startMonsterTriggerInterval() {
  if (monsterTriggerInterval) clearInterval(monsterTriggerInterval)
  monsterTriggerInterval = setInterval(
    checkMonsterTriggersAndApplyHealing,
    1000
  )
  console.log("Started monster trigger monitoring interval")
}

function stopMonsterTriggerInterval() {
  if (monsterTriggerInterval) {
    clearInterval(monsterTriggerInterval)
    monsterTriggerInterval = null
    currentTabId = null // Reset tab tracking
    console.log("Stopped monster trigger monitoring interval")
  }
}

// Note: Monster trigger interval management is now handled in the main message listener above

// Load monsters from JSON file - single source of truth
let MONSTERS_DATA = {}

async function loadMonsters() {
  try {
    const response = await fetch(chrome.runtime.getURL("monsters.json"))
    MONSTERS_DATA = await response.json()
    console.log("Monsters loaded in background:", MONSTERS_DATA)
  } catch (error) {
    console.error("Error loading monsters in background:", error)
    // No fallback - just empty object
    MONSTERS_DATA = {}
  }
}

// --- Startup check for existing session ---
// This is important if the background script was terminated and restarted.
;(async () => {
  console.log("Background script starting up / re-initializing.")

  // Load monsters first
  await loadMonsters()

  const { currentSession } = await chrome.storage.local.get("currentSession")
  if (currentSession && currentSession.isActive) {
    console.log("Found active session on startup:", currentSession)
    const elapsedSeconds = Math.floor(
      (Date.now() - currentSession.startTime) / 1000
    )
    const remainingSeconds = currentSession.durationSeconds - elapsedSeconds

    if (remainingSeconds <= 0) {
      // Session should have ended while background was inactive
      console.log("Session timer expired while inactive.")
      // Check if win condition was met before timer expired based on last HP
      if (currentSession.currentHP <= 0) {
        endSession("victory")
      } else {
        endSession("defeat")
      }
    } else {
      // Resume timer
      if (sessionTimerInterval) clearInterval(sessionTimerInterval) // Clear any old one just in case
      sessionTimerInterval = setInterval(onTimerTick, TICK_INTERVAL_MS)
      console.log("Resumed session timer. Interval ID:", sessionTimerInterval)
    }
  } else {
    console.log("No active session found on startup.")
  }
})()

console.log("Background script fully loaded and initialized.")
