/**
 * Marks an entry that belongs to another space.
 *
 * A personal ledger lists its owner's shared-space spending beside their own,
 * because that is money out of the same pocket. Without something on the row
 * saying so, the two are indistinguishable — and they do not behave the same:
 * one can be edited here and the other has to be edited where it lives.
 *
 * Rendered only for the rows that need it. A badge on every row would be noise
 * on a page where all but a few say the same thing.
 */
const SpaceBadge = ({ name }: { name: string | null }) => {
  return (
    <span className="bg-muted text-muted-foreground ml-1.5 inline-flex shrink-0 items-center rounded px-1.5 py-0.5 align-middle text-[10px] font-medium">
      {name ?? "Shared"}
    </span>
  );
};

export default SpaceBadge;
