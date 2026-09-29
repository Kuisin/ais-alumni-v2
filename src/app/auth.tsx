import { Redirect } from "expo-router";
import * as WebBrowser from "expo-web-browser";

/**
 * Where LINE sign-in returns on the web (…/auth?code=…): the sign-in popup
 * hands the result to the page that opened it and closes (src/lib/auth.tsx).
 * Native apps receive aisalumni://auth in the sign-in browser instead.
 */
WebBrowser.maybeCompleteAuthSession();

export default function AuthReturn() {
  return <Redirect href="/" />;
}
