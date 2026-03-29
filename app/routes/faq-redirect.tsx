import { redirect, type LoaderFunctionArgs } from "react-router";

/** Legacy /faq → /profile/faq */
export async function loader(_args: LoaderFunctionArgs) {
  return redirect("/profile/faq");
}

export default function FaqRedirect() {
  return null;
}
