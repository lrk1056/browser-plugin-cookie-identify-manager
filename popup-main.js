/**
 * Cookie 管理器主逻辑
 * 负责 Cookie 的查询、展示、增删改查、导入导出功能
 */

// ============================================
// 全局状态管理
// ============================================
const state = {
  cookies: [],           // 所有 Cookie 列表
  filteredCookies: [],   // 过滤后的 Cookie 列表
  currentDomain: '',     // 当前域名
  baseDomain: '',        // 基础域名（二级域名）
  domainMode: 'exact',   // 域名模式：exact(精确) | base(基础域名)
  searchKeyword: '',     // 搜索关键字
  filters: {
    httpOnly: false,     // HttpOnly 过滤
    secure: false,       // Secure 过滤
    session: 'all'       // 会话级过滤：all | session | persistent
  },
  sort: {
    field: 'name',       // 排序字段：name | expirationDate
    order: 'asc'         // 排序顺序：asc | desc
  },
  selectedCookie: null,  // 当前选中的 Cookie
  exportFormat: 'json',  // 导出格式：json | header | netscape
  headerLineBreak: false,// Header String 格式是否换行，默认 false
  jsonCompress: false    // JSON 格式是否压缩，默认 false
};

// ============================================
// DOM 元素引用
// ============================================
let elements = {};

// ============================================
// 初始化
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  bindEvents();
  initColumnResize();  // 初始化列宽拖拽
  await loadCurrentTabDomain();
  await loadCookies();
});

/**
 * 初始化列宽拖拽功能
 */
