import TransactionPageContent, {
  TransactionSearchParams,
} from "@/components/transactions/transaction-page";

interface IncomePageProps {
  searchParams: Promise<TransactionSearchParams>;
}

const IncomePage = ({ searchParams }: IncomePageProps) => {
  return <TransactionPageContent kind="income" searchParams={searchParams} />;
};

export default IncomePage;
