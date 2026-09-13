import { Metadata } from "next";
import { ResellerDashboardClient } from "./_client";
import { Suspense } from "react";

export const metadata: Metadata = {
  title: "Reseller Dashboard | Woodesk",
};

export default function ResellerDashboardPage() {
  return (
    <Suspense fallback={<div>Carregando dashboard...</div>}>
      <ResellerDashboardClient />
    </Suspense>
  );
}
