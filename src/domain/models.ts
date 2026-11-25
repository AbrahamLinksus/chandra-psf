export type VehicleType = "scooter" | "motorcycle";

export const OTHER_MODEL = "Other";

/** Dealer two-wheeler pick list (D-48): model name to vehicle type. "Other" asks for both. */
export const HONDA_MODELS: Readonly<Record<string, VehicleType | null>> = {
  Activa: "scooter",
  "Activa 125": "scooter",
  "Activa e:": "scooter",
  "Activa i": "scooter",
  Aviator: "scooter",
  Cliq: "scooter",
  Dio: "scooter",
  "Dio 125": "scooter",
  "CB Hornet 160R": "motorcycle",
  "CB Shine": "motorcycle",
  "CB Trigger": "motorcycle",
  "CB Twister": "motorcycle",
  "CB Unicorn": "motorcycle",
  "CB Unicorn 160": "motorcycle",
  "CB Unicorn Dazzler": "motorcycle",
  "CB125 Hornet": "motorcycle",
  "CB125 Shine SP": "motorcycle",
  "CD 110 Dream": "motorcycle",
  "Dream Neo": "motorcycle",
  "Dream Yuga": "motorcycle",
  Grazia: "motorcycle",
  "Hornet 2.0": "motorcycle",
  Livo: "motorcycle",
  Navi: "motorcycle",
  Shine: "motorcycle",
  "Shine 125": "motorcycle",
  SP125: "motorcycle",
  "SP160 OBD2": "motorcycle",
  Unicorn: "motorcycle",
  "X Blade": "motorcycle",
  [OTHER_MODEL]: null,
};

export const SERVICE_TYPES = [
  "Free service",
  "Paid service",
  "Running repair",
  "Accident repair",
  "Other",
] as const;
