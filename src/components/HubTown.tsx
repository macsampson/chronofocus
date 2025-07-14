import { useState, useEffect } from "react"
import type { Monster, UserStats, XPConfig, SessionHistory } from "../types"
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
  calculateMonsterBaseXP,
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
  const [todayPomodoros, setTodayPomodoros] = useState<number>(0)
  const [sessionHistory, setSessionHistory] = useState<SessionHistory[]>([])

  const level = calculateLevel(userStats.currentXP, xpConfig)
  const title = getUserTitle(level, xpConfig)
  const currentLevelXP = calculateXPForCurrentLevel(
    userStats.currentXP,
    xpConfig
  )
  const nextLevelXP = calculateXPForNextLevel(userStats.currentXP, xpConfig)
  const xpPercentage =
    nextLevelXP > 0 ? (currentLevelXP / nextLevelXP) * 100 : 0

  const mostDefeatedMonster = getMostDefeatedMonster(userStats.monstersDefeated)

  // Load async data
  useEffect(() => {
    const loadData = async () => {
      try {
        const [pomodoros, history] = await Promise.all([
          getTodayPomodoros(),
          getRecentSessionHistory(),
        ])
        setTodayPomodoros(pomodoros)
        setSessionHistory(history)
      } catch (error) {
        console.error("Error loading hub data:", error)
      }
    }

    loadData()
  }, [])

  const currentStreakDisplay =
    userStats.currentStreak > 0
      ? `🔥 ${userStats.currentStreak}`
      : `💤 ${userStats.currentStreak}`

  return (
    <div className="block">
      {/* Hub Header - User Profile */}
      <div className="bg-gradient-to-br from-hub-from to-hub-to text-white p-5 rounded-xl mb-5 shadow-hub">
        <div className="flex items-center mb-4">
          <div className="mr-4">
            <div className="w-12 h-12 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-2xl border-2 border-white border-opacity-30">
              ⚔️
            </div>
          </div>
          <div className="flex-grow">
            <h3 className="m-0 mb-1 text-white text-xl text-left font-bold">
              Focus Warrior
            </h3>
            <div className="text-sm text-white text-opacity-80 mb-2 italic">
              {title}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-grow flex flex-col">
                <div className="flex-grow bg-white bg-opacity-20 rounded-lg p-0.5 relative overflow-hidden">
                  <div
                    className="xp-bar h-5 bg-gradient-to-r from-xp-from to-xp-to rounded-lg transition-all duration-700 ease-out relative overflow-hidden"
                    style={{ width: `${xpPercentage}%` }}
                  ></div>
                </div>
                <span className="block text-center text-sm text-white text-shadow mt-1">
                  {currentLevelXP} / {nextLevelXP} XP
                </span>
              </div>
              <div className="bg-white bg-opacity-90 text-hub-from py-1 px-2 rounded-xl text-sm font-bold whitespace-nowrap">
                Level {level}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-around gap-5">
          <div className="text-center flex-1">
            <div className="text-2xl font-bold mb-1">
              {userStats.totalPomodoros}
            </div>
            <div className="text-sm opacity-90">Total Pomodoros</div>
          </div>
          <div className="text-center flex-1">
            <div className="text-2xl font-bold mb-1 text-yellow-300 text-shadow">
              {currentStreakDisplay}
            </div>
            <div className="text-sm opacity-90">Day Streak</div>
          </div>
        </div>
      </div>

      {/* Monster Selection Section */}
      <div className="mb-5">
        <h2 className="text-gray-700 text-center mb-4 text-lg font-semibold">
          Choose Your Distraction to Battle
        </h2>
        <div className="grid grid-cols-1 gap-3 mb-4">
          {Object.values(monsters).map((monster) => {
            const durationMinutes = Math.round(monster.hp / 60)
            const isSelected = selectedMonsterId === monster.id
            const potentialXP = calculateMonsterBaseXP(
              monster.id,
              monsters,
              xpConfig
            )

            return (
              <div
                key={monster.id}
                className={`monster-card border-2 p-4 rounded-lg cursor-pointer bg-white flex items-center transition-all duration-200 relative overflow-hidden ${
                  isSelected
                    ? "bg-gradient-to-br from-blue-50 to-blue-100 border-blue-500 shadow-monster-selected -translate-y-0.5"
                    : "border-gray-200 hover:border-blue-400 hover:shadow-monster-hover hover:-translate-y-0.5"
                }`}
                onClick={() => onMonsterSelect(monster.id)}
              >
                <img
                  src={monster.icon}
                  alt={monster.name}
                  className="w-24 h-24 mr-4 rounded-lg object-contain border border-gray-200"
                />
                <div className="flex-grow">
                  <strong className="text-lg text-gray-700 block mb-1">
                    {monster.name}
                  </strong>
                  <p className="text-sm text-gray-600 m-0 leading-relaxed">
                    {monster.description}
                  </p>
                  <small className="text-gray-500 mt-1 block">
                    HP: {monster.hp}
                  </small>
                  <small className="text-gray-500 mt-1 block">
                    Duration: {durationMinutes} min
                  </small>
                  <small className="text-blue-600 font-semibold mt-1 block">
                    💰 Base XP: {potentialXP}
                  </small>
                </div>
              </div>
            )
          })}
        </div>
        <button
          className="bg-gradient-to-br from-battle-from to-battle-to text-white border-none py-3 px-5 rounded-lg text-lg font-bold cursor-pointer w-full transition-all duration-200 shadow-battle hover:not-disabled:-translate-y-0.5 hover:not-disabled:shadow-lg disabled:bg-gray-400 disabled:shadow-none disabled:cursor-not-allowed disabled:transform-none"
          disabled={!selectedMonsterId}
          onClick={onStartSession}
        >
          ▶ Start Focus Battle
        </button>
      </div>

      {/* Session Stats */}
      <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h3 className="m-0 mb-3 text-gray-600 text-lg text-center">
          Today's Focus Summary
        </h3>
        <div className="flex justify-between mb-3">
          <div className="text-center flex-1">
            <span className="text-sm text-gray-500 block mb-1">
              Today's Pomodoros:
            </span>
            <span className="font-bold text-gray-700 text-lg">
              {todayPomodoros}
            </span>
          </div>
          <div className="text-center flex-1">
            <span className="text-sm text-gray-500 block mb-1">
              Most Defeated:
            </span>
            <span className="font-bold text-gray-700 text-lg">
              {mostDefeatedMonster !== "None" && monsters[mostDefeatedMonster]
                ? monsters[mostDefeatedMonster].name
                : "None"}
            </span>
          </div>
        </div>
        <div className="text-center pt-2 border-t border-gray-300">
          <span className="text-sm text-gray-500 block mb-2">
            Last 5 sessions:
          </span>
          <div className="flex justify-center gap-1">
            {sessionHistory.map((session, index) => (
              <span
                key={index}
                className={`text-base p-0.5 rounded min-w-5 text-center ${
                  session.success
                    ? "bg-green-100 bg-opacity-40"
                    : "bg-red-100 bg-opacity-40"
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
                className="text-base p-0.5 rounded min-w-5 text-center bg-gray-200 text-gray-400"
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
