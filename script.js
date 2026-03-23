const STORAGE_KEYS = {
  transactions: "financeflow_transactions",
  budget: "financeflow_budget"
};

const DEFAULT_FILTERS = {
  type: "all",
  category: "all",
  month: "",
  search: ""
};

const CHART_COLORS = ["#0f766e", "#f59e0b", "#ef4444", "#3b82f6", "#10b981", "#8b5cf6", "#f97316"];
const elements = {};

const state = {
  transactions: [],
  monthlyBudget: 0,
  editingId: "",
  expenseChart: null,
  monthlyChart: null,
  budgetAlertMonth: "",
  startupMessages: []
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  cacheElements();
  loadState();
  setStaticLabels();
  resetTransactionForm();
  bindEvents();
  renderAll();

  state.startupMessages.forEach((message) => showToast(message, "warning"));
}

function cacheElements() {
  elements.transactionForm = document.getElementById("transactionForm");
  elements.budgetForm = document.getElementById("budgetForm");
  elements.transactionId = document.getElementById("transactionId");
  elements.type = document.getElementById("type");
  elements.amount = document.getElementById("amount");
  elements.category = document.getElementById("category");
  elements.date = document.getElementById("date");
  elements.description = document.getElementById("description");
  elements.submitBtn = document.getElementById("submitBtn");
  elements.cancelEditBtn = document.getElementById("cancelEditBtn");
  elements.formModeLabel = document.getElementById("formModeLabel");
  elements.monthlyBudget = document.getElementById("monthlyBudget");
  elements.budgetStatusPill = document.getElementById("budgetStatusPill");
  elements.budgetUsagePercent = document.getElementById("budgetUsagePercent");
  elements.budgetSpentThisMonth = document.getElementById("budgetSpentThisMonth");
  elements.budgetProgressFill = document.getElementById("budgetProgressFill");
  elements.budgetAlertBanner = document.getElementById("budgetAlertBanner");
  elements.budgetAlertText = document.getElementById("budgetAlertText");
  elements.totalBalance = document.getElementById("totalBalance");
  elements.totalIncome = document.getElementById("totalIncome");
  elements.totalExpenses = document.getElementById("totalExpenses");
  elements.remainingBudget = document.getElementById("remainingBudget");
  elements.remainingBudgetHelper = document.getElementById("remainingBudgetHelper");
  elements.remainingBudgetCard = document.getElementById("remainingBudgetCard");
  elements.balanceCard = document.getElementById("balanceCard");
  elements.sidebarMonth = document.getElementById("sidebarMonth");
  elements.sidebarBudget = document.getElementById("sidebarBudget");
  elements.sidebarSpent = document.getElementById("sidebarSpent");
  elements.sidebarBudgetState = document.getElementById("sidebarBudgetState");
  elements.filterType = document.getElementById("filterType");
  elements.filterCategory = document.getElementById("filterCategory");
  elements.filterDate = document.getElementById("filterDate");
  elements.searchInput = document.getElementById("searchInput");
  elements.resetFiltersBtn = document.getElementById("resetFiltersBtn");
  elements.tableBody = document.getElementById("transactionTableBody");
  elements.transactionCount = document.getElementById("transactionCount");
  elements.exportBtn = document.getElementById("exportBtn");
  elements.expenseChartCanvas = document.getElementById("expenseChart");
  elements.monthlyChartCanvas = document.getElementById("monthlyChart");
  elements.expenseChartEmpty = document.getElementById("expenseChartEmpty");
  elements.monthlyChartEmpty = document.getElementById("monthlyChartEmpty");
  elements.toastRegion = document.getElementById("toastRegion");
}

function setStaticLabels() {
  const now = new Date();

  elements.sidebarMonth.textContent = new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric"
  }).format(now);
}

