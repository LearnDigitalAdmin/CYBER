import type { Product, WorkspaceErrorReason } from "../contract.js";
import { DeskError, type DeskErrorCode } from "../errors.js";

/** A workspace refusal: a DeskError (so every callable wrapper maps it) that also says which kind of refusal it was. */
export class WorkspaceError extends DeskError {
  readonly reason: WorkspaceErrorReason;
  constructor(code: DeskErrorCode, reason: WorkspaceErrorReason, message: string) {
    super(code, message);
    this.name = "WorkspaceError";
    this.reason = reason;
  }
}

export type OfferKind = "audience" | "report" | "export";
const OFFER: Record<OfferKind, { reason: WorkspaceErrorReason; label: string }> = {
  audience: { reason: "no_such_audience", label: "audience" },
  report: { reason: "no_such_report", label: "report" },
  export: { reason: "no_such_export", label: "export" },
};

/** The entity's own plan or setup does not offer what was asked for. */
export class EntityOfferError extends WorkspaceError {
  readonly kind: OfferKind;
  constructor(kind: OfferKind, value: string) {
    super("invalid_argument", OFFER[kind].reason, `This customer's account doesn't offer the ${OFFER[kind].label} "${value}".`);
    this.name = "EntityOfferError";
    this.kind = kind;
  }
}

/** A pms-only feature was asked for on a chama or a school. */
export class NotPmsEntityError extends WorkspaceError {
  constructor(feature: string) {
    super("failed_precondition", "not_pms_entity", `${feature} is only available for Plot Yangu (landlord) accounts.`);
    this.name = "NotPmsEntityError";
  }
}

/** The product's delegate does not implement the action yet (its unknown-action reply). */
export class ProductUnsupportedError extends WorkspaceError {
  constructor(product: Product) {
    super("failed_precondition", "product_unsupported",
      `${PRODUCT_NAMES[product]} doesn't support this yet. Please try again later or contact Samuhia.`);
    this.name = "ProductUnsupportedError";
  }
}
const PRODUCT_NAMES: Record<Product, string> = { chama: "MyChama", school: "MyRegister", pms: "Plot Yangu" };
