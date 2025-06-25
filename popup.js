// --- Constants and Data ---
let MONSTERS = {}
let XP_CONFIG = {}

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

// Load XP configuration from JSON file
async function loadXPConfig() {
  try {
    const response = await fetch("./xp-config.json")
    XP_CONFIG = await response.json()
    console.log("XP Config loaded:", XP_CONFIG)
  } catch (error) {
    console.error("Error loading XP config:", error)
    XP_CONFIG = null
  }
}

const SCREENS = {
  hubTown: document.getElementById("hub-town-screen"),
  battle: document.getElementById("battle-screen"),
  result: document.getElementById("result-screen"),
}

// XP and Level Constants - now loaded from config

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
const userTitleElement = document.getElementById("user-title")
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

// --- XP System Functions ---

function calculateLevel(totalXP) {
  if (!XP_CONFIG || !XP_CONFIG.levelCurve) return XP_CONFIG.defaults.level
  let level = 1
  while (getXPRequiredForLevel(level) <= totalXP) {
    level++
  }
  return level - 1
}

function getXPRequiredForLevel(level) {
  if (!XP_CONFIG || !XP_CONFIG.levelCurve)
    return XP_CONFIG.defaults.xpRequiredForLevel
  return Math.floor(
    XP_CONFIG.levelCurve.baseXP * Math.pow(level, XP_CONFIG.levelCurve.exponent)
  )
}

function calculateXPForCurrentLevel(totalXP) {
  const currentLevel = calculateLevel(totalXP)
  const xpForCurrentLevel = getXPRequiredForLevel(currentLevel)
  return totalXP - xpForCurrentLevel
}

function calculateXPForNextLevel(totalXP) {
  const currentLevel = calculateLevel(totalXP)
  const xpForNextLevel = getXPRequiredForLevel(currentLevel + 1)
  const xpForCurrentLevel = getXPRequiredForLevel(currentLevel)
  return xpForNextLevel - xpForCurrentLevel
}

function getUserTitle(level) {
  if (!XP_CONFIG || !XP_CONFIG.titles) return XP_CONFIG.defaults.title

  // Find the highest title that the user qualifies for
  let userTitle = XP_CONFIG.titles["1"]

  Object.entries(XP_CONFIG.titles).forEach(([reqLevel, title]) => {
    if (level >= parseInt(reqLevel)) {
      userTitle = title
    }
  })

  return userTitle
}

function calculateStreakMultiplier(streakDays) {
  if (!XP_CONFIG || !XP_CONFIG.streakMultiplier)
    return XP_CONFIG.defaults.streakMultiplier
  const multiplier = 1 + streakDays * XP_CONFIG.streakMultiplier.perDay
  return Math.min(multiplier, XP_CONFIG.streakMultiplier.maxMultiplier)
}

function generateFocusCrit() {
  if (!XP_CONFIG || !XP_CONFIG.modifiers) return XP_CONFIG.defaults.focusCrit
  const min = XP_CONFIG.modifiers.minFocusCrit
  const max = XP_CONFIG.modifiers.maxFocusCrit
  return Math.random() * (max - min) + min
}

