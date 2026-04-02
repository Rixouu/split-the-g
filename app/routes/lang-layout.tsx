import { Outlet, redirect, useLoaderData } from "react-router";
import type { LoaderFunctionArgs } from "react-router";
import { AppDesktopFooter } from "~/components/AppDesktopFooter";
import { I18nProvider } from "~/i18n/context";
import { DEFAULT_LOCALE, isSupportedLocale } from "~/i18n/config";
import {
  flattenMessageBundle,
  getMessagesForLocale,
} from "~/i18n/load-messages";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const raw = (params.lang ?? "").trim();
  if (!isSupportedLocale(raw)) {
    const pathname = new URL(request.url).pathname;
    const tail = pathname.replace(/^\/[^/]+(?=\/|$)/, "") || "/";
    const suffix = tail === "/" ? "/" : tail;
    return redirect(
      suffix === "/"
        ? `/${DEFAULT_LOCALE}/`
        : `/${DEFAULT_LOCALE}${suffix}`,
    );
  }
  const bundle = getMessagesForLocale(raw);
  return {
    lang: raw,
    messages: flattenMessageBundle(bundle),
  };
}

export default function LangLayout() {
  const { lang, messages } = useLoaderData<typeof loader>();
  return (
    <I18nProvider lang={lang} messages={messages}>
      <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
        <div className="min-h-0 w-full min-w-0 flex-1">
          <Outlet />
        </div>
        <AppDesktopFooter />
      </div>
    </I18nProvider>
  );
}