// Storage helpers
function loadState() {
  try {
    const rawTransactions = safeParse(localStorage.getItem(STORAGE_KEYS.transactions), []);
    const normalizedTransactions = Array.isArray(rawTransactions)
      ? rawTransactions.map(normalizeTransaction).filter(Boolean)
      : [];

    if (Array.isArray(rawTransactions) && normalizedTransactions.length !== rawTransactions.length) {
      state.startupMessages.push("Some saved transactions were invalid and have been ignored.");
    }

    if (!Array.isArray(rawTransactions) && localStorage.getItem(STORAGE_KEYS.transactions)) {
      state.startupMessages.push("Saved transaction data was invalid, so the list was reset.");
    }

    state.transactions = normalizedTransactions;

    const storedBudget = Number(localStorage.getItem(STORAGE_KEYS.budget));
    state.monthlyBudget = Number.isFinite(storedBudget) && storedBudget >= 0 ? storedBudget : 0;
  } catch (error) {
    state.transactions = [];
    state.monthlyBudget = 0;
    state.startupMessages.push("Stored data could not be read. The app loaded with a clean state.");
  }
}

function saveTransactions() {
  try {
    localStorage.setItem(STORAGE_KEYS.transactions, JSON.stringify(state.transactions));
    return true;
  } catch (error) {
    showToast("Unable to save transactions to localStorage.", "danger");
    return false;
  }
}

function saveBudget() {
  try {
    localStorage.setItem(STORAGE_KEYS.budget, String(state.monthlyBudget));
    return true;
  } catch (error) {
    showToast("Unable to save the monthly budget to localStorage.", "danger");
    return false;
  }
}

