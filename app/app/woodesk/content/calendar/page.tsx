import { requireAuth } from "@/lib/auth/server";
import { ContentCalendarClient } from "../../_components/ContentCalendarClient";

export const dynamic = "force-dynamic";

export default async function ContentCalendarPage() {
  await requireAuth();
  return <ContentCalendarClient />;
}
