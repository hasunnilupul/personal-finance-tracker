import type { ReactNode } from "react";

import BrandMark from "@/components/brand-mark";
import { Card } from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * The frame every page before sign-in shares: the mark, the title, and the card.
 *
 * Sign-in, sign-up, forgot-password and reset-password are one experience, and
 * each carrying its own copy of this block was how they would have drifted apart.
 */
const AuthCard = ({ title, description, children }: AuthCardProps) => {
  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6">
        <div className="mb-6">
          {/*
            The card is the first thing anybody sees of this app, and until now
            it never said whose it was. The mark is `decorative` because the
            wordmark beside it already carries the name — without that, a screen
            reader announces "FinanceFlow FinanceFlow" for one logo.
          */}
          <div className="mb-6 flex items-center gap-2.5">
            <BrandMark className="size-7 shrink-0" gradientId="ff-auth-mark-gradient" decorative />

            {/*
              Set like the splash's wordmark rather than like a heading — same
              uppercase, same tracking, same muted colour. It is branding, not
              the page's title, and at heading weight it competed with the one
              real heading directly beneath it.
            */}
            <span className="text-muted-foreground text-sm font-medium tracking-[0.14em] uppercase">
              FinanceFlow
            </span>
          </div>

          <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>

          <p className="text-muted-foreground mt-1 text-sm">{description}</p>
        </div>

        {children}
      </Card>
    </main>
  );
};

export default AuthCard;
