import CreateSpaceForm from "@/components/create-space-form";
import { requireUser } from "@/lib/auth/dal";

const NewSpacePage = async () => {
  await requireUser();

  return (
    <div className="mx-auto w-full max-w-lg">
      <CreateSpaceForm />
    </div>
  );
};

export default NewSpacePage;
