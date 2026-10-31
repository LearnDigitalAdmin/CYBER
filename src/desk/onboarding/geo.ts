/** County -> constituency -> ward lists for the join form (the same dataset the signup address pickers use), loaded on demand. */
export interface KenyaConstituency { n: string; w: string[] }
export interface KenyaCounty { n: string; k: KenyaConstituency[] }
let cache: Promise<KenyaCounty[]> | undefined;
export const loadKenya = (): Promise<KenyaCounty[]> => (cache ??= import("../../data/kenyaAdmin.json").then((m) => (m.default ?? m) as KenyaCounty[]));
export const constituenciesOf = (data: KenyaCounty[], county: string): KenyaConstituency[] => data.find((c) => c.n === county)?.k ?? [];
export const wardsOf = (data: KenyaCounty[], county: string, constituency: string): string[] => constituenciesOf(data, county).find((k) => k.n === constituency)?.w ?? [];
