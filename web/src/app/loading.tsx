export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="size-8 animate-spin rounded-full border-2 border-stone-200 border-t-stone-600" />
        <span className="text-sm text-stone-400">加载中...</span>
      </div>
    </div>
  );
}
