import type { Topic } from "@/data/access/result";

export type TopicListener = (topics: Topic[]) => void;

export class ChangeBus {
  private readonly listeners = new Set<TopicListener>();

  emit(topics: Topic[]): void {
    for (const listener of [...this.listeners]) listener(topics);
  }

  on(listener: TopicListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}
