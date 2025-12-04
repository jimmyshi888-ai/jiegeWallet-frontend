// ===== State =====
let token = localStorage.getItem("token") || null;
let categories = [];
let transactions = [];
let budget = { id: "1", amount: "0" };

// ===== DOM Elements =====
const landingSection = document.getElementById("landing-section");
const loginSection = document.getElementById("login-section");
const mainSection = document.getElementById("main-section");
const goLoginBtn = document.getElementById("go-login-btn");
const backToLandingBtn = document.getElementById("back-to-landing");
const loginForm = document.getElementById("login-form");
const loginError = document.getElementById("login-error");
const logoutBtn = document.getElementById("logout-btn");
const welcomeMsg = document.getElementById("welcome-msg");

const btnAddTransaction = document.getElementById("btn-add-transaction");
const btnManageCategory = document.getElementById("btn-manage-category");
const transactionList = document.getElementById("transaction-list");
const transactionListTitle = document.getElementById("transaction-list-title");

const totalIncome = document.getElementById("total-income");
const totalExpense = document.getElementById("total-expense");

// 總累計的 DOM 元素
const allTimeIncomeEl = document.getElementById("all-time-income");
const allTimeExpenseEl = document.getElementById("all-time-expense");
const netAssetsEl = document.getElementById("net-assets");

// ✨✨✨ 新增：篩選與統計相關 DOM 元素 ✨✨✨
const categoryFilter = document.getElementById("category-filter");
const categoryStatsPanel = document.getElementById("category-stats-panel");
const categoryMonthlyList = document.getElementById("category-monthly-list");

const budgetSection = document.getElementById("budget-section");
const budgetRemaining = document.getElementById("budget-remaining");
const budgetProgressBar = document.getElementById("budget-progress-bar");
const totalBudget = document.getElementById("total-budget");
const budgetPercent = document.getElementById("budget-percent");

// ===== API Helper =====
async function api(endpoint, options = {}) {
  // 注意：這裡假設 CONFIG 已經在 config.js 定義好了
  const url = `${CONFIG.API_BASE_URL}${endpoint}`;
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "請求失敗");
  }

  return data;
}

