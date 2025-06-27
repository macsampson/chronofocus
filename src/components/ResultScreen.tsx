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
        <div className="text-center">
          <div className="text-sm mb-2 text-gray-600">
            Base XP: {outcome.xpBreakdown.baseXP}
          </div>
          {outcome.xpBreakdown.bonuses.length > 0 && (
            <div className="my-2">
              {outcome.xpBreakdown.bonuses.map((bonus, index) => (
                <div
                  key={index}
                  className="text-sm text-blue-500 my-1 font-medium"
                >
                  {bonus.message}
                </div>
              ))}
            </div>
          )}
          <div className="text-lg mt-3 pt-2 border-t border-gray-300">
            <strong>Total XP Earned: {outcome.xpEarned}</strong>
          </div>
        </div>
      )
    }

    return `XP Earned: ${outcome.xpEarned}`
  }

  return (
    <div className="block">
      <h2 className="text-gray-700 text-center text-2xl font-semibold mt-0 mb-5">
        {resultMessage}
      </h2>
      {outcome.monsterDefeatedName && outcome.result === "victory" && (
        <p className="text-center text-gray-700">
          You defeated {outcome.monsterDefeatedName}!
        </p>
      )}

      <div className="text-center text-2xl font-bold my-2 mb-5 text-success-600">
        {getXPMessage()}
      </div>

      <div className="text-left text-base leading-relaxed bg-gray-50 p-4 rounded border border-gray-200">
        {outcome.pomodoroCompleted && (
          <p className="my-2">
            <strong className="text-gray-600">Pomodoro Completed!</strong> ✅
          </p>
        )}
        {outcome.totalPomodoros !== undefined && (
          <p className="my-2">
            <strong className="text-gray-600">Total Pomodoros:</strong>{" "}
            {outcome.totalPomodoros}
          </p>
        )}
        {outcome.currentXP !== undefined && (
          <p className="my-2">
            <strong className="text-gray-600">Total XP:</strong>{" "}
            {outcome.currentXP} (Level {level})
          </p>
        )}
        <p className="my-2">
          <strong className="text-gray-600">Title:</strong> {title}
        </p>
        {outcome.currentStreak !== undefined && (
          <p className="my-2">
            <strong className="text-gray-600">Current Streak:</strong>{" "}
            {outcome.currentStreak}
          </p>
        )}

        {outcome.result === "abandoned" && (
          <p className="my-2">The monster lives to distract you another day.</p>
        )}
      </div>

      <button
        onClick={onStartAnotherSession}
        className="block w-full py-3 px-4 mt-5 bg-primary-500 text-white border-none rounded cursor-pointer text-base font-bold transition-colors duration-200 ease-in-out hover:bg-primary-600 disabled:bg-gray-400 disabled:text-gray-500 disabled:cursor-not-allowed"
      >
        Return to Hub Town
      </button>
    </div>
  )
}
