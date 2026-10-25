import { createAuthClient } from "better-auth/react";
import { organizationClient, twoFactorClient } from "better-auth/client/plugins";

import { ac, roles } from "@/lib/auth/permissions";

export const authClient = createAuthClient({
  plugins: [
    organizationClient({
      ac,
      roles,
    }),
    // No redirect option: the sign-in form reads `twoFactorRedirect` off the
    // response and swaps in the code step itself, which keeps the page, the
    // typed email and the `?redirect=` destination where they were.
    twoFactorClient(),
  ],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  organization: spaces,
  requestPasswordReset,
  resetPassword,
  changePassword,
  twoFactor,
} = authClient;
