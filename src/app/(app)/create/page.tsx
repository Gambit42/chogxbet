import { Suspense } from "react";
import { CreateCall } from "@/features/betting/create-call";

// ?mode=lastword opens the form in Last Word mode; ?chog=7 enters with that Chog (the "Win it back" links).
export default function CreatePage({ searchParams }: PageProps<"/create">) {
  return (
    <Suspense>
      {searchParams.then((sp) => (
        <CreateCall key={`${sp.mode}-${sp.chog}`} preset={{ lastWord: sp.mode === "lastword", chog: typeof sp.chog === "string" ? sp.chog.replace(/\D/g, "") : "" }} />
      ))}
    </Suspense>
  );
}
