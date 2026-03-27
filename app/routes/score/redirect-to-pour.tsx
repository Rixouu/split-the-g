import { redirect, type LoaderFunctionArgs } from "react-router";
import { supabase } from "~/utils/supabase";

/** Legacy /score/{uuid} → canonical /pour/{slug-or-uuid}. */
export async function loader({ params }: LoaderFunctionArgs) {
  const id = params.splitId?.trim();
  if (!id) throw new Response("Not found", { status: 404 });

  const { data, error } = await supabase
    .from("scores")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const ref =
    !error && data?.slug?.trim() ? data.slug.trim() : id;
  return redirect(`/pour/${encodeURIComponent(ref)}`);
}

export default function RedirectToPour() {
  return null;
}
