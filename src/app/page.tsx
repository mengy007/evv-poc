// src/app/page.tsx
import DeviceBootstrap from "./components/DeviceBootstrap";

export const dynamic = "force-dynamic"; // ensure fresh data per request (optional)

type SearchParams = Record<string, string | string[] | undefined>;

function firstStr(v: string | string[] | undefined): string | null {
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v) && v.length) return v[0]?.trim() || null;
  return null;
}

export default function Page({ searchParams }: { searchParams: SearchParams }) {
  const agentId = firstStr(searchParams.agentId);

  return (
    <main className="min-h-dvh p-6">
      <div className="mx-auto w-full max-w-5xl space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Agent Device Link</h1>
          <p className="text-sm text-slate-600">
            Pass <code className="font-mono">?agentId=USER_HASH</code> in the
            URL.
          </p>
        </header>

        <DeviceBootstrap agentId={agentId} />
      </div>
    </main>
  );
}
