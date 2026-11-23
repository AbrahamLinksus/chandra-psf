import "server-only";
import type { AlertRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

export class ServerAlertRepo implements AlertRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  listAlerts: AlertRepo["listAlerts"] = () => unavailable();
  countOpen: AlertRepo["countOpen"] = () => unavailable();
  updateAlert: AlertRepo["updateAlert"] = () => unavailable();
}
