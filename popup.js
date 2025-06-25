// --- Constants and Data ---
const MONSTERS = {
  scrollfiend: {
    id: "scrollfiend",
    name: "Scrollfiend",
    icon: "assets/scrollfiend.png",
    description: "Represents endless scrolling on social media.",
    hp: 100,
  },
  tubewyrm: {
    id: "tubewyrm",
    name: "Tubewyrm",
    icon: "assets/tubewyrm.png",
    description: "Symbolizes video binges and streaming traps.",
    hp: 100,
  },
  tabberwock: {
    id: "tabberwock",
    name: "Tabberwock",
    icon: "assets/tabberwock.png",
    description: "The beast of excessive tab-hopping and context switching.",
    hp: 100,
  },
}

const SCREENS = {
  monsterSelection: document.getElementById("monster-selection-screen"),
  battle: document.getElementById("battle-screen"),
  result: document.getElementById("result-screen"),
}

// --- State ---
let selectedMonsterId = null
let currentSession = null // Stores { monsterId, startTime, monsterHP, timerValue }

// Track last monster HP for attack animation
let lastMonsterHP = null

// --- UI Elements ---
const monsterCardsContainer = document.getElementById("monster-cards-container")
const startSessionBtn = document.getElementById("start-session-btn")
const endSessionEarlyBtn = document.getElementById("end-session-early-btn")
const startAnotherSessionBtn = document.getElementById(
  "start-another-session-btn"
)

const timerDisplay = document.getElementById("timer-display")
const monsterHpBar = document.getElementById("monster-hp-bar")
const battleMonsterName = document.getElementById("battle-monster-name")
const battleMonsterIcon = document.getElementById("battle-monster-icon")
const battleLogContent = document.getElementById("battle-log-content")

const resultMessage = document.getElementById("result-message")
const xpEarnedDisplay = document.getElementById("xp-earned-display")
const statsDisplayContent = document.getElementById("stats-display-content")

const endSessionModal = document.getElementById("end-session-modal")
const cancelEndSessionBtn = document.getElementById("cancel-end-session-btn")
const confirmEndSessionBtn = document.getElementById("confirm-end-session-btn")

// --- Functions ---

function switchScreen(screenName) {
  Object.values(SCREENS).forEach((screen) => screen.classList.remove("active"))
  if (SCREENS[screenName]) {
    SCREENS[screenName].classList.add("active")
  } else {
    console.error("Screen not found:", screenName)
  }
}

function renderMonsterSelectionScreen() {
  monsterCardsContainer.innerHTML = "" // Clear previous cards
  Object.values(MONSTERS).forEach((monster) => {
    const card = document.createElement("div")
    card.classList.add("monster-card")
    card.dataset.monsterId = monster.id
    card.innerHTML = `
      <img src="${monster.icon}" alt="${monster.name}" class="monster-icon">
      <div class="monster-details">
        <strong>${monster.name}</strong>
        <p>${monster.description}</p>
      </div>
    `
    card.addEventListener("click", () => selectMonster(monster.id, card))
    monsterCardsContainer.appendChild(card)
  })
  switchScreen("monsterSelection")
}

function selectMonster(monsterId, cardElement) {
  selectedMonsterId = monsterId
  // Update UI to show selection
  document
    .querySelectorAll(".monster-card")
    .forEach((card) => card.classList.remove("selected"))
  cardElement.classList.add("selected")
  startSessionBtn.disabled = false
  console.log("Selected monster:", monsterId)
}

async function handleStartSession() {
  if (!selectedMonsterId) return

  const monster = MONSTERS[selectedMonsterId]
  console.log("Starting session with:", monster.name)

  // Send message to background script to start the session
  try {
    const response = await chrome.runtime.sendMessage({
      action: "startSession",
      monsterId: selectedMonsterId,
      monsterHP: monster.hp, // Initial HP
      sessionDuration: 25 * 60, // 25 minutes in seconds
    })
    console.log("Background response to startSession:", response)
    if (response && response.status === "sessionStarted") {
      currentSession = {
        // Store initial session state locally for UI
        monsterId: selectedMonsterId,
        monsterName: monster.name,
        monsterIcon: monster.icon,
        currentHP: monster.hp,
        maxHP: monster.hp,
        timerValue: 25 * 60, // in seconds
        battleLog: ["Session started! Focus!"],
      }
      renderBattleScreen(currentSession)
    } else {
      console.error("Failed to start session via background script:", response)
      // Show error to user?
    }
  } catch (error) {
    console.error("Error sending startSession message:", error)
    // Handle cases where background script might not be ready or an error occurs
    if (
      error.message.includes("Could not establish connection") ||
      error.message.includes("Receiving end does not exist")
    ) {
      alert(
        "FocusForge background service is not ready. Please try again in a moment, or ensure the extension is enabled correctly."
      )
    }
  }
}

