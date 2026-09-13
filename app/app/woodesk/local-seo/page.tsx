import { requireAuth } from "@/lib/auth/server";
import { LocalSeoClient } from "../_components/LocalSeoClient";

export const dynamic = "force-dynamic";

export default async function LocalSeoPage() {
  await requireAuth();
  return <LocalSeoClient />;
}
