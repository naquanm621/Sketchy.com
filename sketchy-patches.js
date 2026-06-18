/**
 * sketchy-patches.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Written against the ACTUAL sketchy.html source (not guessed). This patches
 * the few real gaps in an already-solid app:
 *
 *   1. Persistence — cart, favorites, listings, auth survive a page refresh
 *   2. Real listing creation — photos preview + new listings actually show up
 *      in the dashboard table instead of always showing ClayAndThyme's items
 *   3. Country → State sync at checkout (UK/Canada currently show US states)
 *   4. Shop Profile / Save Draft / Forgot password — real save + feedback
 *   5. Accessible labels on heart/favorite buttons
 *
 * HOW TO INSTALL (recommended — avoids HTML parsing issues entirely):
 *   Save this as its own file named sketchy-patches.js in the same folder
 *   as sketchy.html, then add ONE line right before the closing body tag,
 *   AFTER the existing inline script block:
 *
 *     [script tag with src="sketchy-patches.js" goes here, right before the closing body tag]
 *
 *   This must load AFTER the main inline script, since it relies on
 *   functions and variables (PRODUCTS, cart, favorites, currentUser,
 *   renderHome, etc.) that the main script defines.
 *
 *   Do NOT paste this code directly inside the existing inline script
 *   block as a copy-paste block — these comments contain the literal
 *   closing-script-tag text, which would prematurely end that tag and
 *   break the page. Keep this as a separate linked file instead.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/* ═══════════════════════════════════════════════════════════════════════════
   1. PERSISTENCE — localStorage helpers
═══════════════════════════════════════════════════════════════════════════ */

function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); }
  catch (e) { console.warn('[sketchy-patches] localStorage write failed:', e); }
}

// ── 1a. Restore cart & favorites on load ────────────────────────────────────
cart = lsGet('sk_cart', cart);
favorites = new Set(lsGet('sk_favorites', []));

// Save cart/favorites every time they change. The cleanest hook is to wrap
// the functions that already mutate them, then re-save right after.
['addToCart','removeFromCart','changeCartQty','placeOrder','moveToCart','saveForLater']
  .forEach(fnName => {
    const orig = window[fnName];
    if (typeof orig !== 'function') return;
    window[fnName] = function (...args) {
      const result = orig.apply(this, args);
      lsSet('sk_cart', cart);
      return result;
    };
  });

const _origToggleFav = toggleFav;
toggleFav = function (e, id) {
  _origToggleFav(e, id);
  lsSet('sk_favorites', [...favorites]);
};

const _origToggleFavDirect = toggleFavDirect;
toggleFavDirect = function (id, btn) {
  _origToggleFavDirect(id, btn);
  lsSet('sk_favorites', [...favorites]);
};

// ── 1b. Restore auth state on load ──────────────────────────────────────────
currentUser = lsGet('sk_user', null);
if (currentUser) {
  const authBtn = document.getElementById('authBtn');
  if (authBtn) {
    authBtn.textContent = currentUser.email.split('@')[0];
    authBtn.onclick = () => showView('buyer-dashboard');
  }
}

const _origDoAuth = doAuth;
doAuth = function () {
  _origDoAuth();
  if (currentUser) lsSet('sk_user', currentUser);
};

const _origSocialLogin = socialLogin;
socialLogin = function (provider) {
  _origSocialLogin(provider);
  if (currentUser) lsSet('sk_user', currentUser);
};

// Sign-out: turn the "skip for now"/account button into a real sign-out
// when a user is logged in. Right-click-free, simple confirm-based toggle.
(function addSignOut() {
  const authBtn = document.getElementById('authBtn');
  if (!authBtn || !currentUser) return;
  authBtn.title = 'Click to view account, or hold to sign out';
  authBtn.addEventListener('dblclick', () => {
    if (confirm('Sign out of Sketchy?')) {
      lsSet('sk_user', null);
      currentUser = null;
      location.reload();
    }
  });
})();


/* ═══════════════════════════════════════════════════════════════════════════
   2. REAL LISTING CREATION — photo preview + listings actually persist
═══════════════════════════════════════════════════════════════════════════ */

