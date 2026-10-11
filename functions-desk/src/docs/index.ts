import type { ListMyDocsIn, ListMyDocsOut, UploadDocIn, UploadDocOut } from "../contract.js";
import { deskCallable } from "../connectors/common.js";
import { defaultDocsDeps } from "./deps.js";
import { listMyDocs, uploadDoc } from "./handlers.js";

// A 4 MB file is ~5.4 MB of base64, inside the callable request limit.
export const desk_uploadDoc = deskCallable<UploadDocIn, UploadDocOut>(
  { timeoutSeconds: 120 }, (uid, data) => uploadDoc(defaultDocsDeps(), uid, data),
);
export const desk_listMyDocs = deskCallable<ListMyDocsIn, ListMyDocsOut>({}, (uid) => listMyDocs(uid));
