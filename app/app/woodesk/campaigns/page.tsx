import { requireAuth } from "@/lib/auth/server";
import { CampaignsClient } from "../_components/CampaignsClient";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  await requireAuth();
  return <CampaignsClient />;
}
