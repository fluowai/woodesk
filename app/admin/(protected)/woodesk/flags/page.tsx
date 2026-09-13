import type { Metadata } from "next";
import { WoodeskFlagsClient } from "./_client";

export const metadata: Metadata = { title: "Woodesk · Feature flags" };

export default function WoodeskFlagsPage() {
  return <WoodeskFlagsClient />;
}
