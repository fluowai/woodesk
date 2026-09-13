import { requireAuth } from "@/lib/auth/server";
import { ContentStudioClient } from "../_components/ContentStudioClient";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  await requireAuth();
  return <ContentStudioClient />;
}
