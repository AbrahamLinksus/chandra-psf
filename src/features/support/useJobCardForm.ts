"use client";

import { useCallback, useRef, useState } from "react";
import type { DataAccess, Result } from "@/data/access";
import type { JobCardInput, JobCardView } from "@/data/access/repos/jobCards";
import { OTHER_MODEL } from "@/domain/models";
import { istDateOf } from "@/domain/time";
import { useRepoMutation } from "@/hooks/useRepoMutation";

export interface JobCardValues {
  jobCardNo: string;
  customerName: string;
  phone: string;
  regNo: string;
  model: string;
  modelOther: string;
  vehicleType: "" | "scooter" | "motorcycle";
  serviceType: string;
  serviceDate: string;
  advisorId: string;
}

type CreateInput = JobCardInput & { requestId: string };

const createFn = (da: DataAccess, i: CreateInput): Promise<Result<JobCardView>> =>
  da.jobCards.createJobCard(i);

function toInput(v: JobCardValues): JobCardInput {
  const other = v.model === OTHER_MODEL;
  return {
    jobCardNo: v.jobCardNo,
    customerName: v.customerName,
    phone: v.phone.trim() === "" ? null : v.phone,
    regNo: v.regNo,
    model: v.model,
    ...(other ? { modelOther: v.modelOther } : {}),
    ...(other && v.vehicleType !== "" ? { vehicleType: v.vehicleType } : {}),
    serviceType: v.serviceType,
    serviceDate: v.serviceDate,
    advisorId: v.advisorId,
  };
}

/** Form state for "New job card". One request id per form, so a retry after a lost reply returns the saved card (G-15). */
export function useJobCardForm(initialNo: string, onSaved: (card: JobCardView) => void) {
  const [values, setValues] = useState<JobCardValues>(() => ({
    jobCardNo: initialNo,
    customerName: "",
    phone: "",
    regNo: "",
    model: "",
    modelOther: "",
    vehicleType: "",
    serviceType: "",
    serviceDate: istDateOf(new Date()),
    advisorId: "",
  }));
  const requestId = useRef(crypto.randomUUID());
  const createM = useRepoMutation(createFn);

  const set = <K extends keyof JobCardValues>(k: K, v: JobCardValues[K]) => {
    setValues((prev) => ({ ...prev, [k]: v }));
    createM.reset();
  };

  const submit = useCallback(async () => {
    const r = await createM.run({ ...toInput(values), requestId: requestId.current });
    if (r.ok) onSaved(r.value);
  }, [createM, values, onSaved]);

  const error = createM.error;
  const fields = error?.code === "VALIDATION" ? (error.fields ?? []) : [];
  return {
    values,
    set,
    submit,
    status: createM.status,
    error,
    fields,
    exists: error?.code === "CONFLICT" && (error.fields ?? []).includes("jobCardNo"),
    today: istDateOf(new Date()),
  };
}
