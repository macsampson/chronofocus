// --- Constants and Data ---
let MONSTERS = {}

// Load monsters from JSON file
async function loadMonsters() {
  try {
    const response = await fetch("./monsters.json")
    MONSTERS = await response.json()
    console.log("Monsters loaded:", MONSTERS)
  } catch (error) {
    console.error("Error loading monsters:", error)
    // No fallback - just empty object to trigger error display
    MONSTERS = {}
  }
}

const SCREENS = {
  hubTown: document.getElementById("hub-town-screen"),
  battle: document.getElementById("battle-screen"),
  result: document.getElementById("result-screen"),
}

// XP and Level Constants
const XP_PER_LEVEL = 500
const XP_PER_POMODORO = 50

// --- State ---
let selectedMonsterId = null
let currentSession = null
let userStats = null

// Track last monster HP for attack animation
let lastMonsterHP = null

// --- UI Elements ---
const monsterCardsContainer = document.getElementById("monster-cards-container")
const startSessionBtn = document.getElementById("start-session-btn")
const endSessionEarlyBtn = document.getElementById("end-session-early-btn")
const startAnotherSessionBtn = document.getElementById(
  "start-another-session-btn"
)

// Hub Town Elements
const usernameElement = document.getElementById("username")
const userAvatarElement = document.getElementById("user-avatar")
const xpBarElement = document.getElementById("xp-bar")
const xpTextElement = document.getElementById("xp-text")
const levelBadgeElement = document.getElementById("level-badge")
const totalPomodorosElement = document.getElementById("total-pomodoros")
const currentStreakElement = document.getElementById("current-streak")
const todayPomodorosElement = document.getElementById("today-pomodoros")
const mostDefeatedMonsterElement = document.getElementById(
  "most-defeated-monster"
)
const streakIndicatorsElement = document.getElementById("streak-indicators")

// Battle Elements
const timerDisplay = document.getElementById("timer-display")
const monsterHpBar = document.getElementById("monster-hp-bar")
const battleMonsterName = document.getElementById("battle-monster-name")
const battleMonsterIcon = document.getElementById("battle-monster-icon")
const battleLogContent = document.getElementById("battle-log-content")

// Result Elements
const resultMessage = document.getElementById("result-message")
const xpEarnedDisplay = document.getElementById("xp-earned-display")
const statsDisplayContent = document.getElementById("stats-display-content")

// Modal Elements
const endSessionModal = document.getElementById("end-session-modal")
const cancelEndSessionBtn = document.getElementById("cancel-end-session-btn")
const confirmEndSessionBtn = document.getElementById("confirm-end-session-btn")

// --- Helper Functions ---

function calculateLevel(totalXP) {
  return Math.floor(totalXP / XP_PER_LEVEL) + 1
}

function calculateXPForCurrentLevel(totalXP) {
  return totalXP % XP_PER_LEVEL
}

function calculateXPForNextLevel() {
  return XP_PER_LEVEL
}

function generateUsername() {
  const adjectives = [
    "Focused",
    "Determined",
    "Mighty",
    "Swift",
    "Brave",
    "Wise",
    "Noble",
  ]
  const nouns = [
    "Warrior",
    "Guardian",
    "Champion",
    "Hero",
    "Knight",
    "Defender",
    "Master",
  ]
  return `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${
    nouns[Math.floor(Math.random() * nouns.length)]
  }`
}

function getMostDefeatedMonster(monstersDefeated) {
  if (!monstersDefeated) return "None"

  let maxDefeated = 0
  let mostDefeated = "None"

  Object.entries(monstersDefeated).forEach(([monsterId, count]) => {
    if (count > maxDefeated) {
      maxDefeated = count
      mostDefeated = MONSTERS[monsterId]?.name || monsterId
    }
  })

  return mostDefeated
}

function getTodayPomodoros() {
  const today = new Date().toDateString()
  const todayPomodoros = parseInt(
    localStorage.getItem(`pomodoros_${today}`) || "0",
    10
  )
  return todayPomodoros
}