function initColumnResize() {
  const resizers = document.querySelectorAll('.resizer');
  const listHeader = document.querySelector('.list-header');

  resizers.forEach(resizer => {
    resizer.addEventListener('mousedown', (e) => {
      e.preventDefault();

      const colIndex = parseInt(resizer.getAttribute('data-col'));
      const startX = e.pageX;
      const resizerWidth = 4;

      // 获取当前列的宽度
      const headerCols = listHeader.querySelectorAll('.col-name, .col-value, .col-domain, .col-path, .col-expiry, .col-flags, .col-actions');
      const currentCol = headerCols[colIndex];
      const currentWidth = currentCol.offsetWidth;

      // 获取 cookie-item 中对应的列
      const cookieItems = document.querySelectorAll('.cookie-item');
      const cookieCols = ['.cookie-col.name', '.cookie-col.value', '.cookie-col.domain', '.cookie-col.path', '.cookie-col.expiry', '.cookie-col.flags', '.cookie-col.actions'];

      resizer.classList.add('active');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMouseMove = (moveEvent) => {
        const diff = moveEvent.pageX - startX;
        const newWidth = Math.max(30, currentWidth + diff); // 最小宽度 30px

        // 更新 list-header 中列的宽度
        currentCol.style.width = newWidth + 'px';

        // 同步更新 cookie-item 中对应列的宽度
        const targetClass = cookieCols[colIndex];
        cookieItems.forEach(item => {
          const targetCol = item.querySelector(targetClass);
          if (targetCol) {
            targetCol.style.width = newWidth + 'px';
          }
        });
      };

      const onMouseUp = () => {
        resizer.classList.remove('active');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
  });
}

/**
 * 初始化 DOM 元素引用
 */
function initElements() {
  elements = {
    // 域名相关
    domainDisplay: document.getElementById('domainDisplay'),
    domainModeToggle: document.getElementById('domainModeToggle'),
    domainModeText: document.getElementById('domainModeText'),

    // 搜索和过滤
    searchInput: document.getElementById('searchInput'),
    filterHttpOnly: document.getElementById('filterHttpOnly'),
    filterSecure: document.getElementById('filterSecure'),
    filterSession: document.getElementById('filterSession'),

    // 排序
    sortNameBtn: document.getElementById('sortNameBtn'),
    sortExpiryBtn: document.getElementById('sortExpiryBtn'),

    // 统计
    cookieCount: document.getElementById('cookieCount'),

    // Cookie 列表
    cookieList: document.getElementById('cookieList'),

    // 按钮
    refreshBtn: document.getElementById('refreshBtn'),
    addBtn: document.getElementById('addBtn'),
    importBtn: document.getElementById('importBtn'),
    exportBtn: document.getElementById('exportBtn'),
    deleteAllBtn: document.getElementById('deleteAllBtn'),

    // Toast
    toast: document.getElementById('toast'),
    toastMessage: document.getElementById('toastMessage'),

    // 模态框 - Cookie 编辑
    cookieModal: document.getElementById('cookieModal'),
    cookieForm: document.getElementById('cookieForm'),
    modalTitle: document.getElementById('modalTitle'),
    cookieName: document.getElementById('cookieName'),
    cookieValue: document.getElementById('cookieValue'),
    cookieDomain: document.getElementById('cookieDomain'),
    cookiePath: document.getElementById('cookiePath'),
    cookieExpiration: document.getElementById('cookieExpiration'),
    cookieHttpOnly: document.getElementById('cookieHttpOnly'),
    cookieSecure: document.getElementById('cookieSecure'),
    saveCookieBtn: document.getElementById('saveCookieBtn'),
    cancelCookieBtn: document.getElementById('cancelCookieBtn'),
    deleteCookieBtn: document.getElementById('deleteCookieBtn'),

    // 模态框 - 导入
    importModal: document.getElementById('importModal'),
    importFormat: document.getElementById('importFormat'),
    importData: document.getElementById('importData'),
    importFormatHelp: document.getElementById('importFormatHelp'),
    confirmImportBtn: document.getElementById('confirmImportBtn'),
    cancelImportBtn: document.getElementById('cancelImportBtn'),

    // 模态框 - 导出
    exportModal: document.getElementById('exportModal'),
    exportFormatSelect: document.getElementById('exportFormatSelect'),
    exportData: document.getElementById('exportData'),
    headerLineBreakCheckbox: document.getElementById('headerLineBreak'),
    jsonCompressCheckbox: document.getElementById('jsonCompress'),
    copyExportBtn: document.getElementById('copyExportBtn'),
    downloadExportBtn: document.getElementById('downloadExportBtn'),
    closeExportBtn: document.getElementById('closeExportBtn')
  };
}

/**
 * 绑定事件处理器
 */
function bindEvents() {
  // 域名模式切换
  elements.domainModeToggle.addEventListener('click', toggleDomainMode);

  // 搜索和过滤
  elements.searchInput.addEventListener('input', debounce(onSearch, 300));
  elements.filterHttpOnly.addEventListener('change', onFilterChange);
  elements.filterSecure.addEventListener('change', onFilterChange);
  elements.filterSession.addEventListener('change', onFilterChange);

  // 排序
  elements.sortNameBtn.addEventListener('click', () => toggleSort('name'));
  elements.sortExpiryBtn.addEventListener('click', () => toggleSort('expirationDate'));

  // 按钮
  elements.refreshBtn.addEventListener('click', refreshCookies);
  elements.addBtn.addEventListener('click', openAddModal);
  elements.importBtn.addEventListener('click', openImportModal);
  elements.exportBtn.addEventListener('click', openExportModal);
  elements.deleteAllBtn.addEventListener('click', deleteAllCookies);

  // Cookie 编辑模态框
  elements.cookieForm.addEventListener('submit', saveCookie);
  elements.cancelCookieBtn.addEventListener('click', closeCookieModal);
  elements.deleteCookieBtn.addEventListener('click', deleteCurrentCookie);

  // 导入模态框
  elements.importFormat.addEventListener('change', onImportFormatChange);
  elements.confirmImportBtn.addEventListener('click', importCookies);
  elements.cancelImportBtn.addEventListener('click', closeImportModal);

  // 导出模态框
  elements.exportFormatSelect.addEventListener('change', onExportFormatChange);
  elements.copyExportBtn.addEventListener('click', copyExportData);
  elements.downloadExportBtn.addEventListener('click', downloadExportData);
  elements.closeExportBtn.addEventListener('click', closeExportModal);

  // Header String 换行选项
  if (elements.headerLineBreakCheckbox) {
    elements.headerLineBreakCheckbox.addEventListener('change', onHeaderLineBreakChange);
  }

  // JSON 压缩选项
  if (elements.jsonCompressCheckbox) {
    elements.jsonCompressCheckbox.addEventListener('change', onJsonCompressChange);
  }

  // 额外的关闭按钮事件绑定（用于新添加的按钮）
  const closeModalBtn = document.getElementById('closeModalBtn');
  const closeImportModalBtn = document.getElementById('closeImportModalBtn');
  const closeExportModalBtn = document.getElementById('closeExportModalBtn');

  if (closeModalBtn) closeModalBtn.addEventListener('click', closeCookieModal);
  if (closeImportModalBtn) closeImportModalBtn.addEventListener('click', closeImportModal);
  if (closeExportModalBtn) closeExportModalBtn.addEventListener('click', closeExportModal);

  // 额外的关闭按钮事件绑定
  document.getElementById('closeModalBtn')?.addEventListener('click', closeCookieModal);
  document.getElementById('closeImportModalBtn')?.addEventListener('click', closeImportModal);
  document.getElementById('closeExportModalBtn')?.addEventListener('click', closeExportModal);

  // 点击模态框外部关闭
  window.addEventListener('click', (e) => {
    if (e.target === elements.cookieModal) closeCookieModal();
    if (e.target === elements.importModal) closeImportModal();
    if (e.target === elements.exportModal) closeExportModal();
  });
}

// ============================================
// 域名处理
// ============================================

/**
 * 加载当前标签页的域名
 */
async function loadCurrentTabDomain() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tabs.length === 0) return;

    const url = new URL(tabs[0].url);
    state.currentDomain = url.hostname;
    state.baseDomain = getBaseDomain(url.hostname);

    updateDomainDisplay();
  } catch (error) {
    showToast('获取当前域名失败: ' + error.message, 'error');
  }
}

