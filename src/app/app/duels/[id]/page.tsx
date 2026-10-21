import { Suspense } from "react";
import { DuelPage } from "@/features/betting/duel-page";

// The id is only known at request time, so it's read inside Suspense (Cache Components).
export default function Page({ params }: PageProps<"/app/duels/[id]">) {
  return (
    <Suspense fallback={<div className="h-[320px] animate-pulse rounded-2xl bg-[#F1EEFB] motion-reduce:animate-none" />}>
      {params.then(({ id }) => <DuelPage id={id} />)}
    </Suspense>
  );
}
