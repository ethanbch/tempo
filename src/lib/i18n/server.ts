import { cookies, headers } from "next/headers";

import { LOCALE_COOKIE, resolveLocale, type Locale } from "./locales";

/** Langue de la requête en cours : choix mémorisé, sinon préférences du navigateur. */
export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, headerList.get("accept-language"));
}
