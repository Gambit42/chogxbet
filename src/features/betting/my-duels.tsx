import Link from "next/link";

// Duel history will come from the escrow contract once it's deployed; until then the list is empty.
export function MyDuels() {
  return (
    <>
      <h1 className="m-0 text-[32px] leading-[1.1] font-semibold tracking-[-.03em]">My duels</h1>
      <div className="mt-8 rounded-2xl border border-dashed border-[#DCD5EC] bg-white px-6 py-16 text-center">
        <p className="m-0 text-[17px] font-semibold">No duels yet</p>
        <p className="mx-auto mt-1.5 max-w-[44ch] text-[15px] text-[#6B6185]">
          Calls you make or accept show up here with their stake, result and status.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Link href="/app/create" className="inline-flex rounded-[10px] bg-[#6E56E8] px-4 py-2.5 text-[14px] font-semibold text-white hover:brightness-[.96]">
            Make a call
          </Link>
          <Link href="/app" className="inline-flex rounded-[10px] border border-[#DCD5EC] bg-white px-4 py-2.5 text-[14px] font-semibold hover:bg-[#F7F5FB]">
            Browse open calls
          </Link>
        </div>
      </div>
    </>
  );
}
