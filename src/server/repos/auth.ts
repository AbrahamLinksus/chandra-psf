import "server-only";
import type { AuthRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

export class ServerAuthRepo implements AuthRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  signIn: AuthRepo["signIn"] = () => unavailable();
  setOwnPassword: AuthRepo["setOwnPassword"] = () => unavailable();
  signOut: AuthRepo["signOut"] = () => unavailable();
  currentUser: AuthRepo["currentUser"] = () => unavailable();
}
