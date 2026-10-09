import { DeskError } from "./errors.js";
import type { EntityKey, Product } from "./contract.js";

const PRODUCTS: readonly Product[] = ["chama", "school", "pms"];
const CODE = /^[A-Za-z0-9-]{3,40}$/;

export function makeEntityKey(product: Product, code: string): EntityKey {
  const c = code.trim().toUpperCase();
  if (!CODE.test(c)) throw new DeskError("invalid_argument", "Invalid customer code");
  return `${product}:${c}`;
}
export function parseEntityKey(key: string): { product: Product; code: string } {
  const i = key.indexOf(":");
  const product = key.slice(0, i) as Product;
  const code = key.slice(i + 1);
  if (i < 1 || !PRODUCTS.includes(product) || !CODE.test(code)) throw new DeskError("invalid_argument", "Invalid entity key");
  return { product, code };
}
