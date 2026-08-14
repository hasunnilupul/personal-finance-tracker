"use client";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/auth-client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";

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

  return (
    <Button onClick={handleSignOut} disabled={isSigningOut} variant="outline" size="sm">
      {isSigningOut ? "Signing out..." : "Sign Out"}
    </Button>
  );
};

export default SignOutButton;
