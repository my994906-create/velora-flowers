import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabase-config.js';

const configured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const $ = (selector, root = document) => root.querySelector(selector);
const money = (amount) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(amount);
const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const categoryNames = { bukeler: 'Bukeler', guller: 'Güller', orkideler: 'Orkideler', bitkiler: 'Bitkiler', hediyeler: 'Hediyeler' };
const cartKey = 'velora-cart-v1';
const cart = () => {
  try { return JSON.parse(localStorage.getItem(cartKey) || '[]'); }
  catch (error) { console.error('Sepet okunamadı.', error); return []; }
};
const saveCart = (items) => {
  localStorage.setItem(cartKey, JSON.stringify(items));
  updateCartCount();
};
const updateCartCount = () => {
  const count = cart().reduce((sum, item) => sum + item.quantity, 0);
  document.querySelectorAll('[data-cart-count]').forEach((node) => { node.textContent = String(count); });
};
const showNotice = (message, kind = '') => {
  const notice = $('#notice');
  if (!notice) return;
  notice.textContent = message;
  notice.className = `notice ${kind}`;
  notice.hidden = false;
};
const fail = (error, context) => {
  console.error(context, error);
  showNotice(`${context}: ${error.message || 'Beklenmeyen bir hata oluştu.'}`, 'error');
};
const productImage = (product, className = 'product-image') => {
  const image = product.image_url
    ? `<img src="${safe(product.image_url)}" alt="${safe(product.name)}" loading="lazy">`
    : '<span class="image-placeholder" aria-hidden="true">✿</span>';
  return `<span class="${className}">${image}</span>`;
};
const productCard = (product) => `
  <article class="product-card">
    <a href="product.html?id=${encodeURIComponent(product.id)}" aria-label="${safe(product.name)} detaylarını görüntüle">
      ${productImage(product)}
    </a>
    <div class="product-info">
      <div class="product-info-top"><a class="product-name" href="product.html?id=${encodeURIComponent(product.id)}">${safe(product.name)}</a><span class="product-price">${money(product.price)}</span></div>
      <p class="product-category">${safe(categoryNames[product.category] || product.category)}</p>
      <span class="product-stock">${product.stock > 0 ? 'Siparişe hazır' : 'Stokta yok'}</span>
    </div>
  </article>`;
