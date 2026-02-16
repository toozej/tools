import JsonUtils from '@/components/JsonUtils';

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 text-slate-900 dark:text-white">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10 dark:from-blue-900/20 dark:to-purple-900/20" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">
              JSON Utils
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
              All-in-one JSON toolkit: Format, validate, convert to YAML, compare diffs, and fix incomplete JSON.
            </p>
          </div>
        </div>
      </div>

      {/* App Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="bg-white dark:bg-slate-800/50 rounded-2xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-6 lg:p-8">
          <JsonUtils />
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-2">📝</div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Format & Validate</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Auto-format and validate JSON with customizable indentation</p>
          </div>
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-2">🔄</div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">JSON to YAML</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Convert JSON to YAML with multiple output styles</p>
          </div>
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-2">🔍</div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">JSON Diff</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Compare two JSON documents and see detailed differences</p>
          </div>
          <div className="bg-white dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="text-2xl mb-2">🔧</div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">Incomplete JSON</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Format and fix truncated or incomplete JSON data</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              JSON Utils - All-in-one JSON toolkit
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Auto-saves input to local storage
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
