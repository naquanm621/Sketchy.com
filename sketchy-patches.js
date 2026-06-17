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
   4. SHOP PROFILE — REAL SAVE + RESTORE, AND "FORGOT PASSWORD?"
═══════════════════════════════════════════════════════════════════════════ */

(function wireShopProfile() {
  const panel = document.getElementById('dash-shop-profile');
  if (!panel) return;

  const inputs = panel.querySelectorAll('input.form-input, textarea.textarea-input');
  // Order in the DOM: [0] shop name, [1] tagline, [2] about, [3] announcement,
  // [4] shipping policy, [5] returns, [6] custom orders
  const fieldKeys = ['shopName','tagline','about','announcement','shippingPolicy','returns','customOrders'];

  // Restore saved values on load (falls back to the HTML defaults already there)
  const saved = lsGet('sk_shop_profile', null);
  if (saved) {
    inputs.forEach((el, i) => {
      const key = fieldKeys[i];
      if (key && saved[key] !== undefined) el.value = saved[key];
    });
  }

  const saveBtn = [...panel.querySelectorAll('button')].find(b => b.textContent.trim() === 'Save Profile');
  if (saveBtn) {
    saveBtn.removeAttribute('onclick');
    saveBtn.addEventListener('click', () => {
      const data = {};
      inputs.forEach((el, i) => { if (fieldKeys[i]) data[fieldKeys[i]] = el.value; });
      lsSet('sk_shop_profile', data);
      showToast('Shop profile saved ✓');
    });
  }
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
