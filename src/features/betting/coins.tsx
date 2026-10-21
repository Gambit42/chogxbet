// Each asset settles on its Chainlink feed (networks.ts); an asset only shows on networks that have one.
export const ASSETS = {
  MON: { name: "Monad", eg: "0.02", bg: "#836EF9", mark: <path transform="translate(6.6 6.4) scale(.8)" fill="#fff" d="M11.7375 0C8.34799 0 0 8.53443 0 11.9999C0 15.4654 8.34799 24 11.7375 24C15.1271 24 23.4752 15.4653 23.4752 11.9999C23.4752 8.53458 15.1272 0 11.7375 0ZM9.90843 18.8619C8.47911 18.4637 4.63621 11.5912 5.02577 10.1299C5.41532 8.66856 12.1374 4.73984 13.5667 5.1381C14.9961 5.5363 18.839 12.4087 18.4494 13.87C18.0599 15.3314 11.3378 19.2602 9.90843 18.8619Z" /> },
  BTC: { name: "Bitcoin", eg: "85,000", bg: "#F7931A", mark: <g transform="rotate(14 16 16)" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinejoin="round"><path d="M12 9.5h5a3.25 3.25 0 0 1 0 6.5h-5zm0 6.5h6a3.25 3.25 0 0 1 0 6.5h-6zM14 7v2.5m3-2.5v2.5m-3 13V25m3-2.5V25" /></g> },
  SOL: { name: "Solana", eg: "110", bg: "#14111F", mark: <g fill="#14F195"><path d="M11 10h12l-2 2.6H9z" /><path d="M9 14.7h12l2 2.6H11z" fill="#9AA5F8" /><path d="M11 19.4h12l-2 2.6H9z" fill="#C86DFF" /></g> },
  ETH: { name: "Ethereum", eg: "2,500", bg: "#627EEA", mark: <g fill="#fff"><path fillOpacity=".6" d="M16.5 4v8.87l7.5 3.35z" /><path d="M16.5 4 9 16.22l7.5-3.35z" /><path fillOpacity=".6" d="M16.5 21.97V28l7.5-10.38z" /><path d="M16.5 28v-6.03L9 17.62z" /><path fillOpacity=".2" d="m16.5 20.57 7.5-4.35-7.5-3.35z" /><path fillOpacity=".6" d="m9 16.22 7.5 4.35v-7.7z" /></g> },
};
export type Asset = keyof typeof ASSETS;
export const Coin = ({ a, className = "size-6" }: { a: Asset; className?: string }) => (
  <svg viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden><circle cx="16" cy="16" r="16" fill={ASSETS[a].bg} />{ASSETS[a].mark}</svg>
);
