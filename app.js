// ===== Supabase Cloud Store =====
const SUPABASE_URL = 'https://nfgqlcurdxvlylovstgh.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mZ3FsY3VyZHh2bHlsb3ZzdGdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUzOTEzMTYsImV4cCI6MjEwMDk2NzMxNn0.nTuCUoIRkbcAFVEFb7IqUJqAlXLHuHKCNnByYxkO7zI';

function sbReq(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = new XMLHttpRequest();
    req.open(method, `${SUPABASE_URL}/rest/v1${path}`, true);
    req.setRequestHeader('apikey', SUPABASE_ANON);
    req.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON}`);
    if (data) req.setRequestHeader('Content-Type', 'application/json');
    if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
      req.setRequestHeader('Prefer', 'return=representation');
    }
    req.onload = () => resolve({ status: req.status, data: req.responseText ? JSON.parse(req.responseText) : null });
    req.onerror = () => reject(new Error('Network error'));
    req.send(data);
  });
}

const Store = {
  async getDishes() {
    try {
      const res = await sbReq('GET', '/dishes?select=*&order=created_at.desc');
      if (res.status >= 200 && res.status < 300) {
        return Array.isArray(res.data) && res.data.length > 0 ? res.data : getLocalDishes();
      }
      return getLocalDishes();
    } catch (e) {
      console.error('getDishes error:', e);
      return getLocalDishes();
    }
  },
  async getOrders() {
    try {
      const res = await sbReq('GET', '/orders?select=*&order=created_at.desc');
      if (res.status >= 200 && res.status < 300) return Array.isArray(res.data) ? res.data : [];
      return [];
    } catch (e) {
      console.error('getOrders error:', e);
      try { return JSON.parse(localStorage.getItem('emenu_orders') || '[]'); }
      catch { return []; }
    }
  },
  async saveOrder(order) {
    try {
      const res = await sbReq('POST', '/orders', order);
      if (res.status >= 200 && res.status < 300) {
        const orders = await this.getOrders();
        localStorage.setItem('emenu_orders', JSON.stringify(orders));
        return true;
      }
      return false;
    } catch (e) {
      console.error('saveOrder error:', e);
      return false;
    }
  }
};

function getLocalDishes() {
  try { return JSON.parse(localStorage.getItem('emenu_dishes') || '[]'); }
  catch { return []; }
}

// ===== Cart State =====
let cart = []; // { id, name, price, qty, image }

// ===== DOM Elements =====
const $ = id => document.getElementById(id);
const menuList = $('menuList');
const categoryNav = $('categoryNav');
const searchInput = $('searchInput');
const cartBadge = $('cartBadge');
const cartDrawer = $('cartDrawer');
const cartOverlay = $('cartOverlay');
const cartItems = $('cartItems');
const cartEmpty = $('cartEmpty');
const cartFooter = $('cartFooter');
const cartTotal = $('cartTotal');
const emptyState = $('emptyState');
const orderModal = $('orderModal');
const ordersModal = $('ordersModal');
const orderSummary = $('orderSummary');
const ordersList = $('ordersList');
const ordersEmpty = $('ordersEmpty');
const toast = $('toast');

let currentCategory = '全部';
let allDishes = [];

// ===== Render Menu =====
function renderMenu() {
  const categories = ['全部', ...new Set(allDishes.map(d => d.category).filter(Boolean))];

  // Category chips
  categoryNav.innerHTML = categories.map(c =>
    `<button class="cat-chip${c === currentCategory ? ' active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');

  // Filter
  const keyword = searchInput.value.trim().toLowerCase();
  let filtered = allDishes;
  if (currentCategory !== '全部') {
    filtered = filtered.filter(d => d.category === currentCategory);
  }
  if (keyword) {
    filtered = filtered.filter(d => d.name.toLowerCase().includes(keyword) || (d.desc || '').toLowerCase().includes(keyword));
  }

  if (filtered.length === 0) {
    menuList.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  menuList.innerHTML = filtered.map(dish => {
    const inCart = cart.find(c => c.id === dish.id);
    const qty = inCart ? inCart.qty : 0;
    const imgHtml = dish.image
      ? `<img class="dish-img" src="${dish.image}" alt="${dish.name}">`
      : `<div class="dish-img-placeholder">${dish.emoji || '🍽️'}</div>`;

    return `
      <div class="dish-card" data-id="${dish.id}">
        ${imgHtml}
        <div class="dish-info">
          <div>
            <div class="dish-name">${dish.name}</div>
            ${dish.desc ? `<div class="dish-desc">${dish.desc}</div>` : ''}
          </div>
          <div class="dish-bottom">
            <span class="dish-price">${dish.price.toFixed(2)}</span>
            ${qty > 0 ? `
              <div class="qty-control">
                <button class="qty-btn minus" data-action="minus" data-id="${dish.id}">−</button>
                <span class="qty-num">${qty}</span>
                <button class="qty-btn" data-action="plus" data-id="${dish.id}">+</button>
              </div>
            ` : `
              <button class="btn-add" data-action="add" data-id="${dish.id}">+</button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ===== Cart Logic =====
function addToCart(dishId) {
  const dish = allDishes.find(d => d.id === dishId);
  if (!dish) return;
  const existing = cart.find(c => c.id === dishId);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: dish.id, name: dish.name, price: dish.price, qty: 1, image: dish.image, emoji: dish.emoji });
  }
  updateCartUI();
  renderMenu();
}

