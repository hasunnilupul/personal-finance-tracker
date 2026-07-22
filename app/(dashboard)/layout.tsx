import { ReactNode } from "react";
import AppSidebar from "@/components/app-sidebar";
import { auth } from "@/lib/auth/auth";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { headers } from "next/headers";
import SignOutButton from "@/components/sign-out-button";

const DashboardLayout = async ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const user = session?.user;
  const userName = user?.name || user?.email || "User";

  return (
    <div className="bg-background flex h-screen w-screen overflow-hidden">
      <AppSidebar />

      <main className="w-full flex-1 overflow-auto pb-24 md:pb-0">
        <div className="border-border bg-card border-b p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-foreground truncate text-2xl font-bold sm:text-3xl">
                Welcome back, {userName}
              </h1>
              <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                Track your expenses and manage your budget
              </p>
            </div>
            <div className="flex items-center gap-2">
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
