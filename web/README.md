# F1 Fantasy Sports

A modern Formula 1 fantasy sports platform built with React 19, TypeScript, and Vite. Compete with friends by building your dream F1 team and earning points based on real race performance.

## 🏁 Features

- **Landing Page**: Beautiful, responsive landing page with modern design
- **Team Building**: Select drivers and constructors within budget constraints
- **League Management**: Create and join leagues with friends
- **Real-time Scoring**: Live updates during race weekends
- **Mobile-First Design**: Fully responsive interface optimized for all devices
- **Authentication**: Secure user registration and login system

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository

```bash
git clone https://github.com/emsqrd/f1-companion.git
cd f1-companion
```

2. Install dependencies

```bash
npm install
```

3. Set up environment variables

```bash
cp .env.example .env.local
# Add your Supabase credentials
```

4. Start the development server

```bash
npm run dev
```

5. Open [http://localhost:5173](http://localhost:5173) to view the application

## 🧪 Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## 🏗️ Project Structure

```
src/
├── components/          # React components
│   ├── auth/           # Authentication components
│   ├── LandingPage/    # Landing page component
│   ├── ui/             # Reusable UI components (shadcn/ui)
│   └── ...             # Feature-specific components
├── hooks/              # Custom React hooks
├── lib/                # Utility functions and configurations
├── services/           # API services
└── contexts/           # React contexts
```

## 🎨 Design System

The application uses:

- **shadcn/ui**: High-quality, accessible UI components
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Beautiful icons
- **Framer Motion**: Smooth animations

## 📱 Mobile-First Approach

The landing page and entire application follows a mobile-first design philosophy:

- Responsive layouts that work on all screen sizes
- Touch-friendly interface elements
- Optimized performance for mobile devices
- Progressive enhancement for larger screens

## 🔐 Authentication

Secure authentication system powered by Supabase:

- Email/password registration and login
- Protected routes for authenticated users
- Persistent sessions
- Password recovery

## 🛠️ Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Routing**: React Router
- **Authentication**: Supabase Auth
- **Testing**: Vitest, React Testing Library
- **Code Quality**: ESLint, Prettier, Husky

## React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactDom from 'eslint-plugin-react-dom';
import reactX from 'eslint-plugin-react-x';

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
]);
```