function changeQty(dishId, delta) {
  const item = cart.find(c => c.id === dishId);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    cart = cart.filter(c => c.id !== dishId);
  }
  updateCartUI();
  renderMenu();
}

function updateCartUI() {
  const total = cart.reduce((s, c) => s + c.qty, 0);
  cartBadge.textContent = total;
  cartBadge.style.display = total > 0 ? 'flex' : 'none';

  if (cart.length === 0) {
    cartItems.innerHTML = '';
    cartEmpty.style.display = 'block';
    cartFooter.style.display = 'none';
    return;
  }
  cartEmpty.style.display = 'none';
  cartFooter.style.display = 'block';

  const sum = cart.reduce((s, c) => s + c.price * c.qty, 0);
  cartTotal.textContent = `¥${sum.toFixed(2)}`;

  cartItems.innerHTML = cart.map(c => `
    <div class="cart-item">
      <span class="cart-item-name">${c.name}</span>
      <span class="cart-item-price">¥${(c.price * c.qty).toFixed(2)}</span>
      <div class="qty-control">
        <button class="qty-btn minus" data-action="cart-minus" data-id="${c.id}">−</button>
        <span class="qty-num">${c.qty}</span>
        <button class="qty-btn" data-action="cart-plus" data-id="${c.id}">+</button>
      </div>
    </div>
  `).join('');
}

function openCart() {
  updateCartUI();
  cartDrawer.classList.add('open');
  cartOverlay.classList.add('open');
}
function closeCart() {
  cartDrawer.classList.remove('open');
  cartOverlay.classList.remove('open');
}

// ===== Orders =====
function openOrderModal() {
  if (cart.length === 0) { showToast('购物车是空的'); return; }
  closeCart();
  const sum = cart.reduce((s, c) => s + c.price * c.qty, 0);
  orderSummary.innerHTML = cart.map(c =>
    `<div class="order-line"><span>${c.name} × ${c.qty}</span><span>¥${(c.price * c.qty).toFixed(2)}</span></div>`
  ).join('') + `<div class="order-line total"><span>合计</span><span>¥${sum.toFixed(2)}</span></div>`;
  orderModal.classList.add('open');
}

