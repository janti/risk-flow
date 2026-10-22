import type { NextRequest } from "next/server";
import { handlers } from "../../../../auth";
import { withCanonicalAuthOrigin } from "../../../../lib/canonical-auth-request";

export const GET = (request: NextRequest) => handlers.GET(withCanonicalAuthOrigin(request));
export const POST = (request: NextRequest) => handlers.POST(withCanonicalAuthOrigin(request));
