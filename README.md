# ChronoFocus - React TypeScript Edition

A gamified Pomodoro timer where you battle distraction monsters to improve your focus! This is a React + TypeScript conversion of the original HTML/JS Chrome extension.

## Features

🎮 **Gamified Pomodoro Sessions**

- Choose from different distraction monsters to battle
- Each monster represents different types of distractions
- Timer duration based on monster HP (5 seconds to 30 minutes)

⚔️ **Battle System**

- Real-time HP bars for monsters
- Battle log showing your progress
- Distraction events can heal monsters (simulated)

🏆 **Progression System**

- Earn XP for completed sessions
- Level up and gain titles
- Daily streak bonuses
- Session history tracking

🎯 **Monsters Available**

- **Test Gremlin**: Quick 5-second sessions for testing
- **Doomscoller**: 25-minute battles against social media distractions
- **Tubewyrm**: 20-minute fights against video streaming urges
- **Tabberwock**: 30-minute wars against tab-switching chaos

## Technology Stack

- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast development and build tool
- **CSS** - Custom styling (converted from original)
- **LocalStorage** - Data persistence

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd chronofocus
```

2. Install dependencies:

```bash
npm install
```

3. Start the development server:

```bash
npm run dev
```

4. Open your browser and navigate to `http://localhost:3000`

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
src/
├── components/           # React components
│   ├── HubTown.tsx      # Main dashboard/monster selection
│   ├── BattleScreen.tsx # Pomodoro timer interface
│   └── ResultScreen.tsx # Session results
├── hooks/               # Custom React hooks
│   ├── useGameState.ts  # Global game state management
│   └── useTimer.ts      # Pomodoro timer logic
├── types/               # TypeScript type definitions
│   └── index.ts         # All interfaces and types
├── utils/               # Utility functions
│   ├── xpSystem.ts      # XP calculations and game mechanics
│   └── storage.ts       # LocalStorage operations
├── App.tsx              # Main app component
├── main.tsx             # App entry point
└── style.css            # Global styles
```

## Key Features Converted

### From Original Extension

- ✅ All XP system calculations
- ✅ Monster data and configurations
- ✅ Session tracking and history
- ✅ Level progression and titles
- ✅ Streak system
- ✅ Complete UI/UX design

### New React Features

- ✅ Component-based architecture
- ✅ TypeScript type safety
- ✅ Custom hooks for state management
- ✅ Modern React patterns
- ✅ Responsive design
- ✅ Error handling

## Data Storage

The app uses browser LocalStorage to persist:

- User statistics (XP, level, pomodoros completed)
- Session history (last 5 sessions)
- Daily pomodoro counts
- Monster defeat counts

## Configuration

Game balance and mechanics are configurable via:

- `public/xp-config.json` - XP rates, bonuses, level curves
- `public/monsters.json` - Monster stats and descriptions

## Differences from Original

This React version focuses on the core Pomodoro gameplay and removes browser extension specific features:

- ❌ Website blocking functionality
- ❌ Background service worker
- ❌ Browser tab monitoring
- ❌ Chrome extension APIs

## Development Scripts

```bash
npm run dev        # Start development server
npm run build      # Build for production
npm run preview    # Preview production build
npm run lint       # Run ESLint
npm run lint:fix   # Fix ESLint issues
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes with proper TypeScript types
4. Test thoroughly
5. Submit a pull request

## License

MIT License - Feel free to use this project for learning or building your own focus apps!

## Original Extension

This is based on the ChronoFocus browser extension. The original extension includes website blocking and browser integration features that are not present in this standalone web version.