async function submitOrder() {
  const tableNo = $('tableNo').value.trim();
  if (!tableNo) { showToast('请输入桌号'); return; }
  const remark = $('orderRemark').value.trim();
  const sum = cart.reduce((s, c) => s + c.price * c.qty, 0);

  const order = {
    id: 'ORD' + Date.now(),
    table_no: tableNo,
    remark,
    items: cart.map(c => ({ name: c.name, price: c.price, qty: c.qty })),
    total: sum,
    status: 'pending',
    time: new Date().toLocaleString('zh-CN')
  };

  const ok = await Store.saveOrder(order);
  if (!ok) { showToast('下单失败，请重试'); return; }

  cart = [];
  updateCartUI();
  renderMenu();
  orderModal.classList.remove('open');
  $('tableNo').value = '';
  $('orderRemark').value = '';
  showToast('🎉 下单成功！');
}

async function openOrdersList() {
  const orders = await Store.getOrders();
  if (orders.length === 0) {
    ordersList.innerHTML = '';
    ordersEmpty.style.display = 'block';
  } else {
    ordersEmpty.style.display = 'none';
    ordersList.innerHTML = orders.map(o => `
      <div class="order-card">
        <div class="order-card-header">
          <span class="order-no">${o.id} · 桌号 ${o.table_no}</span>
          <span class="order-status ${o.status === 'pending' ? 'pending' : 'done'}">
            ${o.status === 'pending' ? '制作中' : '已完成'}
          </span>
        </div>
        <div class="order-items-list">
          ${o.items.map(i => `${i.name} × ${i.qty}`).join('、')}
        </div>
        <div class="order-total-line">¥${o.total.toFixed(2)}</div>
        <div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${o.time}</div>
      </div>
    `).join('');
  }
  ordersModal.classList.add('open');
}

// ===== Toast =====
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== Event Listeners =====
// Menu clicks (delegation)
menuList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'add') addToCart(id);
  else if (action === 'plus') changeQty(id, 1);
  else if (action === 'minus') changeQty(id, -1);
});

// Cart clicks
cartItems.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'cart-plus') changeQty(id, 1);
  else if (action === 'cart-minus') changeQty(id, -1);
});

// Category clicks
categoryNav.addEventListener('click', e => {
  const chip = e.target.closest('.cat-chip');
  if (!chip) return;
  currentCategory = chip.dataset.cat;
  renderMenu();
});

// Search
searchInput.addEventListener('input', () => renderMenu());

// Cart drawer
$('btnCart').addEventListener('click', openCart);
$('btnCloseCart').addEventListener('click', closeCart);
cartOverlay.addEventListener('click', closeCart);

// Checkout
$('btnCheckout').addEventListener('click', openOrderModal);
$('btnCloseOrder').addEventListener('click', () => orderModal.classList.remove('open'));
$('btnSubmitOrder').addEventListener('click', async () => {
  $('btnSubmitOrder').disabled = true;
  try { await submitOrder(); }
  finally { $('btnSubmitOrder').disabled = false; }
});

// Orders
$('btnOrders').addEventListener('click', async () => { await openOrdersList(); });
$('btnCloseOrders').addEventListener('click', () => ordersModal.classList.remove('open'));

// Close modals on overlay click
orderModal.addEventListener('click', e => { if (e.target === orderModal) orderModal.classList.remove('open'); });
ordersModal.addEventListener('click', e => { if (e.target === ordersModal) ordersModal.classList.remove('open'); });

// ===== 🎲 骰子随机点菜 =====
const diceOverlay = $('diceOverlay');
const diceCube = $('diceCube');
const diceHint = $('diceHint');
const diceResult = $('diceResult');
const diceParticles = $('diceParticles');
const speedLines = $('speedLines');
const EMOJIS = ['🍗','🌶️','🍚','🍜','🥩','🍮','🥒','🍋','🍕','🍣','🥘','🍛','🍝','🌮','🥟','🍱'];
let diceRolling = false;
let selectedDish = null;

// 随机整数
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// 更新骰子面上的表情
function updateDiceFaces() {
  const faces = diceCube.querySelectorAll('.dice-face');
  const shuffled = [...EMOJIS].sort(() => Math.random() - 0.5);
  faces.forEach((f, i) => f.textContent = shuffled[i] || shuffled[0]);
}