/**
 * 获取基础域名（二级域名）
 * @param {string} hostname - 主机名
 * @returns {string} 基础域名
 */
function getBaseDomain(hostname) {
  // 处理 IP 地址
  if (/^\d+\.\d+\.\d+\.\d+$/.test(hostname)) {
    return hostname;
  }

  const parts = hostname.split('.');
  if (parts.length <= 2) {
    return hostname;
  }

  // 简单处理：取最后两部分
  // 实际项目中可能需要使用更复杂的公共后缀列表
  return parts.slice(-2).join('.');
}

/**
 * 更新域名显示
 */
function updateDomainDisplay() {
  const displayDomain = state.domainMode === 'exact'
    ? state.currentDomain
    : state.baseDomain;
  elements.domainDisplay.textContent = displayDomain || '未知域名';
  elements.domainModeText.textContent = state.domainMode === 'exact' ? '精确匹配' : '二级域名';
}

/**
 * 切换域名模式
 */
function toggleDomainMode() {
  state.domainMode = state.domainMode === 'exact' ? 'base' : 'exact';
  updateDomainDisplay();
  loadCookies();
}

/**
 * 获取当前查询用的域名
 */
function getQueryDomain() {
  return state.domainMode === 'exact' ? state.currentDomain : state.baseDomain;
}

// ============================================
// Cookie 加载与展示
// ============================================

/**
 * 加载 Cookie 列表
 */
async function loadCookies() {
  try {
    const domain = getQueryDomain();
    if (!domain) {
      showToast('无法获取域名信息', 'error');
      return;
    }

    // 查询 Cookie，使用 storeId 确保获取所有 Cookie
    state.cookies = await chrome.cookies.getAll({
      domain: domain
    });

    applyFiltersAndSort();
    renderCookieList();
    updateStats();
  } catch (error) {
    showToast('加载 Cookie 失败: ' + error.message, 'error');
  }
}

/**
 * 刷新 Cookie 列表
 */
async function refreshCookies() {
  await loadCookies();
  showToast('已刷新', 'success');
}

/**
 * 应用过滤和排序
 */
function applyFiltersAndSort() {
  let result = [...state.cookies];

  // 搜索过滤
  if (state.searchKeyword) {
    const keyword = state.searchKeyword.toLowerCase();
    result = result.filter(cookie =>
      cookie.name.toLowerCase().includes(keyword)
    );
  }

  // HttpOnly 过滤
  if (state.filters.httpOnly) {
    result = result.filter(cookie => cookie.httpOnly);
  }

  // Secure 过滤
  if (state.filters.secure) {
    result = result.filter(cookie => cookie.secure);
  }

  // 会话级过滤
  if (state.filters.session === 'session') {
    result = result.filter(cookie => cookie.session);
  } else if (state.filters.session === 'persistent') {
    result = result.filter(cookie => !cookie.session);
  }

  // 排序
  result.sort((a, b) => {
    let comparison = 0;
    if (state.sort.field === 'name') {
      comparison = a.name.localeCompare(b.name);
    } else if (state.sort.field === 'expirationDate') {
      const aTime = a.expirationDate || Infinity;
      const bTime = b.expirationDate || Infinity;
      comparison = aTime - bTime;
    }
    return state.sort.order === 'asc' ? comparison : -comparison;
  });

  state.filteredCookies = result;
}

/**
 * 渲染 Cookie 列表
 */
