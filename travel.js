const STORAGE_KEY = 'travel-tracker-v2';

const countries = {
  thailand: { name: 'Thailand', duration: 60, currency: 'THB', symbol: '฿', rate: 43.5 },
  laos: { name: 'Laos', duration: 14, currency: 'LAK', symbol: '₭', rate: 25000 },
  vietnam: { name: 'Vietnam', duration: 30, currency: 'VND', symbol: '₫', rate: 30000 },
  cambodia: { name: 'Cambodia', duration: 14, currency: 'KHR', symbol: '៛', rate: 5100 },
  malaysia: { name: 'Malaysia', duration: 14, currency: 'MYR', symbol: 'RM', rate: 5.8 },
  philippines: { name: 'Philippines', duration: 45, currency: 'PHP', symbol: '₱', rate: 70 },
  indonesia: { name: 'Indonesia', duration: 45, currency: 'IDR', symbol: 'Rp', rate: 19500 },
};

const categoryLabels = {
  accommodation: 'Accommodation',
  food: 'Food & Drinks',
  transport: 'Transport',
  activities: 'Activities',
  shopping: 'Shopping',
  other: 'Other',
};

const $ = (selector, scope = document) => scope.querySelector(selector);

const SUPABASE_URL = window.SUPABASE_URL || 'https://rzartryefetwaetgsejh.supabase.co';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ6YXJ0cnllZmV0d2FldGdzZWpoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjEyNDQ4NTUsImV4cCI6MjA3NjgyMDg1NX0.d6g7GAsjvERapOlcR-bFrJHDpnkMDgQZcqwGaqf5FpM';
const SHARE_STORAGE_KEY = 'travel-tracker-share-id';
const CLOUD_SYNC_DEBOUNCE = 1500;

let state = loadState();
let currentCountry = null;
let elements = {};
let expandedSummaryDate = null;
let supabaseClient = null;
let activeShareId = localStorage.getItem(SHARE_STORAGE_KEY) || null;
let pendingSyncTimer = null;
let analyticsInteractionsBound = false;
const newlyAddedExpenseIds = new Set();
const lastHeroProgress = { percent: null };
const lastDailyProgress = new Map();
const lastCategoryProgress = new Map();
let budgetAlertMessages = [];
let budgetAlertRotationTimer = null;
let budgetAlertIndex = 0;
let lastBudgetAlertSignature = '';
const ALERT_BADGES = {
  success: '✓',
  warning: '⚠',
  danger: '×',
  info: 'ℹ',
};

const gbpFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
});

const localFormatterCache = new Map();

document.addEventListener('DOMContentLoaded', () => {
  cacheDomReferences();
  setupMobileMenu();
  setupNavigation();
  setupForm();
  setupEditableFields();
  setupDailySummariesInteractions();
  setupAnalyticsDateInteractions();
  setupDataManagement();
  initSyncUI();
  initializeSupabase();

  // Select initial country based on hash or default to Thailand
  const initialHash = window.location.hash.replace('#', '');
  const initialCountry = countries[initialHash] ? initialHash : 'thailand';
  selectCountry(initialCountry);

  if (activeShareId) {
    fetchShare(activeShareId);
  } else {
    updateSyncStatus('Local data only', 'info');
  }
});

function cacheDomReferences() {
  elements = {
    countryName: $('#countryName'),
    overallBudget: $('#overallBudget'),
    dailyTarget: $('#dailyTarget'),
    remainingBudget: $('#remainingBudget'),
    plannedDays: $('#plannedDays'),
    addButton: $('#tAdd'),
    amountInput: $('#tAmount'),
    localAmountInput: $('#tAmountLocal'),
    dateInput: $('#tDate'),
    descriptionInput: $('#tDesc'),
    categorySelect: $('#expenseCategory'),
    repeatToggle: $('#repeatToggle'),
    repeatCount: $('#repeatCount'),
    exchangeRate: $('.exchange-rate'),
    localSymbol: $('.local-symbol'),
    dailySummaries: $('#dailySummaries'),
    overallBudgetProgress: $('#overallBudgetProgress'),
    tripProgress: $('#tripProgress'),
    daysUnderBudget: $('#daysUnderBudget'),
    daysOverBudget: $('#daysOverBudget'),
    budgetSavings: $('#budgetSavings'),
    daysRemaining: $('#daysRemaining'),
    biggestSpendDay: $('#biggestSpendDay'),
    smallestSpendDay: $('#smallestSpendDay'),
    budgetAlerts: $('#budgetAlerts'),
    budgetPositionBanner: $('#budgetPositionBanner'),
    categoryBreakdown: $('#categoryBreakdown'),
    exportButton: $('#exportTravel'),
    importButton: $('#importTravelButton'),
    importInput: $('#importTravelFile'),
    openSyncButton: $('#openSync'),
    closeSyncButton: $('#closeSync'),
    openDataButton: $('#openData'),
    closeDataButton: $('#closeData'),
    dataModal: $('#dataModal'),
    dataOverlay: document.querySelector('[data-close-data]'),
    syncModal: $('#syncModal'),
    syncOverlay: document.querySelector('[data-close-sync]'),
    createShareButton: $('#createShare'),
    shareCodeContainer: $('#shareCodeContainer'),
    shareCodeDisplay: $('#shareCode'),
    copyShareCodeButton: $('#copyShareCode'),
    loadShareForm: $('#loadShareForm'),
    shareIdInput: $('#shareIdInput'),
    disconnectShareButton: $('#disconnectShare'),
    syncFeedback: $('#syncFeedback'),
    syncStatusText: $('#syncStatus'),
    sidebar: $('.sidebar'),
    menuToggle: $('.menu-toggle'),
    closeMenu: $('.close-menu'),
    mobileOverlay: $('.mobile-overlay'),
  };

  if (elements.dateInput && !elements.dateInput.value) {
    elements.dateInput.value = todayIsoString();
  }
}

function setupMobileMenu() {
  if (!elements.sidebar) return;
  
  // Get the existing overlay
  const overlay = document.querySelector('.mobile-overlay');
  if (!overlay) return;

  const applyMenuState = (isOpen) => {
    elements.sidebar.classList.toggle('active', isOpen);
    overlay.classList.toggle('active', isOpen);
    document.body.style.overflow = isOpen ? 'hidden' : '';
    document.body.classList.toggle('menu-open', isOpen);
    elements.menuToggle?.classList.toggle('menu-toggle--hidden', isOpen);
  };

  const toggleMenu = () => {
    const willOpen = !elements.sidebar.classList.contains('active');
    applyMenuState(willOpen);
  };

  const closeMenu = () => {
    applyMenuState(false);
  };

  if (elements.menuToggle) {
    elements.menuToggle.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      toggleMenu();
    });
  }

  if (elements.closeMenu) {
    elements.closeMenu.addEventListener('click', (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      closeMenu();
    });
  }

  overlay.addEventListener('click', closeMenu);
  
  // Store overlay reference for later use
  elements.mobileOverlay = overlay;
  elements.closeMenuHandler = closeMenu;
}

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', (evt) => {
      evt.preventDefault();
      const { country } = item.dataset;
      if (!country || !countries[country]) return;
      selectCountry(country);
      
      // Close mobile menu if it's open
      if (elements.sidebar?.classList.contains('active')) {
        if (typeof elements.closeMenuHandler === 'function') {
          elements.closeMenuHandler();
        } else {
          elements.sidebar.classList.remove('active');
          document.body.style.overflow = '';
          if (elements.mobileOverlay) {
            elements.mobileOverlay.classList.remove('active');
          }
          document.body.classList.remove('menu-open');
          elements.menuToggle?.classList.remove('menu-toggle--hidden');
        }
      }
    });
  });

  window.addEventListener('hashchange', () => {
    const hashCountry = window.location.hash.replace('#', '');
    if (countries[hashCountry] && hashCountry !== currentCountry) {
      selectCountry(hashCountry);
    }
  });
}

