import { redirect, type LoaderFunctionArgs } from "react-router";
import { langFromParams } from "~/i18n/lang-param";
import { localizePath } from "~/i18n/paths";
import { supabase } from "~/utils/supabase";

/** Legacy /score/{uuid} → canonical /pour/{slug-or-uuid}. */
export async function loader({ params }: LoaderFunctionArgs) {
  const lang = langFromParams(params);
  const id = params.splitId?.trim();
  if (!id) throw new Response("Not found", { status: 404 });

  const { data, error } = await supabase
    .from("scores")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const ref =
    !error && data?.slug?.trim() ? data.slug.trim() : id;
  return redirect(localizePath(`/pour/${encodeURIComponent(ref)}`, lang));
}

export default function RedirectToPour() {
  return null;
}
