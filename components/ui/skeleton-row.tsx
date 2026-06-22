// Presentational skeleton placeholder for friend-list rows.
// Mirrors the friend-list row layout (avatar circle + name) so the
// loading shape matches the real content (material/shape continuity).
// Pure: no logic, no fetching. mumate tokens, Tailwind animate-pulse.

type SkeletonRowProps = {
  count?: number;
};

export default function SkeletonRow({ count = 1 }: SkeletonRowProps) {
  return (
    <div className="w-full font-prompt">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className="w-full flex flex-nowrap items-center border-b border-border_gray py-2 animate-pulse"
        >
          <div className="flex flex-none w-[40px] h-[40px] rounded-full bg-bg_gray" />
          <div className="w-full flex flex-col grow px-4 gap-2">
            <div className="h-[12px] w-[60%] rounded bg-bg_gray" />
            <div className="h-[12px] w-[40%] rounded bg-bg_gray" />
          </div>
        </div>
      ))}
    </div>
  );
}
