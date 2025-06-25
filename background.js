// --- Constants ---
const DEFAULT_SESSION_DURATION_SECONDS = 25 * 60; // 25 minutes
const TICK_INTERVAL_MS = 1000; // 1 second
const HP_DAMAGE_PER_SECOND = 1;
const MAX_MONSTER_HP = 100;

// --- State (managed via chrome.storage.local) ---
// 'currentSession': { monsterId, monsterName, monsterIcon, startTime, durationSeconds, currentHP, maxHP, battleLog, isActive }
// 'userStats': { monstersDefeated: { scrollfiend: 0, ... }, totalPomodoros: 0, currentXP: 0, currentStreak: 0 }
// 'blockedSites': [...]

// --- Globals (for active timer interval) ---
let sessionTimerInterval = null;

// --- Initialization ---
chrome.runtime.onInstalled.addListener(async (details) => { // Added details argument
  console.log("FocusForge extension installed/updated. Reason:", details.reason);
  // Initialize or ensure structure of userStats and other settings
  const currentData = await chrome.storage.local.get(['userStats', 'blockedSites', 'currentSession', 'sessionOutcome']);

  const defaultStats = {
    monstersDefeated: { scrollfiend: 0, tubewyrm: 0, tabberwock: 0 },
    totalPomodoros: 0,
    currentXP: 0,
    currentStreak: 0,
  };

  const newStorage = {};
  if (!currentData.userStats || details.reason === 'install') { // Ensure fresh stats on new install or if missing
    newStorage.userStats = defaultStats;
  } else {
    // Merge existing stats with defaults to ensure all keys are present if new ones were added in an update
    newStorage.userStats = { ...defaultStats, ...currentData.userStats };
    // Ensure sub-objects like monstersDefeated are also well-structured
    newStorage.userStats.monstersDefeated = {
        ...defaultStats.monstersDefeated,
        ...(currentData.userStats.monstersDefeated || {})
    };
  }

  if (!currentData.blockedSites || details.reason === 'install') {
    newStorage.blockedSites = ["youtube.com", "twitter.com", "reddit.com", "instagram.com", "facebook.com", "netflix.com"];
  } else {
    newStorage.blockedSites = currentData.blockedSites; // Preserve existing blocked sites if user could edit them
  }

  // Always clear session-related data on install/update for a clean state
  newStorage.currentSession = null;
  newStorage.sessionOutcome = null;

  await chrome.storage.local.set(newStorage);
  console.log("Storage initialized/verified:", newStorage);
});

// --- Helper Functions ---
async function updatePopup() {
  const { currentSession } = await chrome.storage.local.get('currentSession');
  if (currentSession && currentSession.isActive) {
    // Calculate remaining time for the popup
    const elapsedSeconds = Math.floor((Date.now() - currentSession.startTime) / 1000);
    currentSession.timerValue = Math.max(0, currentSession.durationSeconds - elapsedSeconds);

    chrome.runtime.sendMessage({
      action: 'updatePopupBattleState',
      sessionData: currentSession
    }).catch(err => {
      if (err.message.includes("Receiving end does not exist")) {
        // Popup is not open, this is fine.
      } else {
        console.warn("Error sending update to popup:", err);
      }
    });
  }
}

