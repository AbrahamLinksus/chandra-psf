import { Button } from "@/components/ui/button";

interface Props {
  no: string;
  onNew: () => void;
}

/** "No job card JC-… at this branch yet" with the New job card button (US-02). */
export function MissingCard({ no, onNew }: Props) {
  return (
    <div role="alert" className="grid gap-2 rounded-2xl border bg-card p-4">
      <p>No job card {no.trim().toUpperCase()} at this branch yet</p>
      <Button className="h-12 w-fit" onClick={onNew}>
        New job card
      </Button>
    </div>
  );
}
