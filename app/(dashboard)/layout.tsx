import { ReactNode } from "react";
import AppSidebar from "@/components/app-sidebar";
import SpaceSwitcher from "@/components/space-switcher";
import { listSpaces, requireActiveSpace } from "@/lib/auth/dal";
import { ThemeSwitcher } from "@/components/theme-switcher";
import SignOutButton from "@/components/sign-out-button";

const DashboardLayout = async ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => {
  const [{ space }, spaces] = await Promise.all([requireActiveSpace(), listSpaces()]);

  return (
    <div className="bg-background flex h-screen w-screen overflow-hidden">
      <AppSidebar />

      <main className="w-full flex-1 overflow-auto pb-24 md:pb-0">
        <div className="border-border bg-card border-b p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-foreground truncate text-2xl font-bold sm:text-3xl">
                {space.isPersonal ? "Your money" : space.name}
              </h1>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                {space.isPersonal
                  ? "Private to you — nobody else can see this ledger"
                  : "Shared space — everyone here can add and edit entries"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-40 sm:w-48">
                <SpaceSwitcher spaces={spaces} activeSpaceId={space.id} />
              </div>
              <ThemeSwitcher />
              <SignOutButton />
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
