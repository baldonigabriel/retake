import { NextResponse } from "next/server";

import { searchPublicProfiles } from "@/lib/profile/queries";
import { parseSearchQuery } from "@/lib/profile/search";
import { takeSuggestQuota } from "@/lib/profile/search-limit";

/**
 * Suggestions for the profile search while typing (SPEC §6.4). Same rules as
 * /search: public profiles only, and a private user, a non-user and a name
 * that doesn't exist all give the same empty list.
 */
export async function GET(request: Request) {
  const query = parseSearchQuery(new URL(request.url).searchParams.get("q"));
  if (query.kind !== "ok") return NextResponse.json({ results: [] }, { headers: NO_STORE });
  if (!(await takeSuggestQuota())) return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: NO_STORE });
  const results = await searchPublicProfiles(query);
  return NextResponse.json({ results }, { headers: NO_STORE });
}

const NO_STORE = { "Cache-Control": "no-store" };
