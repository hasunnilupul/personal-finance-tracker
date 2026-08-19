import BrandMark from "@/components/brand-mark";

/**
 * The launch screen, on a cold start only.
 *
 * Server-rendered into the first response and dismissed by CSS. There is no
 * client component here on purpose — a splash that waits for React to hydrate
 * before it can appear has missed the moment it exists for, and one that waits
 * for React to hydrate before it can *leave* is a blank app for anybody whose
 * JavaScript is slow, blocked or broken.
 *
 * So the entire lifecycle is a stylesheet: the mark animates, the whole overlay
 * fades out on a delay, and `animation-fill-mode: forwards` leaves it hidden.
 * Nothing has to run for it to go away, which is the property that matters —
 * this element covers the entire application, and every mechanism that could
 * fail to remove it is a way to lose the app completely.
 *
 * `data-splash="done"` on `<html>`, set by the inline gate in the root layout,
 * is what keeps it to genuine launches rather than every reload. See
 * `lib/pwa/splash.ts`.
 *
 * It is `aria-hidden` and announces nothing. A screen reader user is not
 * waiting on a brand animation, and the page behind it is already being read;
 * interrupting that to say "FinanceFlow" would be noise, and a `role="status"`
 * here would fight with the loading skeletons that follow it.
 */
const AppSplash = () => {
  return (
    <div className="ff-splash" aria-hidden data-splash-root>
      <BrandMark className="ff-splash-mark" animated />

      <p className="ff-splash-word">FinanceFlow</p>
    </div>
  );
};

export default AppSplash;