// 生成粒子特效
function spawnParticles() {
  const interval = setInterval(() => {
    if (!diceRolling) { clearInterval(interval); return; }
    for (let i = 0; i < 3; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      const angle = Math.random() * 360;
      const dist = rand(80, 160);
      p.style.left = '50%';
      p.style.top = '50%';
      p.style.setProperty('--px', `${Math.cos(angle * Math.PI / 180) * dist}px`);
      p.style.setProperty('--py', `${Math.sin(angle * Math.PI / 180) * dist}px`);
      p.style.background = `hsl(${rand(15, 45)}, 100%, ${rand(50, 70)}%)`;
      p.style.animationDuration = `${0.5 + Math.random() * 0.5}s`;
      diceParticles.appendChild(p);
      setTimeout(() => p.remove(), 1000);
    }
  }, 100);
  return interval;
}

// 生成速度线
function spawnSpeedLines() {
  const interval = setInterval(() => {
    if (!diceRolling) { clearInterval(interval); return; }
    for (let i = 0; i < 2; i++) {
      const line = document.createElement('div');
      line.className = 'speed-line';
      line.style.top = `${rand(10, 90)}%`;
      line.style.left = `${rand(0, 30)}%`;
      line.style.width = `${rand(60, 140)}px`;
      line.style.animationDuration = `${0.3 + Math.random() * 0.3}s`;
      speedLines.appendChild(line);
      setTimeout(() => line.remove(), 800);
    }
  }, 120);
  return interval;
}

// 滚动骰子主流程
async function rollDice() {
  if (diceRolling) return;
  const dishes = await Store.getDishes();
  if (dishes.length === 0) { showToast('暂无菜品可抽'); return; }

  diceRolling = true;
  diceResult.classList.remove('active');
  diceOverlay.classList.add('active');
  updateDiceFaces();

  // 阶段 1: 快速旋转 (0~1.5s)
  diceCube.className = 'dice-cube spinning-fast';
  diceHint.textContent = '命运之骰正在转动...';
  const pInterval = spawnParticles();
  const sInterval = spawnSpeedLines();

  // 阶段 2: 正常旋转 (1.5s~2.5s)
  setTimeout(() => {
    if (!diceRolling) return;
    diceCube.className = 'dice-cube spinning';
    diceHint.textContent = '即将揭晓...';
    updateDiceFaces();
  }, 1500);

  // 阶段 3: 减速 (2.5s~3s)
  setTimeout(() => {
    if (!diceRolling) return;
    diceCube.className = 'dice-cube slowing';
    diceHint.textContent = '✨ 命运已定!';
  }, 2500);

  // 阶段 4: 落地揭晓 (3s)
  setTimeout(() => {
    if (!diceRolling) return;
    clearInterval(pInterval);
    clearInterval(sInterval);

    // 随机选菜
    selectedDish = dishes[rand(0, dishes.length - 1)];

    // 设置落地角度（让某一面正对观众）
    const faceAngles = [
      { rx: 0, ry: 0, rz: 0 },        // front
      { rx: 0, ry: 180, rz: 0 },       // back
      { rx: 0, ry: -90, rz: 0 },       // right
      { rx: 0, ry: 90, rz: 0 },        // left
      { rx: -90, ry: 0, rz: 0 },       // top
      { rx: 90, ry: 0, rz: 0 }         // bottom
    ];
    const faceIdx = rand(0, 5);
    const final = faceAngles[faceIdx];
    const land = { rx: final.rx + rand(360, 720), ry: final.ry + rand(360, 720), rz: final.rz + rand(360, 720) };

    diceCube.style.setProperty('--land-rx', `${land.rx}deg`);
    diceCube.style.setProperty('--land-ry', `${land.ry}deg`);
    diceCube.style.setProperty('--land-rz', `${land.rz}deg`);
    diceCube.style.setProperty('--final-rx', `${final.rx}deg`);
    diceCube.style.setProperty('--final-ry', `${final.ry}deg`);
    diceCube.style.setProperty('--final-rz', `${final.rz}deg`);
    diceCube.className = 'dice-cube landed';

    // 更新选中面的表情
    const faces = diceCube.querySelectorAll('.dice-face');
    faces[faceIdx].textContent = selectedDish.emoji || '🍽️';
    faces[faceIdx].style.fontSize = '64px';

    // 0.6s后显示结果卡
    setTimeout(() => showDiceResult(selectedDish), 700);
  }, 3000);
}

