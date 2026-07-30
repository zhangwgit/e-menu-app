// ===== Data Layer =====
const Store = {
  getDishes() {
    try { return JSON.parse(localStorage.getItem('emenu_dishes') || '[]'); }
    catch { return []; }
  },
  saveDishes(dishes) {
    localStorage.setItem('emenu_dishes', JSON.stringify(dishes));
  },
  getOrders() {
    try { return JSON.parse(localStorage.getItem('emenu_orders') || '[]'); }
    catch { return []; }
  },
  saveOrders(orders) {
    localStorage.setItem('emenu_orders', JSON.stringify(orders));
  }
};

// ===== DOM =====
const $ = id => document.getElementById(id);
const dishList = $('dishList');
const noDishes = $('noDishes');
const adminOrderList = $('adminOrderList');
const noOrders = $('noOrders');
const tabs = document.querySelectorAll('.admin-tab');
const tabPanels = { dishes: $('tabDishes'), orders: $('tabOrders'), add: $('tabAdd') };
const imgUploadArea = $('imgUploadArea');
const imgInput = $('imgInput');
const toast = $('toast');

let currentImage = '';

// ===== Tabs =====
tabs.forEach(tab => {
  tab.addEventListener('click', () => switchTab(tab.dataset.tab));
});

function switchTab(name) {
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  Object.entries(tabPanels).forEach(([k, el]) => el.style.display = k === name ? 'block' : 'none');
  $('fabAdd').style.display = name === 'dishes' ? 'flex' : 'none';
  if (name === 'dishes') renderDishes();
  if (name === 'orders') renderOrders();
}

// ===== Render Dishes =====
function renderDishes() {
  const dishes = Store.getDishes();
  if (dishes.length === 0) {
    dishList.innerHTML = '';
    noDishes.style.display = 'block';
    return;
  }
  noDishes.style.display = 'none';
  dishList.innerHTML = dishes.map(d => `
    <div class="admin-dish-item" data-id="${d.id}">
      ${d.image
        ? `<img src="${d.image}" alt="${d.name}">`
        : `<div class="placeholder-img">${d.emoji || '🍽️'}</div>`
      }
      <div class="admin-dish-info">
        <div class="name">${d.name}</div>
        <div class="meta">${d.category || '未分类'} · ¥${d.price.toFixed(2)}</div>
      </div>
      <div class="admin-dish-actions">
        <button class="btn-sm btn-edit" data-action="edit" data-id="${d.id}">编辑</button>
        <button class="btn-sm btn-delete" data-action="delete" data-id="${d.id}">删除</button>
      </div>
    </div>
  `).join('');
}

// ===== Dish Actions =====
dishList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;
  if (action === 'delete') deleteDish(id);
  else if (action === 'edit') editDish(id);
});

function deleteDish(id) {
  if (!confirm('确定删除这道菜吗？')) return;
  let dishes = Store.getDishes();
  dishes = dishes.filter(d => d.id !== id);
  Store.saveDishes(dishes);
  renderDishes();
  showToast('已删除');
}

function editDish(id) {
  const dishes = Store.getDishes();
  const dish = dishes.find(d => d.id === id);
  if (!dish) return;

  switchTab('add');
  $('formTitle').textContent = '编辑菜品';
  $('editId').value = dish.id;
  $('dishName').value = dish.name;
  $('dishCategory').value = dish.category || '热菜';
  $('dishPrice').value = dish.price;
  $('dishDesc').value = dish.desc || '';
  $('dishEmoji').value = dish.emoji || '';
  currentImage = dish.image || '';

  if (currentImage) {
    imgUploadArea.innerHTML = `<img src="${currentImage}" alt="preview"><span class="upload-text" style="position:relative;z-index:1;background:rgba(0,0,0,.5);color:#fff;padding:2px 8px;border-radius:4px">点击更换</span>`;
  } else {
    resetImageArea();
  }
  $('btnCancelEdit').style.display = 'block';
}

$('btnCancelEdit').addEventListener('click', () => {
  resetForm();
  switchTab('dishes');
});