async function endSession(result) { // result: 'victory' or 'defeat'
  console.log(`Session ended with ${result}.`);

  // Clear any active grace period timers immediately
  Object.values(gracePeriodTimers).forEach(timerId => clearTimeout(timerId));
  gracePeriodTimers = {};

  clearInterval(sessionTimerInterval);
  sessionTimerInterval = null;

  const { currentSession, userStats } = await chrome.storage.local.get(['currentSession', 'userStats']);
  if (!currentSession) {
    console.error("endSession called but no currentSession found in storage.");
    return;
  }

  let xpEarned = 0;
  let monsterDefeatedName = MONSTERS_DATA[currentSession.monsterId]?.name || "a monster";
  let pomodoroCompletedThisSession = false;

  if (!userStats) { // Initialize userStats if it's somehow missing
    console.warn("userStats was missing in endSession. Initializing.");
    userStats = {
      monstersDefeated: { scrollfiend: 0, tubewyrm: 0, tabberwock: 0 },
      totalPomodoros: 0,
      currentXP: 0,
      currentStreak: 0,
    };
  }
  if (!userStats.monstersDefeated) userStats.monstersDefeated = { scrollfiend: 0, tubewyrm: 0, tabberwock: 0 };


  if (result === 'victory') {
    xpEarned = 100;
    userStats.currentXP += xpEarned;
    userStats.totalPomodoros += 1;
    pomodoroCompletedThisSession = true;
    userStats.currentStreak += 1;
    if (userStats.monstersDefeated[currentSession.monsterId] !== undefined) {
      userStats.monstersDefeated[currentSession.monsterId]++;
    } else {
      userStats.monstersDefeated[currentSession.monsterId] = 1;
    }
    currentSession.battleLog.push(`Victory! ${monsterDefeatedName} defeated. +${xpEarned} XP.`);
  } else { // result === 'defeat' (either by timer running out or early end)
    userStats.currentStreak = 0;
    currentSession.battleLog.push(`Defeat! ${monsterDefeatedName} survived.`);

    // Check if defeat was due to timer running out (full 25 minutes passed)
    const elapsedSeconds = Math.floor((Date.now() - currentSession.startTime) / 1000);
    // currentSession.durationSeconds might be slightly off from actual 25*60 due to timing, check if close
    if (elapsedSeconds >= (currentSession.durationSeconds - 2) && currentSession.currentHP > 0) {
        // Check if this was not an "ended early" scenario
        const endedEarly = currentSession.battleLog.some(log => log.includes("Session ended early by user."));
        if (!endedEarly) {
            userStats.totalPomodoros += 1; // Count as a completed Pomodoro duration
            pomodoroCompletedThisSession = true;
            currentSession.battleLog.push("Full 25 minutes completed. Pomodoro counted.");
        }
    }
  }

  const outcomeData = {
    result: result,
    xpEarned: xpEarned,
    monsterDefeatedName: result === 'victory' ? monsterDefeatedName : null,
    pomodoroCompleted: pomodoroCompletedThisSession,
    // Pass updated stats for immediate display on result screen
    totalPomodoros: userStats.totalPomodoros,
    currentXP: userStats.currentXP,
    currentStreak: userStats.currentStreak
  };

  // Mark session as inactive before saving its final state
  currentSession.isActive = false;

  await chrome.storage.local.set({
    userStats: userStats,
    // currentSession is now effectively a historical record of the ended session
    // It will be removed by the setTimeout below.
    // Or, we could choose to store it differently if we want a session history.
    // For now, sessionOutcome is the primary record for the result screen.
    sessionOutcome: outcomeData
  });

  // Notify popup about session end
  chrome.runtime.sendMessage({ action: 'sessionEnded', outcomeData: outcomeData })
    .catch(err => {
        if (!err.message.includes("Receiving end does not exist")) {
            console.warn("Could not send sessionEnded to popup:", err);
        }
    });

  // Clear the 'currentSession' which marks an *active* session.
  // 'sessionOutcome' remains for the result screen.
  setTimeout(async () => {
    await chrome.storage.local.remove('currentSession');
    console.log("Active session marker (currentSession) cleared from storage.");
  }, 500); // Delay to allow popup to process if it was using currentSession details
}

// --- Main Timer Tick Function ---
async function onTimerTick() {
  const data = await chrome.storage.local.get('currentSession'); // Only get currentSession
  if (!data || !data.currentSession || !data.currentSession.isActive) { // Check data and data.currentSession
    console.warn("Timer tick for inactive/missing session. Clearing interval.");
    clearInterval(sessionTimerInterval);
    sessionTimerInterval = null;
    return;
  }

  let { currentSession } = data;
  const elapsedSeconds = Math.floor((Date.now() - currentSession.startTime) / 1000);
  const remainingSeconds = currentSession.durationSeconds - elapsedSeconds;

  // Deal damage
  currentSession.currentHP -= HP_DAMAGE_PER_SECOND;
  if (!currentSession.battleLog) currentSession.battleLog = [];
  // currentSession.battleLog.push(`Monster took ${HP_DAMAGE_PER_SECOND} damage.`); // Too noisy

  if (currentSession.currentHP <= 0) {
    currentSession.currentHP = 0;
    await chrome.storage.local.set({ currentSession }); // Save final HP
    endSession('victory');
    return;
  }

  if (remainingSeconds <= 0) {
    await chrome.storage.local.set({ currentSession }); // Save final state before loss
    endSession('defeat'); // Time's up, monster still has HP
    return;
  }

  await chrome.storage.local.set({ currentSession });
  updatePopup(); // Send state to popup
}


