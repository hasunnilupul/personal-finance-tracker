import ChangePasswordForm from "@/components/change-password-form";
import SettingsSubnav from "@/components/settings-subnav";
import TwoFactorCard from "@/components/two-factor-card";
import { requireUser } from "@/lib/auth/dal";

const AccountSettingsPage = async () => {
  const user = await requireUser();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Security for <span className="text-foreground font-medium">{user.email}</span>. These
          follow you, not the space you have open.
        </p>
      </div>

      <SettingsSubnav current="account" />

      <ChangePasswordForm />

      <TwoFactorCard enabled={user.twoFactorEnabled === true} />
    </div>
  );
};

export default AccountSettingsPage;
