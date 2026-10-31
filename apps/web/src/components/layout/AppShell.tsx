import { Topbar } from "./Topbar";
import { MobileTabBar } from "./MobileTabBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-bg-primary text-text-primary">
      <Topbar />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0">{children}</main>
      <MobileTabBar />
    </div>
  );
}
