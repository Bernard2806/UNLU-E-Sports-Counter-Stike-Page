import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm";

const SUPABASE_URL = window?.__SUPABASE_URL__ || "";
const SUPABASE_ANON_KEY = window?.__SUPABASE_ANON_KEY__ || "";

const state = {
  user: null,
  cart: [],
};

let unluPolicy;
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  try {
    unluPolicy = window.trustedTypes.createPolicy('unlu-policy', {
      createHTML: (string) => string,
    });
  } catch (e) {
    console.warn("TrustedTypes policy creation failed:", e);
  }
}
const safeHTML = (html) => unluPolicy ? unluPolicy.createHTML(html) : html;


const els = {
  loginBtn: document.querySelector("#login-btn"),
  logoutBtn: document.querySelector("#logout-btn"),
  authStatus: document.querySelector("#auth-status"),
  cartItems: document.querySelector("#cart-items"),
  cartTotal: document.querySelector("#cart-total"),
  checkoutBtn: document.querySelector("#checkout-btn"),
  storeGrid: document.querySelector("#store-grid"),
  cartStatus: document.querySelector("#cart-status"),
  userLabel: document.querySelector("#user-label"),
  cartCount: document.querySelector("#cart-count"),
};

const formatARS = (value) => `ARS ${value.toLocaleString("es-AR")}`;
const CART_KEY = "unlu_cart";

const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true },
})
  : null;

const renderAuth = () => {
  if (!els.authStatus) return;
  if (state.user) {
    els.authStatus.innerHTML = safeHTML(`Estado: <span class="badge glow">online</span>`);
    els.loginBtn?.setAttribute("hidden", "true");
    els.logoutBtn?.removeAttribute("hidden");
    els.cartStatus && (els.cartStatus.innerHTML = safeHTML("<span class=\"badge glow\">listo para comprar</span>"));
    els.checkoutBtn?.removeAttribute("disabled");
    els.checkoutBtn?.classList.remove("opacity-50", "cursor-not-allowed");
    els.storeGrid?.querySelectorAll("button[data-action='add']").forEach((btn) => {
      btn.removeAttribute("disabled");
      btn.classList.remove("opacity-50", "cursor-not-allowed");
    });
    if (els.userLabel) {
      const email = state.user.email ?? "usuario";
      els.userLabel.innerHTML = safeHTML(`Usuario: <span class="badge glow">${email}</span>`);
    }
  } else {
    els.authStatus.innerHTML = safeHTML(`Estado: <span class="badge blink">offline</span>`);
    els.logoutBtn?.setAttribute("hidden", "true");
    els.loginBtn?.removeAttribute("hidden");
    els.cartStatus && (els.cartStatus.innerHTML = safeHTML("<span class=\"badge blink\">logea para comprar</span>"));
    els.checkoutBtn?.setAttribute("disabled", "true");
    els.checkoutBtn?.classList.add("opacity-50", "cursor-not-allowed");
    els.storeGrid?.querySelectorAll("button[data-action='add']").forEach((btn) => {
      btn.setAttribute("disabled", "true");
      btn.classList.add("opacity-50", "cursor-not-allowed");
    });
    if (els.userLabel) {
      els.userLabel.innerHTML = safeHTML("Usuario: <span class=\"badge\">anon</span>");
    }
  }
};

const renderCart = () => {
  if (!els.cartItems) return;
  if (els.cartCount) {
    els.cartCount.textContent = String(state.cart.length);
  }
  if (state.cart.length === 0) {
    els.cartItems.innerHTML = safeHTML('<p class="text-[var(--ink-soft)]">Sin items.</p>');
    els.cartTotal.textContent = "ARS 0";
    if (state.user) {
      els.cartStatus && (els.cartStatus.innerHTML = safeHTML("<span class=\"badge\">agrega items</span>"));
    }
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    return;
  }

  const rows = state.cart
    .map(
      (item, index) => `
        <div class="flex items-center justify-between border-b border-[var(--win-shadow)] py-1">
          <span>${item.name}</span>
          <div class="flex items-center gap-2">
            <span class="badge">${formatARS(item.price)}</span>
            <button class="win-button" data-action="remove" data-index="${index}">X</button>
          </div>
        </div>
      `
    )
    .join("");
  els.cartItems.innerHTML = safeHTML(rows);

  const total = state.cart.reduce((acc, item) => acc + item.price, 0);
  els.cartTotal.textContent = formatARS(total);
  localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
};

const addToCart = (item) => {
  state.cart.push(item);
  renderCart();
};

const removeFromCart = (index) => {
  state.cart.splice(index, 1);
  renderCart();
};

const loadCart = () => {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      state.cart = parsed;
    }
  } catch {
    localStorage.removeItem(CART_KEY);
  }
};

const initAuth = async () => {
  if (!supabase) {
    if (els.authStatus) {
      els.authStatus.innerHTML = safeHTML("Estado: <span class=\"badge blink\">configurar</span>");
    }
    return;
  }

  const { data } = await supabase.auth.getUser();
  state.user = data?.user ?? null;
  renderAuth();

  supabase.auth.onAuthStateChange((_event, session) => {
    state.user = session?.user ?? null;
    renderAuth();
  });
};

const loginWithGoogle = async () => {
  if (!supabase) return;
  await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin,
    },
  });
};

const logout = async () => {
  if (!supabase) return;
  await supabase.auth.signOut();
};

const checkout = async () => {
  if (!state.user) {
    alert("Necesitas iniciar sesion con Google para comprar.");
    return;
  }
  if (state.cart.length === 0) {
    alert("Tu carrito esta vacio.");
    return;
  }

  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: state.cart,
      userId: state.user.id,
      email: state.user.email,
    }),
  });

  if (!response.ok) {
    alert("No se pudo crear el checkout. Verifica la configuracion.");
    return;
  }

  const data = await response.json();
  if (data?.init_point) {
    localStorage.removeItem(CART_KEY);
    state.cart = [];
    renderCart();
    window.location.href = data.init_point;
  } else {
    alert("Checkout sin URL. Revisa el backend.");
  }
};

els.storeGrid?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.action !== "add") return;
  if (!state.user) {
    alert("Necesitas iniciar sesion con Google para agregar items.");
    return;
  }
  const item = {
    id: target.dataset.id,
    name: target.dataset.name,
    price: Number(target.dataset.price),
  };
  addToCart(item);
});

els.cartItems?.addEventListener("click", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;
  if (target.dataset.action !== "remove") return;
  const index = Number(target.dataset.index);
  if (Number.isNaN(index)) return;
  removeFromCart(index);
});

els.loginBtn?.addEventListener("click", loginWithGoogle);
els.logoutBtn?.addEventListener("click", logout);
els.checkoutBtn?.addEventListener("click", checkout);

initAuth();
loadCart();
renderCart();
