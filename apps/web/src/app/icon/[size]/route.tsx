import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/app-icon";

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = [192, 512].includes(Number(raw)) ? Number(raw) : 192;
  const res = new ImageResponse(<AppIcon size={size} />, { width: size, height: size });
  res.headers.set("Cache-Control", "public, max-age=86400");
  return res;
}
