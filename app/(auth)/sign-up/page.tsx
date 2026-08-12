import AuthForm from "@/components/auth-form";
import { safeRedirectPath } from "@/lib/utils";

interface SignUpPageProps {
  searchParams: Promise<{ redirect?: string }>;
}

const SignUpPage = async ({ searchParams }: SignUpPageProps) => {
  const { redirect } = await searchParams;

  return <AuthForm mode="sign-up" redirectTo={safeRedirectPath(redirect)} />;
};

export default SignUpPage;
