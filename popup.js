// --- Constants and Data ---
const MONSTERS = {
  scrollfiend: {
    id: 'scrollfiend',
    name: 'Scrollfiend',
    icon: 'assets/scrollfiend.png',
    description: 'Represents endless scrolling on social media.',
    hp: 100,
  },
  tubewyrm: {
    id: 'tubewyrm',
    name: 'Tubewyrm',
    icon: 'assets/tubewyrm.png',
    description: 'Symbolizes video binges and streaming traps.',
    hp: 100,
  },
  tabberwock: {
    id: 'tabberwock',
    name: 'Tabberwock',
    icon: 'assets/tabberwock.png',
    description: 'The beast of excessive tab-hopping and context switching.',
    hp: 100,
  },
};

const SCREENS = {
  monsterSelection: document.getElementById('monster-selection-screen'),
  battle: document.getElementById('battle-screen'),
  result: document.getElementById('result-screen'),
};

// --- State ---
let selectedMonsterId = null;
let currentSession = null; // Stores { monsterId, startTime, monsterHP, timerValue }

// --- UI Elements ---
const monsterCardsContainer = document.getElementById('monster-cards-container');
const startSessionBtn = document.getElementById('start-session-btn');
const endSessionEarlyBtn = document.getElementById('end-session-early-btn');
const startAnotherSessionBtn = document.getElementById('start-another-session-btn');

const timerDisplay = document.getElementById('timer-display');
const monsterHpBar = document.getElementById('monster-hp-bar');
const battleMonsterName = document.getElementById('battle-monster-name');
const battleMonsterIcon = document.getElementById('battle-monster-icon');
const battleLogContent = document.getElementById('battle-log-content');

const resultMessage = document.getElementById('result-message');
const xpEarnedDisplay = document.getElementById('xp-earned-display');
const statsDisplayContent = document.getElementById('stats-display-content');


// --- Functions ---

function switchScreen(screenName) {
  Object.values(SCREENS).forEach(screen => screen.classList.remove('active'));
  if (SCREENS[screenName]) {
    SCREENS[screenName].classList.add('active');
  } else {
    console.error("Screen not found:", screenName);
  }
}

function renderMonsterSelectionScreen() {
  monsterCardsContainer.innerHTML = ''; // Clear previous cards
  Object.values(MONSTERS).forEach(monster => {
    const card = document.createElement('div');
    card.classList.add('monster-card');
    card.dataset.monsterId = monster.id;
    card.innerHTML = `
      <img src="${monster.icon}" alt="${monster.name}" class="monster-icon">
      <div class="monster-details">
        <strong>${monster.name}</strong>
        <p>${monster.description}</p>
      </div>
    `;
    card.addEventListener('click', () => selectMonster(monster.id, card));
    monsterCardsContainer.appendChild(card);
  });
  switchScreen('monsterSelection');
}

function selectMonster(monsterId, cardElement) {
  selectedMonsterId = monsterId;
  // Update UI to show selection
  document.querySelectorAll('.monster-card').forEach(card => card.classList.remove('selected'));
  cardElement.classList.add('selected');
  startSessionBtn.disabled = false;
  console.log('Selected monster:', monsterId);
}

async function handleStartSession() {
  if (!selectedMonsterId) return;

  const monster = MONSTERS[selectedMonsterId];
  console.log('Starting session with:', monster.name);

  // Send message to background script to start the session
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'startSession',
      monsterId: selectedMonsterId,
      monsterHP: monster.hp, // Initial HP
      sessionDuration: 25 * 60 // 25 minutes in seconds
    });
    console.log('Background response to startSession:', response);
    if (response && response.status === 'sessionStarted') {
      currentSession = { // Store initial session state locally for UI
        monsterId: selectedMonsterId,
        monsterName: monster.name,
        monsterIcon: monster.icon,
        currentHP: monster.hp,
        maxHP: monster.hp,
        timerValue: 25 * 60, // in seconds
        battleLog: ["Session started! Focus!"]
      };
      renderBattleScreen(currentSession);
    } else {
      console.error('Failed to start session via background script:', response);
      // Show error to user?
    }
  } catch (error) {
    console.error('Error sending startSession message:', error);
    // Handle cases where background script might not be ready or an error occurs
    if (error.message.includes("Could not establish connection") || error.message.includes("Receiving end does not exist")) {
        alert("FocusForge background service is not ready. Please try again in a moment, or ensure the extension is enabled correctly.");
    }
  }
}

function renderBattleScreen(sessionData) {
  console.log("Rendering battle screen with data:", sessionData);
  if (!sessionData || !MONSTERS[sessionData.monsterId]) {
    console.error("Invalid session data for battle screen:", sessionData);
    // Potentially switch back to monster selection or show an error
    renderMonsterSelectionScreen(); // Fallback
    alert("Error: Could not load session data. Please try again.");
    return;
  }
  const monster = MONSTERS[sessionData.monsterId];
  battleMonsterName.textContent = `Battling ${monster.name}`;
  battleMonsterIcon.src = monster.icon;
  updateHpBar(sessionData.currentHP, sessionData.maxHP || monster.hp);
  updateTimerDisplay(sessionData.timerValue);
  updateBattleLog(sessionData.battleLog || ["Battle Started!"]);
  switchScreen('battle');
}