function safeParse(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function normalizeTransaction(transaction) {
  if (!transaction || typeof transaction !== "object") {
    return null;
  }

  const type = transaction.type === "income" || transaction.type === "expense" ? transaction.type : "";
  const amount = Number(transaction.amount);
  const category = cleanText(transaction.category);
  const date = typeof transaction.date === "string" ? transaction.date.slice(0, 10) : "";

  if (!type || !Number.isFinite(amount) || amount <= 0 || !category || !isDateInputValue(date)) {
    return null;
  }

  return {
    id: cleanText(transaction.id) || createId(),
    type,
    amount,
    category,
    date,
    description: cleanText(transaction.description),
    createdAt: Number(transaction.createdAt) || Date.now(),
    updatedAt: Number(transaction.updatedAt) || Date.now()
  };
}

// Formatting and derived state
function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(value);
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(dateValue) {
  if (!isDateInputValue(dateValue)) {
    return "-";
  }

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateValue}T00:00:00`));
}

function formatMonthLabel(monthKey) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return monthKey;
  }

  const [year, month] = monthKey.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "short",
    year: "numeric"
  }).format(new Date(year, month - 1, 1));
}

function getCurrentMonthKey() {
  return formatDateForInput(new Date()).slice(0, 7);
}

function getMonthlyExpenses(monthKey = getCurrentMonthKey()) {
  return state.transactions
    .filter((transaction) => transaction.type === "expense" && transaction.date.startsWith(monthKey))
    .reduce((sum, transaction) => sum + transaction.amount, 0);
}

function getTotals() {
  const income = state.transactions
    .filter((transaction) => transaction.type === "income")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  const expenses = state.transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((sum, transaction) => sum + transaction.amount, 0);

  return {
    income,
    expenses,
    balance: income - expenses
  };
}

function getBudgetStatus() {
  const monthKey = getCurrentMonthKey();
  const spent = getMonthlyExpenses(monthKey);
  const remaining = state.monthlyBudget - spent;
  const usage = state.monthlyBudget > 0 ? (spent / state.monthlyBudget) * 100 : 0;
  const exceeded = state.monthlyBudget > 0 && spent > state.monthlyBudget;

  return {
    monthKey,
    spent,
    remaining,
    usage,
    exceeded
  };
}

function getFilteredTransactions() {
  const typeFilter = elements.filterType.value;
  const categoryFilter = elements.filterCategory.value;
  const monthFilter = elements.filterDate.value;
  const searchTerm = cleanText(elements.searchInput.value).toLowerCase();

  return state.transactions.filter((transaction) => {
    const matchesType = typeFilter === DEFAULT_FILTERS.type || transaction.type === typeFilter;
    const matchesCategory = categoryFilter === DEFAULT_FILTERS.category || transaction.category === categoryFilter;
    const matchesMonth = !monthFilter || transaction.date.startsWith(monthFilter);
    const haystack = [
      transaction.category,
      transaction.description,
      transaction.date,
      transaction.amount
    ].join(" ").toLowerCase();
    const matchesSearch = !searchTerm || haystack.includes(searchTerm);

    return matchesType && matchesCategory && matchesMonth && matchesSearch;
  });
}

function getSortedTransactions(transactions) {
  return [...transactions].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }

    return (right.updatedAt || 0) - (left.updatedAt || 0);
  });
}

function getUniqueCategories() {
  return [...new Set(state.transactions.map((transaction) => transaction.category))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function getMonthlySeries() {
  const months = [...new Set(state.transactions.map((transaction) => transaction.date.slice(0, 7)))].sort();
  const visibleMonths = months.length ? months.slice(-6) : [getCurrentMonthKey()];

  const monthlyMap = visibleMonths.reduce((map, monthKey) => {
    map[monthKey] = { income: 0, expense: 0 };
    return map;
  }, {});

  state.transactions.forEach((transaction) => {
    const monthKey = transaction.date.slice(0, 7);

    if (!monthlyMap[monthKey]) {
      return;
    }

    monthlyMap[monthKey][transaction.type] += transaction.amount;
  });

  return {
    hasData: months.length > 0,
    labels: visibleMonths.map(formatMonthLabel),
    income: visibleMonths.map((monthKey) => monthlyMap[monthKey].income),
    expense: visibleMonths.map((monthKey) => monthlyMap[monthKey].expense)
  };
}

// Rendering
function renderAll() {
  renderSummary();
  renderCategoryFilter();
  renderTransactionTable();
  renderExpenseChart();
  renderMonthlyChart();
}

function renderSummary() {
  const totals = getTotals();
  const budgetStatus = getBudgetStatus();
  const progressWidth = state.monthlyBudget > 0 ? Math.min(budgetStatus.usage, 100) : 0;
  const remainingMessage = budgetStatus.exceeded
    ? `Budget exceeded by ${formatCurrency(Math.abs(budgetStatus.remaining))}`
    : `${formatCurrency(budgetStatus.remaining)} left this month`;

  elements.totalBalance.textContent = formatCurrency(totals.balance);
  elements.totalIncome.textContent = formatCurrency(totals.income);
  elements.totalExpenses.textContent = formatCurrency(totals.expenses);
  elements.remainingBudget.textContent = formatCurrency(budgetStatus.remaining);
  elements.monthlyBudget.value = state.monthlyBudget || "";
  elements.sidebarBudget.textContent = formatCurrency(state.monthlyBudget);
  elements.sidebarSpent.textContent = formatCurrency(budgetStatus.spent);
  elements.budgetUsagePercent.textContent = state.monthlyBudget > 0
    ? `${budgetStatus.usage.toFixed(0)}% used`
    : "0% used";
  elements.budgetSpentThisMonth.textContent = `Spent this month: ${formatCurrency(budgetStatus.spent)}`;
  elements.budgetProgressFill.style.width = `${progressWidth}%`;
  elements.budgetProgressFill.classList.toggle("safe", state.monthlyBudget > 0 && !budgetStatus.exceeded);
  elements.remainingBudgetCard.classList.toggle("is-over", budgetStatus.exceeded);
  elements.balanceCard.classList.toggle("is-over", totals.balance < 0);

  if (state.monthlyBudget <= 0) {
    setPillState(elements.budgetStatusPill, "No Budget", "neutral");
    elements.remainingBudgetHelper.textContent = "Set a monthly budget to track this card.";
    elements.sidebarBudgetState.textContent = "Add a monthly target to compare current month expenses against it.";
    elements.budgetAlertBanner.classList.remove("danger");
    elements.budgetAlertText.textContent = "Budget alerts will appear here after you save a monthly target.";
    state.budgetAlertMonth = "";
  } else if (budgetStatus.exceeded) {
    setPillState(elements.budgetStatusPill, "Exceeded", "danger");
    elements.remainingBudgetHelper.textContent = remainingMessage;
    elements.sidebarBudgetState.textContent = `You are over budget for ${formatMonthLabel(budgetStatus.monthKey)}.`;
    elements.budgetAlertBanner.classList.add("danger");
    elements.budgetAlertText.textContent =
      `Spending for ${formatMonthLabel(budgetStatus.monthKey)} is ${formatCurrency(Math.abs(budgetStatus.remaining))} above your target.`;
    maybeAlertBudgetExceeded(budgetStatus);
  } else {
    setPillState(elements.budgetStatusPill, "On Track", "success");
    elements.remainingBudgetHelper.textContent = remainingMessage;
    elements.sidebarBudgetState.textContent =
      `${formatCurrency(budgetStatus.remaining)} remains for ${formatMonthLabel(budgetStatus.monthKey)}.`;
    elements.budgetAlertBanner.classList.remove("danger");
    elements.budgetAlertText.textContent =
      `You are within budget for ${formatMonthLabel(budgetStatus.monthKey)}. Keep monitoring new expenses.`;
    state.budgetAlertMonth = "";
  }
}

function renderCategoryFilter() {
  const categories = getUniqueCategories();
  const selectedCategory = elements.filterCategory.value || DEFAULT_FILTERS.category;

  elements.filterCategory.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = DEFAULT_FILTERS.category;
  defaultOption.textContent = "All Categories";
  elements.filterCategory.appendChild(defaultOption);

  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    elements.filterCategory.appendChild(option);
  });

  elements.filterCategory.value = categories.includes(selectedCategory)
    ? selectedCategory
    : DEFAULT_FILTERS.category;
}

function renderTransactionTable() {
  const filteredTransactions = getSortedTransactions(getFilteredTransactions());
  const totalTransactions = state.transactions.length;
  const fragment = document.createDocumentFragment();

  elements.transactionCount.textContent =
    totalTransactions > 0
      ? `Showing ${filteredTransactions.length} of ${totalTransactions}`
      : "0 transactions";

  if (!filteredTransactions.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 6;
    cell.className = "empty-state";
    cell.textContent = totalTransactions
      ? "No transactions match the current filters."
      : "No transactions saved yet.";

    row.appendChild(cell);
    fragment.appendChild(row);
    elements.tableBody.replaceChildren(fragment);
    return;
  }

  filteredTransactions.forEach((transaction) => {
    fragment.appendChild(buildTransactionRow(transaction));
  });

  elements.tableBody.replaceChildren(fragment);
}

function buildTransactionRow(transaction) {
  const row = document.createElement("tr");
  const dateCell = document.createElement("td");
  const typeCell = document.createElement("td");
  const categoryCell = document.createElement("td");
  const descriptionCell = document.createElement("td");
  const amountCell = document.createElement("td");
  const actionsCell = document.createElement("td");
  const typeBadge = document.createElement("span");
  const actionGroup = document.createElement("div");

  dateCell.textContent = formatDisplayDate(transaction.date);

  typeBadge.className = `type-badge ${transaction.type}`;
  typeBadge.textContent = transaction.type === "income" ? "Income" : "Expense";
  typeCell.appendChild(typeBadge);

  categoryCell.textContent = transaction.category;
  descriptionCell.textContent = transaction.description || "No description";

  amountCell.className = transaction.type === "income" ? "amount-income" : "amount-expense";
  amountCell.textContent = `${transaction.type === "income" ? "+" : "-"}${formatCurrency(transaction.amount)}`;

  actionGroup.className = "action-group";
  actionGroup.appendChild(createActionButton("Edit", "edit", transaction.id));
  actionGroup.appendChild(createActionButton("Delete", "delete", transaction.id, true));
  actionsCell.appendChild(actionGroup);

  row.append(dateCell, typeCell, categoryCell, descriptionCell, amountCell, actionsCell);
  return row;
}

function createActionButton(label, action, id, isDelete = false) {
  const button = document.createElement("button");

  button.type = "button";
  button.className = isDelete ? "action-btn delete" : "action-btn";
  button.dataset.action = action;
  button.dataset.id = id;
  button.textContent = label;

  return button;
}

function renderExpenseChart() {
  destroyChart("expenseChart");

  if (!window.Chart) {
    showChartEmpty(elements.expenseChartEmpty, "Chart.js failed to load. Reopen the page with internet access to view charts.");
    return;
  }

  const expenseMap = state.transactions
    .filter((transaction) => transaction.type === "expense")
    .reduce((map, transaction) => {
      map[transaction.category] = (map[transaction.category] || 0) + transaction.amount;
      return map;
    }, {});

  const labels = Object.keys(expenseMap);
  const values = Object.values(expenseMap);
  const hasData = labels.length > 0;

  showChartEmpty(
    elements.expenseChartEmpty,
    hasData ? "" : "Add expense transactions to see the category split."
  );

  state.expenseChart = new Chart(elements.expenseChartCanvas, {
    type: "pie",
    data: {
      labels: hasData ? labels : ["No expense data"],
      datasets: [
        {
          data: hasData ? values : [1],
          backgroundColor: hasData ? CHART_COLORS : ["#d8e4df"],
          borderColor: "#ffffff",
          borderWidth: 3,
          hoverOffset: 6
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            padding: 18
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              if (!hasData) {
                return "No expense data yet";
              }

              return `${context.label}: ${formatCurrency(context.parsed)}`;
            }
          }
        }
      }
    }
  });
}

function renderMonthlyChart() {
  destroyChart("monthlyChart");

  if (!window.Chart) {
    showChartEmpty(elements.monthlyChartEmpty, "Chart.js failed to load. Reopen the page with internet access to view charts.");
    return;
  }

  const series = getMonthlySeries();

  showChartEmpty(
    elements.monthlyChartEmpty,
    series.hasData ? "" : "Add transactions to unlock the monthly comparison chart."
  );

  state.monthlyChart = new Chart(elements.monthlyChartCanvas, {
    type: "bar",
    data: {
      labels: series.labels,
      datasets: [
        {
          label: "Income",
          data: series.income,
          backgroundColor: "#15803d",
          borderRadius: 10
        },
        {
          label: "Expenses",
          data: series.expense,
          backgroundColor: "#dc2626",
          borderRadius: 10
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: {
            display: false
          }
        },
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return formatCurrency(value);
            }
          }
        }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            padding: 18
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
            }
          }
        }
      }
    }
  });
}

function showChartEmpty(element, message) {
  element.hidden = !message;
  element.textContent = message;
}

function destroyChart(chartKey) {
  if (state[chartKey]) {
    state[chartKey].destroy();
    state[chartKey] = null;
  }
}

// Form state
function resetTransactionForm() {
  state.editingId = "";
  elements.transactionForm.reset();
  elements.transactionId.value = "";
  elements.type.value = "expense";
  elements.date.value = formatDateForInput(new Date());
  elements.submitBtn.textContent = "Save Transaction";
  elements.cancelEditBtn.hidden = true;
  elements.formModeLabel.textContent = "Create Mode";
}

function populateTransactionForm(transaction) {
  state.editingId = transaction.id;
  elements.transactionId.value = transaction.id;
  elements.type.value = transaction.type;
  elements.amount.value = transaction.amount;
  elements.category.value = transaction.category;
  elements.date.value = transaction.date;
  elements.description.value = transaction.description;
  elements.submitBtn.textContent = "Update Transaction";
  elements.cancelEditBtn.hidden = false;
  elements.formModeLabel.textContent = "Edit Mode";

  document.getElementById("transactions").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// Event handlers
function bindEvents() {
  elements.transactionForm.addEventListener("submit", handleTransactionSubmit);
  elements.budgetForm.addEventListener("submit", handleBudgetSubmit);
  elements.cancelEditBtn.addEventListener("click", handleCancelEdit);
  elements.tableBody.addEventListener("click", handleTableClick);
  elements.exportBtn.addEventListener("click", exportData);
  elements.resetFiltersBtn.addEventListener("click", resetFilters);

  [elements.filterType, elements.filterCategory, elements.filterDate].forEach((element) => {
    element.addEventListener("input", renderTransactionTable);
    element.addEventListener("change", renderTransactionTable);
  });

  elements.searchInput.addEventListener("input", renderTransactionTable);
}

function handleTransactionSubmit(event) {
  event.preventDefault();

  const transaction = {
    id: state.editingId || createId(),
    type: elements.type.value,
    amount: Number(elements.amount.value),
    category: cleanText(elements.category.value),
    date: elements.date.value,
    description: cleanText(elements.description.value)
  };

  if (!isTransactionValid(transaction)) {
    window.alert("Please enter a valid type, amount, category, and date.");
    return;
  }

  const timestamp = Date.now();
  const existingIndex = state.transactions.findIndex((item) => item.id === transaction.id);
  let successMessage = "Transaction saved.";

  if (existingIndex >= 0) {
    state.transactions[existingIndex] = {
      ...state.transactions[existingIndex],
      ...transaction,
      updatedAt: timestamp
    };
    successMessage = "Transaction updated.";
  } else {
    state.transactions.push({
      ...transaction,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  if (!saveTransactions()) {
    return;
  }

  resetTransactionForm();
  renderAll();
  showToast(successMessage, "success");
}

function handleBudgetSubmit(event) {
  event.preventDefault();

  const budgetAmount = Number(elements.monthlyBudget.value);

  if (!Number.isFinite(budgetAmount) || budgetAmount < 0) {
    window.alert("Please enter a valid monthly budget.");
    return;
  }

  state.monthlyBudget = budgetAmount;

  if (!saveBudget()) {
    return;
  }

  renderAll();
  showToast("Monthly budget saved.", "success");
}

function handleCancelEdit() {
  resetTransactionForm();
  showToast("Edit mode cleared.");
}

function handleTableClick(event) {
  const actionButton = event.target.closest("[data-action]");

  if (!actionButton) {
    return;
  }

  const { action, id } = actionButton.dataset;
  const transaction = state.transactions.find((item) => item.id === id);

  if (!transaction) {
    return;
  }

  if (action === "edit") {
    populateTransactionForm(transaction);
    return;
  }

  if (action === "delete") {
    const shouldDelete = window.confirm("Delete this transaction?");

    if (!shouldDelete) {
      return;
    }

    state.transactions = state.transactions.filter((item) => item.id !== id);

    if (!saveTransactions()) {
      return;
    }

    if (state.editingId === id) {
      resetTransactionForm();
    }

    renderAll();
    showToast("Transaction deleted.", "warning");
  }
}

function resetFilters() {
  elements.filterType.value = DEFAULT_FILTERS.type;
  elements.filterCategory.value = DEFAULT_FILTERS.category;
  elements.filterDate.value = DEFAULT_FILTERS.month;
  elements.searchInput.value = DEFAULT_FILTERS.search;
  renderTransactionTable();
  showToast("Filters cleared.");
}

function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    monthlyBudget: state.monthlyBudget,
    totals: getTotals(),
    currentMonth: getBudgetStatus(),
    transactions: getSortedTransactions(state.transactions)
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `khata-setu-export-${formatDateForInput(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Data exported as JSON.", "success");
}

// Small UI helpers
function maybeAlertBudgetExceeded(budgetStatus) {
  if (state.budgetAlertMonth === budgetStatus.monthKey) {
    return;
  }

  state.budgetAlertMonth = budgetStatus.monthKey;
  window.alert(
    `Budget exceeded for ${formatMonthLabel(budgetStatus.monthKey)} by ${formatCurrency(Math.abs(budgetStatus.remaining))}.`
  );
}

function setPillState(element, label, tone) {
  element.textContent = label;
  element.classList.remove("neutral", "success", "danger");
  element.classList.add(tone);
}

function showToast(message, tone = "neutral") {
  const toast = document.createElement("div");

  toast.className = `toast ${tone === "neutral" ? "" : tone}`.trim();
  toast.textContent = message;
  elements.toastRegion.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add("visible");
  });

  window.setTimeout(() => {
    toast.classList.remove("visible");
    window.setTimeout(() => {
      toast.remove();
    }, 220);
  }, 2600);
}

function createId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `txn-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cleanText(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function isDateInputValue(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const parsedDate = new Date(year, month - 1, day);

  return (
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day
  );
}

function isTransactionValid(transaction) {
  const validType = transaction.type === "income" || transaction.type === "expense";
  return (
    validType &&
    Number.isFinite(transaction.amount) &&
    transaction.amount > 0 &&
    Boolean(transaction.category) &&
    isDateInputValue(transaction.date)
  );
}
