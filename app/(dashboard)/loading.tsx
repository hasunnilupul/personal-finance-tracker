export default function DashboardLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />

        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    </div>
  );
}
