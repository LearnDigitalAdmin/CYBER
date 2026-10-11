import type { AgentStatus } from "../api";

export interface JourneyStep { status: Extract<AgentStatus, "applied" | "training" | "certified" | "active">; label: string }
export const JOURNEY: readonly JourneyStep[] = [
  { status: "applied", label: "Applied" },
  { status: "training", label: "Training" },
  { status: "certified", label: "Certified" },
  { status: "active", label: "Active" },
];

/** Index of the current step in JOURNEY, or -1 for suspended / closed (which sit outside the normal path). */
export function journeyIndex(status: AgentStatus): number {
  return JOURNEY.findIndex((s) => s.status === status);
}

export interface NextSteps { headline: string; lines: string[]; tone: "blue" | "green" | "amber" | "red" }

/** Plain-language next steps for each status. Activation needs three documents and a payout account (server-enforced). */
export function nextSteps(status: AgentStatus): NextSteps {
  switch (status) {
    case "applied":
      return {
        headline: "Application received", tone: "blue",
        lines: [
          "Upload your ID (front and back) and a selfie in Account → Documents.",
          "Set up the payout account where your earnings are paid, in Account → Payout accounts.",
          "Samuhia reviews your application and invites you to training.",
        ],
      };
    case "training":
      return {
        headline: "You are in training", tone: "blue",
        lines: [
          "Complete your training with Samuhia.",
          "Make sure your three documents and your payout account are done in Account, so you can be activated straight after.",
        ],
      };
    case "certified":
      return {
        headline: "You are certified", tone: "blue",
        lines: [
          "Your desk is waiting for activation by Samuhia.",
          "Activation needs all three documents uploaded and your payout account ready. Check both in Account.",
        ],
      };
    case "active":
      return {
        headline: "Your desk is active", tone: "green",
        lines: ["You can now open customer sessions. Start in Access: enter the customer's code and ask for their OTP."],
      };
    case "suspended":
      return {
        headline: "Your desk is suspended", tone: "amber",
        lines: ["You cannot open customer sessions while suspended.", "Contact Samuhia to find out why and what is needed to be reinstated."],
      };
    case "closed":
      return {
        headline: "Your desk is closed", tone: "red",
        lines: ["This desk is permanently closed and cannot be reopened.", "Contact Samuhia if you think this is a mistake."],
      };
  }
}