function renderCookieList() {
  const list = elements.cookieList;
  list.innerHTML = '';

  if (state.filteredCookies.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🍪</div>
        <div class="empty-state-text">没有找到 Cookie</div>
      </div>
    `;
    return;
  }

  state.filteredCookies.forEach(cookie => {
    const item = createCookieItem(cookie);
    list.appendChild(item);
  });

  // 同步列宽
  syncColumnWidths();
}

/**
 * 同步 list-header 和 cookie-item 的列宽
 */
function syncColumnWidths() {
  const listHeader = document.querySelector('.list-header');
  const headerCols = listHeader.querySelectorAll('.col-name, .col-value, .col-domain, .col-path, .col-expiry, .col-flags, .col-actions');
  const cookieItems = document.querySelectorAll('.cookie-item');
  const cookieColClasses = ['.cookie-col.name', '.cookie-col.value', '.cookie-col.domain', '.cookie-col.path', '.cookie-col.expiry', '.cookie-col.flags', '.cookie-col.actions'];

  cookieItems.forEach(item => {
    headerCols.forEach((headerCol, index) => {
      const width = headerCol.style.width || getComputedStyle(headerCol).width;
      const targetCol = item.querySelector(cookieColClasses[index]);
      if (targetCol) {
        targetCol.style.width = width;
      }
    });
  });
}

/**
 * 创建单个 Cookie 项的 DOM
 * @param {Object} cookie - Cookie 对象
 * @returns {HTMLElement} Cookie 项元素
 */
function createCookieItem(cookie) {
  const div = document.createElement('div');
  div.className = 'cookie-item';
  div.dataset.name = cookie.name;

  const isSession = cookie.session || !cookie.expirationDate;
  const expiryText = isSession
    ? '会话'
    : formatDateTime(cookie.expirationDate * 1000);

  // 构建标记显示（完整文字）
  const flags = [];
  if (cookie.httpOnly) flags.push('<span class="flag httponly">HttpOnly</span>');
  if (cookie.secure) flags.push('<span class="flag secure">Secure</span>');
  if (isSession) flags.push('<span class="flag session">Session</span>');

  // 各列数据
  const name = escapeHtml(cookie.name);  // 名称不截断，显示完整
  const value = escapeHtml(truncateString(cookie.value, 45));
  const domain = escapeHtml(truncateString(cookie.domain || '', 14));
  const path = escapeHtml(truncateString(cookie.path || '/', 8));
  const expiry = expiryText;
  const flagsHtml = flags.join('') || '-';

  div.innerHTML = `
    <div class="cookie-col name" title="${escapeHtml(cookie.name)}">${name}</div>
    <div class="cookie-col value" title="${escapeHtml(cookie.value)}">${value}</div>
    <div class="cookie-col domain" title="${escapeHtml(cookie.domain || '')}">${domain}</div>
    <div class="cookie-col path" title="${escapeHtml(cookie.path || '/')}">${path}</div>
    <div class="cookie-col expiry">${expiry}</div>
    <div class="cookie-col flags">${flagsHtml}</div>
    <div class="cookie-col actions">
      <button class="icon-btn edit" title="编辑">✏️</button>
      <button class="icon-btn delete" title="删除">🗑️</button>
    </div>
  `;

  // 绑定事件
  div.querySelector('.icon-btn.edit').addEventListener('click', (e) => {
    e.stopPropagation();
    openEditModal(cookie);
  });

  div.querySelector('.icon-btn.delete').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteCookie(cookie);
  });

  // 点击行复制 Header String 格式
  div.addEventListener('click', () => {
    // 选中效果
    document.querySelectorAll('.cookie-item').forEach(el => el.classList.remove('selected'));
    div.classList.add('selected');

    // 复制 Header String 格式
    const headerString = `${cookie.name}=${cookie.value}`;
    copyToClipboard(headerString);
  });

  return div;
}

/**
 * 更新统计信息
 */
function updateStats() {
  const filtered = state.filteredCookies.length;
  const total = state.cookies.length;
  elements.cookieCount.textContent = `${filtered} / ${total}`;
}

// ============================================
// 搜索和过滤
// ============================================

/**
 * 搜索处理
 * @param {Event} e - 输入事件
 */
function onSearch(e) {
  state.searchKeyword = e.target.value.trim();
  applyFiltersAndSort();
  renderCookieList();
  updateStats();
}

/**
 * 过滤器变化处理
 */
function onFilterChange() {
  state.filters.httpOnly = elements.filterHttpOnly.checked;
  state.filters.secure = elements.filterSecure.checked;
  state.filters.session = elements.filterSession.value;
  applyFiltersAndSort();
  renderCookieList();
  updateStats();
}

// ============================================
// 排序
// ============================================

/**
 * 切换排序
 * @param {string} field - 排序字段
 */
function toggleSort(field) {
  if (state.sort.field === field) {
    state.sort.order = state.sort.order === 'asc' ? 'desc' : 'asc';
  } else {
    state.sort.field = field;
    state.sort.order = 'asc';
  }

  // 更新按钮样式
  updateSortButtons();
  applyFiltersAndSort();
  renderCookieList();
}

/**
 * 更新排序按钮样式
 */
function updateSortButtons() {
  elements.sortNameBtn.classList.toggle('active', state.sort.field === 'name');
  elements.sortNameBtn.classList.toggle('asc', state.sort.field === 'name' && state.sort.order === 'asc');
  elements.sortNameBtn.classList.toggle('desc', state.sort.field === 'name' && state.sort.order === 'desc');

  elements.sortExpiryBtn.classList.toggle('active', state.sort.field === 'expirationDate');
  elements.sortExpiryBtn.classList.toggle('asc', state.sort.field === 'expirationDate' && state.sort.order === 'asc');
  elements.sortExpiryBtn.classList.toggle('desc', state.sort.field === 'expirationDate' && state.sort.order === 'desc');
}

// ============================================
// Cookie 操作（增删改）
// ============================================

/**
 * 打开添加 Cookie 模态框
 */
function openAddModal() {
  state.selectedCookie = null;
  elements.modalTitle.textContent = '添加 Cookie';
  elements.deleteCookieBtn.style.display = 'none';

  // 重置表单
  elements.cookieName.value = '';
  elements.cookieValue.value = '';
  elements.cookieDomain.value = getQueryDomain();
  elements.cookiePath.value = '/';
  elements.cookieExpiration.value = '';
  elements.cookieHttpOnly.checked = false;
  elements.cookieSecure.checked = false;

  elements.cookieModal.classList.add('active');
}

/**
 * 打开编辑 Cookie 模态框
 * @param {Object} cookie - Cookie 对象
 */
function openEditModal(cookie) {
  state.selectedCookie = cookie;
  elements.modalTitle.textContent = '编辑 Cookie';
  elements.deleteCookieBtn.style.display = 'inline-block';

  // 填充表单
  elements.cookieName.value = cookie.name;
  elements.cookieValue.value = cookie.value;
  elements.cookieDomain.value = cookie.domain.startsWith('.')
    ? cookie.domain.substring(1)
    : cookie.domain;
  elements.cookiePath.value = cookie.path || '/';
  elements.cookieExpiration.value = cookie.expirationDate
    ? new Date(cookie.expirationDate * 1000).toISOString().slice(0, 16)
    : '';
  elements.cookieHttpOnly.checked = cookie.httpOnly || false;
  elements.cookieSecure.checked = cookie.secure || false;

  elements.cookieModal.classList.add('active');
}

/**
 * 关闭 Cookie 模态框
 */
function closeCookieModal() {
  elements.cookieModal.classList.remove('active');
  state.selectedCookie = null;
}

/**
 * 保存 Cookie（新增或编辑）
 * @param {Event} e - 表单提交事件
 */
async function saveCookie(e) {
  e.preventDefault();

  const name = elements.cookieName.value.trim();
  const value = elements.cookieValue.value;
  let domain = elements.cookieDomain.value.trim();
  const path = elements.cookiePath.value.trim() || '/';
  const expirationStr = elements.cookieExpiration.value;
  const httpOnly = elements.cookieHttpOnly.checked;
  const secure = elements.cookieSecure.checked;

  if (!name) {
    showToast('Cookie 名称不能为空', 'error');
    return;
  }

  // 构建 URL
  if (domain.startsWith('.')) {
    domain = domain.substring(1);
  }
  const url = `http${secure ? 's' : ''}://${domain}${path}`;

  const cookieData = {
    url: url,
    name: name,
    value: value,
    path: path,
    httpOnly: httpOnly,
    secure: secure
  };

  // 设置过期时间
  if (expirationStr) {
    cookieData.expirationDate = new Date(expirationStr).getTime() / 1000;
  }

  try {
    // 如果是编辑模式，先删除旧的 Cookie
    if (state.selectedCookie) {
      const oldCookie = state.selectedCookie;
      let oldDomain = oldCookie.domain;
      if (oldDomain.startsWith('.')) {
        oldDomain = oldDomain.substring(1);
      }
      const oldUrl = `http${oldCookie.secure ? 's' : ''}://${oldDomain}${oldCookie.path}`;

      await chrome.cookies.remove({
        url: oldUrl,
        name: oldCookie.name
      });
    }

    // 创建新 Cookie
    await chrome.cookies.set(cookieData);

    showToast(state.selectedCookie ? 'Cookie 已更新' : 'Cookie 已添加', 'success');
    closeCookieModal();
    await loadCookies();
  } catch (error) {
    showToast('保存 Cookie 失败: ' + error.message, 'error');
  }
}

/**
 * 删除指定的 Cookie
 * @param {Object} cookie - Cookie 对象
 */
async function deleteCookie(cookie) {
  if (!confirm(`确定要删除 Cookie "${cookie.name}" 吗？`)) {
    return;
  }

  try {
    let domain = cookie.domain;
    if (domain.startsWith('.')) {
      domain = domain.substring(1);
    }
    const url = `http${cookie.secure ? 's' : ''}://${domain}${cookie.path}`;

    await chrome.cookies.remove({
      url: url,
      name: cookie.name
    });

    showToast('Cookie 已删除', 'success');
    await loadCookies();
  } catch (error) {
    showToast('删除 Cookie 失败: ' + error.message, 'error');
  }
}

/**
 * 删除当前编辑的 Cookie
 */
async function deleteCurrentCookie() {
  if (state.selectedCookie) {
    await deleteCookie(state.selectedCookie);
    closeCookieModal();
  }
}

/**
 * 一键删除当前列表中的所有 Cookie
 */
async function deleteAllCookies() {
  // 获取要删除的 Cookie 列表
  const cookiesToDelete = state.filteredCookies.length > 0
    ? state.filteredCookies
    : state.cookies;

  if (cookiesToDelete.length === 0) {
    showToast('当前列表为空，没有可删除的 Cookie', 'warning');
    return;
  }

  // 确认删除
  if (!confirm(`确定要删除当前列表中的 ${cookiesToDelete.length} 个 Cookie 吗？\n\n注意：这是不可逆操作！`)) {
    return;
  }

  let success = 0;
  let failed = 0;

  for (const cookie of cookiesToDelete) {
    try {
      let domain = cookie.domain;
      if (domain.startsWith('.')) {
        domain = domain.substring(1);
      }
      const url = `http${cookie.secure ? 's' : ''}://${domain}${cookie.path}`;

      await chrome.cookies.remove({
        url: url,
        name: cookie.name
      });
      success++;
    } catch (error) {
      console.error('删除 Cookie 失败:', cookie, error);
      failed++;
    }
  }

  if (failed > 0) {
    showToast(`删除完成: ${success} 成功, ${failed} 失败`, 'warning');
  } else {
    showToast(`成功删除 ${success} 个 Cookie`, 'success');
  }

  await loadCookies();
}

// ============================================
// 导入功能
// ============================================

/**
 * 打开导入模态框
 */
function openImportModal() {
  elements.importModal.classList.add('active');
  elements.importFormat.value = 'json';
  elements.importData.value = '';
  elements.importData.placeholder = getImportPlaceholder('json');
  updateImportFormatHelp('json');
}

/**
 * 关闭导入模态框
 */
function closeImportModal() {
  elements.importModal.classList.remove('active');
}

/**
 * 获取导入占位符文本
 * @param {string} format - 格式类型
 * @returns {string} 占位符文本
 */
function getImportPlaceholder(format) {
  switch (format) {
    case 'json':
      return '[\n  {\n    "name": "example",\n    "value": "value123",\n    "domain": ".example.com",\n    "path": "/"\n  }\n]';
    case 'header':
      return 'name1=value1; name2=value2; name3=value3';
    case 'netscape':
      return '# Netscape HTTP Cookie File\n.example.com\tTRUE\t/\tFALSE\t0\tname\tvalue';
    default:
      return '';
  }
}

/**
 * 导入格式变化处理
 */
function onImportFormatChange() {
  const format = elements.importFormat.value;
  elements.importData.placeholder = getImportPlaceholder(format);
  updateImportFormatHelp(format);
}

/**
 * 更新导入格式帮助文本
 * @param {string} format - 格式类型
 */
function updateImportFormatHelp(format) {
  if (!elements.importFormatHelp) return;

  const helpTexts = {
    json: '<span class="help-label">JSON 格式：</span>支持标准 JSON 数组或对象，兼容压缩格式（有无空格均可）',
    header: '<span class="help-label">Header String 格式：</span>支持分号分隔（<code>name=value; name2=value2</code>）或每行一个（<code>name=value</code>）',
    netscape: '<span class="help-label">Netscape 格式：</span>标准 HTTP Cookie 文件格式，制表符分隔'
  };

  elements.importFormatHelp.innerHTML = '<div class="format-help-text">' + (helpTexts[format] || '') + '</div>';
}

/**
 * 导入 Cookie
 */
async function importCookies() {
  const format = elements.importFormat.value;
  const data = elements.importData.value.trim();

  if (!data) {
    showToast('请输入导入数据', 'error');
    return;
  }

  try {
    let cookies = [];

    switch (format) {
      case 'json':
        cookies = parseJsonCookies(data);
        break;
      case 'header':
        cookies = parseHeaderCookies(data);
        break;
      case 'netscape':
        cookies = parseNetscapeCookies(data);
        break;
    }

    if (cookies.length === 0) {
      showToast('未找到有效的 Cookie 数据', 'error');
      return;
    }

    // 确认导入
    if (!confirm(`确定要导入 ${cookies.length} 个 Cookie 吗？`)) {
      return;
    }

    // 逐个导入
    let success = 0;
    let failed = 0;

    for (const cookie of cookies) {
      try {
        const cookieData = buildCookieData(cookie);
        await chrome.cookies.set(cookieData);
        success++;
      } catch (err) {
        console.error('导入 Cookie 失败:', cookie, err);
        failed++;
      }
    }

    showToast(`导入完成: ${success} 成功, ${failed} 失败`, failed > 0 ? 'warning' : 'success');
    closeImportModal();
    await loadCookies();
  } catch (error) {
    showToast('导入失败: ' + error.message, 'error');
  }
}

/**
 * 解析 JSON 格式的 Cookie（兼容压缩格式）
 * @param {string} data - JSON 字符串
 * @returns {Array} Cookie 数组
 */
function parseJsonCookies(data) {
  // 尝试解析为 JSON
  const parsed = JSON.parse(data);
  if (Array.isArray(parsed)) {
    return parsed;
  }
  if (parsed.cookies && Array.isArray(parsed.cookies)) {
    return parsed.cookies;
  }
  return [parsed];
}

/**
 * 解析 Header String 格式的 Cookie（兼容换行格式）
 * @param {string} data - Header 字符串
 * @returns {Array} Cookie 数组
 */
function parseHeaderCookies(data) {
  const cookies = [];

  // 首先尝试按换行分割（兼容换行格式）
  // 如果包含换行符，优先使用换行分割；否则使用分号分割
  const hasLineBreak = data.includes('\n');
  const pairs = hasLineBreak ? data.split('\n') : data.split(';');

  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;

    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;

    const name = trimmed.substring(0, eqIndex).trim();
    const value = trimmed.substring(eqIndex + 1).trim();

    if (name) {
      cookies.push({
        name: name,
        value: value,
        domain: getQueryDomain(),
        path: '/'
      });
    }
  }

  return cookies;
}

