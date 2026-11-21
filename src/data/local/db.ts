import type {
  Advisor,
  Alert,
  AuditEntry,
  ISOTime,
  JobCard,
  ResponseRecord,
  User,
  Visit,
} from "@/domain/types";

export interface StoredUser extends User {
  passwordHash: string;
}

export interface Db {
  meta: { schemaVersion: 1; seededAt: ISOTime };
  users: StoredUser[];
  advisors: Advisor[];
  jobCards: JobCard[];
  visits: Visit[];
  responses: ResponseRecord[];
  alerts: Alert[];
  audit: AuditEntry[];
}

export interface Clock {
  now(): Date;
}