function renderBattleScreen(sessionData) {
  console.log("Rendering battle screen with data:", sessionData)
  if (!sessionData || !MONSTERS[sessionData.monsterId]) {
    console.error("Invalid session data for battle screen:", sessionData)
    // Potentially switch back to monster selection or show an error
    renderMonsterSelectionScreen() // Fallback
    alert("Error: Could not load session data. Please try again.")
    return
  }
  const monster = MONSTERS[sessionData.monsterId]
  battleMonsterName.textContent = `Battling ${monster.name}`
  battleMonsterIcon.src = monster.icon

  // --- Attack Animation Logic ---
  if (lastMonsterHP !== null && sessionData.currentHP < lastMonsterHP) {
    battleMonsterIcon.classList.remove("monster-attack-anim") // reset if needed
    void battleMonsterIcon.offsetWidth // force reflow
    battleMonsterIcon.classList.add("monster-attack-anim")
    battleMonsterIcon.addEventListener(
      "animationend",
      () => {
        battleMonsterIcon.classList.remove("monster-attack-anim")
      },
      { once: true }
    )
  }
  lastMonsterHP = sessionData.currentHP

  updateHpBar(sessionData.currentHP, sessionData.maxHP || monster.hp)
  updateTimerDisplay(sessionData.timerValue)
  updateBattleLog(sessionData.battleLog || ["Battle Started!"])
  switchScreen("battle")
}

function updateHpBar(currentHP, maxHP) {
  const percentage = maxHP > 0 ? (currentHP / maxHP) * 100 : 0
  monsterHpBar.style.width = `${Math.max(0, percentage)}%`
  monsterHpBar.textContent = `${Math.max(0, Math.round(currentHP))}/${maxHP}`
}

function updateTimerDisplay(seconds) {
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  timerDisplay.textContent = `${minutes}:${
    remainingSeconds < 10 ? "0" : ""
  }${remainingSeconds}`
}

function updateBattleLog(logEntries) {
  battleLogContent.innerHTML = "" // Clear existing log
  if (Array.isArray(logEntries)) {
    logEntries.forEach((entry) => {
      const p = document.createElement("p")
      p.textContent = entry
      battleLogContent.appendChild(p)
    })
    battleLogContent.scrollTop = battleLogContent.scrollHeight // Scroll to bottom
  }
}

function renderResultScreen(outcomeData) {
  console.log("Rendering result screen with outcome:", outcomeData)

  if (!outcomeData) {
    console.error("No outcome data provided to renderResultScreen")
    renderMonsterSelectionScreen()
    return
  }

  // Set result message
  if (outcomeData.result === "victory") {
    resultMessage.innerHTML = `🎉 Victory!`
    if (outcomeData.monsterDefeatedName) {
      resultMessage.innerHTML += `<br>You defeated ${outcomeData.monsterDefeatedName}!`
    }
  } else {
    resultMessage.innerHTML = `😞 Defeat!`
  }

  // Set XP earned
  xpEarnedDisplay.textContent = `XP Earned: ${outcomeData.xpEarned || 0}`

  // Set stats display
  let statsHTML = ""
  if (outcomeData.pomodoroCompleted) {
    statsHTML += `<p><strong>Pomodoro Completed!</strong> ✅</p>`
  }
  if (outcomeData.totalPomodoros !== undefined) {
    statsHTML += `<p><strong>Total Pomodoros:</strong> ${outcomeData.totalPomodoros}</p>`
  }
  if (outcomeData.currentXP !== undefined) {
    statsHTML += `<p><strong>Total XP:</strong> ${outcomeData.currentXP}</p>`
  }
  if (outcomeData.currentStreak !== undefined) {
    statsHTML += `<p><strong>Current Streak:</strong> ${outcomeData.currentStreak}</p>`
  }

  statsDisplayContent.innerHTML = statsHTML

  // Ensure buttons are visible
  startAnotherSessionBtn.style.display = "block"
  startAnotherSessionBtn.textContent = "Start Another Session"

  switchScreen("result")
}

// --- Event Handlers ---

// Show confirmation modal when user clicks 'End Session Early'
endSessionEarlyBtn.addEventListener("click", () => {
  endSessionModal.style.display = "flex"
})

// Hide modal on cancel
cancelEndSessionBtn.addEventListener("click", () => {
  endSessionModal.style.display = "none"
})

