import { Input } from "@/components/ui/input";
import { HONDA_MODELS, OTHER_MODEL, SERVICE_TYPES } from "@/domain/models";
import { FormField, SELECT_CLASS } from "./FormField";
import type { JobCardValues } from "./useJobCardForm";

interface Props {
  values: JobCardValues;
  set: <K extends keyof JobCardValues>(k: K, v: JobCardValues[K]) => void;
  msgFor: (field: string) => string | undefined;
}

/** Model, vehicle type (asked only for "Other") and service type pickers. */
export function JobCardVehicleFields({ values, set, msgFor }: Props) {
  const other = values.model === OTHER_MODEL;
  return (
    <>
      <FormField id="model" label="Model" error={msgFor("model")}>
        <select
          id="model"
          className={SELECT_CLASS}
          value={values.model}
          onChange={(e) => {
            set("model", e.target.value);
          }}
        >
          <option value="">Pick a model</option>
          {Object.keys(HONDA_MODELS).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </FormField>
      {other && (
        <>
          <FormField id="modelOther" label="Model name" error={msgFor("modelOther")}>
            <Input
              id="modelOther"
              className="h-12"
              value={values.modelOther}
              onChange={(e) => {
                set("modelOther", e.target.value);
              }}
            />
          </FormField>
          <FormField id="vehicleType" label="Vehicle type" error={msgFor("vehicleType")}>
            <select
              id="vehicleType"
              className={SELECT_CLASS}
              value={values.vehicleType}
              onChange={(e) => {
                set("vehicleType", e.target.value as JobCardValues["vehicleType"]);
              }}
            >
              <option value="">Pick a vehicle type</option>
              <option value="scooter">Scooter</option>
              <option value="motorcycle">Motorcycle</option>
            </select>
          </FormField>
        </>
      )}
      <FormField id="serviceType" label="Service type" error={msgFor("serviceType")}>
        <select
          id="serviceType"
          className={SELECT_CLASS}
          value={values.serviceType}
          onChange={(e) => {
            set("serviceType", e.target.value);
          }}
        >
          <option value="">Pick a service type</option>
          {SERVICE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </FormField>
    </>
  );
}
