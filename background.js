// --- Constants ---
const DEFAULT_SESSION_DURATION_SECONDS = 25 * 60 // 25 minutes
const TICK_INTERVAL_MS = 1000 // 1 second
const HP_DAMAGE_PER_SECOND = 1

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
      "twitter.com",
      "reddit.com",
      "instagram.com",
      "facebook.com",
      "netflix.com",
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
  stopBlockedSiteInterval()

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

  if (result === "victory") {
    xpEarned = 100
    userStats.currentXP += xpEarned
    userStats.totalPomodoros += 1
    pomodoroCompletedThisSession = true
    userStats.currentStreak += 1
    if (userStats.monstersDefeated[currentSession.monsterId] !== undefined) {
      userStats.monstersDefeated[currentSession.monsterId]++
    } else {
      userStats.monstersDefeated[currentSession.monsterId] = 1
    }
    currentSession.battleLog.push(
      `Victory! ${monsterDefeatedName} defeated. +${xpEarned} XP.`
    )
  } else {
    // result === 'defeat' (either by timer running out or early end)
    userStats.currentStreak = 0
    currentSession.battleLog.push(`Defeat! ${monsterDefeatedName} survived.`)

    // Check if defeat was due to timer running out (full 25 minutes passed)
    const elapsedSeconds = Math.floor(
      (Date.now() - currentSession.startTime) / 1000
    )
    // currentSession.durationSeconds might be slightly off from actual 25*60 due to timing, check if close
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
        currentSession.battleLog.push(
          "Full 25 minutes completed. Pomodoro counted."
        )
      }
    }
  }

  const outcomeData = {
    result: result,
    xpEarned: xpEarned,
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
    stopBlockedSiteInterval() // Ensure blocked site interval is also stopped
    return
  }

  let { currentSession } = data
  const elapsedSeconds = Math.floor(
    (Date.now() - currentSession.startTime) / 1000
  )
  const remainingSeconds = currentSession.durationSeconds - elapsedSeconds

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
        stopBlockedSiteInterval()
        // Clear storage
        await chrome.storage.local.set({
          currentSession: null,
          sessionOutcome: null,
        })
      }

      const monster = MONSTERS_DATA[request.monsterId] // Need monster data here
      if (!monster) {
        console.error("Invalid monsterId:", request.monsterId)
        sendResponse({ status: "error", message: "Invalid monster ID." })
        return
      }

      // Set monster HP to the session duration in seconds for dynamic HP, or use monster.hp for fixed HP
      const sessionHP = request.sessionDuration || monster.hp

      const newSession = {
        monsterId: request.monsterId,
        monsterName: monster.name,
        monsterIcon: monster.icon,
        startTime: Date.now(),
        durationSeconds:
          request.sessionDuration || DEFAULT_SESSION_DURATION_SECONDS,
        currentHP: sessionHP, // HP matches session duration or monster's default
        maxHP: sessionHP,
        battleLog: [`Session started against ${monster.name}!`],
        isActive: true,
      }

      await chrome.storage.local.set({
        currentSession: newSession,
        sessionOutcome: null,
      })
      sessionTimerInterval = setInterval(onTimerTick, TICK_INTERVAL_MS)
      startBlockedSiteInterval() // Start blocked site monitoring
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
      stopBlockedSiteInterval()

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
// Remove grace period and flat penalty logic
let blockedSiteInterval = null // Interval for checking blocked site every second

async function checkBlockedSiteAndApplyPenalty() {
  // Get the currently active tab in the current window
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (!tabs || tabs.length === 0) return
    const tab = tabs[0]
    const url = tab.url
    const { currentSession, blockedSites } = await chrome.storage.local.get([
      "currentSession",
      "blockedSites",
    ])
    if (!currentSession || !currentSession.isActive) return
    if (!url) return
    const isBlocked = blockedSites.some((blockedDomain) => {
      try {
        const hostname = new URL(url).hostname
        return hostname.includes(blockedDomain)
      } catch (e) {
        return false
      }
    })
    if (isBlocked) {
      // Monster gains 1 HP per second spent on blocked site
      if (currentSession.currentHP < currentSession.maxHP) {
        currentSession.currentHP = Math.min(
          currentSession.maxHP,
          currentSession.currentHP + 1
        )
        if (!currentSession.battleLog) currentSession.battleLog = []
        // Check if the last log entry is a distraction entry
        const lastEntry =
          currentSession.battleLog[currentSession.battleLog.length - 1]
        const distractionRegex = /^Distracted! Monster \+(\d+) HP\.$/
        if (lastEntry && distractionRegex.test(lastEntry)) {
          // Increment the HP count in the last entry
          const match = lastEntry.match(distractionRegex)
          const newCount = parseInt(match[1], 10) + 1
          currentSession.battleLog[
            currentSession.battleLog.length - 1
          ] = `Distracted! Monster +${newCount} HP.`
        } else {
          // Start a new distraction entry
          currentSession.battleLog.push("Distracted! Monster +1 HP.")
        }
        await chrome.storage.local.set({ currentSession })
        updatePopup()
      }
    }
  })
}

function startBlockedSiteInterval() {
  if (blockedSiteInterval) clearInterval(blockedSiteInterval)
  blockedSiteInterval = setInterval(checkBlockedSiteAndApplyPenalty, 1000)
}

function stopBlockedSiteInterval() {
  if (blockedSiteInterval) {
    clearInterval(blockedSiteInterval)
    blockedSiteInterval = null
  }
}

// Note: Blocked site interval management is now handled in the main message listener above

// To make MONSTERS_DATA available in background script without duplicating:
const MONSTERS_DATA = {
  // Each monster has a different HP, representing different session lengths/difficulties
  scrollfiend: {
    id: "scrollfiend",
    name: "Scrollfiend",
    icon: "assets/scrollfiend.png",
    hp: 1000,
  }, // ~17 min
  tubewyrm: {
    id: "tubewyrm",
    name: "Tubewyrm",
    icon: "assets/tubewyrm.png",
    hp: 1500,
  }, // 25 min
  tabberwock: {
    id: "tabberwock",
    name: "Tabberwock",
    icon: "assets/tabberwock.png",
    hp: 2000,
  }, // ~33 min
}

// --- Startup check for existing session ---
// This is important if the background script was terminated and restarted.
;(async () => {
  console.log("Background script starting up / re-initializing.")
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