function updateTodayPomodoros() {
  const today = new Date().toDateString()
  const currentCount = getTodayPomodoros()
  localStorage.setItem(`pomodoros_${today}`, currentCount + 1)
}

function getRecentSessionHistory() {
  // Get last 5 sessions from localStorage
  const history = JSON.parse(localStorage.getItem("sessionHistory") || "[]")
  return history.slice(-5).reverse()
}

function addToSessionHistory(success) {
  const history = JSON.parse(localStorage.getItem("sessionHistory") || "[]")
  history.push({ date: Date.now(), success })

  // Keep only last 20 sessions
  if (history.length > 20) {
    history.splice(0, history.length - 20)
  }

  localStorage.setItem("sessionHistory", JSON.stringify(history))
}

// --- Functions ---

function switchScreen(screenName) {
  Object.values(SCREENS).forEach((screen) => screen.classList.remove("active"))
  if (SCREENS[screenName]) {
    SCREENS[screenName].classList.add("active")
  } else {
    console.error("Screen not found:", screenName)
  }
}

async function loadUserStats() {
  try {
    const data = await chrome.storage.local.get(["userStats"])
    userStats = data.userStats || {
      monstersDefeated: { scrollfiend: 0, tubewyrm: 0, tabberwock: 0 },
      totalPomodoros: 0,
      currentXP: 0,
      currentStreak: 0,
    }
    return userStats
  } catch (error) {
    console.error("Error loading user stats:", error)
    return {
      monstersDefeated: { scrollfiend: 0, tubewyrm: 0, tabberwock: 0 },
      totalPomodoros: 0,
      currentXP: 0,
      currentStreak: 0,
    }
  }
}

function updateHubTownDisplay(stats) {
  // Update username (generate if not stored)
  let username = localStorage.getItem("username")
  if (!username) {
    username = generateUsername()
    localStorage.setItem("username", username)
  }
  usernameElement.textContent = username

  // Update level and XP
  const currentLevel = calculateLevel(stats.currentXP)
  const currentLevelXP = calculateXPForCurrentLevel(stats.currentXP)
  const nextLevelXP = calculateXPForNextLevel()

  levelBadgeElement.textContent = `Level ${currentLevel}`
  xpTextElement.textContent = `${currentLevelXP} / ${nextLevelXP} XP`

  // Animate XP bar
  const xpPercentage = (currentLevelXP / nextLevelXP) * 100
  setTimeout(() => {
    xpBarElement.style.width = `${xpPercentage}%`
  }, 100)

  // Update stats
  totalPomodorosElement.textContent = stats.totalPomodoros
  currentStreakElement.innerHTML =
    stats.currentStreak > 0 ? `🔥 ${stats.currentStreak}` : `💤 0`

  // Update today's stats
  const todayPomodoros = getTodayPomodoros()
  todayPomodorosElement.textContent = todayPomodoros

  // Update most defeated monster
  const mostDefeated = getMostDefeatedMonster(stats.monstersDefeated)
  mostDefeatedMonsterElement.textContent = mostDefeated

  // Update session history
  const history = getRecentSessionHistory()
  streakIndicatorsElement.innerHTML = ""

  if (history.length === 0) {
    // Default placeholder if no history
    for (let i = 0; i < 5; i++) {
      const indicator = document.createElement("span")
      indicator.className = "session-indicator"
      indicator.textContent = "⚪"
      streakIndicatorsElement.appendChild(indicator)
    }
  } else {
    // Fill remaining slots with placeholders
    const remaining = 5 - history.length
    for (let i = 0; i < remaining; i++) {
      const indicator = document.createElement("span")
      indicator.className = "session-indicator"
      indicator.textContent = "⚪"
      streakIndicatorsElement.appendChild(indicator)
    }

    // Add actual history
    history.forEach((session) => {
      const indicator = document.createElement("span")
      indicator.className = `session-indicator ${
        session.success ? "success" : "fail"
      }`
      indicator.textContent = session.success ? "✅" : "❌"
      streakIndicatorsElement.appendChild(indicator)
    })
  }
}