function renderShell(page) {
  const header = $('#site-header');
  if (!header) return;
  header.innerHTML = `<header class="site-header"><div class="header-inner">
    <a class="brand" href="index.html"><span class="brand-mark">v.</span><span>Velora Flowers</span></a>
    <div class="nav-tools"><a class="account-shortcut" href="account.html" aria-label="Hesabım">Hesabım</a><a class="cart-link" href="cart.html">Sepet <span class="cart-count" data-cart-count>0</span></a></div>
  </div><form class="global-search" action="search.html" role="search"><span aria-hidden="true">⌕</span><input name="q" type="search" placeholder="Çiçek, buket veya hediye ara" aria-label="Mağazada ara" autocomplete="off"><button type="submit">Ara</button></form></header>`;
  const nav = $('#bottom-nav');
  if (nav) {
    const links = [['home', 'index.html', '⌂', 'Ana sayfa'], ['categories', 'categories.html', '✿', 'Koleksiyon'], ['search', 'search.html', '⌕', 'Ara'], ['cart', 'cart.html', '♧', 'Sepet'], ['settings', 'settings.html', '⚙', 'Ayarlar']];
    nav.innerHTML = `<nav class="bottom-nav" aria-label="Uygulama menüsü">${links.map(([key, href, icon, label]) =>
      `<a class="${page === key || (page === 'product' && key === 'categories') ? 'is-active' : ''}" href="${href}"><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${key === 'cart' ? '<span class="cart-count" data-cart-count>0</span>' : ''}</a>`
    ).join('')}</nav>`;
  }
  const savedTheme = localStorage.getItem('velora-theme');
  document.documentElement.dataset.theme = savedTheme === 'dark' ? 'dark' : 'light';
  updateCartCount();
}
async function loadProducts(category) {
  const grid = $('#product-grid');
  if (!configured) {
    showNotice('Mağaza henüz Supabase’e bağlanmadı. Gerçek ürünleri görmek için supabase-config.js dosyasına proje URL’si ve anonim anahtarını girin.', 'error');
    $('#empty-state')?.setAttribute('hidden', '');
    return;
  }
  let query = supabase.from('products').select('id,name,price,description,image_url,category,stock').eq('active', true).order('created_at', { ascending: false });
  if (category) query = query.eq('category', category);
  const { data, error } = await query;
  if (error) return fail(error, 'Çiçekler yüklenemedi');
  if (!data.length) {
    if (grid) grid.innerHTML = '';
    const empty = $('#empty-state');
    if (empty) { empty.textContent = 'Bu koleksiyonda henüz yayımlanmış çiçek yok.'; empty.hidden = false; }
    return;
  }
  if (grid) grid.innerHTML = data.map(productCard).join('');
}
async function initCategories() {
  const bar = $('#category-bar');
  if (bar) {
    const categories = [['', 'Tüm çiçekler'], ['bukeler', 'Bukeler'], ['guller', 'Güller'], ['orkideler', 'Orkideler'], ['bitkiler', 'Bitkiler'], ['hediyeler', 'Hediyeler']];
    const selected = new URLSearchParams(location.search).get('kategori') || '';
    bar.innerHTML = categories.map(([id, label]) =>
      `<a class="category-chip ${selected === id ? 'is-active' : ''}" href="categories.html${id ? `?kategori=${encodeURIComponent(id)}` : ''}">${label}</a>`
    ).join('');
    await loadProducts(selected);
  } else await loadProducts();
}
async function initSearch() {
  const input = $('#catalog-search');
  const results = $('#product-grid');
  const empty = $('#empty-state');
  const form = $('#catalog-search-form');
  const initialQuery = new URLSearchParams(location.search).get('q') || '';
  input.value = initialQuery;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const url = new URL(location.href);
    const value = input.value.trim();
    value ? url.searchParams.set('q', value) : url.searchParams.delete('q');
    history.replaceState(null, '', url);
    searchProducts(value);
  });
  if (!configured) {
    showNotice('Arama için gerçek ürün kataloğunu yüklemek üzere Supabase bağlantısı gerekli.', 'error');
    return;
  }
  const { data: products, error } = await supabase.from('products').select('id,name,price,description,image_url,category,stock').eq('active', true).order('created_at', { ascending: false }).limit(200);
  if (error) return fail(error, 'Arama kataloğu yüklenemedi');
  function searchProducts(query) {
    const term = query.trim().toLocaleLowerCase('tr-TR');
    const matches = term ? products.filter((product) =>
      [product.name, product.description, categoryNames[product.category] || product.category]
        .some((field) => field.toLocaleLowerCase('tr-TR').includes(term))
    ) : products;
    results.innerHTML = matches.map(productCard).join('');
    empty.hidden = matches.length > 0;
    empty.textContent = term ? 'Aramanızla eşleşen çiçek bulunamadı.' : 'Henüz yayımlanmış çiçek yok.';
  }
  searchProducts(initialQuery);
  input.addEventListener('input', () => searchProducts(input.value));
}
function initSettings() {
  const themeToggle = $('#theme-toggle');
  const notificationToggle = $('#notification-toggle');
  const notificationSaved = localStorage.getItem('velora-notifications') === 'true';
  notificationToggle.checked = notificationSaved;
  themeToggle.checked = document.documentElement.dataset.theme === 'dark';
  themeToggle.addEventListener('change', () => {
    const theme = themeToggle.checked ? 'dark' : 'light';
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('velora-theme', theme);
  });
  notificationToggle.addEventListener('change', async () => {
    if (!notificationToggle.checked) {
      localStorage.setItem('velora-notifications', 'false');
      return;
    }
    if (!('Notification' in window)) {
      notificationToggle.checked = false;
      return showNotice('Bu tarayıcı bildirimleri desteklemiyor.', 'error');
    }
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    notificationToggle.checked = granted;
    localStorage.setItem('velora-notifications', String(granted));
    if (!granted) showNotice('Bildirim izni verilmedi. Daha sonra tarayıcı ayarlarından izin verebilirsiniz.', 'error');
  });
  const accountArea = $('#settings-account');
  if (!configured) {
    accountArea.innerHTML = '<a class="settings-row" href="account.html"><span><strong>Hesap ve siparişler</strong><small>Supabase bağlantısı gerektiğinde kullanılabilir.</small></span><span>→</span></a>';
    return;
  }
  supabase.auth.getUser().then(({ data, error }) => {
    if (error) return fail(error, 'Hesap bilgisi alınamadı');
    accountArea.innerHTML = data.user
      ? `<div class="settings-row"><span><strong>${safe(data.user.user_metadata?.full_name || 'Hesabım')}</strong><small>${safe(data.user.email)}</small></span><a class="text-link" href="account.html">Hesaba git →</a></div><button class="button button-light" id="settings-signout" type="button">Oturumu kapat</button>`
      : '<a class="settings-row" href="account.html"><span><strong>Giriş / hesap oluştur</strong><small>Siparişlerinizi takip edin.</small></span><span>→</span></a>';
    $('#settings-signout')?.addEventListener('click', async () => {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) return fail(signOutError, 'Çıkış yapılamadı');
      accountArea.innerHTML = '<a class="settings-row" href="account.html"><span><strong>Giriş / hesap oluştur</strong></span><span>→</span></a>';
    });
  }).catch((error) => fail(error, 'Hesap bilgisi alınamadı'));
}
async function initProduct() {
  const target = $('#product-detail');
  const id = new URLSearchParams(location.search).get('id');
  if (!configured) return showNotice('Supabase bağlantısı kurulmadığı için ürün ayrıntısı yüklenemiyor.', 'error');
  if (!id) { target.innerHTML = '<div class="empty-state">Ürün bağlantısı eksik. <a class="text-link" href="categories.html">Koleksiyona dön</a></div>'; return; }
  const { data: product, error } = await supabase.from('products').select('id,name,price,description,image_url,category,stock').eq('id', id).eq('active', true).maybeSingle();
  if (error) return fail(error, 'Ürün yüklenemedi');
  if (!product) { target.innerHTML = '<div class="empty-state">Bu ürün bulunamadı veya satışta değil.</div>'; return; }
  target.innerHTML = `<div class="detail-layout"><div class="detail-image">${product.image_url ? `<img src="${safe(product.image_url)}" alt="${safe(product.name)}">` : '<span class="image-placeholder" aria-hidden="true">✿</span>'}</div>
    <div class="detail-copy"><a class="back-link" href="categories.html">← Koleksiyona dön</a><span class="eyebrow">${safe(categoryNames[product.category] || product.category)}</span><h1>${safe(product.name)}</h1><p class="detail-price">${money(product.price)}</p>
    <p class="detail-description">${safe(product.description).replace(/\n/g, '<br>')}</p><p class="stock-line">${product.stock > 0 ? `${product.stock} adet stokta` : 'Şu an stokta yok'}</p>
    <div class="detail-buy"><input class="quantity-input" id="quantity" aria-label="Adet" type="number" value="1" min="1" max="${Math.max(1, product.stock)}" ${product.stock < 1 ? 'disabled' : ''}><button class="button button-dark" id="add-to-cart" type="button" ${product.stock < 1 ? 'disabled' : ''}>Sepete ekle</button></div></div></div>
    <section class="review-section"><span class="eyebrow">MÜŞTERİ YORUMLARI</span><h2>Yorumlar</h2><div id="review-list"><p class="muted">Yorumlar yükleniyor…</p></div><div id="review-form-slot"></div></section>`;
  $('#add-to-cart').addEventListener('click', () => {
    const quantity = Number($('#quantity').value);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > product.stock) return showNotice('Lütfen stok miktarını aşmayan geçerli bir adet seçin.', 'error');
    const items = cart();
    const current = items.find((item) => item.id === product.id);
    if (current && current.quantity + quantity > product.stock) return showNotice('Sepetinizdeki adet, mevcut stok miktarını aşamaz.', 'error');
    if (current) current.quantity += quantity;
    else items.push({ id: product.id, quantity });
    saveCart(items);
    showNotice('Çiçek sepetinize eklendi.', 'success');
  });
  const { data: reviews, error: reviewError } = await supabase.from('reviews').select('rating,body,created_at').eq('product_id', product.id).eq('approved', true).order('created_at', { ascending: false });
  const reviewList = $('#review-list');
  if (reviewError) { reviewList.textContent = 'Yorumlar şu anda yüklenemedi.'; console.error(reviewError); }
  else if (!reviews.length) reviewList.innerHTML = '<p class="muted">Henüz yayımlanmış yorum yok.</p>';
  else reviewList.innerHTML = reviews.map((review) => `<article class="review-card"><span class="rating">${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</span><span class="review-meta"> · ${new Date(review.created_at).toLocaleDateString('tr-TR')}</span><p>${safe(review.body)}</p></article>`).join('');
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) return fail(userError, 'Oturum doğrulanamadı');
  const reviewSlot = $('#review-form-slot');
  if (!user) {
    reviewSlot.innerHTML = '<p class="muted">Yorum yazmak için <a class="text-link" href="account.html">hesabınıza giriş yapın →</a></p>';
    return;
  }
  const { data: existingReview, error: existingReviewError } = await supabase.from('reviews').select('id').eq('product_id', product.id).eq('user_id', user.id).maybeSingle();
  if (existingReviewError) return fail(existingReviewError, 'Yorum durumu kontrol edilemedi');
  if (existingReview) {
    reviewSlot.innerHTML = '<p class="muted">Bu çiçek için yorumunuz zaten alınmış. Yayına alınması için mağaza onayı bekleniyor.</p>';
    return;
  }
  reviewSlot.innerHTML = `<form id="review-form" class="form-stack"><label>Puanınız<select name="rating" required><option value="5">5 — Çok beğendim</option><option value="4">4 — Beğendim</option><option value="3">3 — İyi</option><option value="2">2 — Beklentimin altında</option><option value="1">1 — Beğenmedim</option></select></label><label>Yorumunuz<textarea name="body" rows="3" maxlength="1500" required></textarea></label><button class="button button-dark" type="submit">Yorumu gönder</button></form>`;
  $('#review-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { error } = await supabase.from('reviews').insert({ product_id: product.id, rating: Number(form.get('rating')), body: String(form.get('body')).trim() });
    if (error) return showNotice(`Yorum gönderilemedi: ${error.message}`, 'error');
    reviewSlot.innerHTML = '<p class="notice success">Yorumunuz alındı. Yayımlanmadan önce mağaza tarafından incelenecek.</p>';
  });
}
async function initCart() {
  const root = $('#cart-content');
  if (!configured) { root.innerHTML = '<div class="notice error">Sipariş ve sepet için önce Supabase bağlantısını kurun.</div>'; return; }
  const items = cart();
  if (!items.length) { root.innerHTML = '<div class="empty-state">Sepetiniz henüz boş.<br><br><a class="text-link" href="categories.html">Çiçekleri keşfedin →</a></div>'; return; }
  const { data: products, error } = await supabase.from('products').select('id,name,price,image_url,stock,active').in('id', items.map((item) => item.id)).eq('active', true);
  if (error) { root.innerHTML = ''; return fail(error, 'Sepet yüklenemedi'); }
  const available = items.filter((item) => products.some((product) => product.id === item.id && product.stock > 0));
  if (available.length !== items.length) saveCart(available);
  if (!available.length) { root.innerHTML = '<div class="empty-state">Sepetteki ürünler artık satışta değil. <a href="categories.html">Koleksiyona dön</a></div>'; return; }
  const productById = new Map(products.map((product) => [product.id, product]));
  available.forEach((item) => { item.quantity = Math.min(item.quantity, productById.get(item.id).stock); });
  saveCart(available);
  const renderRows = () => available.map((item) => {
    const product = productById.get(item.id);
    const image = product.image_url ? `<img class="cart-thumb" src="${safe(product.image_url)}" alt="${safe(product.name)}">` : '<span class="cart-thumb image-placeholder">✿</span>';
    return `<article class="cart-row">${image}<div><a class="cart-item-name" href="product.html?id=${encodeURIComponent(item.id)}">${safe(product.name)}</a><div class="cart-controls"><button class="link-button" data-action="minus" data-id="${item.id}" type="button">−</button><span>${item.quantity}</span><button class="link-button" data-action="plus" data-id="${item.id}" type="button">＋</button><button class="link-button" data-action="remove" data-id="${item.id}" type="button">Kaldır</button></div></div><strong>${money(product.price * item.quantity)}</strong></article>`;
  }).join('');
  const render = () => {
    const total = available.reduce((sum, item) => sum + productById.get(item.id).price * item.quantity, 0);
    root.innerHTML = `<div class="cart-list">${renderRows()}</div><section class="cart-summary"><div class="summary-line summary-total"><span>Ürünler toplamı</span><span>${money(total)}</span></div><p class="muted">Bu sayfa online ödeme almaz; ödeme ve teslimat ayrıntıları mağaza tarafından ayrıca netleştirilir.</p>
      <form id="checkout-form" class="checkout-form"><label>Ad soyad<input name="customer_name" autocomplete="name" required maxlength="120"></label><label>Telefon<input name="phone" type="tel" autocomplete="tel" required maxlength="40"></label><label class="wide-field">Teslimat adresi<textarea name="address" rows="3" autocomplete="street-address" required maxlength="1200"></textarea></label><button class="button button-dark" type="submit">Siparişi oluştur · ${money(total)}</button></form></section>`;
    root.querySelectorAll('[data-action]').forEach((button) => button.addEventListener('click', () => {
      const item = available.find((entry) => entry.id === button.dataset.id);
      if (button.dataset.action === 'remove') available.splice(available.indexOf(item), 1);
      else if (button.dataset.action === 'minus') item.quantity--;
      else if (button.dataset.action === 'plus') item.quantity = Math.min(productById.get(item.id).stock, item.quantity + 1);
      const next = available.filter((entry) => entry.quantity > 0);
      available.splice(0, available.length, ...next);
      saveCart(available);
      render();
    }));
    $('#checkout-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) return fail(authError, 'Hesap doğrulanamadı');
      if (!user) { location.href = 'account.html?next=cart.html'; return; }
      const form = new FormData(event.currentTarget);
      const { data, error: orderError } = await supabase.rpc('place_order', {
        p_customer_name: form.get('customer_name'),
        p_phone: form.get('phone'),
        p_address: form.get('address'),
        p_items: available.map(({ id, quantity }) => ({ product_id: id, quantity }))
      });
      if (orderError) return fail(orderError, 'Sipariş oluşturulamadı');
      saveCart([]);
      root.innerHTML = `<div class="empty-state">Siparişiniz alındı. Sipariş numaranız: ${safe(data)}<br><br><a class="text-link" href="account.html">Siparişlerimi görüntüle →</a></div>`;
    });
  };
  render();
}
async function initAccount() {
  const root = $('#account-content');
  if (!configured) { root.innerHTML = '<section class="page-intro"><span class="eyebrow">HESABIM</span><h1>Üyelik ve siparişler</h1></section><div class="notice error">Hesap sistemi için önce Supabase bağlantısını kurun.</div>'; return; }
  const renderAuth = (mode = 'login', message = '') => {
    const signup = mode === 'signup';
    root.innerHTML = `<section class="auth-card"><span class="eyebrow">VELORA FLOWERS</span><h1>${signup ? 'Aramıza katılın.' : 'Tekrar hoş geldiniz.'}</h1><p class="muted">Siparişlerinizi takip etmek ve çiçeklere yorum bırakmak için.</p>
      <form id="account-form" class="form-stack">${signup ? '<label>Ad soyad<input name="full_name" autocomplete="name" maxlength="120" required></label>' : ''}
      <label>E-posta<input name="email" type="email" autocomplete="email" required></label><label>Şifre<input name="password" type="password" minlength="8" autocomplete="${signup ? 'new-password' : 'current-password'}" required></label>
      <button class="button button-dark" type="submit">${signup ? 'Hesap oluştur' : 'Giriş yap'}</button></form>
      ${message ? `<p class="notice">${safe(message)}</p>` : ''}
      <p class="form-switch">${signup ? 'Zaten hesabınız var mı?' : 'Henüz hesabınız yok mu?'} <button id="switch-auth" type="button">${signup ? 'Giriş yap' : 'Hesap oluştur'}</button></p></section>`;
    $('#switch-auth').addEventListener('click', () => renderAuth(signup ? 'login' : 'signup'));
    $('#account-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const email = String(form.get('email')).trim();
      const password = String(form.get('password'));
      const result = signup
        ? await supabase.auth.signUp({ email, password, options: { data: { full_name: String(form.get('full_name')).trim() } } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) return renderAuth(mode, result.error.message);
      if (signup && !result.data.session) return renderAuth('login', 'Hesabınız oluşturuldu. Giriş yapmadan önce e-posta adresinizi doğrulayın.');
      await loadAccount();
    });
  };
  const loadAccount = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) return renderAuth('login', error.message);
    if (!user) return renderAuth();
    if (new URLSearchParams(location.search).get('next') === 'cart.html') {
      location.href = 'cart.html';
      return;
    }
    const { data: orders, error: orderError } = await supabase.from('orders').select('id,status,total_amount,created_at').order('created_at', { ascending: false });
    root.innerHTML = `<section class="page-intro"><span class="eyebrow">HESABIM</span><div class="account-head"><h1>Merhaba${user.user_metadata?.full_name ? `, ${safe(user.user_metadata.full_name)}` : ''}.</h1><button class="button button-light" id="sign-out" type="button">Çıkış yap</button></div><p>${safe(user.email)}</p></section><section><h2>Siparişlerim</h2>${orderError ? `<div class="notice error">${safe(orderError.message)}</div>` : orders.length ? orders.map((order) => `<article class="order-card"><div class="order-top"><span>Sipariş · ${safe(order.id.slice(0, 8).toUpperCase())}</span><span>${money(order.total_amount)}</span></div><p>${new Date(order.created_at).toLocaleDateString('tr-TR')} · ${safe(order.status)}</p></article>`).join('') : '<p class="muted">Henüz siparişiniz yok.</p>'}</section>`;
    $('#sign-out').addEventListener('click', async () => {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) return fail(signOutError, 'Çıkış yapılamadı');
      renderAuth();
    });
  };
  await loadAccount();
}

const page = document.body.dataset.page;
renderShell(page);
if (page === 'home' || page === 'categories') initCategories().catch((error) => fail(error, 'Çiçekler yüklenemedi'));
if (page === 'search') initSearch().catch((error) => fail(error, 'Arama yapılamadı'));
if (page === 'settings') initSettings();
if (page === 'product') initProduct().catch((error) => fail(error, 'Ürün yüklenemedi'));
if (page === 'cart') initCart().catch((error) => fail(error, 'Sepet yüklenemedi'));
if (page === 'account') initAccount().catch((error) => fail(error, 'Hesap yüklenemedi'));
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./service-worker.js').catch((error) => console.error('PWA çevrimdışı desteği başlatılamadı.', error));
}
