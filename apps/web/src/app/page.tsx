import { redirect } from "next/navigation";
import { homePath } from "@club/shared";
import { requireSession } from "@/lib/auth";

export default async function RootPage() {
  const { ctx } = await requireSession();
  redirect(homePath(ctx.role));
}
