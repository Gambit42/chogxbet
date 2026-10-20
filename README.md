# Chog Conviction

Next.js project with TypeScript, Tailwind CSS v4, and shadcn/ui (Base UI), with a Chog Conviction landing page and betting UI demo at `/app`.

See [Monad mainnet deployment plan](MONAD_MAINNET_PLAN.md) for the contract, oracle, wallet, settlement worker, and X/Twitter sharing work needed to launch real duels. Wallet login uses Privy + wagmi; betting actions are still simulated.

## Development

```sh
npm install
npm run dev
```

Copy `.env.example` to `.env` and fill in the Privy app ID.

## Checks

```sh
npm run lint
npm run build
```

Reusable UI components live in `src/components/ui`. Theme tokens live in `src/app/globals.css`.
