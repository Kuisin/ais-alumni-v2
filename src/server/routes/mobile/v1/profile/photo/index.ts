import { mobileRoute } from "@/server/lib/mobile/http";
import { removePhoto, uploadPhoto } from "@/server/lib/mobile/profile";

/** Upload a new photo (multipart, file "avatar") → FormOk. */
export const POST = mobileRoute(({ request }) => uploadPhoto(request));

/** Remove the photo (back to the default icon). */
export const DELETE = mobileRoute(() => removePhoto());
