import { EmptyState } from "./card";

/** Pagină în lucru — înlocuită de modulul corespunzător. */
export function Stub({ title }: { title: string }) {
  return <EmptyState title={title} description="Această secțiune este în lucru." />;
}
