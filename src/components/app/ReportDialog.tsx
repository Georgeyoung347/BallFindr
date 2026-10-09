/**
 * Dialog for reporting a profile/message/media. Inserts a report row (RLS restricts to the reporter) which admins review in admin.reports.
 */
import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { REPORT_REASONS, useMyProfileId, useSubmitReport } from "@/lib/moderation";
import { cn } from "@/lib/utils";

/**
 * Shared reporting dialog for profiles and individual messages.
 * All validation and evidence capture happens in the database.
 */
export function ReportDialog({
  open,
  onOpenChange,
  reportedProfileId,
  reportedName,
  messageId,
  messagePreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportedProfileId: string;
  reportedName: string;
  messageId?: string;
  messagePreview?: string;
}) {
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const submit = useSubmitReport();

  const close = () => {
    onOpenChange(false);
    setReason("");
    setDetails("");
  };

  const send = () => {
    if (!reason) {
      toast.error("Please choose a reason");
      return;
    }
    submit.mutate(
      {
        reportedProfileId,
        reason,
        ...(details.trim() ? { details } : {}),
        ...(messageId ? { messageId } : {}),
      },
      {
        onSuccess: () => {
          toast.success("Report sent", {
            description: "Our moderation team will review this. Thanks for letting us know.",
          });
          close();
        },
        onError: (err) =>
          toast.error("Couldn't send the report", {
            description: err instanceof Error ? err.message : "Please try again.",
          }),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? onOpenChange(true) : close())}>
      <DialogContent className="max-h-[85dvh] max-w-md overflow-y-auto overscroll-contain">
        <DialogHeader>
          <DialogTitle>{messageId ? "Report this message" : `Report ${reportedName}`}</DialogTitle>
          <DialogDescription>
            {messageId
              ? `This message from ${reportedName} will be sent to the BallFindr moderation team for review.`
              : "Tell us what's wrong and our moderation team will review this account."}
          </DialogDescription>
        </DialogHeader>

        {messagePreview ? (
          <p className="rounded-xl border border-border bg-elevated/60 p-3 text-sm break-words whitespace-pre-wrap text-muted-foreground">
            {messagePreview.length > 300 ? `${messagePreview.slice(0, 300)}…` : messagePreview}
          </p>
        ) : null}

        <div className="space-y-2">
          <p className="text-sm font-semibold">Reason</p>
          <div className="flex flex-wrap gap-2">
            {REPORT_REASONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setReason(item)}
                className={cn(
                  "rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  reason === item
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-elevated/50 text-muted-foreground hover:text-foreground",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold">
            Details <span className="font-normal text-muted-foreground">(optional)</span>
          </p>
          <Textarea
            value={details}
            onChange={(e) => setDetails(e.target.value.slice(0, 2000))}
            rows={4}
            placeholder="Add anything that helps us understand what happened."
            className="resize-none rounded-xl border-border bg-elevated/60"
          />
        </div>

        <DialogFooter>
          <Button variant="subtle" onClick={close} disabled={submit.isPending}>
            Cancel
          </Button>
          <Button variant="volt" onClick={send} disabled={submit.isPending || !reason}>
            <Flag className="size-4" /> {submit.isPending ? "Sending…" : "Send report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small ghost "Report" button used on profile pages. Hidden on your own profile. */
export function ReportProfileButton({
  profileId,
  name,
  className,
}: {
  profileId: string;
  name: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: me } = useMyProfileId();
  if (!me || me === profileId) return null;
  return (
    <>
      <Button
        variant="quiet"
        size="sm"
        className={cn("text-muted-foreground", className)}
        onClick={() => setOpen(true)}
      >
        <Flag className="size-4" /> Report
      </Button>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        reportedProfileId={profileId}
        reportedName={name}
      />
    </>
  );
}

/** Tiny flag control shown beside another member's message. */
export function ReportMessageButton({
  messageId,
  senderId,
  senderName,
  body,
}: {
  messageId: string;
  senderId: string;
  senderName: string;
  body: string;
}) {
  const [open, setOpen] = useState(false);
  const { data: me } = useMyProfileId();
  if (!me || me === senderId) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Report this message from ${senderName}`}
        title="Report this message"
        className="mt-1 shrink-0 self-end rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:text-destructive focus-visible:text-destructive"
      >
        <Flag className="size-3.5" />
      </button>
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        reportedProfileId={senderId}
        reportedName={senderName}
        messageId={messageId}
        messagePreview={body}
      />
    </>
  );
}

