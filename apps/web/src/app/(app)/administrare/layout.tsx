import { requireRole } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/admin-tabs";

/** Administrarea clubului: administratorul și preparatorul fizic. Fiecare pagină și acțiune verifică din nou rolul. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("physio", "admin");
  return (
    <>
      <AdminTabs />
      {children}
    </>
  );
}
