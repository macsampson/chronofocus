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
    <div className="block">
      <h2 className="text-gray-700 text-center text-2xl font-semibold mt-0 mb-4">
        Battling {monster.name}
      </h2>

      <div className="text-5xl font-bold text-center my-4 text-danger-600">
        {formatTime(sessionData.timerValue)}
      </div>

      <div className="text-gray-700 mb-2">Monster HP:</div>
      <div className="w-full bg-gray-200 rounded-md my-2 mb-4 p-1">
        <div
          className="h-6 bg-success-500 rounded-sm text-center leading-6 text-white font-bold text-sm transition-all duration-300 ease-in-out whitespace-nowrap overflow-hidden"
          style={{ width: `${Math.max(0, hpPercentage)}%` }}
        >
          {Math.max(0, Math.round(sessionData.currentHP))}/{sessionData.maxHP}
        </div>
      </div>

      <img
        src={monster.icon}
        alt="Monster Icon"
        className={`block my-2 mx-auto border-2 border-gray-200 rounded w-44 h-44 object-contain ${
          isAttackAnimating ? "animate-monster-attack" : ""
        } ${isHealing ? "animate-healing-glow" : ""}`}
      />

      <h3 className="text-gray-700 text-center text-xl font-semibold mt-5 mb-4">
        Battle Log
      </h3>
      <div className="h-24 overflow-y-auto border border-gray-300 p-2 mt-2 text-sm bg-gray-50 rounded leading-6">
        {sessionData.battleLog
          .slice()
          .reverse()
          .map((entry, index) => (
            <p
              key={index}
              className="m-0 mb-1 pb-1 border-b border-dotted border-gray-200 text-gray-800 last:border-b-0 last:mb-0"
            >
              {entry}
            </p>
          ))}
      </div>

      <div className="flex gap-2 mt-5">
        <button
          onClick={handleEndSessionClick}
          className="block w-full py-3 px-4 my-4 mx-0 bg-primary-500 text-white border-none rounded cursor-pointer text-base font-bold transition-colors duration-200 ease-in-out hover:bg-primary-600 disabled:bg-gray-400 disabled:text-gray-500 disabled:cursor-not-allowed"
        >
          End Session Early
        </button>

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
        <div className="fixed top-0 left-0 right-0 bottom-0 bg-black bg-opacity-35 flex items-center justify-center z-50">
          <div className="bg-white py-7 px-6 pb-5 rounded-lg shadow-modal max-w-80 w-full text-center">
            <h2 className="mt-0 text-danger-500 text-xl">
              ❗ End Session Early?
            </h2>
            <p className="my-4 mx-0 text-gray-800 text-base">
              Leaving early means you won't defeat the monster and won't earn
              any XP.
              <br />
              Are you sure you want to stop now?
            </p>
            <div className="flex justify-between gap-3">
              <button
                onClick={handleCancelEndSession}
                className="flex-1 py-2 px-0 text-base rounded border-none cursor-pointer font-bold bg-gray-200 text-gray-800"
              >
                Keep Fighting
              </button>
              <button
                onClick={handleConfirmEndSession}
                className="flex-1 py-2 px-0 text-base rounded border-none cursor-pointer font-bold bg-danger-500 text-white"
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
