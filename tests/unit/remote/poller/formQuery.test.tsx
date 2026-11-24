import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DataAccessProvider } from "@/data/access/provider";
import type { DataAccess, Topic } from "@/data/access";
import { useLiveInvalidation } from "@/hooks/useLiveInvalidation";
import { useFormContext } from "@/features/feedback-form/useFormContext";

describe("the public form query", () => {
  it("never refetches when the poller signals a refresh", async () => {
    let emit: (t: Topic[]) => void = () => undefined;
    const getVisitByToken = vi.fn().mockResolvedValue({ ok: true, value: { state: "open" } });
    const da = {
      feedback: { getVisitByToken },
      subscribe: (l: (t: Topic[]) => void) => {
        emit = l;
        return () => undefined;
      },
    } as unknown as DataAccess;
    const qc = new QueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>
        <DataAccessProvider value={da}>{children}</DataAccessProvider>
      </QueryClientProvider>
    );
    const { result } = renderHook(
      () => {
        useLiveInvalidation();
        return useFormContext("tok");
      },
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.state.status).toBe("loaded");
    });
    act(() => {
      emit(["visits"]);
      emit(["visits"]);
    });
    await Promise.resolve();
    expect(getVisitByToken).toHaveBeenCalledTimes(1);
  });
});
