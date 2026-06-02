import { NextResponse } from "next/server";
import { getServerUserAdminStatus } from "@/lib/admin-server";
import { syncUserProfile } from "@/lib/profile";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const sessionClient = await createClient();
  const adminClient = createAdminClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dataClient = adminClient ?? sessionClient;
  await syncUserProfile(dataClient, user);

  const isAdmin = await getServerUserAdminStatus(dataClient, user);

  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: orders, error: ordersError } = await dataClient
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (ordersError) {
    return NextResponse.json(
      {
        error: adminClient
          ? "Unable to load admin orders"
          : "Unable to load admin orders. Rerun supabase-product-admin-setup.sql to add the orders policies, or add SUPABASE_SERVICE_ROLE_KEY to .env.local for server-side admin management.",
      },
      { status: 500 },
    );
  }

  const enrichedOrders = await Promise.all(
    (orders ?? []).map(async (order: any) => {
      const [{ data: items }, { data: profile }] = await Promise.all([
        dataClient.from("order_items").select("*").eq("order_id", order.id),
        dataClient
          .from("profiles")
          .select("id, name, email")
          .eq("id", order.user_id)
          .maybeSingle(),
      ]);

      const orderItems = await Promise.all(
        (items ?? []).map(async (item: any) => {
          const [{ data: product }, { data: color }, { data: quantity }] =
            await Promise.all([
              dataClient
                .from("products")
                .select("name")
                .eq("id", item.product_id)
                .maybeSingle(),
              item.color_id
                ? dataClient
                    .from("product_colors")
                    .select("color_name")
                    .eq("id", item.color_id)
                    .maybeSingle()
                : Promise.resolve({ data: null }),
              item.quantity_id
                ? dataClient
                    .from("product_quantities")
                    .select("length_inches")
                    .eq("id", item.quantity_id)
                    .maybeSingle()
                : Promise.resolve({ data: null }),
            ]);

          return {
            id: item.id,
            product_id: item.product_id,
            quantity_ordered: item.quantity_ordered ?? item.quantity ?? 0,
            price_at_purchase: item.price_at_purchase ?? item.price ?? 0,
            product_name: product?.name || `Product ID: ${item.product_id}`,
            color_name: color?.color_name || (item.color_id ? "Unknown" : ""),
            length_inches: quantity?.length_inches ?? null,
          };
        }),
      );

      return {
        ...order,
        user_name: profile?.name || "Unknown",
        user_email: profile?.email || "Unknown",
        order_items: orderItems,
      };
    }),
  );

  return NextResponse.json({ orders: enrichedOrders });
}
