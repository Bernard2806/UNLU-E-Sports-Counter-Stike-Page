import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const data = await request.json();
  console.log("Mercado Pago webhook", data);
  return new Response("ok");
};
