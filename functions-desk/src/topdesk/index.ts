import type {
  TopGetDeskIn, TopGetDeskOut, TopGetDocIn, TopGetDocOut, TopListDesksIn, TopListDesksOut, TopRequestOtpIn, TopRequestOtpOut,
  TopSetDeskStatusIn, TopSetDeskStatusOut, TopSetRankIn, TopSetRankOut,
} from "../contract.js";
import { topCallable } from "./callable.js";
import { HP_SECRETS } from "../kernel/sms.js";
import { defaultTopDeps } from "./deps.js";
import {
  topGetDesk, topGetDoc, topListDesks, topRequestOtp, topSetDeskStatus, topSetRank,
} from "./handlers.js";

export const desk_top_requestOtp = topCallable<TopRequestOtpIn, TopRequestOtpOut>(
  { secrets: HP_SECRETS, timeoutSeconds: 90 }, (auth, data) => topRequestOtp(defaultTopDeps(), auth, data));
export const desk_top_listDesks = topCallable<TopListDesksIn, TopListDesksOut>({ timeoutSeconds: 90 }, (auth, data) => topListDesks(auth, data));
export const desk_top_getDesk = topCallable<TopGetDeskIn, TopGetDeskOut>({}, (auth, data) => topGetDesk(defaultTopDeps(), auth, data));
export const desk_top_getDoc = topCallable<TopGetDocIn, TopGetDocOut>({ timeoutSeconds: 90 }, (auth, data) => topGetDoc(defaultTopDeps(), auth, data));
export const desk_top_setDeskStatus = topCallable<TopSetDeskStatusIn, TopSetDeskStatusOut>({}, (auth, data) => topSetDeskStatus(defaultTopDeps(), auth, data));
export const desk_top_setRank = topCallable<TopSetRankIn, TopSetRankOut>({}, (auth, data) => topSetRank(defaultTopDeps(), auth, data));
