# ChronoFocus

A gamified Pomodoro timer Chrome extension where you battle distraction monsters to improve your focus! Turn your productivity sessions into epic battles against different types of distractions.

## 🎮 What is ChronoFocus?

ChronoFocus transforms the traditional Pomodoro technique into an engaging RPG-style experience. Instead of just running a timer, you're battling personalized distraction monsters that represent your specific productivity challenges. Each monster heals when you visit their trigger websites or perform distracting actions, making your focus sessions feel like real battles.

## ✨ Features

### 🗡️ Monster Battle System
- **Test Gremlin**: 5-second training sessions for testing
- **Doomscoller**: 25-minute battles against social media distractions (Facebook, Instagram, X, TikTok, etc.)
- **Tubewyrm**: 20-minute fights against video streaming urges (YouTube, Netflix, Twitch, etc.)
- **Tabberwock**: 30-minute wars against tab-switching chaos

### 📈 XP & Progression System
- **Base XP**: 100 XP per completed session
- **Bonus Multipliers**:
  - +10% for perfect focus (no distractions)
  - +10% for second+ sessions in a day
  - +20% for streaks > 3 days
  - 5-25% random "Focus Crit" multiplier
- **Level System**: Progressive XP requirements (Level 1: 1000 XP, Level 2: 2828 XP, etc.)
- **Titles**: Rank progression from "Distractling" to "Flowmaster"

### 🎯 Real-Time Battle Mechanics
- Monster HP decreases as you stay focused
- Monsters heal when you visit their trigger sites
- Battle log tracks your distraction events
- Visual feedback with animations and effects

### 🏆 Statistics & Tracking
- Daily session counts and streaks
- Session history with detailed outcomes
- Monster defeat counters
- Total XP and level progression

## 🚀 Getting Started

### Prerequisites
- **Node.js** v16 or higher
- **Bun** (recommended) or npm/yarn
- **Google Chrome** browser

### Installation & Development

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/chronofocus.git
   cd chronofocus
   ```

2. **Install dependencies**:
   ```bash
   bun install
   # or
   npm install
   ```

3. **Start development server**:
   ```bash
   bun run dev
   # or
   npm run dev
   ```

4. **Build for production**:
   ```bash
   bun run build
   # or
   npm run build
   ```

### Chrome Extension Installation

1. Build the project (`bun run build`)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the `dist` folder
5. The ChronoFocus icon should appear in your extensions toolbar

## 🛠️ Technology Stack

- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS with custom animations
- **Build Tool**: Vite
- **Extension APIs**: Chrome Extensions Manifest V3
- **Storage**: Chrome Local Storage
- **Architecture**: Component-based with custom hooks

## 📁 Project Structure

```
chronofocus/
├── public/
│   ├── assets/           # Monster icons and sounds
│   ├── manifest.json     # Chrome extension manifest
│   ├── monsters.json     # Monster configurations
│   └── xp-config.json    # XP system settings
├── src/
│   ├── components/       # React components
│   │   ├── HubTown.tsx      # Main dashboard
│   │   ├── BattleScreen.tsx # Pomodoro timer interface
│   │   └── ResultScreen.tsx # Session results
│   ├── hooks/           # Custom React hooks
│   │   └── useGameState.ts  # Global state management
│   ├── types/           # TypeScript definitions
│   ├── utils/           # Utility functions
│   │   ├── storage.ts      # Chrome storage operations
│   │   └── xpSystem.ts     # XP calculations
│   ├── App.tsx          # Main app component
│   ├── background.ts    # Chrome extension background script
│   └── index.css        # Tailwind styles
├── popup.html           # Extension popup HTML
└── popup.tsx            # Extension popup entry point
```

## 🎮 How to Play

1. **Choose Your Battle**: Select a monster that represents your main distraction type
2. **Start the Session**: Click "Battle" to begin your Pomodoro session
3. **Stay Focused**: Avoid visiting the monster's trigger sites during the session
4. **Watch the Battle**: See the monster's HP decrease as you maintain focus
5. **Complete & Level Up**: Finish the session to earn XP and level up your focus skills

## ⚙️ Configuration

### Monster Customization
Edit `public/monsters.json` to modify monster stats, trigger sites, or add new monsters:

```json
{
  "newmonster": {
    "id": "newmonster",
    "name": "New Monster",
    "icon": "assets/newmonster.png",
    "description": "A custom distraction monster",
    "hp": 1500,
    "triggerSites": ["example.com", "distraction.com"]
  }
}
```

### XP System Tuning
Modify `public/xp-config.json` to adjust progression rates, bonuses, and level requirements:

```json
{
  "base": {
    "xpPerSession": 100,
    "xpPerHP": 0.1
  },
  "modifiers": {
    "noDistractions": 0.1,
    "streakBonus": 0.2
  }
}
```

## 🚧 Planned Features

### Short-term Roadmap
- [ ] **Custom Session Durations**: Allow manual timer settings beyond monster HP
- [ ] **Distraction Blocking**: Optional website blocking during sessions
- [ ] **Sound Settings**: Customizable notification sounds and volume control
- [ ] **Theme Options**: Dark mode and alternative color schemes
- [ ] **Session Notes**: Add personal notes to completed sessions

### Medium-term Features
- [ ] **Achievement System**: Unlock badges for specific milestones
- [ ] **Weekly Challenges**: Special objectives with bonus rewards
- [ ] **Custom Monsters**: User-created monsters with personalized triggers
- [ ] **Export Data**: CSV export of session history and statistics
- [ ] **Sync Across Devices**: Cloud sync for multi-device usage

### Long-term Vision
- [ ] **Social Features**: Leaderboards and friend challenges
- [ ] **Advanced Analytics**: Detailed productivity insights and trends
- [ ] **Integration APIs**: Connect with other productivity tools
- [ ] **Mobile Companion**: Standalone mobile app version
- [ ] **Team Battles**: Collaborative focus sessions for teams

## 🔧 Development Scripts

```bash
# Development
bun run dev          # Start dev server with hot reload
bun run build:watch  # Build with file watching

# Production
bun run build        # Build for production
bun run preview      # Preview production build

# Code Quality
bun run lint         # Run ESLint
bun run lint:fix     # Fix auto-fixable lint issues
bun run type-check   # TypeScript type checking
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Use TypeScript for all new code
- Follow the existing component structure
- Add proper error handling for Chrome extension APIs
- Test thoroughly in both development and extension modes
- Maintain backward compatibility with existing save data

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Why ChronoFocus?

Traditional Pomodoro timers can feel monotonous and fail to address the psychological aspects of distraction. ChronoFocus gamifies the experience by:

- **Personalizing the Challenge**: Different monsters for different distraction types
- **Providing Immediate Feedback**: Real-time battle mechanics show the impact of distractions
- **Creating Long-term Motivation**: XP progression and leveling systems encourage consistency
- **Making Focus Fun**: RPG elements transform productivity into an engaging game

Transform your focus sessions from a chore into an adventure with ChronoFocus!

---

**Happy Focusing! 🎮⚔️**