// --- Message Listener ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    if (request.action === "startSession") {
      console.log("Background: Received startSession request", request);
      if (sessionTimerInterval) {
        console.warn("Session already in progress. Ignoring new start request.");
        sendResponse({ status: "error", message: "Session already active." });
        return;
      }

      const monster = MONSTERS_DATA[request.monsterId]; // Need monster data here
      if (!monster) {
        console.error("Invalid monsterId:", request.monsterId);
        sendResponse({ status: "error", message: "Invalid monster ID." });
        return;
      }

      const newSession = {
        monsterId: request.monsterId,
        monsterName: monster.name,
        monsterIcon: monster.icon,
        startTime: Date.now(),
        durationSeconds: request.sessionDuration || DEFAULT_SESSION_DURATION_SECONDS,
        currentHP: monster.hp,
        maxHP: monster.hp,
        battleLog: [`Session started against ${monster.name}!`],
        isActive: true,
      };

      await chrome.storage.local.set({ currentSession: newSession, sessionOutcome: null });
      sessionTimerInterval = setInterval(onTimerTick, TICK_INTERVAL_MS);
      console.log("Session started in background. Timer ID:", sessionTimerInterval);
      sendResponse({ status: "sessionStarted", sessionData: newSession });
      updatePopup(); // Initial popup update

    } else if (request.action === "endSessionEarly") {
      console.log("Background: Received endSessionEarly request");
      const { currentSession } = await chrome.storage.local.get('currentSession');
      if (currentSession && currentSession.isActive) {
        if (!currentSession.battleLog) currentSession.battleLog = [];
        currentSession.battleLog.push("Session ended early by user.");
        await chrome.storage.local.set({ currentSession });
        endSession('defeat'); // Ending early is a defeat
        sendResponse({ status: "sessionEndedEarly" });
      } else {
        sendResponse({ status: "noActiveSession" });
      }
    } else if (request.action === "getPopupState") {
        // This allows popup to query state if it reopens
        const { currentSession, sessionOutcome } = await chrome.storage.local.get(['currentSession', 'sessionOutcome']);
        if (sessionOutcome) {
            sendResponse({ status: "sessionEnded", outcomeData: sessionOutcome });
        } else if (currentSession && currentSession.isActive) {
            const elapsedSeconds = Math.floor((Date.now() - currentSession.startTime) / 1000);
            currentSession.timerValue = Math.max(0, currentSession.durationSeconds - elapsedSeconds);
            sendResponse({ status: "sessionActive", sessionData: currentSession });
        } else {
            sendResponse({ status: "noActiveSessionOrOutcome" });
        }
    }
  })();
  return true; // Indicates asynchronous response.
});

// --- Tab & Site Monitoring ---
const BLOCKED_SITE_GRACE_PERIOD_MS = 3000; // 3 seconds
const HP_PENALTY_BLOCKED_SITE = 10;
let gracePeriodTimers = {}; // Store timers for grace periods, keyed by tabId

async function handleBlockedSiteVisit(tabId, url) {
  const { currentSession, blockedSites } = await chrome.storage.local.get(['currentSession', 'blockedSites']);

  if (!currentSession || !currentSession.isActive) {
    clearTimeout(gracePeriodTimers[tabId]); // Clear any pending grace timer if session ended
    delete gracePeriodTimers[tabId];
    return;
  }

  const isBlocked = blockedSites.some(blockedDomain => {
    try {
      const hostname = new URL(url).hostname;
      return hostname.includes(blockedDomain);
    } catch (e) {
      // Invalid URL, probably not a concern for blocking.
      // console.warn("Invalid URL encountered in handleBlockedSiteVisit:", url, e);
      return false;
    }
  });

  if (isBlocked) {
    // Clear any existing timer for this tab before starting a new one
    if (gracePeriodTimers[tabId]) {
      clearTimeout(gracePeriodTimers[tabId]);
    }

    // Start grace period timer
    gracePeriodTimers[tabId] = setTimeout(async () => {
      // Re-check if still on a blocked site and session is active
      const currentTabData = await chrome.tabs.get(tabId).catch(() => null);
      const { currentSession: updatedSession, blockedSites: updatedBlockedSites } = await chrome.storage.local.get(['currentSession', 'blockedSites']);

      if (!currentTabData || !updatedSession || !updatedSession.isActive) {
        delete gracePeriodTimers[tabId];
        return; // Tab closed, session ended, or navigated away from blocked site within grace period
      }

      const stillBlocked = updatedBlockedSites.some(blockedDomain => {
        try {
          const hostname = new URL(currentTabData.url).hostname;
          return hostname.includes(blockedDomain);
        } catch (e) { return false; }
      });

      if (stillBlocked) {
        console.log(`Penalty applied for tab ${tabId} on ${currentTabData.url}`);
        updatedSession.currentHP = Math.min(updatedSession.maxHP, updatedSession.currentHP + HP_PENALTY_BLOCKED_SITE);
        if (!updatedSession.battleLog) updatedSession.battleLog = [];
        const penaltyMessage = `Distracted! Monster +${HP_PENALTY_BLOCKED_SITE} HP.`;
        if (updatedSession.battleLog[updatedSession.battleLog.length -1] !== penaltyMessage) { // Avoid duplicate messages if quick succession
            updatedSession.battleLog.push(penaltyMessage);
        }

        await chrome.storage.local.set({ currentSession: updatedSession });
        updatePopup(); // Notify popup of HP change and new log entry
      }
      delete gracePeriodTimers[tabId];
    }, BLOCKED_SITE_GRACE_PERIOD_MS);
  } else {
    // Navigated to a non-blocked site, clear any grace period timer for this tab
    if (gracePeriodTimers[tabId]) {
      clearTimeout(gracePeriodTimers[tabId]);
      delete gracePeriodTimers[tabId];
      // console.log(`Cleared grace period for tab ${tabId} as it's no longer on a blocked site.`);
    }
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // We are interested in URL changes, particularly when a tab finishes loading or updates its URL.
  // 'status: complete' is good but sometimes URL changes before 'complete'.
  // So, checking changeInfo.url is more responsive.
  if (changeInfo.url) {
    // console.log(`Tab ${tabId} updated URL to: ${changeInfo.url}`);
    handleBlockedSiteVisit(tabId, changeInfo.url);
  }
});

