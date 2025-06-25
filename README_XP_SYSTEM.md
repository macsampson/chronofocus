# ChronoFocus XP System Implementation

## Overview

This implementation adds a comprehensive XP (Experience Points) system to ChronoFocus with RPG-style progression, titles, and engaging feedback animations.

## ✨ Key Features

### 🎯 XP Gain Formula

- **Base XP:** 100 per completed session
- **No Distractions Bonus:** +10% for perfect focus sessions
- **Daily Focus Bonus:** +10% for second+ sessions in a day
- **Streak Bonus:** +20% for streaks > 3 days
- **Focus Crit:** Random 5-25% multiplier for extra excitement

### 📈 Leveling System

- **Leveling Curve:** XP required = 100 × (level^1.5)
- **Example Progression:**
  - Level 1: 100 XP
  - Level 2: 280 XP
  - Level 3: 519 XP
  - Level 4: 894 XP
  - Level 5: 1,341 XP

### 🏆 Title/Rank System

| Level | Title            |
| ----- | ---------------- |
| 1     | Distractling     |
| 3     | Focus Novice     |
| 5     | Attention Adept  |
| 8     | Pomodoro Paladin |
| 12    | Mind Slayer      |
| 20    | Flowmaster       |

### 🔥 Streak Bonuses

- **XP Multiplier:** 1 + (streakDays × 0.05) up to 2.0x max
- **Examples:**
  - 2-day streak: 1.10x (10% boost)
  - 5-day streak: 1.25x (25% boost)
  - 20-day streak: 2.0x (maximum)

### 🎉 Micro Progress Rewards

- **Session Start:** +5 XP
- **Halfway Point:** +10 XP
- **Session Completion:** Full XP calculation with bonuses

## 🎨 Visual Features

### Animations

- **XP Bar:** Smooth filling animation with particle effects
- **Level Up:** Explosion animation with golden glow
- **Feedback Messages:** Floating notifications for all XP gains
- **Badge Pulse:** Level badge animates on level up

### UI Enhancements

- **XP Breakdown:** Detailed display of bonus calculations
- **Progress Tracking:** Visual session history indicators
- **Title Display:** Prominent display of current rank
- **Milestone Feedback:** Real-time progress notifications

## ⚙️ Configuration

All XP system parameters are stored in `xp-config.json` for easy modification:

```json
{
  "base": {
    "xpPerSession": 100,
    "xpForStarting": 5,
    "xpForHalfway": 10
  },
  "modifiers": {
    "noDistractions": 0.1,
    "secondSession": 0.1,
    "streakBonus": 0.2,
    "minFocusCrit": 1.05,
    "maxFocusCrit": 1.25
  },
  "levelCurve": {
    "baseXP": 100,
    "exponent": 1.5
  },
  "titles": {
    "1": "Distractling",
    "3": "Focus Novice",
    "5": "Attention Adept",
    "8": "Pomodoro Paladin",
    "12": "Mind Slayer",
    "20": "Flowmaster"
  }
}
```

## 🎮 Example XP Calculation

**Scenario:** User defeats Tubewyrm with no distractions on a 4-day streak:

1. **Base XP:** 100
2. **No Distractions:** +10 (10%)
3. **4-Day Streak:** +20 (20%)
4. **Subtotal:** 130 XP
5. **Focus Crit (1.2x):** 130 × 1.2 = **156 XP**

## 🔧 Technical Implementation

### Files Modified/Added

- ✅ `xp-config.json` - Configuration file
- ✅ `popup.js` - XP calculation and UI logic
- ✅ `background.js` - Session tracking and micro-progress
- ✅ `popup.html` - Title display elements
- ✅ `style.css` - Animations and visual effects
- ✅ `manifest.json` - Updated permissions

### Key Functions

- `calculateSessionXP()` - Main XP calculation with bonuses
- `triggerLevelUpAnimation()` - Level up visual effects
- `showXPFeedback()` - Floating notification system
- `animateXPBar()` - Smooth XP progression animation
- `getUserTitle()` - Title determination logic

## 🚀 Getting Started

1. Install/reload the extension
2. Start a focus session
3. Complete it without distractions for maximum XP
4. Watch your progress with engaging animations!
5. Build streaks for increasing multipliers

## 💡 Future Enhancements

Potential additions for the system:

- Achievement unlocks
- Seasonal events with bonus XP
- Leaderboards for streak competitions
- Custom avatar progression
- Special effects for high-level users

---

**Happy Focusing! 🎯✨**
