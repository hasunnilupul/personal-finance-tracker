import { ReactNode } from "react";
import AppSidebar from "@/components/app-sidebar";
import AppTopbar from "@/components/app-topbar";
import { listSpaces, requireActiveSpace } from "@/lib/auth/dal";

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
        <AppTopbar space={space} spaces={spaces} />

        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