function setupForm() {
  if (!elements.addButton) return;

  elements.addButton.addEventListener('click', (evt) => {
    evt.preventDefault();
    handleAddExpense();
  });

  elements.descriptionInput?.addEventListener('keydown', (evt) => {
    if (evt.key === 'Enter' && !evt.shiftKey) {
      evt.preventDefault();
      handleAddExpense();
    }
  });

  elements.amountInput?.addEventListener('input', syncLocalAmountFromGbp);
  elements.localAmountInput?.addEventListener('input', syncGbpFromLocalAmount);

  const toggleRepeatControls = () => {
    if (!elements.repeatToggle || !elements.repeatCount) return;
    const enabled = elements.repeatToggle.checked;
    elements.repeatCount.disabled = !enabled;
    if (!enabled) {
      elements.repeatCount.value = elements.repeatCount.getAttribute('data-default') || elements.repeatCount.defaultValue || '3';
    }
  };

  if (elements.repeatToggle) {
    elements.repeatCount?.setAttribute('data-default', elements.repeatCount?.value || '3');
    elements.repeatToggle.addEventListener('change', toggleRepeatControls);
    toggleRepeatControls();
  }
}

function setupDataManagement() {
  // Import button triggers file picker
  elements.importButton?.addEventListener('click', (evt) => {
    evt.preventDefault();
    elements.importInput?.click();
  });

  // Export button exports data
  elements.exportButton?.addEventListener('click', (evt) => {
    evt.preventDefault();
    exportStateAsJson();
  });

  // Handle file selection
  elements.importInput?.addEventListener('change', async (evt) => {
    const [file] = evt.target.files || [];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      state = normaliseIncomingState(parsed);
      persistState();
      renderCountry();
      updateSyncStatus('Imported data applied locally', 'success');
      if (typeof setSyncFeedback === 'function') {
        setSyncFeedback('Import successful. Share again to sync to the cloud.', 'success');
      }
    } catch (error) {
      console.error('Import failed', error);
      alert('Import failed. Make sure you selected a valid JSON export.');
    } finally {
      evt.target.value = '';
    }
  });
}

function setupEditableFields() {
  if (elements.overallBudget) {
    attachInlineNumberEditor(elements.overallBudget, {
      step: '0.01',
      min: '0',
      formatValue: (value) => formatGbp(value),
      parse: (value) => parseFloat(value),
      save: (value) => {
        if (!currentCountry || Number.isNaN(value)) return;
        ensureCountryState(currentCountry).budget = clampNumber(value, 0);
        persistState();
        renderCountry();
      },
    });
  }

  if (elements.plannedDays) {
    attachInlineNumberEditor(elements.plannedDays, {
      step: '1',
      min: '1',
      formatValue: (value) => `${Math.round(value)}`,
      parse: (value) => parseInt(value, 10),
      save: (value) => {
        if (!currentCountry || Number.isNaN(value) || value < 1) return;
        ensureCountryState(currentCountry).durationDays = Math.round(value);
        persistState();
        renderCountry();
      },
    });
  }
}

function setupDailySummariesInteractions() {
  const container = elements.dailySummaries;
  if (!container || container.dataset.listenersBound === '1') return;

  container.addEventListener('click', (evt) => {
    const deleteButton = evt.target.closest('.delete-expense');
    if (deleteButton) {
      evt.preventDefault();
      const { expenseId, expenseDate } = deleteButton.dataset;
      if (expenseDate) {
        expandedSummaryDate = expenseDate;
      }
      if (expenseId) {
        deleteExpense(Number(expenseId));
      }
      return;
    }

    const editButton = evt.target.closest('.edit-expense');
    if (editButton) {
      evt.preventDefault();
      const { expenseId, expenseDate } = editButton.dataset;
      if (expenseDate) {
        expandedSummaryDate = expenseDate;
      }
      if (expenseId) {
        startExpenseEdit(Number(expenseId));
      }
    }
  });

  container.dataset.listenersBound = '1';
}

function setupAnalyticsDateInteractions() {
  if (analyticsInteractionsBound) return;
  analyticsInteractionsBound = true;

  const handleJump = (evt) => {
    if (!(evt.target instanceof Element)) return;
    const trigger = evt.target.closest('.analytics-date[data-jump-to-date]');
    if (!trigger) return;
    evt.preventDefault();
    const targetDate = trigger.dataset.jumpToDate;
    if (targetDate) {
      jumpToDate(targetDate);
    }
  };

  document.addEventListener('click', handleJump);
  document.addEventListener('keydown', (evt) => {
    if (evt.key !== 'Enter' && evt.key !== ' ') return;
    handleJump(evt);
  });
}

function attachInlineNumberEditor(element, { step, min, formatValue, parse, save }) {
  element.classList.add('editable');
  element.addEventListener('click', () => {
    if (!currentCountry || element.dataset.editing === '1') return;

    const countryState = ensureCountryState(currentCountry);
    const initialValue = element.id === 'plannedDays'
      ? countryState.durationDays
      : countryState.budget;

    const input = document.createElement('input');
    input.type = 'number';
    input.step = step;
    if (min !== undefined) input.min = min;
    input.value = Number.isFinite(initialValue) ? initialValue : 0;
    input.className = 'inline-number-editor';

    element.style.display = 'none';
    element.dataset.editing = '1';
    element.after(input);
    input.focus();
    input.select();

    const commit = () => {
      const parsed = parse(input.value);
      save(parsed);
      cleanup();
    };

    const cancel = () => {
      cleanup();
    };

    const cleanup = () => {
      element.textContent = formatValue(ensureCountryState(currentCountry)[element.id === 'plannedDays' ? 'durationDays' : 'budget']);
      element.style.display = '';
      element.dataset.editing = '0';
      input.remove();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        commit();
      }
      if (evt.key === 'Escape') {
        evt.preventDefault();
        cancel();
      }
    });
  });
}

function handleAddExpense() {
  if (!currentCountry) {
    alert('Select a country before adding expenses.');
    return;
  }

  const amount = parseFloat(elements.amountInput?.value || '');
  const description = elements.descriptionInput?.value.trim() || '';
  const dateValue = elements.dateInput?.value || '';
  const category = elements.categorySelect?.value || 'other';
  const repeatEnabled = Boolean(elements.repeatToggle?.checked);
  const repeatRaw = elements.repeatCount?.value || '0';
  const additionalDays = repeatEnabled ? Math.max(0, Math.min(parseInt(repeatRaw, 10) || 0, 30)) : 0;

  if (!dateValue) {
    alert('Please choose a date for this expense.');
    elements.dateInput?.focus();
    return;
  }

  if (!amount || Number.isNaN(amount) || amount <= 0) {
    alert('Please enter a valid amount in GBP.');
    elements.amountInput?.focus();
    return;
  }

  if (!description) {
    alert('Please add a description so you remember this expense.');
    elements.descriptionInput?.focus();
    return;
  }

  const startDate = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(startDate.getTime())) {
    alert('The selected date is invalid.');
    elements.dateInput?.focus();
    return;
  }

  const countryState = ensureCountryState(currentCountry);
  const expensesToAdd = [];

  for (let offset = 0; offset <= additionalDays; offset += 1) {
    const entryDate = new Date(startDate);
    entryDate.setDate(startDate.getDate() + offset);
    const iso = entryDate.toISOString().split('T')[0];

    const id = generateExpenseId(offset);
    expensesToAdd.push({
      id,
      amount,
      description,
      date: iso,
      category,
    });
    newlyAddedExpenseIds.add(id);
  }

  countryState.expenses.push(...expensesToAdd);
  expandedSummaryDate = expensesToAdd[expensesToAdd.length - 1].date;

  persistState();
  resetForm();
  renderCountry();
}

function resetForm() {
  if (elements.amountInput) elements.amountInput.value = '';
  if (elements.localAmountInput) elements.localAmountInput.value = '';
  if (elements.descriptionInput) elements.descriptionInput.value = '';
  if (elements.dateInput) elements.dateInput.value = todayIsoString();
  if (elements.repeatToggle) {
    elements.repeatToggle.checked = false;
  }
  if (elements.repeatCount) {
    const defaultValue = elements.repeatCount.getAttribute('data-default') || '3';
    elements.repeatCount.value = defaultValue;
    elements.repeatCount.disabled = true;
  }
}

function selectCountry(country) {
  if (!countries[country]) return;

  currentCountry = country;
  ensureCountryState(currentCountry);

  expandedSummaryDate = null;
  if (window.location.hash.replace('#', '') !== country) {
    window.location.hash = country;
  }

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.country === currentCountry);
  });

  renderCountry();
  updateExchangeRateDisplay();
  resetForm();
}

function renderCountry() {
  if (!currentCountry) return;
  const countryConfig = countries[currentCountry];
  const countryState = ensureCountryState(currentCountry);

  if (elements.countryName) elements.countryName.textContent = countryConfig.name;
  if (elements.overallBudget) elements.overallBudget.textContent = formatGbp(countryState.budget);
  if (elements.plannedDays) elements.plannedDays.textContent = `${countryState.durationDays}`;

  renderStats(countryState);
  renderDailySummaries(countryState);
}

