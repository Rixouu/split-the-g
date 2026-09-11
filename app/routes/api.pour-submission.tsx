import { DEFAULT_LOCALE } from "~/i18n/config";
import { handleHomePourAction } from "./home-pour.server";

export async function action({ request }: { request: Request }) {
  return handleHomePourAction({
    request,
    lang: DEFAULT_LOCALE,
  });
}

export function loader() {
  return Response.json(
    {
      success: false,
      error: "METHOD_NOT_ALLOWED",
      detail: "Use POST to submit a pour image.",
    },
    { status: 405 },
  );
}
