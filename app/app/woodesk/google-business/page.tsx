import { requireAuth } from "@/lib/auth/server";
import { GoogleBusinessClient } from "../_components/GoogleBusinessClient";

export const dynamic = "force-dynamic";

export default async function GoogleBusinessPage() {
  await requireAuth();
  return <GoogleBusinessClient />;
}