function renderStats(countryState) {
  const expenses = countryState.expenses || [];
  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const rawRemaining = (countryState.budget || 0) - totalSpent;
  const remaining = Math.max(rawRemaining, 0);
  const plannedDays = Math.max(countryState.durationDays || 0, 0);
  const dailyTarget = plannedDays > 0 ? countryState.budget / plannedDays : 0;

  // Calculate days left
  const uniqueDaysSpent = new Set(expenses.map((expense) => expense.date)).size;
  const daysLeft = plannedDays > 0 ? Math.max(plannedDays - uniqueDaysSpent, 0) : 0;

  if (elements.dailyTarget) elements.dailyTarget.textContent = formatGbp(dailyTarget);
  if (elements.remainingBudget) {
    const daysLeftText = plannedDays > 0 ? ` <span class="days-remaining-hint">${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left</span>` : '';
    elements.remainingBudget.innerHTML = `${formatGbp(remaining)}${daysLeftText}`;
  }

  const budgetStatus = getBudgetStatus(countryState, totalSpent, dailyTarget);
  updateAnalytics(expenses, countryState, dailyTarget, remaining, rawRemaining);
  renderHeroProgress(countryState.budget, totalSpent, remaining, budgetStatus);
}

function getBudgetStatus(countryState, totalSpent, dailyTarget) {
  if (!countryState || !countryState.budget) return null;

  const plannedDays = countryState.durationDays || 0;
  const expenses = countryState.expenses || [];

  if (!plannedDays || plannedDays <= 0 || !expenses.length) {
    return basicBudgetStatus(countryState.budget, totalSpent);
  }

  const uniqueDays = new Set(expenses.map((expense) => expense.date)).size;
  if (!uniqueDays) {
    return basicBudgetStatus(countryState.budget, totalSpent);
  }

  const expectedSpend = dailyTarget * uniqueDays;
  const tolerance = dailyTarget * 0.2; // 20% cushion
  if (totalSpent <= expectedSpend - tolerance) {
    return { className: 'on-track', symbol: '✓', label: 'Under plan so far' };
  }
  if (totalSpent <= expectedSpend + tolerance) {
    return { className: 'warning', symbol: '!', label: 'Slightly over target' };
  }
  return { className: 'off-track', symbol: '×', label: 'Over budget pace' };
}

function basicBudgetStatus(budget, totalSpent) {
  const ratio = totalSpent / budget;
  if (ratio <= 0.75) {
    return { className: 'on-track', symbol: '✓', label: 'On track' };
  }
  if (ratio <= 1) {
    return { className: 'warning', symbol: '!', label: 'Close to limit' };
  }
  return { className: 'off-track', symbol: '×', label: 'Over budget' };
}

function updateAnalytics(expenses, countryState, dailyTarget, remaining, rawRemaining) {
  if (!elements.tripProgress && !elements.daysUnderBudget && !elements.budgetSavings && !elements.daysRemaining && !elements.categoryBreakdown && !elements.budgetAlerts) {
    return;
  }

  const totalSpent = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const progress = countryState.budget > 0 ? Math.min((totalSpent / countryState.budget) * 100, 999) : 0;

  const totalsByDate = expenses.reduce((acc, expense) => {
    acc[expense.date] = (acc[expense.date] || 0) + expense.amount;
    return acc;
  }, {});

  const dailyTotals = Object.values(totalsByDate);
  const daysUnderBudget = dailyTarget > 0
    ? dailyTotals.filter((total) => total <= dailyTarget).length
    : 0;

  const daysOverBudget = dailyTarget > 0
    ? dailyTotals.filter((total) => total > dailyTarget).length
    : 0;

  let totalSavings = 0;
  let totalOverspend = 0;
  if (dailyTarget > 0) {
    dailyTotals.forEach((total) => {
      if (total < dailyTarget) {
        totalSavings += dailyTarget - total;
      } else if (total > dailyTarget) {
        totalOverspend += total - dailyTarget;
      }
    });
  }
  const hasDailyTarget = dailyTarget > 0 && dailyTotals.length > 0;
  const netSavingsFromBudget = totalSavings - totalOverspend;

  const uniqueDaysSpent = Object.keys(totalsByDate).length;
  const plannedDays = countryState.durationDays || 0;
  const remainingDays = plannedDays > 0 ? Math.max(plannedDays - uniqueDaysSpent, 0) : null;

  // Find biggest and smallest spend days
  let biggestDay = null;
  let smallestDay = null;
  if (Object.keys(totalsByDate).length > 0) {
    const sortedDays = Object.entries(totalsByDate).sort((a, b) => b[1] - a[1]);
    biggestDay = sortedDays[0];
    smallestDay = sortedDays[sortedDays.length - 1];
  }

  if (elements.tripProgress) elements.tripProgress.textContent = `${Math.round(progress)}%`;
  if (elements.daysUnderBudget) elements.daysUnderBudget.textContent = `${daysUnderBudget}`;
  if (elements.daysOverBudget) elements.daysOverBudget.textContent = `${daysOverBudget}`;
  if (elements.budgetSavings) elements.budgetSavings.textContent = formatGbp(netSavingsFromBudget);
  if (elements.daysRemaining) {
    elements.daysRemaining.textContent = remainingDays === null ? 'Set days' : `${remainingDays} day${remainingDays === 1 ? '' : 's'}`;
  }
  if (elements.biggestSpendDay) {
    elements.biggestSpendDay.innerHTML = biggestDay
      ? `${formatGbp(biggestDay[1])}<span class="analytics-date" role="button" tabindex="0" data-jump-to-date="${biggestDay[0]}">${formatDisplayDate(biggestDay[0])}</span>`
      : '—';
  }
  if (elements.smallestSpendDay) {
    elements.smallestSpendDay.innerHTML = smallestDay
      ? `${formatGbp(smallestDay[1])}<span class="analytics-date" role="button" tabindex="0" data-jump-to-date="${smallestDay[0]}">${formatDisplayDate(smallestDay[0])}</span>`
      : '—';
  }
  updateBudgetPositionBanner(hasDailyTarget ? netSavingsFromBudget : null);

  const categoryTotals = expenses.reduce((acc, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
    return acc;
  }, {});
  updateCategoryBreakdown(categoryTotals, totalSpent);
  updateBudgetAlerts({
    expenses,
    countryState,
    dailyTarget,
    rawRemaining,
    totalSpent,
    uniqueDaysSpent,
    remainingDays,
  });
}

