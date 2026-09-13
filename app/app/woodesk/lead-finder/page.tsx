import { requireAuth } from "@/lib/auth/server";
import { LeadFinderClient } from "../_components/LeadFinderClient";

export const dynamic = "force-dynamic";

export default async function LeadFinderPage() {
  await requireAuth();
  return <LeadFinderClient />;
}
