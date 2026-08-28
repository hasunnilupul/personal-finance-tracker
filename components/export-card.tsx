import { DownloadIcon } from "lucide-react";

import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

interface ExportCardProps {
  spaceName: string;
  baseCurrency: string;
  /** A shared space has no income to export, and one extra thing to explain. */
  isPersonal: boolean;
}

/**
 * Getting the ledger out.
 *
 * A plain link, not a button with an `onClick`. The response is a file, so the
 * browser's own download handling is exactly right: it streams to disk, shows
 * its own progress, and survives the tab navigating away. Fetching it into
 * memory to make a blob URL would buy nothing and would cap the export at
 * whatever the tab can hold.
 *
 * `download` is deliberately **not** set. The filename is chosen by the server
 * from the space's name and today's date, and the attribute would let the
 * markup override the `Content-Disposition` — two places deciding one thing,
 * which is how a file ends up called `route.csv`.
 */
const ExportCard = ({ spaceName, baseCurrency, isPersonal }: ExportCardProps) => {
  return (
    <Card className="p-6">
      <h2 className="text-foreground text-base font-semibold">Export</h2>

      <p className="text-muted-foreground mt-1 text-sm">
        {isPersonal ? (
          <>
            Every entry in <span className="text-foreground font-medium">{spaceName}</span>, plus
            what you have spent from shared spaces, as a CSV file — the amount as it was entered,
            the rate used, and the converted {baseCurrency} figure, so the file reconciles against a
            statement rather than only summing. A <span className="font-medium">Space</span> column
            says where each entry was filed.
          </>
        ) : (
          <>
            Every expense in <span className="text-foreground font-medium">{spaceName}</span> as a
            CSV file — the amount as it was entered, the rate used, and the converted {baseCurrency}{" "}
            figure, so the file reconciles against a statement rather than only summing.
          </>
        )}
      </p>

      <a
        href="/api/export"
        className={buttonVariants({ variant: "default", className: "mt-4 w-full sm:w-auto" })}
      >
        <DownloadIcon />
        Download CSV
      </a>
    </Card>
  );
};

export default ExportCard;