async function renderHubTownScreen() {
  // Ensure monsters are loaded before rendering
  if (Object.keys(MONSTERS).length === 0) {
    await loadMonsters()
  }

  const stats = await loadUserStats()
  updateHubTownDisplay(stats)

  monsterCardsContainer.innerHTML = ""

  // Check if monsters loaded successfully
  if (Object.keys(MONSTERS).length === 0) {
    // Display error message
    const errorCard = document.createElement("div")
    errorCard.classList.add("monster-card")
    errorCard.style.textAlign = "center"
    errorCard.style.color = "#e74c3c"
    errorCard.style.border = "2px solid #e74c3c"
    errorCard.innerHTML = `
      <div class="monster-details" style="text-align: center;">
        <strong>❌ Error Loading Monsters</strong>
        <p>Could not load monster data. Please check the monsters.json file.</p>
      </div>
    `
    monsterCardsContainer.appendChild(errorCard)
    startSessionBtn.disabled = true
  } else {
    // Render monsters normally
    Object.values(MONSTERS).forEach((monster) => {
      const card = document.createElement("div")
      card.classList.add("monster-card")
      card.dataset.monsterId = monster.id
      card.innerHTML = `
        <img src="${monster.icon}" alt="${monster.name}" class="monster-icon">
        <div class="monster-details">
          <strong>${monster.name}</strong>
          <p>${monster.description}</p>
          <small style="color: #888; margin-top: 4px; display: block;">HP: ${monster.hp}</small>
        </div>
      `
      card.addEventListener("click", () => selectMonster(monster.id, card))
      monsterCardsContainer.appendChild(card)
    })
  }

  switchScreen("hubTown")
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
      monsterHP: monster.hp,
      sessionDuration: 25 * 60, // 25 minutes in seconds
    })
    console.log("Background response to startSession:", response)
    if (response && response.status === "sessionStarted") {
      currentSession = {
        monsterId: selectedMonsterId,
        monsterName: monster.name,
        monsterIcon: monster.icon,
        currentHP: monster.hp,
        maxHP: monster.hp,
        timerValue: 25 * 60,
        battleLog: ["Session started! Focus!"],
      }
      renderBattleScreen(currentSession)
    } else {
      console.error("Failed to start session via background script:", response)
    }
  } catch (error) {
    console.error("Error sending startSession message:", error)
    if (
      error.message.includes("Could not establish connection") ||
      error.message.includes("Receiving end does not exist")
    ) {
      alert(
        "ChronoFocus background service is not ready. Please try again in a moment, or ensure the extension is enabled correctly."
      )
    }
  }
}

