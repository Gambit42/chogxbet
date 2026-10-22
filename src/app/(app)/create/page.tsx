import { Suspense } from "react";
import { CreateCall } from "@/features/betting/create-call";

// ?mode=lastword opens the form in Last Word mode.
export default function CreatePage({ searchParams }: PageProps<"/create">) {
  return (
    <Suspense>
      {searchParams.then((sp) => (
        <CreateCall key={String(sp.mode)} preset={{ lastWord: sp.mode === "lastword" }} />
      ))}
    </Suspense>
  );
}
