// Full-screen loading state shown while client identity is still resolving
// (see lib/auth/use-current-user.ts). Prevents the "page breaks then data pops
// in with no loading indicator" flash reported during the browser walkthrough.

export default function ScreenLoading({ label = "กำลังโหลด..." }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-4 bg-white">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-gray-200 border-t-moumate_blue" />
      <p className="text-sm text-gray-500">{label}</p>
    </div>
  );
}
