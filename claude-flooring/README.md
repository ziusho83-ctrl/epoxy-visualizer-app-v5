# Claude Flooring

Replicated from the Epoxy Visualizer V5 app, rebranded as **Claude Flooring**. The original app at the repository root is left untouched.

## Stack
- React 19 + TypeScript + Vite
- Serverless API routes under `api/` (Vercel)
- Auto-mask via Replicate (Grounding DINO + SAM)
- Quote intake with optional Resend email + webhook forwarding

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
```

## Environment variables
See `.env.example`.
