import { redirect } from "@remix-run/node";
import { localeCookie } from "../cookies.server";

// `args` is an object with `{ request, params }`
// You can destructure request directly
export const action = async ({ request }: { request: Request }) => {
  const formData = await request.formData();
  const newLocale = formData.get("locale")?.toString();

  if (!newLocale) return null;

  // Preserve current page
  const referer = request.headers.get("Referer") || "/";

  return redirect(referer, {
    headers: {
      "Set-Cookie": await localeCookie.serialize(newLocale),
    },
  });
};
