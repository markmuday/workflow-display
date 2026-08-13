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

## Workflow editor

Add, remove, and reorder steps, options, and actions. All edits are kept in local
state and only persisted when **Save** is clicked (**Discard** resets them).

- **Reorder steps** — drag the grip handle on a step card (dnd-kit; keyboard-accessible
  via Space/arrows/Space). Ordinals are recomputed to a contiguous `1..N` sequence on
  save, so gaps and duplicate ordinals are collapsed.
- **Rollup mode** — toggle in the header to collapse each step to a single line (name
  only, no options/actions), making it easier to see and rearrange many steps at once.
  Adding a step still works in this mode.

## API Proxy

The Vite dev server proxies `/api` to `http://localhost:5001`. Make sure the Flask backend is running on that port.
