import AuthForm from "@/components/auth-form";
import { safeRedirectPath } from "@/lib/utils";

interface SignInPageProps {
  searchParams: Promise<{ redirect?: string; reset?: string }>;
}

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const { redirect, reset } = await searchParams;

  return (
    <AuthForm
      mode="sign-in"
      redirectTo={safeRedirectPath(redirect)}
      notice={
        reset === "1" ? "Your password has been changed. Sign in with the new one." : undefined
      }
    />
  );
};

export default SignInPage;
