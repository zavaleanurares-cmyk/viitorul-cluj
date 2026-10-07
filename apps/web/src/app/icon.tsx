import { ImageResponse } from "next/og";
import { AppIcon } from "@/lib/app-icon";

export const size = { width: 48, height: 48 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(<AppIcon size={48} />, size);
}