function updateCategoryBreakdown(categoryTotals, totalSpent) {
  const container = elements.categoryBreakdown;
  if (!container) return;

  const entries = Object.entries(categoryTotals)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a);
  const seenKeys = new Set();

  if (!entries.length || totalSpent <= 0) {
    container.innerHTML = '<div class="meta">Add expenses to see the category breakdown.</div>';
    lastCategoryProgress.clear();
    return;
  }

  container.innerHTML = entries.map(([category, amount]) => {
    const ratio = totalSpent > 0 ? Math.min((amount / totalSpent) * 100, 100) : 0;
    const label = categoryLabels[category] || category;
    seenKeys.add(category);
    return `
      <div class="category-breakdown__row" data-category="${category}">
        <span class="category-breakdown__label">${label}</span>
        <div class="category-breakdown__bar">
          <div class="category-breakdown__bar-fill" data-progress-target="${ratio.toFixed(1)}"></div>
        </div>
        <span class="category-breakdown__value">${formatGbp(amount)} (${ratio.toFixed(1)}%)</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.category-breakdown__bar-fill').forEach((fill) => {
    const targetAttr = fill.getAttribute('data-progress-target') || fill.dataset.progressTarget;
    const target = targetAttr ? parseFloat(targetAttr) : 0;
    const row = fill.closest('.category-breakdown__row');
    const key = row?.dataset.category;
    fill.setAttribute('data-progress-target', Number.isFinite(target) ? target : 0);
    if (key) {
      const previous = lastCategoryProgress.has(key) ? lastCategoryProgress.get(key) : null;
      if (previous !== null && Number.isFinite(previous)) {
        fill.setAttribute('data-progress-current', previous);
      }
      animateProgressFill(fill);
      lastCategoryProgress.set(key, target);
    } else {
      animateProgressFill(fill);
    }
  });

  Array.from(lastCategoryProgress.keys()).forEach((key) => {
    if (!seenKeys.has(key)) {
      lastCategoryProgress.delete(key);
    }
  });
}

function updateBudgetPositionBanner(netSavings) {
  const banner = elements.budgetPositionBanner;
  if (!banner) return;

  const baseClasses = ['budget-alerts', 'budget-alerts--inline'];

  const resetBanner = () => {
    banner.className = `${baseClasses.join(' ')} hidden`;
    banner.innerHTML = '<div class="meta">Log a few expenses to see how your budget is tracking.</div>';
  };

  if (netSavings === null) {
    resetBanner();
    return;
  }

  const rounded = Math.round(netSavings * 100) / 100;
  const absRounded = Math.abs(rounded);

  if (absRounded < 0.5) {
    banner.className = baseClasses.join(' ');
    banner.innerHTML = `
      <div class="budget-alert budget-alert--inline info">
        <span class="budget-alert__badge">ℹ️</span>
        <span class="budget-alert__message">You're right on budget. Keep your daily spending steady.</span>
      </div>
    `;
    return;
  }

  if (rounded > 0) {
    banner.className = baseClasses.join(' ');
    banner.innerHTML = `
      <div class="budget-alert budget-alert--inline success">
        <span class="budget-alert__badge">✓</span>
        <span class="budget-alert__message">You've saved ${formatGbp(rounded)} from being under your daily budgets — well done!</span>
      </div>
    `;
    return;
  }

  banner.className = baseClasses.join(' ');
  banner.innerHTML = `
    <div class="budget-alert budget-alert--inline danger">
      <span class="budget-alert__badge">⚠</span>
      <span class="budget-alert__message">You're ${formatGbp(absRounded)} over your daily budgets. Trim a little to get back on track.</span>
    </div>
  `;
}

function updateBudgetAlerts({
  expenses,
  countryState,
  dailyTarget,
  rawRemaining,
  totalSpent,
  uniqueDaysSpent,
  remainingDays,
}) {
  const container = elements.budgetAlerts;
  if (!container) return;

  const alerts = [];
  const budget = countryState.budget || 0;
  const plannedDays = countryState.durationDays || 0;
  const hasExpenses = expenses.length > 0;
  const averageDaily = uniqueDaysSpent > 0 ? (totalSpent / uniqueDaysSpent) : 0;
  const today = new Date();
  const todayIso = today.toISOString().split('T')[0];

  const pushAlert = (tone, message) => {
    alerts.push({ tone, message });
  };

  const totalsByDate = expenses.reduce((acc, expense) => {
    if (!expense?.date) return acc;
    acc[expense.date] = (acc[expense.date] || 0) + (Number(expense.amount) || 0);
    return acc;
  }, {});

  const orderedDates = Object.keys(totalsByDate).sort();
  const dailyTotals = orderedDates.map((date) => totalsByDate[date]);
  const daysUnderBudget = dailyTarget > 0
    ? dailyTotals.filter((total) => total <= dailyTarget).length
    : 0;
  const daysOverBudget = dailyTarget > 0
    ? dailyTotals.filter((total) => total > dailyTarget).length
    : 0;

  const recentDates = orderedDates.slice(-3);
  const overspendStreak = dailyTarget > 0 && recentDates.length === 3
    ? recentDates.every((date) => totalsByDate[date] > dailyTarget)
    : false;
  const efficientStreak = dailyTarget > 0 && recentDates.length === 3
    ? recentDates.every((date) => totalsByDate[date] <= dailyTarget * 0.7)
    : false;

  if (hasExpenses && dailyTarget > 0 && daysUnderBudget >= Math.max(3, Math.ceil(dailyTotals.length * 0.5))) {
    pushAlert('success', `You've stayed under your daily target on ${daysUnderBudget} day${daysUnderBudget === 1 ? '' : 's'} so far — brilliant pacing!`);
  }

  if (hasExpenses && dailyTarget > 0 && daysOverBudget > daysUnderBudget) {
    pushAlert('warning', `You've gone over budget on ${daysOverBudget} day${daysOverBudget === 1 ? '' : 's'}. Try planning a lighter spend day to rebalance.`);
  }

  if (overspendStreak) {
    pushAlert('danger', 'Spending topped your daily target three days in a row — time for a reset day.');
  }

  if (efficientStreak) {
    pushAlert('success', 'Three efficient days in a row! Keep this streak going and bank the savings for a big treat.');
  }

  if (budget > 0 && hasExpenses) {
    const remainingRatio = rawRemaining / budget;
    if (remainingRatio < -0.1) {
      pushAlert('danger', `You're ${formatGbp(Math.abs(rawRemaining))} beyond the total trip budget. Consider rebalancing categories or extending the budget.`);
    } else if (remainingRatio < 0.15 && remainingDays && remainingDays > 2) {
      pushAlert('warning', `Only ${formatGbp(rawRemaining)} left for ${remainingDays} day${remainingDays === 1 ? '' : 's'}. Keep a closer eye on the next few spends.`);
    } else if (remainingRatio > 0.5 && uniqueDaysSpent >= Math.max(3, Math.ceil(plannedDays * 0.3))) {
      pushAlert('success', `You're halfway through the budget with plenty left — ${formatGbp(rawRemaining)} remains for future adventures.`);
    }
  }

  if (hasExpenses && dailyTarget > 0 && orderedDates.length) {
    const lastDate = orderedDates[orderedDates.length - 1];
    const lastTotal = totalsByDate[lastDate];
    if (lastTotal <= dailyTarget * 0.6) {
      pushAlert('success', `Yesterday came in at ${formatGbp(lastTotal)} — well under your daily target of ${formatGbp(dailyTarget)}.`);
    } else if (lastTotal > dailyTarget * 1.3) {
      pushAlert('warning', `Yesterday hit ${formatGbp(lastTotal)}, about ${formatGbp(lastTotal - dailyTarget)} over target. Adjust today if you can.`);
    }
  }

  if (!budget) {
    pushAlert('info', 'Set an overall budget to unlock tailored suggestions.');
  }

  if (!hasExpenses) {
    pushAlert('info', 'No spending logged yet — add your first expense to see insights.');
  }

  if (hasExpenses && dailyTarget > 0 && uniqueDaysSpent > 0) {
    const diff = averageDaily - dailyTarget;
    if (diff < -2) {
      pushAlert('success', `You're averaging ${formatGbp(averageDaily)} per day — ${formatGbp(Math.abs(diff))} under your daily target of ${formatGbp(dailyTarget)}.`);
    } else if (diff > 2) {
      pushAlert('warning', `Daily spend is ${formatGbp(Math.abs(diff))} above your target (${formatGbp(dailyTarget)}). Keep an eye on discretionary costs.`);
    } else {
      pushAlert('info', `Daily spend is tracking close to plan at ${formatGbp(averageDaily)} per day.`);
    }

    const shouldHaveSpent = dailyTarget * uniqueDaysSpent;
    const totalDiff = totalSpent - shouldHaveSpent;
    if (Math.abs(totalDiff) >= dailyTarget) {
      if (totalDiff > 0) {
        pushAlert('warning', `You've spent ${formatGbp(Math.abs(totalDiff))} more than the pace budget so far. Consider a lighter day soon.`);
      } else {
        pushAlert('success', `Nice! You're ${formatGbp(Math.abs(totalDiff))} under the pace budget so far.`);
      }
    }
  }

  if (hasExpenses && dailyTarget > 0) {
    const startOfWeek = new Date(today);
    const day = startOfWeek.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    const startIso = startOfWeek.toISOString().split('T')[0];

    const weeklySpent = expenses
      .filter((expense) => expense.date >= startIso && expense.date <= todayIso)
      .reduce((sum, expense) => sum + expense.amount, 0);

    const daysElapsedThisWeek = Math.max(1, Math.min(7, Math.floor((today - startOfWeek) / (24 * 60 * 60 * 1000)) + 1));
    const weeklyTarget = dailyTarget * daysElapsedThisWeek;
    const weeklyDiff = weeklySpent - weeklyTarget;

    if (weeklyDiff > dailyTarget) {
      pushAlert('danger', `This week you're ${formatGbp(Math.abs(weeklyDiff))} over the weekly target so far. Try trimming the next few days.`);
    } else if (weeklyDiff < -dailyTarget) {
      pushAlert('success', `You're ${formatGbp(Math.abs(weeklyDiff))} under the weekly target — room for a treat!`);
    }
  }

  if (rawRemaining <= 0 && budget > 0) {
    const overspend = Math.abs(rawRemaining);
    if (overspend > 0) {
      pushAlert('danger', `Budget exhausted — you're ${formatGbp(overspend)} over plan. Consider pausing spending or raising the budget.`);
    } else {
      pushAlert('warning', 'Budget fully used — any new spending will push you over plan.');
    }
  }

  if (rawRemaining > 0 && hasExpenses && averageDaily > 0) {
    const daysLeftAtPace = rawRemaining / averageDaily;
    if (remainingDays !== null && remainingDays > 0) {
      if (daysLeftAtPace < remainingDays - 1) {
        pushAlert('danger', `At this pace you'll run out in about ${formatDays(daysLeftAtPace)} (plan needs ${formatDays(remainingDays)}). Time to rein it in.`);
      } else if (daysLeftAtPace > remainingDays + 1) {
        const projectedSurplus = rawRemaining - (remainingDays * averageDaily);
        pushAlert('success', `Great job — you could finish the trip with around ${formatGbp(projectedSurplus)} left if you keep this pace.`);
      } else {
        pushAlert('info', `You're on track to finish with the budget balanced in about ${formatDays(remainingDays)}.`);
      }
    } else {
      pushAlert('info', `At this pace you'll use the remaining budget in about ${formatDays(daysLeftAtPace)}.`);
    }
  }

  if (!alerts.length) {
    stopBudgetAlertRotation();
    budgetAlertMessages = [];
    lastBudgetAlertSignature = '';
    container.innerHTML = '<div class="meta">All quiet here — keep logging expenses to see more tips.</div>';
    return;
  }

  const signature = JSON.stringify(alerts.map(({ tone, message }) => `${tone}:${message}`));
  if (signature === lastBudgetAlertSignature && budgetAlertMessages.length) {
    return;
  }

  lastBudgetAlertSignature = signature;
  budgetAlertMessages = alerts.slice();
  budgetAlertIndex = 0;
  renderBudgetAlertMessage();
  startBudgetAlertRotation();
}

