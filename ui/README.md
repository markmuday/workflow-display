# UI

React frontend for workflow-display.

## Setup

```bash
npm install
```

## Running

```bash
npm run dev       # dev server (http://localhost:5173)
npm run build     # production build
npm run preview   # preview production build
npm run lint      # lint
```

## Stack

- React 19, TypeScript, Vite
- Tailwind CSS v4
- shadcn/ui + Radix UI primitives
- react-router-dom v7
- dnd-kit (drag-and-drop)
- lucide-react (icons)

## Routes

| Path | Page |
|------|------|
| `/` | Workflow list |
| `/workflow/:id` | Workflow detail |
| `/workflow/:id/edit` | Workflow editor |

## API Proxy

The Vite dev server proxies `/api` to `http://localhost:5001`. Make sure the Flask backend is running on that port.
