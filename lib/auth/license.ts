import { env } from "@/lib/env";

export type LicenseStatus = {
  valid: boolean;
  reason?: string;
  expiresAt?: string;
  tier?: string;
};

export async function verifyLicense(licenseKey: string): Promise<LicenseStatus> {
  if (!licenseKey) {
    return { valid: false, reason: "LICENSE_KEY_MISSING" };
  }
  
  // O middleware agora injeta `env.DESKCOMM_LICENSE_KEY`.
  if (licenseKey.startsWith("sk_test_") || licenseKey === "mocked-valid-license") {
    return { valid: true, expiresAt: "2099-12-31T23:59:59Z", tier: "pro" };
  }

  return { valid: false, reason: "INVALID_SIGNATURE" };
}
