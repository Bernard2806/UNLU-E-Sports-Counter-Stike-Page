import type { APIRoute } from "astro";

const MP_ACCESS_TOKEN = import.meta.env.MP_ACCESS_TOKEN;
const PUBLIC_SITE_URL = import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321";

export const POST: APIRoute = async ({ request }) => {
  if (!MP_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: "Missing MP_ACCESS_TOKEN" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.json();
  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (items.length === 0) {
    return new Response(JSON.stringify({ error: "Empty items" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const preference = {
    items: items.map((item: { name: string; price: number }) => ({
      title: item.name,
      quantity: 1,
      unit_price: Number(item.price),
      currency_id: "ARS",
    })),
    payer: {
      email: payload?.email,
    },
    back_urls: {
      success: `${PUBLIC_SITE_URL}/?status=success`,
      pending: `${PUBLIC_SITE_URL}/?status=pending`,
      failure: `${PUBLIC_SITE_URL}/?status=failure`,
    },
    auto_return: "approved",
    metadata: {
      userId: payload?.userId,
    },
  };

  const mpResponse = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(preference),
  });

  const mpData = await mpResponse.json();
  return new Response(JSON.stringify(mpData), {
    status: mpResponse.status,
    headers: { "Content-Type": "application/json" },
  });
};
