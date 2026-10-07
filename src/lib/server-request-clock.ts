import "server-only";

import { cache } from "react";

// Layouts and streamed sections share the same financial cutoff within a render.
export const getRequestNowIso = cache(() => new Date().toISOString());
