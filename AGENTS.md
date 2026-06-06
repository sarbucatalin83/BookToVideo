# Frontend

Plain React with Vite. Source lives in `src/`. Entry point is `src/main.tsx`.

# Backend / Worker

The BullMQ worker (`worker/index.ts`) runs separately via `npm run worker`. It is not part of the Vite build — it runs with `tsx` directly.
