import { getFounders } from "@/app/actions";
import FounderDashboard from "@/app/FounderDashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const initialFounders = await getFounders();
  return <FounderDashboard initialFounders={initialFounders} />;
}
