import Link from "next/link";

export function PublicShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="bg-brand-900 text-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5">
          <Link href="/careers" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-500 text-sm font-bold">
              P
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight">Paragon Global Internships</p>
              <p className="text-xs text-indigo-200">Careers</p>
            </div>
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-10">{children}</main>
      <footer className="pb-10 text-center text-xs text-slate-400">© Paragon Global Internships · Realising Excellence</footer>
    </div>
  );
}
