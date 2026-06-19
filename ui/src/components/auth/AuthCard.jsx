export default function AuthCard({ children, className = '' }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-8 bg-slate-50 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className={`
          bg-white dark:bg-slate-900
          rounded-2xl shadow-xl
          border border-slate-100 dark:border-slate-800
          p-8 space-y-6
          animate-fade-in
          ${className}
        `}>
          {children}
        </div>
      </div>
    </div>
  );
}
