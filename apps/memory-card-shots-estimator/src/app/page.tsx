import MemoryCardEstimator from "@/components/MemoryCardEstimator";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-teal-50 via-slate-100 to-slate-200 p-4 dark:from-slate-800 dark:via-slate-950 dark:to-black sm:p-8">
      <MemoryCardEstimator />
    </main>
  );
}
