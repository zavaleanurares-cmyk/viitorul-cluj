import { NextResponse, type NextRequest } from "next/server";
import { processWebhook } from "@/lib/payments/webhook";

export const dynamic = "force-dynamic";

/** Webhook-ul operatorului de plăți: POST /api/plati/webhook/<operator>. Răspunde 2xx doar după ce a scris în registru. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!/^[a-z0-9_-]{1,32}$/.test(provider)) return NextResponse.json({ error: "Operator necunoscut." }, { status: 404 });
  const res = await processWebhook(provider, request);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });
  return NextResponse.json({ received: res.applied });
}
