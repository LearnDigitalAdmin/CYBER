/** One readable sentence from anything a desk call can throw. DeskApiError messages are already written for people. */
export function messageOf(e: unknown): string {
  if (e instanceof Error && e.message) return e.message;
  return "Something went wrong. Please try again.";
}
