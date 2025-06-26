import { useState, useEffect } from "react"
import type { Monster, SessionData } from "../types"

interface BattleScreenProps {
  monster: Monster
  sessionData: SessionData
  onEndSessionEarly: () => void
  onTriggerDistraction?: () => void
}

export const BattleScreen = ({
  monster,
  sessionData,
  onEndSessionEarly,
  onTriggerDistraction,
}: BattleScreenProps) => {
  const [showEndModal, setShowEndModal] = useState(false)
  const [isAttackAnimating, setIsAttackAnimating] = useState(false)
  const [isHealing, setIsHealing] = useState(false)
  const [lastHP, setLastHP] = useState(sessionData.currentHP)

  // Listen for attack animation messages from background script
  useEffect(() => {
    const handleMessage = (message: any) => {
      if (message.action === "triggerMonsterAttackAnimation") {
        setIsAttackAnimating(true)
        // Reset animation state after animation completes
        setTimeout(() => {
          setIsAttackAnimating(false)
        }, 400) // Duration matches the CSS animation (0.4s)
      }
    }

    if (chrome?.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage)
      return () => {
        chrome.runtime.onMessage.removeListener(handleMessage)
      }
    }
  }, [])

  // Monitor HP changes to trigger healing animation
  useEffect(() => {
    if (sessionData.currentHP > lastHP) {
      // Monster healed!
      setIsHealing(true)
      createHealingEffect()

      // Stop healing animation after 3 seconds
      setTimeout(() => {
        setIsHealing(false)
      }, 3000)
    }
    setLastHP(sessionData.currentHP)
  }, [sessionData.currentHP, lastHP])

  // Function to create floating plus symbols
  const createHealingEffect = () => {
    const monsterIcon = document.querySelector(".battle-monster-icon")
    if (!monsterIcon) return

    // Add healing effect container if not present
    if (!monsterIcon.parentElement?.classList.contains("healing-effect")) {
      const container = document.createElement("div")
      container.className = "healing-effect"
      monsterIcon.parentElement?.insertBefore(container, monsterIcon)
      container.appendChild(monsterIcon)
    }

    const sizes = ["small", "medium", "large"]
    const delays = ["delay-1", "delay-2", "delay-3", "delay-4"]

    // Create 8 plus symbols for a nice effect
    for (let i = 0; i < 8; i++) {
      const plus = document.createElement("div")
      plus.className = `plus-symbol ${
        sizes[Math.floor(Math.random() * sizes.length)]
      } ${delays[Math.floor(Math.random() * delays.length)]}`
      plus.textContent = "+"

      // Position randomly around the monster (centered over 180px icon)
      plus.style.left = Math.random() * 140 + 20 + "px" // 20-160px range, centered
      plus.style.top = Math.random() * 140 + 20 + "px" // 20-160px range, centered

      monsterIcon.parentElement?.appendChild(plus)

      // Remove plus symbol after animation completes
      setTimeout(() => {
        plus.remove()
      }, 3500) // Slightly longer than longest animation
    }
  }

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds < 10 ? "0" : ""}${remainingSeconds}`
  }

  const hpPercentage =
    sessionData.maxHP > 0
      ? (sessionData.currentHP / sessionData.maxHP) * 100
      : 0

  const handleEndSessionClick = () => {
    setShowEndModal(true)
  }

  const handleConfirmEndSession = () => {
    setShowEndModal(false)
    onEndSessionEarly()
  }

  const handleCancelEndSession = () => {
    setShowEndModal(false)
  }

  return (
    <div className="screen active">
      <h2>Battling {monster.name}</h2>

      <div className="timer">{formatTime(sessionData.timerValue)}</div>

      <div>Monster HP:</div>
      <div className="hp-bar-container">
        <div
          className="hp-bar"
          style={{ width: `${Math.max(0, hpPercentage)}%` }}
        >
          {Math.max(0, Math.round(sessionData.currentHP))}/{sessionData.maxHP}
        </div>
      </div>

      <img
        src={monster.icon}
        alt="Monster Icon"
        className={`battle-monster-icon ${
          isAttackAnimating ? "monster-attack-anim" : ""
        } ${isHealing ? "healing" : ""}`}
        style={{ margin: "10px auto", display: "block" }}
      />

      <h3>Battle Log</h3>
      <div className="battle-log">
        {sessionData.battleLog
          .slice()
          .reverse()
          .map((entry, index) => (
            <p key={index}>{entry}</p>
          ))}
      </div>

      <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
        <button onClick={handleEndSessionClick}>End Session Early</button>

        {/* Debug button for testing distractions */}
        {/* {onTriggerDistraction && (
          <button
            onClick={onTriggerDistraction}
            className="secondary"
          >
            Trigger Distraction (Debug)
          </button>
        )}

        {/* Test button for healing animation */}
        {/*<button
          onClick={() => {
            setIsHealing(true)
            createHealingEffect()
            setTimeout(() => setIsHealing(false), 3000)
          }}
          style={{
            background: "linear-gradient(135deg, #2ecc71 0%, #27ae60 100%)",
            fontSize: "0.9em",
          }}
        >
          🩹 Test Healing
        </button> */}
      </div>

      {/* Confirmation Modal */}
      {showEndModal && (
        <div
          className="modal"
          style={{ display: "flex" }}
        >
          <div className="modal-content">
            <h2>❗ End Session Early?</h2>
            <p>
              Leaving early means you won't defeat the monster and won't earn
              any XP.
              <br />
              Are you sure you want to stop now?
            </p>
            <div className="modal-buttons">
              <button onClick={handleCancelEndSession}>Keep Fighting</button>
              <button
                onClick={handleConfirmEndSession}
                className="danger"
              >
                Yes, End Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
