"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/auth-client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOutIcon } from "lucide-react";

const SignOutButton = () => {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleSignOut = useCallback(async () => {
    setIsSigningOut(true);
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push("/sign-in"); // redirect to login page
          setIsSigningOut(false);
        },
        onError: () => {
          setIsSigningOut(false);
        },
      },
    });
  }, [router, setIsSigningOut]);

  const label = isSigningOut ? "Signing out..." : "Sign Out";

  return (
    // The label is hidden rather than dropped below `sm`, so the button is an
    // icon on a phone and still announces itself — and still says "Signing
    // out..." while it does.
    <Button
      onClick={handleSignOut}
      disabled={isSigningOut}
      variant="outline"
      size="sm"
      title={label}
      className="px-2 sm:px-3"
    >
      <LogOutIcon />
      <span className="sr-only sm:not-sr-only">{label}</span>
    </Button>
  );
};

export default SignOutButton;