// ===== Auth =====
async function login(username, password) {
  const data = await api("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  token = data.token;
  localStorage.setItem("token", token);
  return data;
}

function logout() {
  token = null;
  localStorage.removeItem("token");
  showLanding();
}

async function validateToken() {
  if (!token) return false;
  try {
    await api("/api/categories");
    return true;
  } catch (error) {
    token = null;
    localStorage.removeItem("token");
    return false;
  }
}

// ===== Navigation =====
function showLanding() {
  landingSection.classList.remove("hidden");
  loginSection.classList.add("hidden");
  mainSection.classList.add("hidden");
}

function showLogin() {
  landingSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
  mainSection.classList.add("hidden");
}

function showMain() {
  landingSection.classList.add("hidden");
  loginSection.classList.add("hidden");
  mainSection.classList.remove("hidden");
  loadData();
}

// ===== Data Loading =====
async function loadData() {
  try {
    await Promise.all([loadCategories(), loadTransactions(), loadBudget()]);
  } catch (error) {
    if (error.message.includes("token") || error.message.includes("未授權")) {
      logout();
    }
  }
}

async function loadCategories() {
  const data = await api("/api/categories");
  categories = data.data || [];
  
  // ✨✨✨ 載入類別後，順便更新篩選選單 ✨✨✨
  updateCategoryFilterOptions();
}

async function loadTransactions() {
  const data = await api("/api/transactions");
  transactions = data.data || [];
  renderTransactions();
  updateSummary();
  // 如果目前有選取分類，也要更新統計
  if (categoryFilter.value !== "all") {
    renderCategoryStats();
  }
}

async function loadBudget() {
  const data = await api("/api/budget");
  budget = data.data || { id: "1", amount: "0" };
  updateSummary();
}

// ✨✨✨ 新增：更新篩選選單選項 ✨✨✨
function updateCategoryFilterOptions() {
  // 記錄當前選中的值，以免重新渲染時跑掉
  const currentValue = categoryFilter.value;

  categoryFilter.innerHTML = '<option value="all">📋 顯示所有類別</option>';
  
  categories.forEach(cat => {
    const option = document.createElement("option");
    option.value = cat.id;
    option.textContent = cat.name;
    categoryFilter.appendChild(option);
  });

  // 如果原本選的值還在（例如編輯完類別回來），就設回去
  if (currentValue && categories.some(c => c.id === currentValue)) {
    categoryFilter.value = currentValue;
  }
}

// ===== Render Functions =====
function renderTransactions() {
  // ✨✨✨ 修改：取得篩選值 ✨✨✨
  const selectedCatId = categoryFilter.value;

  // ✨✨✨ 修改：根據篩選值過濾資料 ✨✨✨
  let displayTransactions = transactions;
  if (selectedCatId !== "all") {
    displayTransactions = transactions.filter(txn => txn.category_id === selectedCatId);
  }

  if (displayTransactions.length === 0) {
    transactionList.innerHTML = `<div style="text-align:center; padding:20px; color:#9ca095;">
      🍃 這裡空空的，還沒有紀錄喔！
    </div>`;
    return;
  }

  // 按 ID 排序（新的在前），如果 ID 相同才按日期
  const sorted = [...displayTransactions].sort((a, b) => {
    const getIdNum = (id) => {
      const match = id.match(/(\d+)$/);
      return match ? Number(match[1]) : 0;
    };
    const idDiff = getIdNum(b.id) - getIdNum(a.id);
    if (idDiff !== 0) return idDiff;

    return new Date(b.date) - new Date(a.date);
  });

  transactionList.innerHTML = sorted
    .map(
      (txn) => `
      <div class="transaction-item">
        <div class="left">
          <div class="category-icon" style="background-color: ${
            txn.category_color_hex || "#9E9E9E"
          }">
            ${txn.category_name.charAt(0)}
          </div>
          <div class="info">
            <span class="note">${txn.note || txn.category_name}</span>
            <span class="meta">${txn.date} · ${txn.category_name}</span>
          </div>
        </div>
        <div class="right">
          <span class="amount ${txn.type}">
            ${txn.type === "income" ? "+" : "-"}${Number(
        txn.amount
      ).toLocaleString()}
          </span>
          <button class="edit-btn" onclick="window.editTransaction('${
            txn.id
          }')">✎</button>
          <button class="delete-btn" onclick="window.deleteTransaction('${
            txn.id
          }')">✕</button>
        </div>
      </div>
    `
    )
    .join("");
}

// ✨✨✨ 新增：計算該類別每月金額 ✨✨✨
function renderCategoryStats() {
  const selectedCatId = categoryFilter.value;

  // 如果選的是「全部」，就隱藏統計面板
  if (selectedCatId === "all") {
    categoryStatsPanel.classList.add("hidden");
    return;
  }

  // 顯示面板
  categoryStatsPanel.classList.remove("hidden");

  // 1. 篩選出該類別的所有交易
  const targetTxns = transactions.filter(txn => txn.category_id === selectedCatId);

  // 2. 依照月份分組並加總
  const monthlyTotals = targetTxns.reduce((acc, txn) => {
    const monthKey = txn.date.substring(0, 7); // 取出 YYYY-MM
    if (!acc[monthKey]) acc[monthKey] = 0;
    acc[monthKey] += Number(txn.amount);
    return acc;
  }, {});

  // 3. 排序月份 (新的月份在上面)
  const sortedMonths = Object.keys(monthlyTotals).sort((a, b) => new Date(b) - new Date(a));

  // 4. 產生 HTML
  if (sortedMonths.length === 0) {
    categoryMonthlyList.innerHTML = "<li>尚無紀錄</li>";
  } else {
    categoryMonthlyList.innerHTML = sortedMonths.map(month => {
        const amount = monthlyTotals[month];
        return `
            <li style="display:flex; justify-content:space-between; padding: 4px 0; border-bottom: 1px dotted #eee;">
                <span>🗓️ ${month}</span>
                <span style="font-weight:bold; color: #555;">$${amount.toLocaleString()}</span>
            </li>
        `;
    }).join("");
  }
}

function updateSummary() {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // 更新標題為當月
  transactionListTitle.textContent = `${currentMonth + 1}月收支`;

  // --- 1. 計算當月收支 (原本的邏輯) ---
  const monthlyTransactions = transactions.filter((txn) => {
    const txnDate = new Date(txn.date);
    return (
      txnDate.getMonth() === currentMonth &&
      txnDate.getFullYear() === currentYear
    );
  });

  const income = monthlyTransactions
    .filter((txn) => txn.type === "income")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  const expense = monthlyTransactions
    .filter((txn) => txn.type === "expense")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  totalIncome.textContent = income.toLocaleString();
  totalExpense.textContent = expense.toLocaleString();

  // --- 2. 計算歷史總收支與總資產 ---
  const allTimeIncome = transactions
    .filter((txn) => txn.type === "income")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  const allTimeExpense = transactions
    .filter((txn) => txn.type === "expense")
    .reduce((sum, txn) => sum + Number(txn.amount), 0);

  const netAssets = allTimeIncome - allTimeExpense;

  if (allTimeIncomeEl) allTimeIncomeEl.textContent = allTimeIncome.toLocaleString();
  if (allTimeExpenseEl) allTimeExpenseEl.textContent = allTimeExpense.toLocaleString();
  
  if (netAssetsEl) {
    netAssetsEl.textContent = `$${netAssets.toLocaleString()}`;
    netAssetsEl.style.color = netAssets >= 0 ? "#5abf98" : "#ff7675";
  }

  // --- 3. 更新預算介面 ---
  const budgetAmount = Number(budget.amount);
  const remaining = budgetAmount - expense;
  const percent =
    budgetAmount > 0 ? Math.round((remaining / budgetAmount) * 100) : 0;

  budgetRemaining.textContent = `$${remaining.toLocaleString()}`;
  totalBudget.textContent = `$${budgetAmount.toLocaleString()}`;
  budgetPercent.textContent = `${percent}%`;

  let progressWidth = budgetAmount > 0 ? (remaining / budgetAmount) * 100 : 0;
  progressWidth = Math.max(0, Math.min(100, progressWidth));
  budgetProgressBar.style.width = `${progressWidth}%`;

  budgetProgressBar.className = "progress-bar-fill";
  if (percent < 20) {
    budgetProgressBar.classList.add("danger");
  } else if (percent < 50) {
    budgetProgressBar.classList.add("warning");
  }
}

// ===== SweetAlert Flows =====

// 設定預算彈窗
async function openBudgetModal() {
  const { value: amount } = await Swal.fire({
    title: "設定每月總預算",
    input: "number",
    inputLabel: "請輸入金額",
    inputValue: budget.amount,
    showCancelButton: true,
    confirmButtonText: "儲存",
    cancelButtonText: "取消",
    confirmButtonColor: "#5abf98",
    inputValidator: (value) => {
      if (!value || Number(value) < 0) {
        return "請輸入有效的金額！";
      }
    },
  });

  if (amount) {
    Swal.fire({
      title: "儲存中...",
      text: "正在更新預算",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api("/api/budget", {
        method: "PUT",
        body: JSON.stringify({ amount }),
      });
      await loadBudget();
      Swal.fire("成功", "預算已更新！", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
}

// 新增交易彈窗
async function openAddTransactionModal() {
  const categoryOptions = categories
    .map((cat) => `<option value="${cat.id}">${cat.name}</option>`)
    .join("");

  const today = new Date().toISOString().split("T")[0];

  const { value: formValues } = await Swal.fire({
    title: "記一筆",
    html: `
      <form id="swal-txn-form" class="swal-form">
        <div class="form-group">
          <label>項目名稱</label>
          <input type="text" id="swal-note" class="swal2-input" placeholder="例如：午餐、搭公車、買卡片" required autofocus>
        </div>
        <div class="form-group">
          <label>類別</label>
          <select id="swal-category" class="swal2-select">
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group">
          <label>金額</label>
          <input type="number" id="swal-amount" class="swal2-input" placeholder="多少錢？" min="1" required>
        </div>
        <div class="form-group">
          <label>收支</label>
          <select id="swal-type" class="swal2-select">
            <option value="expense">支出</option>
            <option value="income">收入</option>
          </select>
        </div>
        <div class="form-group">
          <label>日期</label>
          <input type="date" id="swal-date" class="swal2-input" value="${today}" required>
        </div>
      </form>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "記帳！",
    cancelButtonText: "算了",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      return {
        date: document.getElementById("swal-date").value,
        type: document.getElementById("swal-type").value,
        category_id: document.getElementById("swal-category").value,
        amount: document.getElementById("swal-amount").value,
        note: document.getElementById("swal-note").value,
      };
    },
  });

  if (formValues) {
    if (!formValues.amount)
      return Swal.fire("哎呀！", "金額沒填喔！", "warning");

    Swal.fire({
      title: "處理中...",
      text: "正在儲存記帳資料",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await createTransaction(formValues);
      Swal.fire("成功！", "記帳完成！", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
}

// 管理類別彈窗
async function openManageCategoryModal() {
  const categoryListHtml = categories
    .map(
      (cat) => `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; padding:8px; background:#f9f9f9; border-radius:8px;">
        <div style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:1;" onclick="window.editCategory('${
          cat.id
        }', '${cat.name}', '${cat.color_hex}')">
          <span style="width:12px; height:12px; border-radius:50%; background:${
            cat.color_hex
          }"></span>
          <span>${cat.name}</span>
          <span style="font-size:0.8em; color:#999;">(點擊編輯)</span>
        </div>
        ${
          cat.id !== "1"
            ? `<button onclick="window.deleteCategory('${cat.id}')" style="border:none; background:none; color:red; cursor:pointer; padding:4px 8px;">✕</button>`
            : ""
        }
      </div>
    `
    )
    .join("");

  const { value: newCat } = await Swal.fire({
    title: "管理類別",
    html: `
      <div style="text-align:left; margin-bottom:16px;">
        <label style="font-weight:bold;">新增類別</label>
        <div style="display:flex; gap:8px; margin-top:8px;">
          <input id="swal-cat-name" class="swal2-input" placeholder="名稱" style="margin:0 !important;">
          <input id="swal-cat-color" type="color" value="#5abf98" style="height:46px; width:60px; padding:0; border:none; background:none;">
        </div>
      </div>
      <hr style="border:0; border-top:1px dashed #ccc; margin:16px 0;">
      <div style="text-align:left; max-height:200px; overflow-y:auto;">
        <label style="font-weight:bold; margin-bottom:8px; display:block;">現有類別 (點擊可編輯)</label>
        ${categoryListHtml}
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "新增類別",
    cancelButtonText: "關閉",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      const name = document.getElementById("swal-cat-name").value;
      const color = document.getElementById("swal-cat-color").value;
      if (!name) return null;
      return { name, color_hex: color };
    },
  });

  if (newCat) {
    Swal.fire({
      title: "新增中...",
      text: "正在建立類別",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api("/api/categories", {
        method: "POST",
        body: JSON.stringify(newCat),
      });
      await loadCategories();
      // 因為新增了類別，篩選選單也要更新
      updateCategoryFilterOptions();
      
      Swal.fire("成功", "類別已新增！", "success").then(() =>
        openManageCategoryModal()
      );
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
}

// 編輯類別
window.editCategory = async function (id, currentName, currentColor) {
  const { value: updatedCat } = await Swal.fire({
    title: "編輯類別",
    html: `
      <div style="text-align:left;">
        <div style="margin-bottom:16px;">
          <label>類別名稱</label>
          <input id="edit-cat-name" class="swal2-input" value="${currentName}" placeholder="名稱">
        </div>
        <div>
          <label>代表色</label>
          <input id="edit-cat-color" type="color" value="${currentColor}" style="width:100%; height:50px; padding:0; border:none;">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: "儲存",
    cancelButtonText: "取消",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      return {
        name: document.getElementById("edit-cat-name").value,
        color_hex: document.getElementById("edit-cat-color").value,
      };
    },
  });

  if (updatedCat) {
    Swal.fire({
      title: "更新中...",
      text: "正在儲存變更",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api(`/api/categories/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedCat),
      });
      await loadCategories();
      // 因為修改了類別名稱，篩選選單也要更新
      updateCategoryFilterOptions();
      
      Swal.fire("成功", "類別已更新！", "success").then(() =>
        openManageCategoryModal()
      );
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

// ===== CRUD Operations =====
async function createTransaction(payload) {
  await api("/api/transactions", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      id: `txn-${Date.now()}`,
      amount: Number(payload.amount),
    }),
  });
  await loadTransactions();
}

// 編輯交易
window.editTransaction = async function (id) {
  const txn = transactions.find((t) => t.id === id);
  if (!txn) return;

  const categoryOptions = categories
    .map(
      (cat) =>
        `<option value="${cat.id}" ${
          cat.id === txn.category_id ? "selected" : ""
        }>${cat.name}</option>`
    )
    .join("");

  const { value: formValues } = await Swal.fire({
    title: "編輯記帳",
    html: `
      <form id="swal-txn-form" class="swal-form">
        <div class="form-group">
          <label>項目名稱</label>
          <input type="text" id="swal-note" class="swal2-input" placeholder="例如：午餐、搭公車、買卡片" value="${
            txn.note || ""
          }" required autofocus>
        </div>
        <div class="form-group">
          <label>類別</label>
          <select id="swal-category" class="swal2-select">
            ${categoryOptions}
          </select>
        </div>
        <div class="form-group">
          <label>金額</label>
          <input type="number" id="swal-amount" class="swal2-input" placeholder="多少錢？" min="1" value="${
            txn.amount
          }" required>
        </div>
        <div class="form-group">
          <label>收支</label>
          <select id="swal-type" class="swal2-select">
            <option value="expense" ${
              txn.type === "expense" ? "selected" : ""
            }>支出</option>
            <option value="income" ${
              txn.type === "income" ? "selected" : ""
            }>收入</option>
          </select>
        </div>
        <div class="form-group">
          <label>日期</label>
          <input type="date" id="swal-date" class="swal2-input" value="${
            txn.date
          }" required>
        </div>
      </form>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: "儲存",
    cancelButtonText: "取消",
    confirmButtonColor: "#5abf98",
    preConfirm: () => {
      return {
        date: document.getElementById("swal-date").value,
        type: document.getElementById("swal-type").value,
        category_id: document.getElementById("swal-category").value,
        amount: document.getElementById("swal-amount").value,
        note: document.getElementById("swal-note").value,
      };
    },
  });

  if (formValues) {
    if (!formValues.amount)
      return Swal.fire("哎呀！", "金額沒填喔！", "warning");

    Swal.fire({
      title: "更新中...",
      text: "正在儲存變更",
      allowOutsideClick: false,
      allowEscapeKey: false,
      didOpen: () => {
        Swal.showLoading();
      },
    });

    try {
      await api(`/api/transactions/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...formValues,
          amount: Number(formValues.amount),
        }),
      });
      await loadTransactions();
      Swal.fire("成功！", "記帳已更新！", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

window.deleteTransaction = async function (id) {
  const result = await Swal.fire({
    title: "確定要刪除嗎？",
    text: "這筆紀錄會消失在時空縫隙中喔！",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ff7675",
    confirmButtonText: "刪除",
    cancelButtonText: "取消",
  });

  if (result.isConfirmed) {
    try {
      await api(`/api/transactions/${id}`, { method: "DELETE" });
      await loadTransactions();
      Swal.fire("已刪除！", "紀錄已移除。", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

window.deleteCategory = async function (id) {
  const result = await Swal.fire({
    title: "刪除類別？",
    text: "該類別無法復原喔！",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#ff7675",
    confirmButtonText: "刪除",
    cancelButtonText: "取消",
  });

  if (result.isConfirmed) {
    try {
      await api(`/api/categories/${id}`, { method: "DELETE" });
      await loadCategories();
      // 類別被刪除後，記得更新篩選選單
      updateCategoryFilterOptions();
      Swal.fire("已刪除！", "類別已移除。", "success");
    } catch (error) {
      Swal.fire("失敗", error.message, "error");
    }
  }
};

// ===== Event Listeners =====
goLoginBtn.addEventListener("click", showLogin);
backToLandingBtn.addEventListener("click", showLanding);

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.textContent = "";

  const username = document.getElementById("username").value;
  const password = document.getElementById("password").value;

  try {
    await login(username, password);
    showMain();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

logoutBtn.addEventListener("click", logout);
btnAddTransaction.addEventListener("click", openAddTransactionModal);
btnManageCategory.addEventListener("click", openManageCategoryModal);
budgetSection.addEventListener("click", openBudgetModal);

// ✨✨✨ 新增：監聽篩選選單變化 ✨✨✨
categoryFilter.addEventListener("change", () => {
  renderTransactions();   // 重新渲染列表
  renderCategoryStats();  // 更新統計面板
});

// ===== Initialize =====
async function init() {
  if (token) {
    const isValid = await validateToken();
    if (isValid) {
      showMain();
    } else {
      showLanding();
    }
  } else {
    showLanding();
  }
}

init();