import { Button } from "@/components/ui/button";

interface Props {
  message: string;
  onOpen: () => void;
}

/** "JC-… already exists at this branch" with Open it (US-26). */
export function ExistsNotice({ message, onOpen }: Props) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-danger">
      <span>{message}</span>
      <Button type="button" variant="outline" className="h-12" onClick={onOpen}>
        Open it
      </Button>
    </div>
  );
}