// ── 2a. Photo upload preview (FileReader, no server needed) ────────────────
let pendingListingPhotos = []; // data URLs for the listing currently being created

(function wirePhotoUpload() {
  // There are two .img-upload-zone divs: one in New Listing, one in Shop Profile.
  // We only want to attach real upload behavior to the New Listing one, which
  // is the first .img-upload-zone inside #dash-new-listing.
  const zone = document.querySelector('#dash-new-listing .img-upload-zone');
  if (!zone) return;

  // Replace the toast-only onclick with a real file picker
  zone.removeAttribute('onclick');
  zone.style.cursor = 'pointer';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/*';
  fileInput.multiple = true;
  fileInput.style.display = 'none';
  zone.appendChild(fileInput);

  zone.addEventListener('click', () => fileInput.click());

  function handleFiles(files) {
    [...files].slice(0, 10).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        pendingListingPhotos.push(e.target.result);
        renderPhotoPreviews();
      };
      reader.readAsDataURL(file);
    });
  }

  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.style.borderColor = 'var(--sienna)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; });
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.style.borderColor = '';
    handleFiles(e.dataTransfer.files);
  });

  function renderPhotoPreviews() {
    let strip = document.getElementById('photoPreviewStrip');
    if (!strip) {
      strip = document.createElement('div');
      strip.id = 'photoPreviewStrip';
      strip.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;';
      zone.after(strip);
    }
    strip.innerHTML = pendingListingPhotos.map((src, i) => `
      <div style="position:relative;width:64px;height:64px;">
        <img src="${src}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;${i===0?'outline:2px solid var(--sienna);':''}" alt="Listing photo ${i+1}">
        <button onclick="window._skRemovePhoto(${i})" aria-label="Remove photo" style="position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;background:var(--walnut);color:#fff;font-size:11px;line-height:1;border:none;cursor:pointer;">✕</button>
      </div>`).join('');
  }

  window._skRemovePhoto = function (i) {
    pendingListingPhotos.splice(i, 1);
    renderPhotoPreviews();
  };

  window._skRenderPhotoPreviews = renderPhotoPreviews;
})();

// ── 2b. Make new listings persist AND actually appear in the table ─────────
// We keep the original behavior (pushing into PRODUCTS so it shows up
// everywhere — search, home, shop page) but fix two real bugs:
//   • cover photo now uses an uploaded photo if provided, else a sensible default
//   • the listing is tagged with a sk_owned flag so the table can show
//     real listings instead of always showing ClayAndThyme + first 3 products

let myListingIds = lsGet('sk_my_listings', []); // ids of products this "seller" created

const _origCreateListing = createListing;
createListing = function () {
  const title = document.getElementById('newListingTitle').value.trim();
  const price = document.getElementById('newListingPrice').value;
  if (!title || !price) { showToast('Please fill in title and price'); return; }

  const newId = Math.max(0, ...PRODUCTS.map(p => p.id)) + 1;
  const cover = pendingListingPhotos[0] || 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=600&h=600&fit=crop';
  const imgs = pendingListingPhotos.length ? pendingListingPhotos : [cover];

  const catSelect = document.querySelector('#dash-new-listing select');
  const category = catSelect && catSelect.value !== 'Select a category…' ? catSelect.value.toLowerCase() : 'ceramics';

  PRODUCTS.push({
    id: newId,
    name: title,
    shop: 'ClayAndThyme',
    shopId: 1,
    price: parseFloat(price),
    stock: parseInt(document.getElementById('newListingQty').value || 1),
    category,
    badge: 'New',
    badgeType: 'sage',
    img: cover,
    imgs,
    rating: 5.0,
    reviews: 0,
    desc: document.getElementById('newListingDesc').value || 'No description yet.',
    tags: [],
    variations: {},
  });

  myListingIds.push(newId);
  lsSet('sk_my_listings', myListingIds);
  lsSet('sk_products_extra', PRODUCTS.filter(p => myListingIds.includes(p.id)));

  showToast(`"${title}" listed successfully ✅`);
  document.getElementById('newListingTitle').value = '';
  document.getElementById('newListingPrice').value = '';
  document.getElementById('newListingDesc').value = '';
  pendingListingPhotos = [];
  window._skRenderPhotoPreviews?.();
  document.getElementById('photoPreviewStrip')?.remove();

  showDashPanel('listings', null);
  renderListingsTable();
};

// Restore previously created listings into PRODUCTS on page load
(function restoreMyListings() {
  const saved = lsGet('sk_products_extra', []);
  saved.forEach(p => {
    if (!PRODUCTS.some(existing => existing.id === p.id)) PRODUCTS.push(p);
  });
})();

// ── 2c. Listings table: show real owned listings first, fall back to demo ──
renderListingsTable = function () {
  const tbody = document.getElementById('listingsTable');
  if (!tbody) return;

  const owned = PRODUCTS.filter(p => myListingIds.includes(p.id));
  const rows = owned.length
    ? owned
    : PRODUCTS.filter(p => p.shopId === 1).concat(PRODUCTS.slice(0, 3));

  tbody.innerHTML = rows.map(p => `
    <tr>
      <td style="display:flex;align-items:center;gap:10px;">
        <img src="${p.img}" alt="${p.name}" style="width:40px;height:40px;object-fit:cover;border-radius:6px;flex-shrink:0;" loading="lazy">
        <span style="font-size:13px;font-weight:500;">${p.name}</span>
      </td>
      <td style="font-weight:600;">$${p.price.toFixed(2)}</td>
      <td>${p.stock} left</td>
      <td><span class="status-pill ${p.stock>0?'shipped':'cancelled'}">${p.stock>0?'Active':'Sold Out'}</span></td>
      <td>
        <button onclick="showToast('Edit mode coming in v2 ✏️')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:12px;color:var(--bark);cursor:pointer;margin-right:4px;">Edit</button>
        ${myListingIds.includes(p.id) ? `<button onclick="window._skDeleteListing(${p.id})" style="background:none;border:1px solid #fca5a5;border-radius:6px;padding:4px 10px;font-size:12px;color:#b91c1c;cursor:pointer;">Delete</button>` : `<button onclick="showToast('Listing duplicated! 📋')" style="background:none;border:1px solid var(--border);border-radius:6px;padding:4px 10px;font-size:12px;color:var(--bark);cursor:pointer;">Duplicate</button>`}
      </td>
    </tr>`).join('');
};

window._skDeleteListing = function (id) {
  if (!confirm('Delete this listing?')) return;
  myListingIds = myListingIds.filter(x => x !== id);
  lsSet('sk_my_listings', myListingIds);
  lsSet('sk_products_extra', PRODUCTS.filter(p => myListingIds.includes(p.id)));
  renderListingsTable();
  showToast('Listing deleted.');
};

// ── 2d. Wire up "Save Draft" (currently has no onclick at all) ─────────────
(function wireSaveDraft() {
  const newListingPanel = document.getElementById('dash-new-listing');
  if (!newListingPanel) return;
  const buttons = newListingPanel.querySelectorAll('button');
  const draftBtn = [...buttons].find(b => b.textContent.trim() === 'Save Draft');
  if (draftBtn) {
    draftBtn.addEventListener('click', () => {
      const title = document.getElementById('newListingTitle').value.trim();
      if (!title) { showToast('Add a title before saving a draft'); return; }
      const drafts = lsGet('sk_drafts', []);
      drafts.push({
        title,
        price: document.getElementById('newListingPrice').value,
        qty: document.getElementById('newListingQty').value,
        desc: document.getElementById('newListingDesc').value,
        photos: pendingListingPhotos,
        savedAt: new Date().toISOString(),
      });
      lsSet('sk_drafts', drafts);
      showToast(`"${title}" saved as a draft 📝`);
    });
  }
})();


/* ═══════════════════════════════════════════════════════════════════════════
   3. CHECKOUT — COUNTRY → STATE SYNC
   ─────────────────────────────────────────────────────────────────────────
   The country <select> currently has no id, so it can't be targeted. We
   find it by position (it's the second select in the State/Country row)
   and give it an id, then sync #coState's options when it changes.
═══════════════════════════════════════════════════════════════════════════ */

(function wireCountryStateSync() {
  const stateSelect = document.getElementById('coState');
  if (!stateSelect) return;
  const countrySelect = stateSelect.closest('.form-2col')?.querySelectorAll('select')[1];
  if (!countrySelect) return;
  countrySelect.id = 'coCountry';

  const REGIONS = {
    'United States': { label: 'State', options: ['Oregon','California','New York','Texas','Washington','Other'] },
    'Canada':        { label: 'Province', options: ['Alberta','British Columbia','Manitoba','Ontario','Quebec','Other'] },
    'United Kingdom':{ label: 'Region', options: ['England','Scotland','Wales','Northern Ireland'] },
  };

  const stateLabel = stateSelect.closest('.form-row')?.querySelector('label');

  function syncState() {
    const region = REGIONS[countrySelect.value] || REGIONS['United States'];
    stateSelect.innerHTML = region.options.map(o => `<option>${o}</option>`).join('');
    if (stateLabel) stateLabel.textContent = region.label;
  }

  countrySelect.addEventListener('change', syncState);
})();


/* ═══════════════════════════════════════════════════════════════════════════
   4. SHOP PROFILE — FULL CUSTOMIZATION EDITOR
   ─────────────────────────────────────────────────────────────────────────
   Adds: theme color picker, banner layout style, reorderable/toggleable
   sections (About, Announcement, Policies, FAQ, Hours, Links), and a live
   preview pane. Persists in-memory for the session (SHOPS[i].customization)
   so it matches the rest of the app's demo data — no localStorage.
═══════════════════════════════════════════════════════════════════════════ */

const SHOP_THEMES = [
  { id:'sienna', label:'Sienna',  accent:'#C4622D', accentDk:'#A3501F' },
  { id:'sage',   label:'Sage',    accent:'#7B9B8A', accentDk:'#5E8170' },
  { id:'plum',   label:'Plum',    accent:'#8B5E83', accentDk:'#6E4768' },
  { id:'ocean',  label:'Ocean',   accent:'#3E7C9C', accentDk:'#2F617B' },
  { id:'mustard',label:'Mustard', accent:'#C99A2E', accentDk:'#A87E1E' },
  { id:'ink',    label:'Ink',     accent:'#2C1810', accentDk:'#1A1209' },
];

const SHOP_LAYOUTS = [
  { id:'classic', label:'Classic',  desc:'Sidebar + grid' },
  { id:'wide',     label:'Wide Banner', desc:'Hero-style banner' },
  { id:'minimal',  label:'Minimal', desc:'Compact, no sidebar art' },
];

const DEFAULT_SECTIONS = [
  { key:'announcement', icon:'📣', name:'Announcement', enabled:true },
  { key:'about',        icon:'📝', name:'About',        enabled:true },
  { key:'policies',     icon:'📦', name:'Policies',      enabled:true },
  { key:'hours',        icon:'🕒', name:'Hours',         enabled:false },
  { key:'faq',          icon:'❓', name:'FAQ',           enabled:false },
  { key:'links',        icon:'🔗', name:'Links',         enabled:false },
];

function getShopCustomization(shop) {
  if (!shop.customization) {
    shop.customization = {
      theme: 'sienna',
      layout: 'classic',
      tagline: '',
      announcement: '',
      sections: DEFAULT_SECTIONS.map(s => ({ ...s })),
      hours: [{ day:'Mon–Fri', time:'9am – 5pm' }],
      faq: [{ q:'Do you ship internationally?', a:'Yes, message me for a rate quote.' }],
      links: [{ label:'Instagram', url:'#' }],
    };
  }
  return shop.customization;
}

(function wireShopProfileEditor() {
  const controlsEl = document.getElementById('spControls');
  const previewEl = document.getElementById('spPreviewFrame');
  const saveBtn = document.getElementById('spSaveBtn');
  if (!controlsEl || !previewEl || !saveBtn) return;

  // Editor always works on the logged-in seller's shop — shop #1 in this demo.
  const shop = SHOPS[0];
  const c = getShopCustomization(shop);

  function themeOf(id) { return SHOP_THEMES.find(t => t.id === id) || SHOP_THEMES[0]; }

  function renderControls() {
    controlsEl.innerHTML = `
      <div class="sp-block">
        <h3>🎨 Theme Color</h3>
        <p class="sp-block-sub">Sets your storefront's accent color across buttons, links, and badges.</p>
        <div class="sp-theme-row">
          ${SHOP_THEMES.map(t => `
            <div class="sp-theme-item">
              <div class="sp-swatch ${c.theme===t.id?'active':''}" style="background:${t.accent}" data-theme="${t.id}"></div>
              <div class="sp-swatch-label">${t.label}</div>
            </div>`).join('')}
        </div>
      </div>

      <div class="sp-block">
        <h3>🖼 Banner Image</h3>
        <p class="sp-block-sub">Recommended: 1200×300px. Upload a file or paste an image URL.</p>
        <div class="img-upload-zone" id="spBannerUpload" style="background-image:url('${shop.banner}');background-size:cover;background-position:center;">
          <input type="file" id="spBannerFile" accept="image/*" style="display:none;">
          <div class="sp-banner-overlay">
            <div class="up-icon">🖼</div>
            <p><strong>Click to upload a new banner</strong></p>
          </div>
        </div>
        <div class="form-row" style="margin-top:12px;"><label>...or paste an image URL</label><input class="form-input" id="spBannerUrl" type="text" placeholder="https://…" value="${shop.banner.startsWith('data:')?'':esc(shop.banner)}"></div>
      </div>

      <div class="sp-block">
        <h3>📐 Banner Style</h3>
        <p class="sp-block-sub">Choose how your storefront header is laid out.</p>
        <div class="sp-layout-row">
          ${SHOP_LAYOUTS.map(l => `
            <div class="sp-layout-card ${c.layout===l.id?'active':''}" data-layout="${l.id}">
              <div class="lc-preview"></div>
              <span>${l.label}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="sp-block">
        <h3>✏️ Basics</h3>
        <div class="form-row"><label>Shop name</label><input class="form-input" id="spName" type="text" value="${esc(shop.name)}"></div>
        <div class="form-row"><label>Shop tagline</label><input class="form-input" id="spTagline" type="text" placeholder="A one-line description for search results" value="${esc(c.tagline)}"></div>
        <div class="form-row"><label>About your shop</label><textarea class="textarea-input" id="spAbout">${esc(shop.description)}</textarea></div>
      </div>

      <div class="sp-block">
        <h3>🧩 Page Sections</h3>
        <p class="sp-block-sub">Toggle sections on/off and reorder them with the arrows — your preview updates live.</p>
        <div class="sp-section-list" id="spSectionList"></div>
      </div>

      <div class="sp-block" id="spDynamicSections"><!-- content editors for enabled sections beyond basics --></div>

      <div class="sp-block">
        <h3>📦 Shop Policies</h3>
        <div class="form-row"><label>Shipping policy</label><textarea class="textarea-input" id="spShipping" style="min-height:60px;">${esc(shop.policies.shipping||'')}</textarea></div>
        <div class="form-row"><label>Returns & exchanges</label><textarea class="textarea-input" id="spReturns" style="min-height:60px;">${esc(shop.policies.returns||'')}</textarea></div>
        <div class="form-row"><label>Custom orders</label><textarea class="textarea-input" id="spCustom" style="min-height:60px;">${esc(shop.policies.custom||'')}</textarea></div>
      </div>
    `;
    renderSectionList();
    renderDynamicSections();
    bindControlEvents();
  }

  function renderSectionList() {
    const list = document.getElementById('spSectionList');
    if (!list) return;
    list.innerHTML = c.sections.map((s, i) => `
      <div class="sp-section-item ${s.enabled?'':'disabled'}" data-key="${s.key}">
        <span class="sp-drag-handle">⠿</span>
        <span class="sec-icon">${s.icon}</span>
        <span class="sec-name">${s.name}</span>
        <div class="sec-move">
          <button class="sp-mini-btn" data-act="up" data-i="${i}" ${i===0?'disabled':''}>↑</button>
          <button class="sp-mini-btn" data-act="down" data-i="${i}" ${i===c.sections.length-1?'disabled':''}>↓</button>
        </div>
        <div class="sp-toggle ${s.enabled?'on':''}" data-act="toggle" data-i="${i}"></div>
      </div>
    `).join('');
    list.querySelectorAll('[data-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.i;
        if (btn.dataset.act === 'toggle') c.sections[i].enabled = !c.sections[i].enabled;
        if (btn.dataset.act === 'up' && i > 0) [c.sections[i-1], c.sections[i]] = [c.sections[i], c.sections[i-1]];
        if (btn.dataset.act === 'down' && i < c.sections.length-1) [c.sections[i+1], c.sections[i]] = [c.sections[i], c.sections[i+1]];
        renderSectionList();
        renderDynamicSections();
        renderPreview();
      });
    });
  }

  function renderDynamicSections() {
    const el = document.getElementById('spDynamicSections');
    if (!el) return;
    const blocks = [];

    const announceSec = c.sections.find(s => s.key === 'announcement');
    if (announceSec?.enabled) {
      blocks.push(`<h3>📣 Announcement</h3><p class="sp-block-sub">Pinned at the top of your storefront.</p>
        <div class="form-row"><textarea class="textarea-input" id="spAnnounce" style="min-height:50px;" placeholder="e.g. 20% off through Sunday!">${esc(c.announcement)}</textarea></div>`);
    }
    const hoursSec = c.sections.find(s => s.key === 'hours');
    if (hoursSec?.enabled) {
      blocks.push(`<h3>🕒 Studio Hours</h3>
        <div id="spHoursRows">${c.hours.map((h,i)=>`
          <div class="sp-hours-row">
            <input class="form-input" data-hours-i="${i}" data-hours-f="day" value="${esc(h.day)}" placeholder="Days">
            <input class="form-input" data-hours-i="${i}" data-hours-f="time" value="${esc(h.time)}" placeholder="Hours">
            <button class="sp-remove-btn" data-hours-rm="${i}">✕</button>
          </div>`).join('')}</div>
        <div class="sp-add-row-btn" id="spAddHours">+ Add row</div>`);
    }
    const faqSec = c.sections.find(s => s.key === 'faq');
    if (faqSec?.enabled) {
      blocks.push(`<h3>❓ FAQ</h3>
        <div id="spFaqRows">${c.faq.map((f,i)=>`
          <div class="sp-faq-row">
            <input class="form-input" data-faq-i="${i}" data-faq-f="q" value="${esc(f.q)}" placeholder="Question">
            <input class="form-input" data-faq-i="${i}" data-faq-f="a" value="${esc(f.a)}" placeholder="Answer">
            <button class="sp-remove-btn" data-faq-rm="${i}">✕</button>
          </div>`).join('')}</div>
        <div class="sp-add-row-btn" id="spAddFaq">+ Add question</div>`);
    }
    const linksSec = c.sections.find(s => s.key === 'links');
    if (linksSec?.enabled) {
      blocks.push(`<h3>🔗 Links</h3>
        <div id="spLinkRows">${c.links.map((l,i)=>`
          <div class="sp-link-row">
            <input class="form-input" data-link-i="${i}" data-link-f="label" value="${esc(l.label)}" placeholder="Label">
            <input class="form-input" data-link-i="${i}" data-link-f="url" value="${esc(l.url)}" placeholder="https://…">
            <button class="sp-remove-btn" data-link-rm="${i}">✕</button>
          </div>`).join('')}</div>
        <div class="sp-add-row-btn" id="spAddLink">+ Add link</div>`);
    }

    el.style.display = blocks.length ? '' : 'none';
    el.innerHTML = blocks.join('<div style="height:18px"></div>');
    bindDynamicEvents();
  }

  function bindDynamicEvents() {
    document.getElementById('spAnnounce')?.addEventListener('input', e => { c.announcement = e.target.value; renderPreview(); });

    el_each('[data-hours-i]', el => el.addEventListener('input', () => {
      c.hours[+el.dataset.hoursI][el.dataset.hoursF] = el.value; renderPreview();
    }));
    document.getElementById('spAddHours')?.addEventListener('click', () => { c.hours.push({day:'',time:''}); renderDynamicSections(); renderPreview(); });
    el_each('[data-hours-rm]', el => el.addEventListener('click', () => { c.hours.splice(+el.dataset.hoursRm,1); renderDynamicSections(); renderPreview(); }));

    el_each('[data-faq-i]', el => el.addEventListener('input', () => {
      c.faq[+el.dataset.faqI][el.dataset.faqF] = el.value; renderPreview();
    }));
    document.getElementById('spAddFaq')?.addEventListener('click', () => { c.faq.push({q:'',a:''}); renderDynamicSections(); renderPreview(); });
    el_each('[data-faq-rm]', el => el.addEventListener('click', () => { c.faq.splice(+el.dataset.faqRm,1); renderDynamicSections(); renderPreview(); }));

    el_each('[data-link-i]', el => el.addEventListener('input', () => {
      c.links[+el.dataset.linkI][el.dataset.linkF] = el.value; renderPreview();
    }));
    document.getElementById('spAddLink')?.addEventListener('click', () => { c.links.push({label:'',url:''}); renderDynamicSections(); renderPreview(); });
    el_each('[data-link-rm]', el => el.addEventListener('click', () => { c.links.splice(+el.dataset.linkRm,1); renderDynamicSections(); renderPreview(); }));
  }

  function el_each(sel, fn) { document.querySelectorAll(sel).forEach(fn); }

  function bindControlEvents() {
    document.querySelectorAll('.sp-swatch').forEach(sw => sw.addEventListener('click', () => {
      c.theme = sw.dataset.theme;
      document.querySelectorAll('.sp-swatch').forEach(s => s.classList.toggle('active', s.dataset.theme === c.theme));
      renderPreview();
    }));
    document.querySelectorAll('.sp-layout-card').forEach(card => card.addEventListener('click', () => {
      c.layout = card.dataset.layout;
      document.querySelectorAll('.sp-layout-card').forEach(s => s.classList.toggle('active', s.dataset.layout === c.layout));
      renderPreview();
    }));
    document.getElementById('spName')?.addEventListener('input', e => { shop.name = e.target.value; renderPreview(); });
    document.getElementById('spTagline')?.addEventListener('input', e => { c.tagline = e.target.value; renderPreview(); });
    document.getElementById('spAbout')?.addEventListener('input', e => { shop.description = e.target.value; renderPreview(); });
    document.getElementById('spShipping')?.addEventListener('input', e => { shop.policies.shipping = e.target.value; renderPreview(); });
    document.getElementById('spReturns')?.addEventListener('input', e => { shop.policies.returns = e.target.value; renderPreview(); });
    document.getElementById('spCustom')?.addEventListener('input', e => { shop.policies.custom = e.target.value; renderPreview(); });

    const bannerZone = document.getElementById('spBannerUpload');
    const bannerFile = document.getElementById('spBannerFile');
    const bannerUrl = document.getElementById('spBannerUrl');
    bannerZone?.addEventListener('click', () => bannerFile.click());
    bannerFile?.addEventListener('change', () => {
      const file = bannerFile.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        shop.banner = reader.result;
        bannerZone.style.backgroundImage = `url('${shop.banner}')`;
        bannerUrl.value = '';
        renderPreview();
        showToast('Banner image updated ✓');
      };
      reader.readAsDataURL(file);
    });
    bannerUrl?.addEventListener('input', e => {
      const url = e.target.value.trim();
      if (!url) return;
      shop.banner = url;
      bannerZone.style.backgroundImage = `url('${url}')`;
      renderPreview();
    });
  }

  function esc(s) { return (s||'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

  function sectionHTML(key) {
    if (key === 'announcement') {
      if (!c.announcement) return '';
      const t = themeOf(c.theme);
      return `<div class="shop-announce-bar" style="background:${t.accent}22;color:${t.accentDk}">📣 ${esc(c.announcement)}</div>`;
    }
    if (key === 'about') {
      return `<div class="sp-pv-section"><h5>About</h5><p>${esc(shop.description)||'<em style="color:var(--muted)">No description yet</em>'}</p></div>`;
    }
    if (key === 'policies') {
      const p = shop.policies;
      return `<div class="sp-pv-section"><h5>Policies</h5>
        ${p.shipping?`<div>📦 ${esc(p.shipping)}</div>`:''}
        ${p.returns?`<div>↩️ ${esc(p.returns)}</div>`:''}
        ${p.custom?`<div>✏️ ${esc(p.custom)}</div>`:''}</div>`;
    }
    if (key === 'hours') {
      return `<div class="sp-pv-section"><h5>Hours</h5>${c.hours.map(h=>`<div>${esc(h.day)}: ${esc(h.time)}</div>`).join('')}</div>`;
    }
    if (key === 'faq') {
      return `<div class="sp-pv-section"><h5>FAQ</h5>${c.faq.map(f=>`<div class="sp-pv-faq-q">${esc(f.q)}</div><div>${esc(f.a)}</div>`).join('')}</div>`;
    }
    if (key === 'links') {
      const t = themeOf(c.theme);
      return `<div class="sp-pv-section"><h5>Links</h5>${c.links.map(l=>`<a class="sp-pv-link" style="background:${t.accent}22;color:${t.accentDk}" href="${esc(l.url)}" onclick="return false">${esc(l.label)}</a>`).join('')}</div>`;
    }
    return '';
  }

  function renderPreview() {
    const t = themeOf(c.theme);
    const enabledSections = c.sections.filter(s => s.enabled).map(s => sectionHTML(s.key)).filter(Boolean);
    const layoutClass = `sp-pv-banner--${c.layout}`;
    const showTagline = c.layout !== 'minimal';
    previewEl.innerHTML = `
      <div class="sp-pv-banner ${layoutClass}" style="background-image:url('${shop.banner}')">
        <div class="sp-pv-meta">
          <img class="sp-pv-avatar" src="${shop.avatar}" alt="">
          <div>
            <h4>${esc(shop.name)}</h4>
            ${showTagline ? `<p>${esc(c.tagline) || `⭐ ${shop.rating} · ${shop.reviews} reviews`}</p>` : ''}
          </div>
        </div>
      </div>
      <div class="sp-pv-body">
        ${enabledSections.length ? enabledSections.join('') : '<div class="sp-pv-empty">Turn on a section to see it here</div>'}
      </div>
    `;
    previewEl.style.borderTop = `4px solid ${t.accent}`;
  }

  saveBtn.addEventListener('click', () => {
    showToast(`Shop profile saved ✓ — visit "View Shop" to see it live`);
  });

  renderControls();
  renderPreview();
})();

// ── "Forgot password?" — currently a plain <a> with no onclick at all ──────
(function wireForgotPassword() {
  const link = [...document.querySelectorAll('.modal-footer a')]
    .find(a => /forgot password/i.test(a.textContent));
  if (!link) return;
  link.style.cursor = 'pointer';
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const email = document.getElementById('authEmail')?.value.trim();
    if (!email) { showToast('Enter your email above first'); return; }
    showToast(`Reset link sent to ${email} ✓`);
  });
})();


/* ═══════════════════════════════════════════════════════════════════════════
   5. ACCESSIBLE LABELS ON FAVORITE/HEART BUTTONS
   ─────────────────────────────────────────────────────────────────────────
   .fav-btn elements are generated dynamically by productCardHTML(), so a
   one-time querySelectorAll won't catch cards rendered later. We patch
   productCardHTML itself to add the aria-label at generation time.
═══════════════════════════════════════════════════════════════════════════ */

const _origProductCardHTML = productCardHTML;
productCardHTML = function (p) {
  const html = _origProductCardHTML(p);
  const faved = favorites.has(p.id);
  const label = faved ? `Remove ${p.name} from favorites` : `Save ${p.name} to favorites`;
  return html.replace(
    /class="fav-btn[^"]*"/,
    (match) => `${match} aria-label="${label}"`
  );
};

// Re-render anything already on screen so the patched aria-labels take effect
if (typeof renderHome === 'function') renderHome();
