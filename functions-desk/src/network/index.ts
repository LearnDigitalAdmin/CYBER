import type { NetDashboardIn, NetDashboardOut, NetDecideIn, NetDecideOut, NetInviteIn, NetInviteOut, NetOptionsIn, NetOptionsOut, NetTeamIn, NetTeamOut } from "../contract.js";
import { deskCallable } from "../connectors/common.js";
import { HP_SECRETS } from "../kernel/sms.js";
import { netDashboard, netDecide, netInvite, netOptions, netTeam } from "./handlers.js";

export const desk_net_options = deskCallable<NetOptionsIn, NetOptionsOut>({}, (uid, data) => netOptions(uid, data));
export const desk_net_invite = deskCallable<NetInviteIn, NetInviteOut>({ secrets: HP_SECRETS }, (uid, data) => netInvite(uid, data, Date.now()));
export const desk_net_decide = deskCallable<NetDecideIn, NetDecideOut>({}, (uid, data) => netDecide(uid, data, Date.now()));
export const desk_net_team = deskCallable<NetTeamIn, NetTeamOut>({}, (uid, data) => netTeam(uid, data, Date.now()));
export const desk_net_dashboard = deskCallable<NetDashboardIn, NetDashboardOut>({}, (uid) => netDashboard(uid, Date.now()));
