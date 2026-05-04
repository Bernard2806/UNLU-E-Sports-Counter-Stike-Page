import type { APIRoute } from "astro";

const MP_ACCESS_TOKEN = import.meta.env.MP_ACCESS_TOKEN;
const PUBLIC_SITE_URL = import.meta.env.PUBLIC_SITE_URL || "http://localhost:4321";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  if (!MP_ACCESS_TOKEN) {
    return new Response(JSON.stringify({ error: "Missing MP_ACCESS_TOKEN" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const items = Array.isArray(payload?.items) ? payload.items : [];

  if (items.length === 0) {
    return new Response(JSON.stringify({ error: "Empty items" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isLocalhost = PUBLIC_SITE_URL.includes("localhost") || PUBLIC_SITE_URL.includes("127.0.0.1");

  const preference: any = {
    items: items.map((item: { name: string; price: number }) => ({
      title: item.name,
      quantity: 1,
      unit_price: Number(item.price),
      currency_id: "ARS",
    })),
    payer: {
      email: payload?.email,
    },
    metadata: {
      userId: payload?.userId,
    },
  };

  if (!isLocalhost) {
    preference.back_urls = {
      success: `${PUBLIC_SITE_URL}/?status=success`,
      pending: `${PUBLIC_SITE_URL}/?status=pending`,
      failure: `${PUBLIC_SITE_URL}/?status=failure`,
    };
    preference.auto_return = "approved";
  }

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