function renderHeroProgress(budget, totalSpent, remaining, status) {
  const container = elements.overallBudgetProgress;
  if (!container) return;

  if (!budget) {
    lastHeroProgress.percent = null;
    container.classList.add('hero-progress-card--empty');
    container.innerHTML = `
      <div class="hero-progress-placeholder">
        <p>${totalSpent ? `You've spent ${formatGbp(totalSpent)} so far. Set an overall budget to see progress.` : 'Set an overall budget to start tracking your progress.'}</p>
      </div>
    `;
    return;
  }

  container.classList.remove('hero-progress-card--empty');

  const spentPercent = budget > 0 ? Math.min((totalSpent / budget) * 100, 999) : 0;
  const barPercent = budget > 0 ? Math.min(spentPercent, 100) : 0;
  const overBudget = budget > 0 && totalSpent > budget;
  const variance = budget > 0 ? Math.abs(budget - totalSpent) : totalSpent;
  const previousPercent = Number.isFinite(lastHeroProgress.percent) ? lastHeroProgress.percent : null;

  const statusMarkup = status
    ? `<span class="status-indicator ${status.className}" title="${status.label}">${status.symbol}</span>`
    : '';

  // Calculate the starting percentage for the counter
  const previousSpentPercent = previousPercent !== null && barPercent > 0
    ? (previousPercent / barPercent) * spentPercent
    : 0;
  const startingCounterValue = Math.round(previousSpentPercent);

  container.innerHTML = `
    <div class="hero-progress-header">
      <span class="hero-progress-title">Budget Progress</span>
      <div class="hero-progress-status">
        <span class="hero-progress-value" data-counter-target="${Math.round(spentPercent)}">${startingCounterValue}%</span>
        ${statusMarkup}
      </div>
    </div>
    <div class="progress-bar">
      <div
        class="progress-fill ${overBudget ? 'over-budget' : ''}"
        data-progress-target="${barPercent}"
        data-percentage="${Math.round(spentPercent)}%">
      </div>
    </div>
    <div class="budget-context">
      <span>Spent: ${formatGbp(totalSpent)}</span>
      <span>${overBudget ? 'Over plan by' : 'Remaining'}: ${formatGbp(overBudget ? variance : remaining)}</span>
    </div>
  `;
  const fill = container.querySelector('.progress-fill');
  const counterElement = container.querySelector('.hero-progress-value');
  if (fill) {
    if (previousPercent !== null) {
      fill.setAttribute('data-progress-current', previousPercent);
    }
    animateProgressFill(fill, counterElement);
  }
  lastHeroProgress.percent = barPercent;
}

function renderDailySummaries(countryState) {
  if (!elements.dailySummaries) return;

  const container = elements.dailySummaries;
  container.innerHTML = '';

  if (!countryState.expenses.length) {
    container.innerHTML = '<div class="meta">No expenses yet.</div>';
    return;
  }

  const grouped = countryState.expenses.reduce((acc, expense) => {
    if (!acc[expense.date]) acc[expense.date] = [];
    acc[expense.date].push(expense);
    return acc;
  }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  const plannedDays = Math.max(countryState.durationDays || 0, 0);
  const dailyBudget = plannedDays > 0 ? countryState.budget / plannedDays : 0;
  const seenDates = new Set();
  const fragment = document.createDocumentFragment();

  let activeDate = expandedSummaryDate;
  if (activeDate && activeDate !== false && !grouped[activeDate]) {
    activeDate = null;
  }
  if ((activeDate === null || activeDate === undefined) && sortedDates.length) {
    activeDate = sortedDates[0];
    expandedSummaryDate = activeDate;
  }

  sortedDates.forEach((date, index) => {
    seenDates.add(date);
    const dailyExpenses = grouped[date];
    const dayTotal = dailyExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const wrapper = document.createElement('div');
    wrapper.className = 'day-summary';
    const shouldExpand = activeDate !== false && activeDate === date;
    if (shouldExpand) {
      wrapper.classList.add('expanded');
    }

    const header = document.createElement('div');
    header.className = 'day-header';
    header.setAttribute('role', 'button');
    header.setAttribute('tabindex', '0');
    header.setAttribute('aria-expanded', shouldExpand ? 'true' : 'false');

    const progressPercent = dailyBudget > 0 ? Math.min((dayTotal / dailyBudget) * 100, 999) : 0;
    const barPercent = dailyBudget > 0 ? Math.min(progressPercent, 100) : 0;
    const overBudget = dailyBudget > 0 && dayTotal > dailyBudget;
    const variance = dailyBudget > 0 ? Math.abs(dailyBudget - dayTotal) : 0;
    const previousPercent = lastDailyProgress.has(date) ? lastDailyProgress.get(date) : null;

    header.innerHTML = `
      <div class="day-header-top">
        <div class="day-title">
          <span class="arrow">▸</span>
          <div class="day-title-text">
            <strong>${formatDisplayDate(date)}</strong>
            <span class="meta">${date}</span>
          </div>
        </div>
        <div class="day-total">
          <span class="day-total-amount">${formatGbp(dayTotal)}</span>
          ${dailyBudget > 0 ? `<span class="daily-budget">Target ${formatGbp(dailyBudget)}</span>` : ''}
        </div>
      </div>
      ${dailyBudget > 0 ? `
        <div class="day-progress">
          <div class="progress-bar">
            <div
              class="progress-fill ${overBudget ? 'over-budget' : ''}"
              data-progress-target="${barPercent}"
              data-percentage="${Math.round(progressPercent)}%">
            </div>
          </div>
          <div class="budget-context">
            <span>${overBudget ? 'Over target' : 'Remaining'}</span>
            <span>${formatGbp(variance)}</span>
          </div>
        </div>
      ` : ''}
    `;

    const headerProgressFill = header.querySelector('.progress-fill');
    if (headerProgressFill) {
      if (previousPercent !== null) {
        headerProgressFill.setAttribute('data-progress-current', previousPercent);
      }
      animateProgressFill(headerProgressFill);
    }
    if (dailyBudget > 0) {
      lastDailyProgress.set(date, barPercent);
    } else {
      lastDailyProgress.delete(date);
    }

    const toggle = () => {
      const isExpanded = wrapper.classList.contains('expanded');
      container.querySelectorAll('.day-summary').forEach((item) => {
        const itemHeader = item.querySelector('.day-header');
        if (item !== wrapper) {
          item.classList.remove('expanded');
          if (itemHeader) {
            itemHeader.setAttribute('aria-expanded', 'false');
          }
        }
      });
      wrapper.classList.toggle('expanded', !isExpanded);
      header.setAttribute('aria-expanded', (!isExpanded).toString());
      expandedSummaryDate = !isExpanded ? date : false;
    };

    header.addEventListener('click', toggle);
    header.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter' || evt.key === ' ') {
        evt.preventDefault();
        toggle();
      }
    });

    const list = document.createElement('div');
    list.className = 'day-details';

    dailyExpenses
      .sort((a, b) => b.id - a.id)
      .forEach((expense) => {
        const item = document.createElement('div');
        item.className = 'expense-item';
        item.dataset.expenseId = String(expense.id);
        item.dataset.expenseDate = expense.date;
        if (newlyAddedExpenseIds.has(expense.id)) {
          item.classList.add('expense-item--recent');
          setTimeout(() => {
            item.classList.remove('expense-item--recent');
          }, 900);
          newlyAddedExpenseIds.delete(expense.id);
        }
        item.innerHTML = `
          <div class="expense-info">
            <span class="category-tag ${expense.category}">${categoryLabels[expense.category] || expense.category}</span>
            <span class="expense-desc">${escapeHtml(expense.description)}</span>
          </div>
          <div class="expense-actions">
            <div class="expense-amounts">
              <span class="amount-gbp">${formatGbp(expense.amount)}</span>
              <span class="amount-local">${formatLocal(expense.amount, currentCountry)}</span>
            </div>
            <div class="expense-action-buttons">
              <button class="expense-action-btn edit-expense" type="button" title="Edit expense" aria-label="Edit expense" data-expense-id="${expense.id}" data-expense-date="${expense.date}">
                <span class="icon-pencil" aria-hidden="true"></span>
              </button>
              <button class="expense-action-btn delete-expense" type="button" title="Delete expense" aria-label="Delete expense" data-expense-id="${expense.id}" data-expense-date="${expense.date}">
                <span class="icon-trash" aria-hidden="true"></span>
              </button>
            </div>
          </div>
        `;
        list.appendChild(item);
      });

    wrapper.appendChild(header);
    wrapper.appendChild(list);
    fragment.appendChild(wrapper);
  });

  container.appendChild(fragment);

  Array.from(lastDailyProgress.keys()).forEach((key) => {
    if (!seenDates.has(key)) {
      lastDailyProgress.delete(key);
    }
  });
}

function startExpenseEdit(expenseId) {
  if (!currentCountry || !elements.dailySummaries) return;
  const countryState = ensureCountryState(currentCountry);
  const expense = countryState.expenses.find((entry) => entry.id === expenseId);
  if (!expense) return;

  const item = elements.dailySummaries.querySelector(`.expense-item[data-expense-id="${expenseId}"]`);
  if (!item || item.classList.contains('editing')) return;

  expandedSummaryDate = expense.date;
  item.classList.add('editing');

  const categoryOptions = Object.entries(categoryLabels)
    .map(([value, label]) => `<option value="${value}">${label}</option>`)
    .join('');

  item.innerHTML = `
    <div class="expense-edit-form">
      <div class="expense-edit-row">
        <select class="edit-category">${categoryOptions}</select>
        <input type="date" class="edit-date">
      </div>
      <div class="expense-edit-row">
        <input type="text" class="edit-desc" placeholder="Description">
      </div>
      <div class="expense-edit-row amount-row">
        <div class="amount-input inline">
          <span class="currency">£</span>
          <input type="number" class="edit-amount" step="0.01" min="0" />
        </div>
        <span class="edit-local-preview"></span>
      </div>
      <div class="expense-edit-actions">
        <button type="button" class="expense-edit-btn save-expense">Save</button>
        <button type="button" class="expense-edit-btn cancel-expense">Cancel</button>
      </div>
    </div>
  `;

  const categorySelect = item.querySelector('.edit-category');
  const dateInput = item.querySelector('.edit-date');
  const descInput = item.querySelector('.edit-desc');
  const amountInput = item.querySelector('.edit-amount');
  const localPreview = item.querySelector('.edit-local-preview');

  if (categorySelect) categorySelect.value = expense.category;
  if (dateInput) dateInput.value = expense.date;
  if (descInput) descInput.value = expense.description;
  if (amountInput) amountInput.value = expense.amount.toFixed(2);
  if (localPreview && amountInput) {
    const updatePreview = () => {
      const val = parseFloat(amountInput.value);
      const displayAmount = Number.isNaN(val) ? 0 : Math.max(val, 0);
      localPreview.textContent = `≈ ${formatLocal(displayAmount, currentCountry)}`;
    };
    updatePreview();
    amountInput.addEventListener('input', updatePreview);
  } else if (localPreview) {
    localPreview.textContent = `≈ ${formatLocal(expense.amount, currentCountry)}`;
  }

  const save = () => {
    const updatedCategory = categorySelect?.value || expense.category;
    const updatedDate = dateInput?.value || expense.date;
    const updatedDescription = descInput?.value.trim() || '';
    const updatedAmount = parseFloat(amountInput?.value || '');

    if (!updatedDate) {
      alert('Please choose a date');
      dateInput?.focus();
      return;
    }
    if (Number.isNaN(updatedAmount) || updatedAmount <= 0) {
      alert('Please enter a valid amount');
      amountInput?.focus();
      return;
    }
    if (!updatedDescription) {
      alert('Please enter a description');
      descInput?.focus();
      return;
    }

    expense.category = updatedCategory;
    expense.date = updatedDate;
    expense.description = updatedDescription;
    expense.amount = updatedAmount;

    expandedSummaryDate = updatedDate;
    persistState();
    renderCountry();
  };

  const cancel = () => {
    renderCountry();
  };

  item.querySelector('.save-expense')?.addEventListener('click', save);
  item.querySelector('.cancel-expense')?.addEventListener('click', cancel);
  item.querySelectorAll('input').forEach((input) => {
    input.addEventListener('keydown', (evt) => {
      if (evt.key === 'Enter') {
        evt.preventDefault();
        save();
      }
      if (evt.key === 'Escape') {
        evt.preventDefault();
        cancel();
      }
    });
  });
  categorySelect?.addEventListener('keydown', (evt) => {
    if (evt.key === 'Escape') {
      evt.preventDefault();
      cancel();
    }
  });
}

function deleteExpense(expenseId) {
  if (!currentCountry || !expenseId) return;
  const countryState = ensureCountryState(currentCountry);
  countryState.expenses = countryState.expenses.filter((expense) => expense.id !== expenseId);
  persistState();
  renderCountry();
}

function jumpToDate(targetDate) {
  if (!targetDate) return;
  
  // Set this date to be expanded
  expandedSummaryDate = targetDate;
  
  // Re-render to expand the target day
  renderCountry();
  
  // Find the day summary element and scroll to it
  setTimeout(() => {
    const container = elements.dailySummaries;
    const daySummary = container?.querySelector('.day-summary .day-header[aria-expanded="true"]');
    if (daySummary) {
      daySummary.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // Add a brief highlight effect
      const wrapper = daySummary.closest('.day-summary');
      if (wrapper) {
        wrapper.style.transition = 'box-shadow 0.3s ease';
        wrapper.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.3)';
        setTimeout(() => {
          wrapper.style.boxShadow = '';
        }, 1500);
      }
    }
  }, 100);
}

function initSyncUI() {
  if (elements.openSyncButton) {
    elements.openSyncButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      if (!supabaseConfigured()) {
        alert('Add your Supabase URL and anon key near the top of travel.js to enable syncing.');
        return;
      }
      populateShareDetails(activeShareId);
      toggleSyncModal(true);
    });
  }

  elements.closeSyncButton?.addEventListener('click', () => toggleSyncModal(false));
  elements.syncOverlay?.addEventListener('click', () => toggleSyncModal(false));

  // Data Management Modal
  if (elements.openDataButton) {
    elements.openDataButton.addEventListener('click', (evt) => {
      evt.preventDefault();
      toggleDataModal(true);
    });
  }

  elements.closeDataButton?.addEventListener('click', () => toggleDataModal(false));
  elements.dataOverlay?.addEventListener('click', () => toggleDataModal(false));

  elements.createShareButton?.addEventListener('click', async (evt) => {
    evt.preventDefault();
    await handleCreateShare();
  });

  elements.copyShareCodeButton?.addEventListener('click', async () => {
    if (!activeShareId) return;
    try {
      await navigator.clipboard.writeText(activeShareId);
      setSyncFeedback('Share code copied to clipboard', 'success');
    } catch (err) {
      console.warn('Clipboard copy failed', err);
      setSyncFeedback('Copy failed – copy manually instead.', 'error');
    }
  });

  elements.loadShareForm?.addEventListener('submit', async (evt) => {
    evt.preventDefault();
    const code = elements.shareIdInput?.value.trim().toUpperCase();
    if (!code) {
      setSyncFeedback('Enter a share code to load data.', 'error');
      return;
    }
    await fetchShare(code);
  });

  elements.disconnectShareButton?.addEventListener('click', (evt) => {
    evt.preventDefault();
    handleDisconnectShare();
  });

  populateShareDetails(activeShareId);
}

function toggleSyncModal(show) {
  if (!elements.syncModal) return;
  const shouldShow = Boolean(show);
  elements.syncModal.classList.toggle('hidden', !shouldShow);
  elements.syncModal.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
  if (shouldShow) {
    populateShareDetails(activeShareId);
  }
}

function toggleDataModal(show) {
  if (!elements.dataModal) return;
  const shouldShow = Boolean(show);
  elements.dataModal.classList.toggle('hidden', !shouldShow);
  elements.dataModal.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
}

function populateShareDetails(code) {
  if (!elements.shareCodeContainer || !elements.shareCodeDisplay) return;
  if (code) {
    elements.shareCodeDisplay.textContent = code;
    elements.shareCodeContainer.classList.remove('hidden');
  } else {
    elements.shareCodeDisplay.textContent = '';
    elements.shareCodeContainer.classList.add('hidden');
  }
  if (elements.shareIdInput) {
    elements.shareIdInput.value = code || '';
  }
  setSyncFeedback('', 'info');
}

function setSyncFeedback(message, tone = 'info') {
  if (!elements.syncFeedback) return;
  elements.syncFeedback.textContent = message;
  elements.syncFeedback.className = `sync-feedback ${tone}`;
}

function initializeSupabase() {
  if (!supabaseConfigured()) {
    updateSyncStatus('Add Supabase credentials to enable sync', 'error');
    return;
  }
  if (!window.supabase || !window.supabase.createClient) {
    updateSyncStatus('Supabase client not loaded', 'error');
    return;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  updateSyncStatus(activeShareId ? 'Connected • syncing enabled' : 'Connected • ready to share', 'success');
}

function supabaseConfigured() {
  return (
    typeof SUPABASE_URL === 'string' &&
    typeof SUPABASE_ANON_KEY === 'string' &&
    !SUPABASE_URL.includes('YOUR_SUPABASE_PROJECT') &&
    !SUPABASE_ANON_KEY.includes('YOUR_SUPABASE_ANON_KEY')
  );
}

function updateSyncStatus(message, tone = 'info') {
  if (!elements.syncStatusText) return;
  elements.syncStatusText.textContent = message;
  elements.syncStatusText.className = `sync-status ${tone}`;
}

function queueCloudSync() {
  if (!supabaseConfigured() || !supabaseClient || !activeShareId) return;
  if (pendingSyncTimer) {
    clearTimeout(pendingSyncTimer);
  }
  pendingSyncTimer = setTimeout(() => {
    pendingSyncTimer = null;
    syncStateToCloud();
  }, CLOUD_SYNC_DEBOUNCE);
}

function exportStateAsJson() {
  try {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const timestamp = new Date().toISOString().split('T')[0];
    const countryLabel = currentCountry ? `-${currentCountry}` : '';
    link.href = url;
    link.download = `travel-budget${countryLabel}-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    updateSyncStatus('Exported data downloaded', 'success');
  } catch (error) {
    console.error('Export failed', error);
    updateSyncStatus('Export failed', 'error');
    alert('Unable to export data right now.');
  }
}

