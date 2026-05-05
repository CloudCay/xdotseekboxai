# AGENTS.md

This document provides an overview of the project structure for developers and AI agents working on this codebase.

## Project Architecture

SeekBoxAi is an interactive multi-AI search platform. Built with TanStack Start and deployed on Netlify.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start |
| Frontend | React 19, TanStack Router v1 |
| Build | Vite 7 |
| Styling | Tailwind CSS 4 |
| UI Components | Lucide React |
| Language | TypeScript 5.7 (strict mode) |
| Deployment | Netlify |

## Directory Structure

```
├── public/
│   └── favicon.ico
├── src/
│   ├── routes/
│   │   ├── __root.tsx  # Root layout: basic HTML setup and global classes.
│   │   ├── index.tsx   # Premium dark-mode SaaS landing page for SeekBoxAi.
│   │   └── faq.tsx     # Additional routes.
│   ├── router.tsx      # TanStack Router setup.
│   └── styles.css      # Global styles with Tailwind import.
├── netlify.toml        # Netlify deployment config.
├── package.json        # Project manifest.
├── tsconfig.json       # TypeScript config.
└── vite.config.ts      # Vite config.
```

## Key Decisions and Conventions

### Routing
Uses TanStack Router for file-based routing. The `__root.tsx` defines the shell, and page components are located in `src/routes/`.

### Styling
Tailwind CSS v4 is used exclusively for styling. The application defaults to a dark mode aesthetic (`bg-[#050B14]`, `text-slate-50`). No separate UI component library is currently heavily utilized; rather, fully custom Tailwind components are implemented directly in the routes to match the futuristic cyberpunk/high-tech aesthetic.

### 3D/Effects
The UI utilizes CSS 3D transforms (`perspective`, `rotateX`, `rotateY`), custom CSS animations, and composite gradients directly within React components to achieve a premium "Apple meets xAI" presentation without heavy WebGL libraries.

### Environment
The project targets Node v22 and Netlify deployment. Local development should utilize `netlify dev` to properly emulate edge functions or specific routing if added later.