chrome.tabs.onActivated.addListener(activeInfo => {
  // When user switches to a tab, check if its URL is blocked.
  // console.log(`Tab ${activeInfo.tabId} activated.`);
  chrome.tabs.get(activeInfo.tabId, tab => {
    if (chrome.runtime.lastError) {
        // console.warn("Error getting tab info onActivated:", chrome.runtime.lastError.message);
        return;
    }
    if (tab && tab.url) {
      handleBlockedSiteVisit(tab.id, tab.url);
    }
  });
});

// Clear grace period timers if a tab is closed
chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
  if (gracePeriodTimers[tabId]) {
    clearTimeout(gracePeriodTimers[tabId]);
    delete gracePeriodTimers[tabId];
    // console.log(`Cleared grace period for closed tab ${tabId}.`);
  }
});


// --- Alarms (alternative to setInterval for Manifest V3, more robust) ---
// For simplicity with frequent updates (every second), setInterval is used here.
// If issues arise with background script becoming inactive, switch to chrome.alarms.
// Example: chrome.alarms.create('sessionTick', { periodInMinutes: 1/60 });
// chrome.alarms.onAlarm.addListener(alarm => { if (alarm.name === 'sessionTick') onTimerTick(); });

// To make MONSTERS_DATA available in background script without duplicating:
const MONSTERS_DATA = {
  scrollfiend: { id: 'scrollfiend', name: 'Scrollfiend', icon: 'assets/scrollfiend.png', hp: 100 },
  tubewyrm: { id: 'tubewyrm', name: 'Tubewyrm', icon: 'assets/tubewyrm.png', hp: 100 },
  tabberwock: { id: 'tabberwock', name: 'Tabberwock', icon: 'assets/tabberwock.png', hp: 100 },
};

// --- Startup check for existing session ---
// This is important if the background script was terminated and restarted.
(async () => {
  console.log("Background script starting up / re-initializing.");
  const { currentSession } = await chrome.storage.local.get('currentSession');
  if (currentSession && currentSession.isActive) {
    console.log("Found active session on startup:", currentSession);
    const elapsedSeconds = Math.floor((Date.now() - currentSession.startTime) / 1000);
    const remainingSeconds = currentSession.durationSeconds - elapsedSeconds;

    if (remainingSeconds <= 0) {
      // Session should have ended while background was inactive
      console.log("Session timer expired while inactive.");
      // Check if win condition was met before timer expired based on last HP
      if (currentSession.currentHP <=0) {
          endSession('victory');
      } else {
          endSession('defeat');
      }
    } else {
      // Resume timer
      if (sessionTimerInterval) clearInterval(sessionTimerInterval); // Clear any old one just in case
      sessionTimerInterval = setInterval(onTimerTick, TICK_INTERVAL_MS);
      console.log("Resumed session timer. Interval ID:", sessionTimerInterval);
    }
  } else {
    console.log("No active session found on startup.");
  }
})();

console.log("Background script fully loaded and initialized.");
