import { redirect, type LoaderFunctionArgs } from "react-router";

/** Legacy /collage → /wall */
export async function loader(_args: LoaderFunctionArgs) {
  return redirect("/wall");
}

export default function CollageRedirect() {
  return null;
}
