import { common } from "./common";
import { auth } from "./auth";
import { player } from "./player";
import { players } from "./players";
import { library } from "./library";
import { planning } from "./planning";
import { wellness } from "./wellness";
import { physical } from "./physical";
import { imports } from "./imports";
import { dashboard } from "./dashboard";
import { admin } from "./admin";
import { reports } from "./reports";
import { partner } from "./partner";
import { notifications } from "./notifications";

export const ro = { common, auth, player, players, library, planning, wellness, physical, imports, dashboard, admin, reports, partner, notifications } as const;
