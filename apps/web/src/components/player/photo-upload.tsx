"use client";
import { useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { setMyPhoto } from "@/app/(app)/profil/actions";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Avatar } from "@/components/ui/misc";
import { uploadFile } from "@/lib/upload";
import { useAction } from "@/lib/use-action";
import { useT } from "@/messages";

const MAX_SIDE = 512;

/** Micșorează imaginea în browser (latura mare de cel mult 512 px) și o întoarce ca JPEG. */
async function resizeToJpeg(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext("2d");
    if (!g) throw new Error("canvas");
    g.fillStyle = "#ffffff"; // PNG-urile transparente primesc fundal alb
    g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("encode"))), "image/jpeg", 0.86),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Fotografia jucătorului: încărcare din browser în bucketul privat „avatars", la `<player_id>/<fișier>`. */
export function PhotoUpload({ playerId, name, photoUrl, hasPhoto }: { playerId: string; name: string; photoUrl: string | null; hasPhoto: boolean }) {
  const t = useT().player.photo;
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = useAction(setMyPhoto);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) return setError(t.notImage);
    setBusy(true);
    try {
      let blob: Blob;
      try {
        blob = await resizeToJpeg(file);
      } catch {
        setError(t.unreadable);
        return;
      }
      const path = `${playerId}/foto-${Date.now()}.jpg`;
      const up = await uploadFile("avatars", path, blob);
      if (!up.ok) {
        setError(t.uploadFailed);
        return;
      }
      await save.run({ path });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <Avatar name={name} src={photoUrl} size={88} />
        <div className="flex min-w-0 flex-1 flex-wrap gap-2">
          <Button variant="secondary" pending={busy || save.pending} icon={<Camera className="size-5" aria-hidden />} onClick={() => input.current?.click()}>
            {hasPhoto ? t.change : t.add}
          </Button>
          {hasPhoto ? (
            <Button variant="ghost" disabled={busy || save.pending} icon={<Trash2 className="size-5" aria-hidden />} onClick={() => save.run({ path: null })}>
              {t.remove}
            </Button>
          ) : null}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          aria-label={t.inputLabel}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </div>
      <p className="mt-2 text-sm text-ink-3">{t.hint}</p>
      <div className="mt-2"><FormError>{error ?? save.error}</FormError></div>
    </div>
  );
}
