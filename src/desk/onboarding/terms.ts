/**
 * The rules every agent accepts when applying. They restate the Samuhia Desk operating rules (build plan sections 2 and 3);
 * the wording is for the project owner to review before launch.
 */
export const AGENT_TERMS: readonly { title: string; body: string }[] = [
  { title: "Only with the customer's permission", body: "I open a customer's account only when they ask for my help, using the code they read to me. I use the access only for what they asked." },
  { title: "No accounts of my own", body: "I will not own, administer, or be related to the accounts I serve. Samuhia may close a desk that does." },
  { title: "Customer information stays private", body: "I keep everything I see in a customer's account confidential and never share or copy it for any other purpose." },
  { title: "Samuhia sets the prices", body: "I charge customers only the prices shown in the app and take no extra payment outside it." },
  { title: "How I am paid", body: "Service charges and commissions are split automatically by Paystack after its fees. Refunds are handled by Paystack and appear as reversals in my earnings." },
  { title: "My details are true", body: "My name, ID number, phone and documents are my own and accurate. Samuhia may check them." },
  { title: "Samuhia may suspend or close a desk", body: "Samuhia can suspend or close a desk that breaks these rules or puts customers at risk." },
];
