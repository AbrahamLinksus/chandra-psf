export type VehicleType = "scooter" | "motorcycle";

export const OTHER_MODEL = "Other";

/** Honda two-wheeler pick list (SPEC F-2): model name to vehicle type. "Other" asks for both. */
export const HONDA_MODELS: Readonly<Record<string, VehicleType | null>> = {
  "Activa 6G": "scooter",
  "Activa 125": "scooter",
  Dio: "scooter",
  "Dio 125": "scooter",
  Shine: "motorcycle",
  "Shine 100": "motorcycle",
  SP125: "motorcycle",
  Unicorn: "motorcycle",
  "Hornet 2.0": "motorcycle",
  CB350: "motorcycle",
  Livo: "motorcycle",
  [OTHER_MODEL]: null,
};

export const SERVICE_TYPES = [
  "Free service",
  "Paid service",
  "Running repair",
  "Accident repair",
  "Other",
] as const;