// 显示结果卡
function showDiceResult(dish) {
  diceOverlay.classList.remove('active');
  diceRolling = false;

  const imgEl = $('diceResultImg');
  if (dish.image) {
    imgEl.innerHTML = `<img src="${dish.image}" alt="${dish.name}">`;
  } else {
    imgEl.innerHTML = dish.emoji || '🍽️';
    imgEl.style.fontSize = '56px';
    imgEl.style.display = 'flex';
    imgEl.style.alignItems = 'center';
    imgEl.style.justifyContent = 'center';
  }
  $('diceResultName').textContent = dish.name;
  $('diceResultDesc').textContent = dish.desc || '精选美味，不容错过!';
  $('diceResultPrice').textContent = dish.price.toFixed(2);
  diceResult.classList.add('active');
}

// 事件绑定
$('btnDice').addEventListener('click', async () => { await rollDice(); });

$('btnDiceOrder').addEventListener('click', () => {
  if (!selectedDish) return;
  addToCart(selectedDish.id);
  diceResult.classList.remove('active');
  showToast(`🎉 ${selectedDish.name} 已加入购物车!`);
  renderMenu();
});

$('btnDiceReroll').addEventListener('click', () => {
  diceResult.classList.remove('active');
  setTimeout(async () => { await rollDice(); }, 300);
});

$('btnDiceClose').addEventListener('click', () => {
  diceResult.classList.remove('active');
  diceOverlay.classList.remove('active');
  diceRolling = false;
});

// ===== Demo Data (fallback) =====
function seedDemoDishes() {
  const demoDishes = [
    { id: 'demo1', name: '宫保鸡丁', category: '热菜', price: 38, desc: '经典川菜，鸡肉配花生米，香辣可口', emoji: '🍗', image: '' },
    { id: 'demo2', name: '麻婆豆腐', category: '热菜', price: 28, desc: '麻辣鲜香，嫩滑入味', emoji: '🌶️', image: '' },
    { id: 'demo3', name: '蛋炒饭', category: '主食', price: 18, desc: '粒粒分明，蛋香浓郁', emoji: '🍚', image: '' },
    { id: 'demo4', name: '酸辣汤', category: '汤品', price: 22, desc: '酸辣开胃，暖身佳品', emoji: '🍜', image: '' },
    { id: 'demo5', name: '凉拌黄瓜', category: '凉菜', price: 12, desc: '清脆爽口，蒜香开胃', emoji: '🥒', image: '' },
    { id: 'demo6', name: '柠檬水', category: '饮品', price: 8, desc: '新鲜柠檬，清凉解渴', emoji: '🍋', image: '' },
    { id: 'demo7', name: '红烧肉', category: '热菜', price: 48, desc: '肥而不腻，入口即化', emoji: '🥩', image: '' },
    { id: 'demo8', name: '芒果布丁', category: '甜点', price: 16, desc: '细腻顺滑，芒果飘香', emoji: '🍮', image: '' }
  ];
  localStorage.setItem('emenu_dishes', JSON.stringify(demoDishes));
  return demoDishes;
}

// ===== Init =====
async function init() {
  allDishes = await Store.getDishes();
  if (allDishes.length === 0) {
    allDishes = seedDemoDishes();
  }
  renderMenu();
}
init();

// Register Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