// ===== Image Upload =====
imgUploadArea.addEventListener('click', () => imgInput.click());

imgInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    currentImage = ev.target.result;
    imgUploadArea.innerHTML = `<img src="${currentImage}" alt="preview"><span class="upload-text" style="position:relative;z-index:1;background:rgba(0,0,0,.5);color:#fff;padding:2px 8px;border-radius:4px">点击更换</span>`;
  };
  reader.readAsDataURL(file);
});

function resetImageArea() {
  imgUploadArea.innerHTML = '<span class="upload-icon">📷</span><span class="upload-text">点击上传图片</span>';
}

// ===== Save Dish =====
$('btnSaveDish').addEventListener('click', () => {
  const name = $('dishName').value.trim();
  const price = parseFloat($('dishPrice').value);
  if (!name) { showToast('请输入菜品名称'); return; }
  if (isNaN(price) || price < 0) { showToast('请输入有效价格'); return; }

  const editId = $('editId').value;
  let dishes = Store.getDishes();

  const dishData = {
    id: editId || 'dish_' + Date.now(),
    name,
    category: $('dishCategory').value,
    price,
    desc: $('dishDesc').value.trim(),
    emoji: $('dishEmoji').value.trim() || '🍽️',
    image: currentImage
  };

  if (editId) {
    const idx = dishes.findIndex(d => d.id === editId);
    if (idx !== -1) dishes[idx] = dishData;
    showToast('菜品已更新');
  } else {
    dishes.push(dishData);
    showToast('菜品已添加');
  }

  Store.saveDishes(dishes);
  resetForm();
  switchTab('dishes');
});

function resetForm() {
  $('formTitle').textContent = '添加新菜品';
  $('editId').value = '';
  $('dishName').value = '';
  $('dishCategory').value = '热菜';
  $('dishPrice').value = '';
  $('dishDesc').value = '';
  $('dishEmoji').value = '';
  currentImage = '';
  resetImageArea();
  imgInput.value = '';
  $('btnCancelEdit').style.display = 'none';
}

// ===== Render Orders =====
function renderOrders() {
  const orders = Store.getOrders();
  if (orders.length === 0) {
    adminOrderList.innerHTML = '';
    noOrders.style.display = 'block';
    return;
  }
  noOrders.style.display = 'none';
  adminOrderList.innerHTML = orders.map(o => `
    <div class="all-order-card">
      <div class="order-header-row">
        <div>
          <div style="font-weight:600;font-size:14px">${o.id}</div>
          <div style="font-size:13px;color:var(--text-secondary)">桌号: ${o.tableNo} · ${o.time}</div>
          ${o.remark ? `<div style="font-size:12px;color:#ff6b35;margin-top:2px">备注: ${o.remark}</div>` : ''}
        </div>
        ${o.status === 'pending' ? `<button class="btn-status btn-mark-done" data-action="mark-done" data-id="${o.id}">完成</button>` : '<span class="order-status done">已完成</span>'}
      </div>
      <div style="margin-top:8px;font-size:14px;line-height:1.6">
        ${o.items.map(i => `${i.name} × ${i.qty}  <span style="color:var(--text-secondary)">¥${(i.price * i.qty).toFixed(2)}</span>`).join('<br>')}
      </div>
      <div class="order-total-line">合计: ¥${o.total.toFixed(2)}</div>
    </div>
  `).join('');
}

adminOrderList.addEventListener('click', e => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  if (btn.dataset.action === 'mark-done') {
    const orders = Store.getOrders();
    const order = orders.find(o => o.id === btn.dataset.id);
    if (order) {
      order.status = 'done';
      Store.saveOrders(orders);
      renderOrders();
      showToast('订单已完成');
    }
  }
});

// ===== FAB =====
$('fabAdd').addEventListener('click', () => {
  resetForm();
  switchTab('add');
});

// ===== Toast =====
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ===== Init =====
renderDishes();

// ===== Demo Data (if empty) =====
if (Store.getDishes().length === 0) {
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
  Store.saveDishes(demoDishes);
  renderDishes();
}
