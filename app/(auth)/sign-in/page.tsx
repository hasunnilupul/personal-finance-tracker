import AuthForm from "@/components/auth-form";
import { safeRedirectPath } from "@/lib/utils";

interface SignInPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

const SignInPage = async ({ searchParams }: SignInPageProps) => {
  const { redirect } = await searchParams;

  return <AuthForm mode="sign-in" redirectTo={safeRedirectPath(redirect)} />;
};

export default SignInPage;