/**
 * 解析 Netscape 格式的 Cookie
 * @param {string} data - Netscape 格式字符串
 * @returns {Array} Cookie 数组
 */
function parseNetscapeCookies(data) {
  const cookies = [];
  const lines = data.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split('\t');
    if (parts.length >= 7) {
      const domain = parts[0];
      const path = parts[2];
      const secure = parts[3].toUpperCase() === 'TRUE';
      const expiration = parseInt(parts[4], 10);
      const name = parts[5];
      const value = parts[6];

      cookies.push({
        name: name,
        value: value,
        domain: domain,
        path: path,
        secure: secure,
        expirationDate: isNaN(expiration) || expiration === 0 ? undefined : expiration
      });
    }
  }

  return cookies;
}

/**
 * 构建 Cookie 数据对象
 * @param {Object} cookie - 原始 Cookie 对象
 * @returns {Object} 可用于 chrome.cookies.set 的对象
 */
function buildCookieData(cookie) {
  let domain = cookie.domain || getQueryDomain();
  if (domain.startsWith('.')) {
    domain = domain.substring(1);
  }

  const secure = cookie.secure || false;
  const path = cookie.path || '/';
  const url = `http${secure ? 's' : ''}://${domain}${path}`;

  const result = {
    url: url,
    name: cookie.name,
    value: cookie.value || '',
    path: path,
    httpOnly: cookie.httpOnly || false,
    secure: secure
  };

  if (cookie.expirationDate && cookie.expirationDate > 0) {
    result.expirationDate = cookie.expirationDate;
  }

  return result;
}