async function syncStateToCloud(force = false) {
  if (!supabaseConfigured() || !supabaseClient || !activeShareId) return;
  updateSyncStatus('Syncing…', 'info');
  try {
    const { error } = await supabaseClient
      .from('travel_shares')
      .upsert({
        share_code: activeShareId,
        payload: state,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'share_code', returning: 'minimal' });
    if (error) throw error;
    updateSyncStatus('Synced • ' + new Date().toLocaleTimeString(), 'success');
  } catch (error) {
    console.error('Supabase sync failed', error);
    updateSyncStatus('Sync failed', 'error');
    setSyncFeedback('Sync failed: ' + (error.message || 'check console for details'), 'error');
  }
}

async function fetchShare(code) {
  if (!supabaseConfigured()) {
    updateSyncStatus('Add Supabase credentials to enable sync', 'error');
    return;
  }
  if (!supabaseClient) {
    initializeSupabase();
  }
  if (!supabaseClient) return;

  updateSyncStatus('Loading shared data…', 'info');
  setSyncFeedback('Loading shared data…', 'info');
  try {
    let query = supabaseClient
      .from('travel_shares')
      .select('payload')
      .eq('share_code', code);
    const response = query.maybeSingle ? await query.maybeSingle() : await query.single();
    const { data, error } = response;
    if (error) throw error;
    if (!data || !data.payload) {
      setSyncFeedback('No data found for that code.', 'error');
      updateSyncStatus('Share code not found', 'error');
      return;
    }
    applyRemoteState(data.payload);
    activeShareId = code;
    localStorage.setItem(SHARE_STORAGE_KEY, code);
    populateShareDetails(code);
    toggleSyncModal(false);
    updateSyncStatus('Shared data loaded', 'success');
    setSyncFeedback('Share loaded successfully.', 'success');
  } catch (error) {
    console.error('Supabase fetch failed', error);
    setSyncFeedback('Failed to load share: ' + (error.message || 'unknown error'), 'error');
    updateSyncStatus('Share load failed', 'error');
  }
}

