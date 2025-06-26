import type { Monster, UserStats, XPConfig } from "../types"
import {
  getTodayPomodoros,
  getRecentSessionHistory,
  getMostDefeatedMonster,
} from "../utils/storage"
import {
  calculateLevel,
  getUserTitle,
  calculateXPForCurrentLevel,
  calculateXPForNextLevel,
} from "../utils/xpSystem"

interface HubTownProps {
  userStats: UserStats
  monsters: Record<string, Monster>
  xpConfig: XPConfig
  selectedMonsterId: string | null
  onMonsterSelect: (monsterId: string) => void
  onStartSession: () => void
}

export const HubTown = ({
  userStats,
  monsters,
  xpConfig,
  selectedMonsterId,
  onMonsterSelect,
  onStartSession,
}: HubTownProps) => {
  const level = calculateLevel(userStats.currentXP, xpConfig)
  const title = getUserTitle(level, xpConfig)
  const currentLevelXP = calculateXPForCurrentLevel(
    userStats.currentXP,
    xpConfig
  )
  const nextLevelXP = calculateXPForNextLevel(userStats.currentXP, xpConfig)
  const xpPercentage =
    nextLevelXP > 0 ? (currentLevelXP / nextLevelXP) * 100 : 0

  const todayPomodoros = getTodayPomodoros()
  const sessionHistory = getRecentSessionHistory()
  const mostDefeatedMonster = getMostDefeatedMonster(userStats.monstersDefeated)

  const currentStreakDisplay =
    userStats.currentStreak > 0
      ? `🔥 ${userStats.currentStreak}`
      : `💤 ${userStats.currentStreak}`

  return (
    <div className="screen active">
      {/* Hub Header - User Profile */}
      <div className="hub-header">
        <div className="user-profile">
          <div className="user-avatar">
            <div className="avatar-placeholder">⚔️</div>
          </div>
          <div className="user-info">
            <h3>Focus Warrior</h3>
            <div className="user-title">{title}</div>
            <div className="xp-section">
              <div className="xp-display">
                <div className="xp-bar-container">
                  <div
                    className="xp-bar"
                    style={{ width: `${xpPercentage}%` }}
                  ></div>
                </div>
                <span id="xp-text">
                  {currentLevelXP} / {nextLevelXP} XP
                </span>
              </div>
              <div className="level-badge">Level {level}</div>
            </div>
          </div>
        </div>

        <div className="stats-summary">
          <div className="stat-item">
            <div className="stat-value">{userStats.totalPomodoros}</div>
            <div className="stat-label">Total Pomodoros</div>
          </div>
          <div className="stat-item">
            <div className="stat-value streak">{currentStreakDisplay}</div>
            <div className="stat-label">Day Streak</div>
          </div>
        </div>
      </div>

      {/* Monster Selection Section */}
      <div className="monster-selection-section">
        <h2>Choose Your Distraction to Battle</h2>
        <div className="monster-grid">
          {Object.values(monsters).map((monster) => {
            const durationMinutes = Math.round(monster.hp / 60)
            const isSelected = selectedMonsterId === monster.id

            return (
              <div
                key={monster.id}
                className={`monster-card ${isSelected ? "selected" : ""}`}
                onClick={() => onMonsterSelect(monster.id)}
              >
                <img
                  src={monster.icon}
                  alt={monster.name}
                  className="monster-icon"
                />
                <div className="monster-details">
                  <strong>{monster.name}</strong>
                  <p>{monster.description}</p>
                  <small
                    style={{
                      color: "#888",
                      marginTop: "4px",
                      display: "block",
                    }}
                  >
                    HP: {monster.hp}
                  </small>
                  <small
                    style={{
                      color: "#888",
                      marginTop: "4px",
                      display: "block",
                    }}
                  >
                    Duration: {durationMinutes} min
                  </small>
                </div>
              </div>
            )
          })}
        </div>
        <button
          className="battle-button"
          disabled={!selectedMonsterId}
          onClick={onStartSession}
        >
          ▶ Start Focus Battle
        </button>
      </div>

      {/* Session Stats */}
      <div className="session-stats">
        <h3>Today's Focus Summary</h3>
        <div className="today-stats">
          <div className="today-stat">
            <span className="stat-label">Today's Pomodoros:</span>
            <span className="stat-value">{todayPomodoros}</span>
          </div>
          <div className="today-stat">
            <span className="stat-label">Most Defeated:</span>
            <span className="stat-value">
              {mostDefeatedMonster !== "None" && monsters[mostDefeatedMonster]
                ? monsters[mostDefeatedMonster].name
                : "None"}
            </span>
          </div>
        </div>
        <div className="streak-log">
          <span className="stat-label">Last 5 sessions:</span>
          <div className="streak-indicators">
            {sessionHistory.map((session, index) => (
              <span
                key={index}
                className={`session-indicator ${
                  session.success ? "success" : "failure"
                }`}
                title={`Session ${index + 1}: ${
                  session.success ? "Victory" : "Defeat"
                }`}
              >
                {session.success ? "✅" : "❌"}
              </span>
            ))}
            {/* Fill remaining slots with placeholders */}
            {Array.from({ length: 5 - sessionHistory.length }, (_, i) => (
              <span
                key={`placeholder-${i}`}
                className="session-indicator placeholder"
                title="No session"
              >
                ⬜
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
