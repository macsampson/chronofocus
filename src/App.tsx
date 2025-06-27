import { useCallback } from "react"
import { HubTown } from "./components/HubTown"
import { BattleScreen } from "./components/BattleScreen"
import { ResultScreen } from "./components/ResultScreen"
import { useGameState } from "./hooks/useGameState"
import type { SessionOutcome, SessionData } from "./types"

function App() {
  const {
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
  } = useGameState()

  const selectedMonster = selectedMonsterId ? monsters[selectedMonsterId] : null

  const handleMonsterSelect = useCallback(
    (monsterId: string) => {
      setSelectedMonsterId(monsterId)
    },
    [setSelectedMonsterId]
  )

  const handleStartSession = useCallback(async () => {
    if (!selectedMonster) {
      console.error("No monster selected")
      return
    }

    console.log("Starting session for monster:", selectedMonster)

    // Check if chrome.runtime is available
    if (!chrome || !chrome.runtime) {
      console.error("Chrome runtime not available")
      alert(
        "Chrome extension runtime not available. Please ensure this is running as a Chrome extension."
      )
      return
    }

    try {
      console.log("Sending chrome runtime message...")
      const response = await chrome.runtime.sendMessage({
        action: "startSession",
        monsterId: selectedMonster.id,
        sessionDuration: selectedMonster.hp, // Duration in seconds
      })

      console.log("Received response:", response)

      if (response && response.status === "sessionStarted") {
        setCurrentSession(response.sessionData)
        setCurrentScreen("battle")
      } else {
        console.error(
          "Failed to start session:",
          response?.message || response?.status
        )
        alert(
          `Failed to start session: ${
            response?.message || response?.status || "Unknown error"
          }`
        )
      }
    } catch (error) {
      console.error("Error starting session:", error)
      alert(`Error starting session: ${error}`)
    }
  }, [selectedMonster, setCurrentSession, setCurrentScreen])

  const handleEndSessionEarly = useCallback(async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        action: "endSessionEarly",
      })

      if (response.status === "sessionEndedEarly") {
        // The background script will handle the session end and send us the outcome
        console.log("Session ended early")
      } else {
        console.error("Failed to end session:", response.status)
      }
    } catch (error) {
      console.error("Error ending session:", error)
    }
  }, [])

  const handleStartAnotherSession = useCallback(async () => {
    // Clear the session outcome from Chrome storage so popup doesn't reopen to result screen
    try {
      await chrome.storage.local.remove("sessionOutcome")
      console.log("✅ Cleared sessionOutcome from storage")
    } catch (error) {
      console.error("Error clearing sessionOutcome:", error)
    }

    setSelectedMonsterId(null)
    setCurrentSession(null)
    setCurrentScreen("hub")
  }, [setSelectedMonsterId, setCurrentSession, setCurrentScreen])

  const handleTriggerDistraction = useCallback(() => {
    // This is just for demo/debugging - the real distractions are handled by the background script
    console.log("Distraction triggered (debug)")
  }, [])

  if (isLoading) {
    return (
      <div className="font-sans w-96 min-h-[500px] p-0 m-0 bg-primary-50 text-gray-800">
        <div className="p-4 bg-white min-h-[calc(100vh-2rem)] box-border">
          <div className="text-center py-12">Loading ChronoFocus...</div>
        </div>
      </div>
    )
  }

  if (!userStats || !xpConfig) {
    return (
      <div className="font-sans w-96 min-h-[500px] p-0 m-0 bg-primary-50 text-gray-800">
        <div className="p-4 bg-white min-h-[calc(100vh-2rem)] box-border">
          <div className="text-center py-12 text-red-500">
            Error loading game data. Please refresh the page.
          </div>
        </div>
      </div>
    )
  }

  // Use the session data directly from the background script
  const battleSessionData: SessionData | null =
    currentSession &&
    typeof currentSession === "object" &&
    "monsterId" in currentSession
      ? currentSession
      : null

  return (
    <div className="font-sans w-96 min-h-[500px] p-0 m-0 bg-primary-50 text-gray-800">
      <div className="p-4 bg-white min-h-[calc(100vh-2rem)] box-border">
        {currentScreen === "hub" && (
          <HubTown
            userStats={userStats}
            monsters={monsters}
            xpConfig={xpConfig}
            selectedMonsterId={selectedMonsterId}
            onMonsterSelect={handleMonsterSelect}
            onStartSession={handleStartSession}
          />
        )}

        {currentScreen === "battle" && selectedMonster && battleSessionData && (
          <BattleScreen
            monster={selectedMonster}
            sessionData={battleSessionData}
            onEndSessionEarly={handleEndSessionEarly}
            onTriggerDistraction={handleTriggerDistraction}
          />
        )}

        {currentScreen === "result" &&
          currentSession &&
          typeof currentSession === "object" &&
          "result" in currentSession && (
            <ResultScreen
              outcome={currentSession as SessionOutcome}
              userStats={userStats}
              xpConfig={xpConfig}
              onStartAnotherSession={handleStartAnotherSession}
            />
          )}
      </div>
    </div>
  )
}

export default App
