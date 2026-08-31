import { formatPhoneLocal } from "@/lib/phone";

export type TelecomNetwork =
  | "Cellcard"
  | "Metfone"
  | "Smart"
  | "Seatel"
  | "Qube"
  | null;

export const detectCambodiaNetwork = (phoneNumber: string): TelecomNetwork => {
  // Remove all spaces, dashes, or special characters
  const cleanNumber = phoneNumber.replace(/[^0-9]/g, "");

  // Ensure it starts with 0 and check the prefix lengths
  if (!cleanNumber.startsWith("0")) return null;

  // Extract 3-digit prefixes (e.g., 010, 012, 088)
  const prefix3 = cleanNumber.substring(0, 3);

  // Smart Prefixes
  const smart = [
    "010",
    "015",
    "016",
    "069",
    "070",
    "081",
    "086",
    "087",
    "093",
    "096",
    "098",
  ]; //
  if (smart.includes(prefix3)) return "Smart";

  // Seatel Prefixes
  const seatel = ["018"]; //
  if (seatel.includes(prefix3)) return "Seatel";

  // Cellcard Prefixes
  const cellcard = [
    "011",
    "012",
    "014",
    "017",
    "061",
    "076",
    "077",
    "078",
    "079",
    "085",
    "089",
    "092",
    "095",
    "099",
  ]; //
  if (cellcard.includes(prefix3)) return "Cellcard";

  // Metfone Prefixes
  const metfone = [
    "031",
    "060",
    "066",
    "067",
    "068",
    "071",
    "088",
    "090",
    "097",
  ]; //
  if (metfone.includes(prefix3)) return "Metfone";

  // Qube Prefixes
  const qube = ["013", "080", "083", "084"]; //
  if (qube.includes(prefix3)) return "Qube";

  return null;
};

const ICON_PATH: Partial<Record<Exclude<TelecomNetwork, null>, string>> = {
  Cellcard: "/icon/cellcard.png",
  Metfone: "/icon/metfone.png",
  Smart: "/icon/smart.png",
  Seatel: "/icon/seatel.png",
  // Qube: no asset in public/icon — intentionally absent
};

/** Public path of the carrier logo for a phone number, or null when unknown / no asset. */
export const carrierIconPath = (phone: string): string | null => {
  const network = detectCambodiaNetwork(formatPhoneLocal(phone));
  return network ? (ICON_PATH[network] ?? null) : null;
};
