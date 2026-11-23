import "server-only";
import type { UserRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

export class ServerUserRepo implements UserRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  listUsers: UserRepo["listUsers"] = () => unavailable();
  createSupportUser: UserRepo["createSupportUser"] = () => unavailable();
  setUserActive: UserRepo["setUserActive"] = () => unavailable();
}
