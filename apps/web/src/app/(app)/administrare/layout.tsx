import { requireRole } from "@/lib/auth";
import { AdminTabs } from "@/components/admin/admin-tabs";

/** Administrarea clubului: doar preparatorul fizic. Fiecare pagină și acțiune verifică din nou rolul. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("physio");
  return (
    <>
      <AdminTabs />
      {children}
    </>
  );
}