function calculateMonsterBaseXP(monsterId) {
  if (!XP_CONFIG || !XP_CONFIG.base || !MONSTERS)
    return XP_CONFIG.defaults.baseXP

  const monster = MONSTERS[monsterId]
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

function calculateSessionXP(sessionData) {
  if (!XP_CONFIG || !XP_CONFIG.base || !XP_CONFIG.modifiers)
    return XP_CONFIG.defaults.sessionXP

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
  const todayPomodoros = getTodayPomodoros()
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

function showXPFeedback(message, isLevelUp = false) {
  // Create a feedback element
  const feedback = document.createElement("div")
  feedback.className = isLevelUp ? "xp-feedback level-up" : "xp-feedback"
  feedback.textContent = message

  // Add to the current screen
  const activeScreen = document.querySelector(".screen.active")
  if (activeScreen) {
    activeScreen.appendChild(feedback)

    // Trigger animation
    setTimeout(() => feedback.classList.add("show"), 10)

    // Remove after animation
    setTimeout(
      () => {
        feedback.classList.add("fade-out")
        setTimeout(() => feedback.remove(), 500)
      },
      isLevelUp ? 3000 : 2000
    )
  }
}

function animateXPBar(startXP, endXP, totalXP) {
  const currentLevel = calculateLevel(startXP)
  const newLevel = calculateLevel(endXP)

  // Animate XP bar
  const startCurrentXP = calculateXPForCurrentLevel(startXP)
  const endCurrentXP = calculateXPForCurrentLevel(endXP)
  const maxXPForLevel = calculateXPForNextLevel(startXP)

  let progress = 0
  const duration = 1000 // 1 second
  const stepTime = 16 // ~60fps
  const steps = duration / stepTime

  const animate = () => {
    progress++
    const ratio = progress / steps

    if (ratio <= 1) {
      const currentXP = startCurrentXP + (endCurrentXP - startCurrentXP) * ratio
      const percentage = (currentXP / maxXPForLevel) * 100

      xpBarElement.style.width = `${Math.min(100, percentage)}%`
      xpTextElement.textContent = `${Math.floor(
        currentXP
      )} / ${maxXPForLevel} XP`

      requestAnimationFrame(animate)
    } else {
      // Final update
      updateXPDisplay(endXP)

      // Check for level up
      if (newLevel > currentLevel) {
        triggerLevelUpAnimation(newLevel)
      }
    }
  }

  animate()
}

function triggerLevelUpAnimation(newLevel) {
  const title = getUserTitle(newLevel)

  // Add explosion effect to XP bar
  xpBarElement.classList.add("level-up-explosion")
  setTimeout(() => xpBarElement.classList.remove("level-up-explosion"), 1000)

  // Show level up message
  showXPFeedback(XP_CONFIG.feedback.levelUp.replace("{title}", title), true)

  // Update level badge with animation
  levelBadgeElement.classList.add("level-up-pulse")
  levelBadgeElement.textContent = `Level ${newLevel}`
  setTimeout(() => levelBadgeElement.classList.remove("level-up-pulse"), 1000)

  // Update title
  userTitleElement.textContent = title
}

function updateXPDisplay(totalXP) {
  const level = calculateLevel(totalXP)
  const currentXP = calculateXPForCurrentLevel(totalXP)
  const maxXP = calculateXPForNextLevel(totalXP)
  const percentage = (currentXP / maxXP) * 100

  xpBarElement.style.width = `${percentage}%`
  xpTextElement.textContent = `${currentXP} / ${maxXP} XP`
  levelBadgeElement.textContent = `Level ${level}`

  // Update title
  const title = getUserTitle(level)
  userTitleElement.textContent = title
}

// --- Helper Functions ---

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

  // Update XP and level display
  updateXPDisplay(stats.currentXP)

  // Update stats
  totalPomodorosElement.textContent = stats.totalPomodoros
  const streakText =
    stats.currentStreak > 0
      ? `🔥 ${stats.currentStreak}`
      : `💤 ${stats.currentStreak}`
  currentStreakElement.textContent = streakText

  // Update today's stats
  todayPomodorosElement.textContent = getTodayPomodoros()
  mostDefeatedMonsterElement.textContent = getMostDefeatedMonster(
    stats.monstersDefeated
  )

  // Update session history
  const history = getRecentSessionHistory()
  streakIndicatorsElement.innerHTML = ""
  history.forEach((session, index) => {
    const indicator = document.createElement("span")
    indicator.className = `session-indicator ${
      session.success ? "success" : "failure"
    }`
    indicator.textContent = session.success ? "✅" : "❌"
    indicator.title = `Session ${index + 1}: ${
      session.success ? "Victory" : "Defeat"
    }`
    streakIndicatorsElement.appendChild(indicator)
  })

  // Fill remaining slots with placeholder
  for (let i = history.length; i < 5; i++) {
    const placeholder = document.createElement("span")
    placeholder.className = "session-indicator placeholder"
    placeholder.textContent = "⬜"
    placeholder.title = "No session"
    streakIndicatorsElement.appendChild(placeholder)
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

      // Calculate duration in minutes for display
      const durationMinutes = Math.round(monster.hp / 60)

      card.innerHTML = `
        <img src="${monster.icon}" alt="${monster.name}" class="monster-icon">
        <div class="monster-details">
          <strong>${monster.name}</strong>
          <p>${monster.description}</p>
          <small style="color: #888; margin-top: 4px; display: block;">HP: ${monster.hp}</small>
          <small style="color: #888; margin-top: 4px; display: block;">Duration: ${durationMinutes} min</small>
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
      sessionDuration: monster.hp, // Duration in seconds = monster HP
    })
    console.log("Background response to startSession:", response)
    if (response && response.status === "sessionStarted") {
      currentSession = {
        monsterId: selectedMonsterId,
        monsterName: monster.name,
        monsterIcon: monster.icon,
        currentHP: monster.hp,
        maxHP: monster.hp,
        timerValue: monster.hp,
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

  // Enhanced XP display with bonuses
  let xpHTML = `<div class="xp-breakdown">`

  if (outcomeData.xpBreakdown) {
    xpHTML += `<div class="base-xp">Base XP: ${outcomeData.xpBreakdown.baseXP}</div>`

    if (
      outcomeData.xpBreakdown.bonuses &&
      outcomeData.xpBreakdown.bonuses.length > 0
    ) {
      xpHTML += `<div class="xp-bonuses">`
      outcomeData.xpBreakdown.bonuses.forEach((bonus) => {
        xpHTML += `<div class="xp-bonus">${bonus.message}</div>`
      })
      xpHTML += `</div>`
    }

    xpHTML += `<div class="total-xp"><strong>Total XP Earned: ${outcomeData.xpEarned}</strong></div>`
  } else {
    xpHTML += `<div class="total-xp">XP Earned: ${
      outcomeData.xpEarned ?? XP_CONFIG.defaults.xpEarned
    }</div>`
  }

  xpHTML += `</div>`
  xpEarnedDisplay.innerHTML = xpHTML

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
    const title = getUserTitle(level)
    statsHTML += `<p><strong>Total XP:</strong> ${outcomeData.currentXP} (Level ${level})</p>`
    statsHTML += `<p><strong>Title:</strong> ${title}</p>`
  }
  if (outcomeData.currentStreak !== undefined) {
    statsHTML += `<p><strong>Current Streak:</strong> ${outcomeData.currentStreak}</p>`
  }

  statsDisplayContent.innerHTML = statsHTML
  startAnotherSessionBtn.style.display = "block"
  startAnotherSessionBtn.textContent = "Return to Hub Town"

  // Animate XP gain if we have previous XP data
  if (
    outcomeData.previousXP !== undefined &&
    outcomeData.currentXP !== undefined
  ) {
    setTimeout(() => {
      animateXPBar(outcomeData.previousXP, outcomeData.currentXP)
    }, 500)

    // Show XP feedback messages
    if (outcomeData.xpBreakdown && outcomeData.xpBreakdown.bonuses) {
      outcomeData.xpBreakdown.bonuses.forEach((bonus, index) => {
        setTimeout(() => {
          showXPFeedback(bonus.message)
        }, 1000 + index * 500)
      })
    }
  }

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
  // Load monsters and XP config first
  await Promise.all([loadMonsters(), loadXPConfig()])

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