// ============================================
// 导出功能
// ============================================

/**
 * 打开导出模态框
 */
function openExportModal() {
  elements.exportModal.classList.add('active');
  elements.exportFormatSelect.value = state.exportFormat;
  // 初始化换行选项状态
  if (elements.headerLineBreakCheckbox) {
    elements.headerLineBreakCheckbox.checked = state.headerLineBreak;
  }
  // 初始化 JSON 压缩选项状态
  if (elements.jsonCompressCheckbox) {
    elements.jsonCompressCheckbox.checked = state.jsonCompress;
  }
  updateHeaderLineBreakVisibility();
  updateJsonCompressVisibility();
  generateExportData();
}

/**
 * 关闭导出模态框
 */
function closeExportModal() {
  elements.exportModal.classList.remove('active');
}

/**
 * 导出格式变化处理
 */
function onExportFormatChange() {
  state.exportFormat = elements.exportFormatSelect.value;
  // 切换格式时显示/隐藏换行选项
  updateHeaderLineBreakVisibility();
  // 切换格式时显示/隐藏 JSON 压缩选项
  updateJsonCompressVisibility();
  generateExportData();
}

/**
 * 切换 Header String 换行选项显示状态
 */
function updateHeaderLineBreakVisibility() {
  const lineBreakContainer = document.getElementById('headerLineBreakContainer');
  if (lineBreakContainer) {
    lineBreakContainer.style.display = state.exportFormat === 'header' ? 'block' : 'none';
  }
}