function updateHpBar(currentHP, maxHP) {
  const percentage = maxHP > 0 ? (currentHP / maxHP) * 100 : 0;
  monsterHpBar.style.width = `${Math.max(0, percentage)}%`;
  monsterHpBar.textContent = `${Math.max(0, Math.round(currentHP))}/${maxHP}`;
}

function updateTimerDisplay(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  timerDisplay.textContent = `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function updateBattleLog(logEntries) {
    battleLogContent.innerHTML = ''; // Clear existing log
    if (Array.isArray(logEntries)) {
        logEntries.forEach(entry => {
            const p = document.createElement('p');
            p.textContent = entry;
            battleLogContent.appendChild(p);
        });
        battleLogContent.scrollTop = battleLogContent.scrollHeight; // Scroll to bottom
    }
}


async function handleEndSessionEarly() {
  console.log('Ending session early');
  try {
    const response = await chrome.runtime.sendMessage({ action: 'endSessionEarly' });
    console.log('Background response to endSessionEarly:', response);
    // The background script will handle storage updates and outcome determination.
    // The popup should then reflect the outcome screen once it gets an update or re-checks storage.
    // For now, we assume the background will manage the state change that leads to the result screen.
  } catch (error) {
    console.error('Error sending endSessionEarly message:', error);
  }
}

function renderResultScreen(outcomeData) {
  // outcomeData: { result: 'victory'/'defeat', xpEarned: number, monsterDefeatedName?: string,
  //                pomodoroCompleted: boolean, totalPomodoros, currentXP, currentStreak }

  if (outcomeData.result === 'victory') {
    resultMessage.textContent = `Victory! You defeated ${outcomeData.monsterDefeatedName || 'the monster'}!`;
  } else {
    resultMessage.textContent = 'Defeat! The monster survived.';
  }

  xpEarnedDisplay.textContent = `XP Earned: +${outcomeData.xpEarned}`;

  let statsSummary = `
    <p><strong>Total Pomodoros Completed:</strong> ${outcomeData.totalPomodoros || 0}</p>
    <p><strong>Current XP:</strong> ${outcomeData.currentXP || 0}</p>
    <p><strong>Current Win Streak:</strong> ${outcomeData.currentStreak || 0}</p>
  `;

  if (outcomeData.pomodoroCompleted) {
    statsSummary += `<p><em>This session was counted as a completed Pomodoro!</em></p>`;
  } else {
    statsSummary += `<p><em>This session was not counted as a completed Pomodoro.</em></p>`;
  }

  statsDisplayContent.innerHTML = statsSummary;
  switchScreen('result');
}

function handleStartAnotherSession() {
  chrome.storage.local.remove(['currentSession', 'sessionOutcome'], () => {
    console.log("Cleared session data, returning to monster selection.");
    selectedMonsterId = null;
    startSessionBtn.disabled = true; // Ensure it's disabled before selection
    // Clear other UI elements that might persist visually
    monsterCardsContainer.querySelectorAll('.monster-card').forEach(card => card.classList.remove('selected'));
    renderMonsterSelectionScreen();
  });
}

// --- Event Listeners ---
startSessionBtn.addEventListener('click', handleStartSession);
endSessionEarlyBtn.addEventListener('click', handleEndSessionEarly);
startAnotherSessionBtn.addEventListener('click', handleStartAnotherSession);

// Listen for updates from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log("Popup received message:", message);
  if (message.action === 'updatePopupBattleState') {
    if (SCREENS.battle.classList.contains('active')) { // Only update if battle screen is visible
      currentSession = message.sessionData; // Update local cache of session
      renderBattleScreen(message.sessionData);
    }
  } else if (message.action === 'sessionEnded') {
    // Background has determined the session outcome
    renderResultScreen(message.outcomeData);
  }
  return true; // Keep the message channel open for asynchronous response if needed
});

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  // Check current state from chrome.storage.local to determine which screen to show
  try {
    const data = await chrome.storage.local.get(['currentSession', 'sessionOutcome']);
    console.log("Initial storage data:", data);

    if (data.sessionOutcome) {
      // If there's an outcome, show the result screen
      renderResultScreen(data.sessionOutcome);
    } else if (data.currentSession && data.currentSession.isActive) {
      // If a session is active, show the battle screen
      currentSession = data.currentSession; // Load existing session
      renderBattleScreen(currentSession);
    } else {
      // Otherwise, show the monster selection screen
      renderMonsterSelectionScreen();
    }
  } catch (error) {
    console.error("Error initializing popup state from storage:", error);
    renderMonsterSelectionScreen(); // Fallback to default
  }
});

console.log("Popup script fully loaded and initialized.");
