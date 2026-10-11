import type { EntityKey, Product, Scope } from "../api";

export const SCOPE_LABEL: Record<Scope, string> = {
  read: "View customer details", import: "Import records", manual_entry: "Enter records by hand",
  schedule: "Schedule SMS", bulk_sms: "Send bulk SMS", report: "Run reports", export: "Export data", rent_stk: "Rent payment prompts",
};

export const SCOPE_HELP: Record<Scope, string> = {
  read: "See the account name, plan and SMS credits.",
  import: "Upload an Excel or CSV file for the customer.",
  manual_entry: "Type or copy records in for the customer.",
  schedule: "Set up a scheduled SMS.",
  bulk_sms: "Send one message to many people (needs a code for each send).",
  report: "Generate a report for the customer.",
  export: "Download the customer's data (needs a code for each export).",
  rent_stk: "Send rent payment prompts to tenants (needs a code for each batch).",
};

const ALL_SCOPES: readonly Scope[] = ["read", "import", "manual_entry", "schedule", "bulk_sms", "report", "export", "rent_stk"];

/** Rent payment prompts exist only for Plot Yangu landlords. */
export function scopesForProduct(product: Product): Scope[] {
  return ALL_SCOPES.filter((s) => s !== "rent_stk" || product === "pms");
}

export const PRODUCT_LABEL: Record<Product, string> = { chama: "MyChama", school: "MyRegister", pms: "Plot Yangu" };
/** What each product calls the people an import adds. */
export const RECORD_NOUN: Record<Product, { plural: string; singular: string }> = {
  chama: { plural: "members", singular: "member" },
  school: { plural: "students", singular: "student" },
  pms: { plural: "tenants", singular: "tenant" },
};

export function splitEntityKey(key: EntityKey): { product: Product; code: string } | null {
  const i = key.indexOf(":");
  const product = key.slice(0, i);
  if (i < 1 || (product !== "chama" && product !== "school" && product !== "pms")) return null;
  return { product, code: key.slice(i + 1) };
}
