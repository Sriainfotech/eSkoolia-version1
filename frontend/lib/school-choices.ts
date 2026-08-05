/**
 * Shared dropdown option lists for school-identity fields, kept in sync with
 * the canonical lists returned by SchoolFormChoicesView
 * (backend/apps/super_admin/views.py). Duplicated here (rather than fetched)
 * because the source endpoint is super-admin-gated and this data barely
 * changes, but tenant-facing pages (Settings > School Info) still need it.
 */

export const MEDIUM_OF_INSTRUCTION_OPTIONS = [
  "English",
  "English & Hindi",
  "English & Telugu",
  "Telugu",
  "Hindi",
  "Urdu",
  "Kannada",
  "Tamil",
  "Marathi",
];

export const BOARD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "CBSE", label: "CBSE" },
  { value: "ICSE", label: "ICSE" },
  { value: "SSC_TG", label: "SSC TG" },
  { value: "SSC_AP", label: "SSC AP" },
  { value: "OTHER", label: "Other" },
];

export const INDIAN_STATE_OPTIONS: Array<{ code: string; name: string }> = [
  { code: "35", name: "Andaman and Nicobar Islands" },
  { code: "37", name: "Andhra Pradesh" },
  { code: "12", name: "Arunachal Pradesh" },
  { code: "18", name: "Assam" },
  { code: "10", name: "Bihar" },
  { code: "04", name: "Chandigarh" },
  { code: "22", name: "Chhattisgarh" },
  { code: "26", name: "Dadra and Nagar Haveli and Daman and Diu" },
  { code: "07", name: "Delhi" },
  { code: "30", name: "Goa" },
  { code: "24", name: "Gujarat" },
  { code: "06", name: "Haryana" },
  { code: "02", name: "Himachal Pradesh" },
  { code: "01", name: "Jammu and Kashmir" },
  { code: "20", name: "Jharkhand" },
  { code: "29", name: "Karnataka" },
  { code: "32", name: "Kerala" },
  { code: "38", name: "Ladakh" },
  { code: "31", name: "Lakshadweep" },
  { code: "23", name: "Madhya Pradesh" },
  { code: "27", name: "Maharashtra" },
  { code: "14", name: "Manipur" },
  { code: "17", name: "Meghalaya" },
  { code: "15", name: "Mizoram" },
  { code: "13", name: "Nagaland" },
  { code: "21", name: "Odisha" },
  { code: "34", name: "Puducherry" },
  { code: "03", name: "Punjab" },
  { code: "08", name: "Rajasthan" },
  { code: "11", name: "Sikkim" },
  { code: "33", name: "Tamil Nadu" },
  { code: "36", name: "Telangana" },
  { code: "16", name: "Tripura" },
  { code: "09", name: "Uttar Pradesh" },
  { code: "05", name: "Uttarakhand" },
  { code: "19", name: "West Bengal" },
].sort((a, b) => a.name.localeCompare(b.name));

export const REGION_OPTIONS = ["north", "south", "east", "west", "northeast"];

// Maps each Indian state/UT code to one of REGION_OPTIONS. There's no "central"
// bucket in this app's Region field, so Madhya Pradesh/Chhattisgarh are folded
// into their nearest neighbours (west/east) rather than left unmapped.
export const STATE_CODE_TO_REGION: Record<string, string> = {
  "01": "north", "02": "north", "03": "north", "04": "north", "06": "north",
  "07": "north", "08": "north", "09": "north", "05": "north", "38": "north",
  "37": "south", "36": "south", "29": "south", "32": "south", "33": "south",
  "34": "south", "35": "south", "31": "south",
  "10": "east", "20": "east", "21": "east", "19": "east", "22": "east",
  "24": "west", "27": "west", "30": "west", "26": "west", "23": "west",
  "12": "northeast", "18": "northeast", "14": "northeast", "17": "northeast",
  "15": "northeast", "13": "northeast", "16": "northeast", "11": "northeast",
};

// Nominatim reverse-geocode returns full state names (with occasional variants);
// match them against INDIAN_STATE_OPTIONS to recover the code the State <select> uses.
const STATE_NAME_ALIASES: Record<string, string> = {
  "nct of delhi": "Delhi",
  "national capital territory of delhi": "Delhi",
  "orissa": "Odisha",
  "pondicherry": "Puducherry",
  "uttaranchal": "Uttarakhand",
};

export function matchStateNameToCode(name: string | undefined | null): string | undefined {
  if (!name) return undefined;
  const normalized = STATE_NAME_ALIASES[name.trim().toLowerCase()] ?? name.trim();
  const match = INDIAN_STATE_OPTIONS.find((s) => s.name.toLowerCase() === normalized.toLowerCase());
  return match?.code;
}