// Handle confirm end session
confirmEndSessionBtn.addEventListener("click", async () => {
  endSessionModal.style.display = "none"
  // End session as abandoned
  try {
    const response = await chrome.runtime.sendMessage({
      action: "endSessionEarly",
    })
    // Track abandoned sessions in localStorage
    let abandoned = parseInt(
      localStorage.getItem("abandonedSessions") || "0",
      10
    )
    localStorage.setItem("abandonedSessions", abandoned + 1)
    // Optionally track monster and time left
    if (currentSession) {
      localStorage.setItem("lastAbandonedMonster", currentSession.monsterId)
      localStorage.setItem("lastAbandonedTimeLeft", currentSession.timerValue)
      localStorage.setItem(
        "lastAbandonedDistractions",
        (currentSession.battleLog || []).some((e) =>
          e.startsWith("Distracted!")
        )
          ? "yes"
          : "no"
      )
    }
    // Show custom abandon result
    renderAbandonResultScreen()
  } catch (error) {
    console.error("Error sending endSessionEarly message:", error)
  }
})

function renderAbandonResultScreen() {
  // Custom abandon result
  const monster = currentSession ? MONSTERS[currentSession.monsterId] : null
  resultMessage.innerHTML = `😔 You fled the battle...`
  xpEarnedDisplay.textContent = `No XP earned.`
  let monsterMsg = monster
    ? `${monster.name} devours your focus and lives to distract you another day.`
    : "The monster lives to distract you another day."
  statsDisplayContent.innerHTML = `<p>${monsterMsg}</p>`
  // Show both options
  startAnotherSessionBtn.textContent = "Start New Session"
  startAnotherSessionBtn.style.display = "block"
  // Add a Return to Monster Select button if not present
  let returnBtn = document.getElementById("return-to-select-btn")
  if (!returnBtn) {
    returnBtn = document.createElement("button")
    returnBtn.id = "return-to-select-btn"
    returnBtn.textContent = "Return to Monster Select"
    returnBtn.onclick = () => renderMonsterSelectionScreen()
    statsDisplayContent.appendChild(returnBtn)
  }
  switchScreen("result")
}

function handleStartAnotherSession() {
  // Force cleanup of any stuck session state
  chrome.runtime.sendMessage({ action: "forceCleanup" }, (response) => {
    console.log("Force cleanup response:", response)
  })

  chrome.storage.local.remove(["currentSession", "sessionOutcome"], () => {
    console.log("Cleared session data, returning to monster selection.")
    selectedMonsterId = null
    currentSession = null // Clear local session cache
    lastMonsterHP = null // Reset animation tracking
    startSessionBtn.disabled = true // Ensure it's disabled before selection
    // Clear other UI elements that might persist visually
    monsterCardsContainer
      .querySelectorAll(".monster-card")
      .forEach((card) => card.classList.remove("selected"))
    renderMonsterSelectionScreen()
  })
}

// --- Event Listeners ---
startSessionBtn.addEventListener("click", handleStartSession)
startAnotherSessionBtn.addEventListener("click", handleStartAnotherSession)

// Listen for updates from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Popup received message:", message)
  if (message.action === "updatePopupBattleState") {
    if (SCREENS.battle.classList.contains("active")) {
      // Only update if battle screen is visible
      currentSession = message.sessionData // Update local cache of session
      renderBattleScreen(message.sessionData)
    }
  } else if (message.action === "sessionEnded") {
    // Background has determined the session outcome
    renderResultScreen(message.outcomeData)
  }
  return true // Keep the message channel open for asynchronous response if needed
})

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  // Check current state from chrome.storage.local to determine which screen to show
  try {
    // First, get the current popup state from background
    const backgroundResponse = await chrome.runtime.sendMessage({
      action: "getPopupState",
    })
    console.log("Background popup state:", backgroundResponse)

    if (backgroundResponse.status === "sessionEnded") {
      renderResultScreen(backgroundResponse.outcomeData)
    } else if (backgroundResponse.status === "sessionActive") {
      currentSession = backgroundResponse.sessionData
      renderBattleScreen(currentSession)
    } else {
      // No active session or outcome, show monster selection
      renderMonsterSelectionScreen()
    }
  } catch (error) {
    console.error("Error getting popup state from background:", error)
    // Fallback: check storage directly
    try {
      const data = await chrome.storage.local.get([
        "currentSession",
        "sessionOutcome",
      ])
      console.log("Fallback storage data:", data)

      if (data.sessionOutcome) {
        renderResultScreen(data.sessionOutcome)
      } else if (data.currentSession && data.currentSession.isActive) {
        currentSession = data.currentSession
        renderBattleScreen(currentSession)
      } else {
        renderMonsterSelectionScreen()
      }
    } catch (storageError) {
      console.error("Error accessing storage:", storageError)
      renderMonsterSelectionScreen()
    }
  }
})

console.log("Popup script fully loaded and initialized.")