/**
 * 切换 JSON 压缩选项显示状态
 */
function updateJsonCompressVisibility() {
  const jsonCompressContainer = document.getElementById('jsonCompressContainer');
  if (jsonCompressContainer) {
    jsonCompressContainer.style.display = state.exportFormat === 'json' ? 'block' : 'none';
  }
}

/**
 * Header String 换行选项变化处理
 */
function onHeaderLineBreakChange() {
  state.headerLineBreak = elements.headerLineBreakCheckbox.checked;
  generateExportData();
}

/**
 * JSON 压缩选项变化处理
 */
function onJsonCompressChange() {
  state.jsonCompress = elements.jsonCompressCheckbox.checked;
  generateExportData();
}

/**
 * 生成导出数据
 */
function generateExportData() {
  const cookies = state.filteredCookies.length > 0 ? state.filteredCookies : state.cookies;
  let data = '';

  switch (state.exportFormat) {
    case 'json':
      data = state.jsonCompress
        ? JSON.stringify(cookies)
        : JSON.stringify(cookies, null, 2);
      break;
    case 'header':
      data = state.headerLineBreak
        ? cookies.map(c => `${c.name}=${c.value}`).join('\n')
        : cookies.map(c => `${c.name}=${c.value}`).join('; ');
      break;
    case 'netscape':
      data = generateNetscapeFormat(cookies);
      break;
  }

  elements.exportData.value = data;
}