function renderBattleScreen(sessionData) {
  console.log("Rendering battle screen with data:", sessionData)
  if (!sessionData || !MONSTERS[sessionData.monsterId]) {
    console.error("Invalid session data for battle screen:", sessionData)
    renderHubTownScreen()
    alert("Error: Could not load session data. Please try again.")
    return
  }
  const monster = MONSTERS[sessionData.monsterId]
  battleMonsterName.textContent = `Battling ${monster.name}`
  battleMonsterIcon.src = monster.icon

  // Attack Animation Logic
  if (lastMonsterHP !== null && sessionData.currentHP < lastMonsterHP) {
    battleMonsterIcon.classList.remove("monster-attack-anim")
    void battleMonsterIcon.offsetWidth
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
  battleLogContent.innerHTML = ""
  if (Array.isArray(logEntries)) {
    logEntries.forEach((entry) => {
      const p = document.createElement("p")
      p.textContent = entry
      battleLogContent.appendChild(p)
    })
    battleLogContent.scrollTop = battleLogContent.scrollHeight
  }
}

function renderResultScreen(outcomeData) {
  console.log("Rendering result screen with outcome:", outcomeData)

  if (!outcomeData) {
    console.error("No outcome data provided to renderResultScreen")
    renderHubTownScreen()
    return
  }

  // Update session history
  const success = outcomeData.result === "victory"
  addToSessionHistory(success)

  // Update today's pomodoros if successful
  if (success) {
    updateTodayPomodoros()
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
    const level = calculateLevel(outcomeData.currentXP)
    statsHTML += `<p><strong>Total XP:</strong> ${outcomeData.currentXP} (Level ${level})</p>`
  }
  if (outcomeData.currentStreak !== undefined) {
    statsHTML += `<p><strong>Current Streak:</strong> ${outcomeData.currentStreak}</p>`
  }

  statsDisplayContent.innerHTML = statsHTML
  startAnotherSessionBtn.style.display = "block"
  startAnotherSessionBtn.textContent = "Return to Hub Town"

  switchScreen("result")
}

// --- Event Handlers ---

endSessionEarlyBtn.addEventListener("click", () => {
  endSessionModal.style.display = "flex"
})

cancelEndSessionBtn.addEventListener("click", () => {
  endSessionModal.style.display = "none"
})

confirmEndSessionBtn.addEventListener("click", async () => {
  endSessionModal.style.display = "none"
  try {
    const response = await chrome.runtime.sendMessage({
      action: "endSessionEarly",
    })

    // Track session as failed
    addToSessionHistory(false)

    let abandoned = parseInt(
      localStorage.getItem("abandonedSessions") || "0",
      10
    )
    localStorage.setItem("abandonedSessions", abandoned + 1)

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
    renderAbandonResultScreen()
  } catch (error) {
    console.error("Error sending endSessionEarly message:", error)
  }
})

function renderAbandonResultScreen() {
  const monster = currentSession ? MONSTERS[currentSession.monsterId] : null
  resultMessage.innerHTML = `😔 You fled the battle...`
  xpEarnedDisplay.textContent = `No XP earned.`
  let monsterMsg = monster
    ? `${monster.name} devours your focus and lives to distract you another day.`
    : "The monster lives to distract you another day."
  statsDisplayContent.innerHTML = `<p>${monsterMsg}</p>`

  startAnotherSessionBtn.textContent = "Return to Hub Town"
  startAnotherSessionBtn.style.display = "block"

  let returnBtn = document.getElementById("return-to-select-btn")
  if (!returnBtn) {
    returnBtn = document.createElement("button")
    returnBtn.id = "return-to-select-btn"
    returnBtn.textContent = "Try Again"
    returnBtn.onclick = () => renderHubTownScreen()
    statsDisplayContent.appendChild(returnBtn)
  }
  switchScreen("result")
}

function handleStartAnotherSession() {
  chrome.runtime.sendMessage({ action: "forceCleanup" }, (response) => {
    console.log("Force cleanup response:", response)
  })

  chrome.storage.local.remove(["currentSession", "sessionOutcome"], () => {
    console.log("Cleared session data, returning to hub town.")
    selectedMonsterId = null
    currentSession = null
    lastMonsterHP = null
    startSessionBtn.disabled = true

    monsterCardsContainer
      .querySelectorAll(".monster-card")
      .forEach((card) => card.classList.remove("selected"))
    renderHubTownScreen()
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
      currentSession = message.sessionData
      renderBattleScreen(message.sessionData)
    }
  } else if (message.action === "sessionEnded") {
    renderResultScreen(message.outcomeData)
  }
  return true
})

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  // Load monsters first
  await loadMonsters()

  try {
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
      renderHubTownScreen()
    }
  } catch (error) {
    console.error("Error getting popup state from background:", error)
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
        renderHubTownScreen()
      }
    } catch (storageError) {
      console.error("Error accessing storage:", storageError)
      renderHubTownScreen()
    }
  }
})

console.log("ChronoFocus popup script fully loaded and initialized.")
