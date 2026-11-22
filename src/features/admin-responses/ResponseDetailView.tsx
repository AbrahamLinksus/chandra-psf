"use client";

import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { PasswordPromptDialog } from "@/components/shared/PasswordPromptDialog";
import { SaveState } from "@/components/shared/SaveState";
import type { ResponseDetail } from "@/data/access/repos/responses";
import { AnswerList } from "./AnswerList";
import { DetailActions, EditBar } from "./DetailActions";
import { useDeleteResponse } from "./useDeleteResponse";
import { useResponseEditor } from "./useResponseEditor";
import { VisitInfo } from "./VisitInfo";

export function ResponseDetailView({ detail }: { detail: ResponseDetail }) {
  const router = useRouter();
  const editor = useResponseEditor(detail);
  const del = useDeleteResponse(detail.response.id);
  const { mutation } = editor;
  const showSave = mutation.status === "error" && mutation.error?.code !== "BAD_PASSWORD";
  return (
    <div className="grid gap-6">
      <VisitInfo detail={detail} />
      {editor.draft === null ? (
        <DetailActions onEdit={editor.start} onDelete={del.askConfirm} />
      ) : (
        <EditBar
          canSave={editor.changed && editor.valid}
          onSave={() => {
            editor.setAskPassword(true);
          }}
          onCancel={editor.cancel}
        />
      )}
      <SaveState
        status={showSave ? "error" : mutation.status === "saving" ? "saving" : "idle"}
        error={mutation.error}
        onRetry={() => {
          editor.setAskPassword(true);
        }}
      />
      <AnswerList
        questionnaire={detail.questionnaire}
        answers={editor.draft ?? detail.response.answers}
        {...(editor.draft === null ? {} : { onChange: editor.setAnswer })}
      />
      <PasswordPromptDialog
        open={editor.askPassword}
        title="Save changes"
        onConfirm={editor.save}
        onClose={() => {
          editor.setAskPassword(false);
        }}
      />
      <ConfirmDialog
        open={del.step === "confirm"}
        title="Delete this response?"
        body="It moves to Recently deleted. You can restore it later."
        confirmLabel="Delete"
        destructive
        onConfirm={del.askPassword}
        onClose={del.close}
      />
      <PasswordPromptDialog
        open={del.step === "password"}
        title="Confirm delete"
        onConfirm={async (password) => {
          const result = await del.remove(password);
          if (result.ok) router.push("/admin/responses");
          return result;
        }}
        onClose={del.close}
      />
    </div>
  );
}
