import TransactionPageContent, {
  TransactionSearchParams,
} from "@/components/transactions/transaction-page";

interface ExpensesPageProps {
  searchParams: Promise<TransactionSearchParams>;
}

const ExpensesPage = ({ searchParams }: ExpensesPageProps) => {
  return <TransactionPageContent kind="expense" searchParams={searchParams} />;
};

export default ExpensesPage;
