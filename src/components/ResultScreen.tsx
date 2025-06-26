import type { SessionOutcome, UserStats, XPConfig } from "../types"
import { calculateLevel, getUserTitle } from "../utils/xpSystem"

interface ResultScreenProps {
  outcome: SessionOutcome
  userStats: UserStats
  xpConfig: XPConfig
  onStartAnotherSession: () => void
}

export const ResultScreen = ({
  outcome,
  userStats,
  xpConfig,
  onStartAnotherSession,
}: ResultScreenProps) => {
  const level = calculateLevel(userStats.currentXP, xpConfig)
  const title = getUserTitle(level, xpConfig)

  const resultMessage =
    outcome.result === "victory"
      ? "🎉 Victory!"
      : outcome.result === "abandoned"
      ? "😔 You fled the battle..."
      : "😞 Defeat!"

  const getXPMessage = () => {
    if (outcome.result === "abandoned") {
      return "No XP earned."
    }

    if (outcome.xpBreakdown) {
      return (
        <div className="xp-breakdown">
          <div className="base-xp">Base XP: {outcome.xpBreakdown.baseXP}</div>
          {outcome.xpBreakdown.bonuses.length > 0 && (
            <div className="xp-bonuses">
              {outcome.xpBreakdown.bonuses.map((bonus, index) => (
                <div
                  key={index}
                  className="xp-bonus"
                >
                  {bonus.message}
                </div>
              ))}
            </div>
          )}
          <div className="total-xp">
            <strong>Total XP Earned: {outcome.xpEarned}</strong>
          </div>
        </div>
      )
    }

    return `XP Earned: ${outcome.xpEarned}`
  }

  return (
    <div className="screen active">
      <h2>{resultMessage}</h2>
      {outcome.monsterDefeatedName && outcome.result === "victory" && (
        <p>You defeated {outcome.monsterDefeatedName}!</p>
      )}

      <div className="xp-earned">{getXPMessage()}</div>

      <div className="stats-display">
        {outcome.pomodoroCompleted && (
          <p>
            <strong>Pomodoro Completed!</strong> ✅
          </p>
        )}
        {outcome.totalPomodoros !== undefined && (
          <p>
            <strong>Total Pomodoros:</strong> {outcome.totalPomodoros}
          </p>
        )}
        {outcome.currentXP !== undefined && (
          <p>
            <strong>Total XP:</strong> {outcome.currentXP} (Level {level})
          </p>
        )}
        <p>
          <strong>Title:</strong> {title}
        </p>
        {outcome.currentStreak !== undefined && (
          <p>
            <strong>Current Streak:</strong> {outcome.currentStreak}
          </p>
        )}

        {outcome.result === "abandoned" && (
          <p>The monster lives to distract you another day.</p>
        )}
      </div>

      <button
        onClick={onStartAnotherSession}
        style={{ marginTop: "20px" }}
      >
        Return to Hub Town
      </button>
    </div>
  )
}
