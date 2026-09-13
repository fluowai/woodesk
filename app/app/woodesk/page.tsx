import { requireAuth } from "@/lib/auth/server";
import { WoodeskDashboardClient } from "./_components/WoodeskDashboardClient";

export const dynamic = "force-dynamic";

export default async function WoodeskDashboardPage() {
  await requireAuth();
  return <WoodeskDashboardClient />;
}