function applyRemoteState(payload) {
  state = normaliseIncomingState(payload);
  persistState();
  renderCountry();
}

function normaliseIncomingState(payload) {
  const base = initialiseBlankState();
  Object.keys(base).forEach((countryKey) => {
    if (payload && payload[countryKey]) {
      const incoming = payload[countryKey];
      base[countryKey] = {
        budget: Number(incoming.budget) || 0,
        durationDays: Number(incoming.durationDays) || countries[countryKey].duration,
        expenses: Array.isArray(incoming.expenses)
          ? incoming.expenses.map((expense, index) => ({
              id: Number(expense.id) || generateExpenseId(index),
              amount: Number(expense.amount) || 0,
              description: expense.description || '',
              date: expense.date || todayIsoString(),
              category: expense.category || 'other',
            }))
          : [],
      };
    }
  });
  return base;
}

async function handleCreateShare() {
  const customCodeRaw = elements.shareIdInput?.value || '';
  let customCode = customCodeRaw.trim().toUpperCase();
  if (customCode) {
    if (!/^[A-Z0-9-]{3,20}$/.test(customCode)) {
      setSyncFeedback('Use 3-20 letters/numbers for a custom code.', 'error');
      return;
    }
    activeShareId = customCode;
  } else if (!activeShareId) {
    activeShareId = generateShareCode();
  }
  localStorage.setItem(SHARE_STORAGE_KEY, activeShareId);
  populateShareDetails(activeShareId);

  if (!supabaseConfigured()) {
    setSyncFeedback('Share code saved locally. Add Supabase credentials to sync devices.', 'warning');
    updateSyncStatus('Share code ready • connect Supabase to sync', 'warning');
    return;
  }

  if (!supabaseClient) {
    initializeSupabase();
  }
  if (!supabaseClient) return;

  setSyncFeedback('Generating share code…', 'info');
  await syncStateToCloud(true);
  setSyncFeedback('Share ready! Use this code on another device.', 'success');
}

function handleDisconnectShare() {
  activeShareId = null;
  localStorage.removeItem(SHARE_STORAGE_KEY);
  populateShareDetails(null);
  updateSyncStatus('Sync disabled • local only', 'info');
  setSyncFeedback('Sync disabled on this device.', 'info');
}

function generateShareCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function updateExchangeRateDisplay() {
  if (!currentCountry) return;
  const config = countries[currentCountry];
  const { rate, symbol } = config;

  if (elements.localSymbol) {
    elements.localSymbol.textContent = symbol;
  }

  if (elements.exchangeRate) {
    const formattedRate = rate > 100
      ? Math.round(rate).toLocaleString('en-GB')
      : rate.toFixed(2);
    const spacing = symbol === 'Rp' || symbol === 'RM' ? ' ' : '';
    elements.exchangeRate.textContent = `£1 = ${symbol}${spacing}${formattedRate}`;
  }

  const localInputContainer = document.querySelector('.amount-input.local');
  if (localInputContainer) {
    localInputContainer.classList.toggle('rm', symbol === 'RM');
    localInputContainer.classList.toggle('rp', symbol === 'Rp');
  }
}

function syncLocalAmountFromGbp() {
  if (!currentCountry || !elements.amountInput || !elements.localAmountInput) return;
  if (!elements.amountInput.value) {
    elements.localAmountInput.value = '';
    return;
  }
  const amount = parseFloat(elements.amountInput.value);
  const rate = countries[currentCountry].rate;
  if (Number.isNaN(amount)) {
    elements.localAmountInput.value = '';
    return;
  }
  const local = amount * rate;
  elements.localAmountInput.value = rate > 100 ? Math.round(local) : local.toFixed(2);
}

function syncGbpFromLocalAmount() {
  if (!currentCountry || !elements.amountInput || !elements.localAmountInput) return;
  if (!elements.localAmountInput.value) {
    elements.amountInput.value = '';
    return;
  }
  const local = parseFloat(elements.localAmountInput.value);
  const rate = countries[currentCountry].rate;
  if (Number.isNaN(local)) {
    return;
  }
  const gbp = local / rate;
  elements.amountInput.value = gbp.toFixed(2);
}

function ensureCountryState(country) {
  if (!state[country]) {
    state[country] = {
      budget: 0,
      durationDays: countries[country].duration,
      expenses: [],
    };
  }
  if (!Number.isFinite(state[country].budget)) state[country].budget = 0;
  if (!Number.isFinite(state[country].durationDays)) state[country].durationDays = countries[country].duration;
  if (!Array.isArray(state[country].expenses)) state[country].expenses = [];
  return state[country];
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return initialiseBlankState();
    }
    const parsed = JSON.parse(saved);
    return Object.keys(countries).reduce((acc, countryKey) => {
      const existing = parsed[countryKey];
      acc[countryKey] = {
        budget: existing?.budget ?? 0,
        durationDays: existing?.durationDays ?? countries[countryKey].duration,
        expenses: Array.isArray(existing?.expenses) ? existing.expenses : [],
      };
      return acc;
    }, {});
  } catch (error) {
    console.error('Unable to load saved travel data:', error);
    return initialiseBlankState();
  }
}

function persistState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Unable to save travel data:', error);
  }
  queueCloudSync();
}

function initialiseBlankState() {
  return Object.keys(countries).reduce((acc, countryKey) => {
    acc[countryKey] = {
      budget: 0,
      durationDays: countries[countryKey].duration,
      expenses: [],
    };
    return acc;
  }, {});
}

function generateExpenseId(offset = 0) {
  return (Date.now() * 1000) + Math.floor(Math.random() * 1000) + offset;
}

function formatGbp(value) {
  return gbpFormatter.format(Number.isFinite(value) ? value : 0);
}

function formatLocal(amount, country) {
  const config = countries[country];
  if (!config) {
    return gbpFormatter.format(Number.isFinite(amount) ? amount : 0);
  }
  const { rate, symbol } = config;
  const numericAmount = Number.isFinite(amount) ? amount : 0;
  const localValue = numericAmount * rate;
  const decimals = rate > 100 ? 0 : 2;
  const cacheKey = `${country}-${decimals}`;
  if (!localFormatterCache.has(cacheKey)) {
    localFormatterCache.set(cacheKey, new Intl.NumberFormat('en-GB', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }));
  }
  const formatter = localFormatterCache.get(cacheKey);
  const formatted = formatter.format(localValue);
  return symbol === 'Rp' || symbol === 'RM' ? `${symbol} ${formatted}` : `${symbol}${formatted}`;
}

function formatDisplayDate(dateString) {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function clampNumber(value, min) {
  return Math.max(value, min);
}

function todayIsoString() {
  return new Date().toISOString().split('T')[0];
}

function formatDays(value) {
  if (!Number.isFinite(value) || value <= 0) return 'less than a day';
  if (value < 1.5) return 'about 1 day';
  if (value < 5) return `${value.toFixed(1)} days`;
  return `${Math.round(value)} days`;
}

function renderBudgetAlertMessage() {
  const container = elements.budgetAlerts;
  if (!container || !budgetAlertMessages.length) return;

  container.querySelector('.meta')?.remove();
  const alert = budgetAlertMessages[budgetAlertIndex];
  if (!alert) return;

  const badge = ALERT_BADGES[alert.tone] || ALERT_BADGES.info;
  const existing = container.querySelector('.budget-alert');
  if (existing) {
    existing.classList.add('budget-alert--exit');
    existing.addEventListener('animationend', () => existing.remove(), { once: true });
  }

  const wrapper = document.createElement('div');
  wrapper.className = `budget-alert ${alert.tone}`;
  wrapper.innerHTML = `
    <span class="budget-alert__badge">${badge}</span>
    <span class="budget-alert__message">${escapeHtml(alert.message)}</span>
  `;
  container.appendChild(wrapper);
}

function startBudgetAlertRotation() {
  stopBudgetAlertRotation();
  if (budgetAlertMessages.length <= 1) return;
  budgetAlertRotationTimer = setInterval(() => {
    budgetAlertIndex = (budgetAlertIndex + 1) % budgetAlertMessages.length;
    renderBudgetAlertMessage();
  }, 5000);
}

function stopBudgetAlertRotation() {
  if (budgetAlertRotationTimer) {
    clearInterval(budgetAlertRotationTimer);
    budgetAlertRotationTimer = null;
  }
}

function animateProgressFill(element, counterElement = null) {
  if (!element) return;
  const target = Number(element.getAttribute('data-progress-target')) || 0;
  const clampedTarget = Math.max(0, Math.min(100, target));
  const previousAttr = element.getAttribute('data-progress-current');
  const previousValue = Number(previousAttr);
  const hasPrevious = Number.isFinite(previousValue);
  const startPercent = hasPrevious ? previousValue : 0;

  // Get counter target if we have a counter element
  let counterStart = 0;
  let counterTarget = 0;
  if (counterElement) {
    counterTarget = Number(counterElement.getAttribute('data-counter-target')) || 0;
    const currentText = counterElement.textContent.replace('%', '');
    counterStart = Number(currentText) || 0;
  }

  if (element._progressAnimation) {
    element._progressAnimation.cancel();
  }
  if (counterElement && counterElement._counterInterval) {
    clearInterval(counterElement._counterInterval);
  }

  if (startPercent === clampedTarget) {
    element.style.width = `${clampedTarget}%`;
    element.setAttribute('data-progress-current', clampedTarget);
    if (counterElement) {
      counterElement.textContent = `${Math.round(counterTarget)}%`;
    }
    return;
  }

  element.style.width = `${startPercent}%`;
  const duration = Math.min(8000, Math.max(1500, Math.abs(clampedTarget - startPercent) * 120));
  
  // Animate the progress bar
  const animation = element.animate(
    [
      { width: `${startPercent}%` },
      { width: `${clampedTarget}%` },
    ],
    {
      duration,
      easing: 'cubic-bezier(0.22, 1, 0.27, 1)',
      fill: 'forwards',
    },
  );

  // Animate the counter if we have a counter element
  if (counterElement) {
    const startTime = performance.now();
    const counterDiff = counterTarget - counterStart;
    
    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use the same easing function as the progress bar
      const easeProgress = progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      const currentValue = counterStart + (counterDiff * easeProgress);
      counterElement.textContent = `${Math.round(currentValue)}%`;
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        counterElement.textContent = `${Math.round(counterTarget)}%`;
      }
    };
    
    requestAnimationFrame(updateCounter);
  }

  animation.onfinish = () => {
    element.style.width = `${clampedTarget}%`;
    element.setAttribute('data-progress-current', clampedTarget);
    element._progressAnimation = null;
    if (counterElement) {
      counterElement.textContent = `${Math.round(counterTarget)}%`;
    }
  };
  animation.oncancel = () => {
    element._progressAnimation = null;
  };
  element._progressAnimation = animation;
}
