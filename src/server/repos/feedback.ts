import "server-only";
import type { FeedbackRepo } from "@/data/access";
import type { RequestCtx } from "../ctx";
import { unavailable } from "./unavailable";

export class ServerFeedbackRepo implements FeedbackRepo {
  constructor(protected readonly ctx: RequestCtx) {}
  getVisitByToken: FeedbackRepo["getVisitByToken"] = () => unavailable();
  markOpened: FeedbackRepo["markOpened"] = () => unavailable();
  submitResponse: FeedbackRepo["submitResponse"] = () => unavailable();
}
