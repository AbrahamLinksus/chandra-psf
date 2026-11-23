import "server-only";
import type { CustomerRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

/** Stub until the feature task that owns this repo lands (LLD-phase2 §23/§24). */
export class ServerCustomerRepo implements CustomerRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  searchCustomers: CustomerRepo["searchCustomers"] = () => unavailable();
  exportCustomers: CustomerRepo["exportCustomers"] = () => unavailable();
  eraseCustomers: CustomerRepo["eraseCustomers"] = () => unavailable();
}