/**
 * 生成 Netscape 格式
 * @param {Array} cookies - Cookie 数组
 * @returns {string} Netscape 格式字符串
 */
function generateNetscapeFormat(cookies) {
  const lines = ['# Netscape HTTP Cookie File'];

  for (const cookie of cookies) {
    const domain = cookie.domain || '';
    const includeSubdomains = domain.startsWith('.') ? 'TRUE' : 'FALSE';
    const path = cookie.path || '/';
    const secure = cookie.secure ? 'TRUE' : 'FALSE';
    const expiration = cookie.expirationDate ? Math.floor(cookie.expirationDate).toString() : '0';
    const name = cookie.name;
    const value = cookie.value;

    lines.push(`${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expiration}\t${name}\t${value}`);
  }

  return lines.join('\n');
}

/**
 * 复制导出数据到剪贴板
 */
async function copyExportData() {
  const data = elements.exportData.value;
  if (!data) {
    showToast('没有可复制的数据', 'error');
    return;
  }

  try {
    await navigator.clipboard.writeText(data);
    showToast('已复制到剪贴板', 'success');
  } catch (error) {
    showToast('复制失败: ' + error.message, 'error');
  }
}

/**
 * 下载导出数据为文件
 */
function downloadExportData() {
  const data = elements.exportData.value;
  if (!data) {
    showToast('没有可下载的数据', 'error');
    return;
  }

  // 根据格式确定文件扩展名和 MIME 类型
  let extension = 'txt';
  let mimeType = 'text/plain';
  switch (state.exportFormat) {
    case 'json':
      extension = 'json';
      mimeType = 'application/json';
      break;
    case 'header':
      extension = 'txt';
      mimeType = 'text/plain';
      break;
    case 'netscape':
      extension = 'txt';
      mimeType = 'text/plain';
      break;
  }

  // 生成文件名：域名_时间戳.扩展名
  const domain = getQueryDomain() || 'cookies';
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const filename = `${domain}_${timestamp}.${extension}`;

  // 创建 Blob 和下载链接
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast(`已下载: ${filename}`, 'success');
}

// ============================================
// 工具函数
// ============================================

/**
 * 防抖函数
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * 复制文本到剪贴板
 * @param {string} text - 要复制的文本
 */
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(`已复制: ${truncateString(text, 40)}`, 'success');
  } catch (error) {
    showToast('复制失败', 'error');
  }
}

/**
 * 显示 Toast 提示
 * @param {string} message - 消息内容
 * @param {string} type - 类型：success | error | warning
 */
function showToast(message, type = 'success') {
  elements.toastMessage.textContent = message;
  elements.toast.className = 'toast show ' + type;

  setTimeout(() => {
    elements.toast.classList.remove('show');
  }, 3000);
}

/**
 * HTML 转义
 * @param {string} text - 原始文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * 截断字符串
 * @param {string} str - 原始字符串
 * @param {number} maxLength - 最大长度
 * @returns {string} 截断后的字符串
 */
function truncateString(str, maxLength) {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
}

/**
 * 格式化日期时间
 * @param {number} timestamp - 时间戳（毫秒）
 * @returns {string} 格式化后的字符串
 */
function formatDateTime(timestamp) {
  if (!timestamp) return '未知';
  const date = new Date(timestamp);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}
