import { requireAuth } from "@/lib/auth/server";
import { ProposalsClient } from "../_components/ProposalsClient";

export const dynamic = "force-dynamic";

export default async function ProposalsPage() {
  await requireAuth();
  return <ProposalsClient />;
}
