import { getT } from "@/messages";
import { ForgotForm } from "./form";

export const metadata = { title: "Resetează parola" };

export default function ForgotPage() {
  const t = getT().auth.forgot;
  return (
    <>
      <h1 className="text-3xl">{t.title}</h1>
      <p className="mb-6 mt-1 text-ink-3">{t.intro}</p>
      <ForgotForm />
    </>
  );
}
