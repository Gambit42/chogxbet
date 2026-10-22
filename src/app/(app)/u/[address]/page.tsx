import { Suspense } from "react";
import { isAddress } from "viem";
import { ProfilePanel } from "@/features/profile/profile";

// Anyone's public profile: their Chogs, each one's record and the line it wears. ?chog= opens that Chog.
// The address is only known at request time, so it's read inside Suspense (Cache Components).
export default function Page({ params, searchParams }: PageProps<"/u/[address]">) {
  return (
    <Suspense>
      {Promise.all([params, searchParams]).then(([{ address }, sp]) =>
        isAddress(address) ? (
          <ProfilePanel address={address} chog={typeof sp.chog === "string" ? sp.chog : undefined} />
        ) : (
          <p className="text-[15px] text-[#6B6185]">That isn&apos;t a wallet address.</p>
        ),
      )}
    </Suspense>
  );
}
