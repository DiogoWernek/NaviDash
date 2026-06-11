import { NextResponse } from "next/server";
import type { AccountsResponse } from "@/types";
import {
  MOCK_BUSINESS_MANAGERS,
  MOCK_AD_ACCOUNTS,
} from "@/lib/mock-data";

const USE_MOCK =
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes("<project-ref>") ||
  process.env.USE_MOCK_DATA === "true";

export async function GET() {
  console.log("[api/accounts] USE_MOCK:", USE_MOCK, "| SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL?.slice(0, 40));

  if (USE_MOCK) {
    const response: AccountsResponse = {
      businessManagers: MOCK_BUSINESS_MANAGERS,
      adAccounts: MOCK_AD_ACCOUNTS,
    };
    return NextResponse.json(response);
  }

  try {
    const { supabaseAdmin } = await import("@/lib/supabase");

    const [bmsResult, accountsResult] = await Promise.all([
      supabaseAdmin.from("business_managers").select("*").order("name"),
      supabaseAdmin
        .from("ad_accounts")
        .select("*")
        .eq("active", true)
        .order("name"),
    ]);

    if (bmsResult.error) throw bmsResult.error;
    if (accountsResult.error) throw accountsResult.error;

    const response: AccountsResponse = {
      businessManagers: bmsResult.data ?? [],
      adAccounts: accountsResult.data ?? [],
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Falha ao carregar contas" },
      { status: 500 }
    );
  }
}
