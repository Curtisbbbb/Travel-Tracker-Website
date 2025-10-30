import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase credentials are missing. Set window.SUPABASE_URL and window.SUPABASE_ANON_KEY before loading travel.js.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

const elements = {
  authScreen: document.getElementById('authScreen'),
  appShell: document.getElementById('appShell'),
  loginForm: document.getElementById('loginForm'),
  signupForm: document.getElementById('signupForm'),
  loginFeedback: document.getElementById('loginFeedback'),
  signupFeedback: document.getElementById('signupFeedback'),
  loginEmail: document.getElementById('loginEmail'),
  loginPassword: document.getElementById('loginPassword'),
  signupName: document.getElementById('signupName'),
  signupEmail: document.getElementById('signupEmail'),
  signupPassword: document.getElementById('signupPassword'),
  signupConfirm: document.getElementById('signupConfirm'),
  authTabs: document.querySelectorAll('.auth-tab'),
  viewTitle: document.getElementById('viewTitle'),
  viewSubtitle: document.getElementById('viewSubtitle'),
  primaryAction: document.getElementById('primaryAction'),
  openQuickDestination: document.getElementById('openQuickDestination'),
  logout: document.getElementById('logout'),
  navLinks: document.querySelectorAll('.nav-link'),
  dashboardNextDestination: document.getElementById('dashboardNextDestination'),
  dashboardCountdown: document.getElementById('dashboardCountdown'),
  dashboardTripCount: document.getElementById('dashboardTripCount'),
  dashboardBudgetProgress: document.getElementById('dashboardBudgetProgress'),
  dashboardBudgetBar: document.getElementById('dashboardBudgetBar'),
  dashboardHighlights: document.getElementById('dashboardHighlights'),
  upcomingDestinations: document.getElementById('upcomingDestinations'),
  destinationForm: document.getElementById('destinationForm'),
  destinationFeedback: document.getElementById('destinationFeedback'),
  destinationLocation: document.getElementById('destinationLocation'),
  destinationStart: document.getElementById('destinationStart'),
  destinationNights: document.getElementById('destinationNights'),
  destinationBudget: document.getElementById('destinationBudget'),
  destinationActivities: document.getElementById('destinationActivities'),
  expenseForm: document.getElementById('expenseForm'),
  expenseDestination: document.getElementById('expenseDestination'),
  expenseCategory: document.getElementById('expenseCategory'),
  expenseAmount: document.getElementById('expenseAmount'),
  expenseDate: document.getElementById('expenseDate'),
  expenseNotes: document.getElementById('expenseNotes'),
  expenseFeedback: document.getElementById('expenseFeedback'),
  budgetDestinationPicker: document.getElementById('budgetDestinationPicker'),
  budgetSubtitle: document.getElementById('budgetSubtitle'),
  budgetSummary: document.getElementById('budgetSummary'),
  expenseList: document.getElementById('expenseList'),
  itineraryList: document.getElementById('itineraryList'),
  itineraryDetail: document.getElementById('itineraryDetail'),
  mapContainer: document.getElementById('mapContainer'),
  centerMap: document.getElementById('centerMap'),
  toggleHeat: document.getElementById('toggleHeat'),
  userName: document.getElementById('userName'),
  userEmail: document.getElementById('userEmail'),
  userInitials: document.getElementById('userInitials'),
};

const CATEGORY_LABELS = {
  stay: 'Stay',
  food: 'Food & Drink',
  transport: 'Transport',
  experience: 'Experiences',
  shopping: 'Shopping',
  other: 'Other',
};

const viewConfig = {
  dashboard: {
    title: 'Dashboard',
    subtitle: 'Your travel intelligence hub.',
    action: 'New destination',
  },
  budget: {
    title: 'Budget HQ',
    subtitle: 'Keep every cost aligned with the vision.',
    action: 'Record expense',
  },
  itinerary: {
    title: 'Itinerary Lab',
    subtitle: 'Shape unforgettable day-by-day experiences.',
    action: 'Add itinerary day',
  },
  map: {
    title: 'Route Map',
    subtitle: 'See the entire journey come alive.',
    action: 'Center map',
  },
};

const state = {
  profile: null,
  destinations: [],
};

let currentUser = null;
let currentView = 'dashboard';
let selectedDestinationId = null;
let mapInstance = null;
let mapMarkers = [];
let routeLine = null;
let heatLayer = null;
let heatActive = false;

const currencyFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

document.addEventListener('DOMContentLoaded', () => {
  setupAuthTabs();
  setupAuthForms();
  setupNavigation();
  setupForms();
  setupActions();
  seedDefaultDates();
  void tryRestoreSession();
});

function setupAuthTabs() {
  elements.authTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      elements.authTabs.forEach((btn) => btn.classList.toggle('is-active', btn === tab));
      const target = tab.dataset.authTab;
      elements.loginForm.classList.toggle('is-active', target === 'login');
      elements.signupForm.classList.toggle('is-active', target === 'signup');
      clearAuthFeedback();
    });
  });
}

function setupAuthForms() {
  elements.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAuthFeedback();

    const email = elements.loginEmail.value.trim().toLowerCase();
    const password = elements.loginPassword.value;

    if (!email || !password) {
      elements.loginFeedback.textContent = 'Enter your email and password to continue.';
      return;
    }

    elements.loginFeedback.textContent = 'Authenticating…';

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      elements.loginFeedback.textContent = error.message || 'Login failed. Try again.';
      return;
    }

    if (data.session?.user) {
      await enterApp(data.session.user);
      elements.loginForm.reset();
      elements.loginFeedback.textContent = '';
    }
  });

  elements.signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAuthFeedback();

    const name = elements.signupName.value.trim();
    const email = elements.signupEmail.value.trim().toLowerCase();
    const password = elements.signupPassword.value;
    const confirm = elements.signupConfirm.value;

    if (!name || !email || !password) {
      elements.signupFeedback.textContent = 'Fill in every field to craft your profile.';
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      elements.signupFeedback.textContent = 'Enter a valid email address.';
      return;
    }

    if (password.length < 6) {
      elements.signupFeedback.textContent = 'Use at least 6 characters for your password.';
      return;
    }

    if (password !== confirm) {
      elements.signupFeedback.textContent = 'Passwords need to match perfectly.';
      return;
    }

    elements.signupFeedback.textContent = 'Creating your account…';

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
        },
      },
    });

    if (error) {
      elements.signupFeedback.textContent = error.message || 'Unable to sign up right now.';
      return;
    }

    const user = data.user;
    if (!user) {
      elements.signupFeedback.textContent = 'Check your inbox to confirm your email before logging in.';
      return;
    }

    await ensureProfileRecord(user, name);

    if (data.session?.user) {
      await enterApp(data.session.user);
      elements.signupForm.reset();
      elements.signupFeedback.textContent = '';
    } else {
      elements.signupFeedback.textContent = 'Account created. Verify your email to continue.';
    }
  });
}

function clearAuthFeedback() {
  elements.loginFeedback.textContent = '';
  elements.signupFeedback.textContent = '';
}

function setupNavigation() {
  elements.navLinks.forEach((link) => {
    link.addEventListener('click', () => {
      const targetView = link.dataset.view;
      switchView(targetView);
    });
  });
}

function setupForms() {
  elements.destinationForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    ensureAuthenticated();

    const location = elements.destinationLocation.value.trim();
    const start = elements.destinationStart.value;
    const nights = Number(elements.destinationNights.value) || 0;
    const budget = Number(elements.destinationBudget.value) || 0;
    const activities = elements.destinationActivities.value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (!location || !start || nights <= 0) {
      elements.destinationFeedback.textContent = 'Location, arrival date, and nights are required.';
      return;
    }

    const destination = {
      location,
      startDate: start,
      nights,
      endDate: computeEndDate(start, nights),
      budget,
      activities,
      coordinates: null,
      placeName: null,
    };

    let geocoded = false;
    try {
      elements.destinationFeedback.textContent = 'Locating your destination on the globe…';
      await geocodeDestination(destination);
      geocoded = Boolean(destination.coordinates);
    } catch (error) {
      console.error('Geocoding failed', error);
    }

    const payload = {
      user_id: currentUser.id,
      location: destination.location,
      start_date: destination.startDate,
      end_date: destination.endDate,
      nights: destination.nights,
      budget: destination.budget,
      activities: destination.activities,
      coordinates: destination.coordinates,
      place_name: destination.placeName,
    };

    const { data, error } = await supabase
      .from('destinations')
      .insert(payload)
      .select('id')
      .single();

    if (error) {
      console.error(error);
      elements.destinationFeedback.textContent = error.message || 'Could not save destination.';
      return;
    }

    selectedDestinationId = data.id;
    elements.destinationFeedback.textContent = geocoded
      ? 'Destination locked in. Time to plan the magic!'
      : 'Destination added. Map update pending — refine the location if needed.';

    elements.destinationForm.reset();
    seedDefaultDates();
    await loadDestinations();
    renderAll();
    focusElement(elements.expenseDestination);
  });

  elements.expenseForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    ensureAuthenticated();

    const destinationId = elements.expenseDestination.value;
    const category = elements.expenseCategory.value;
    const amount = Number(elements.expenseAmount.value);
    const date = elements.expenseDate.value;
    const notes = elements.expenseNotes.value.trim();

    if (!destinationId) {
      elements.expenseFeedback.textContent = 'Select which destination this spend belongs to.';
      return;
    }

    if (!amount || amount <= 0) {
      elements.expenseFeedback.textContent = 'Enter an amount greater than zero.';
      return;
    }

    if (!date) {
      elements.expenseFeedback.textContent = 'Let us know when this expense happens.';
      return;
    }

    const { error } = await supabase.from('destination_expenses').insert({
      destination_id: destinationId,
      category,
      amount,
      date,
      notes,
    });

    if (error) {
      console.error(error);
      elements.expenseFeedback.textContent = error.message || 'Could not record the expense.';
      return;
    }

    elements.expenseFeedback.textContent = 'Expense tracked. Budget intel updated.';
    elements.expenseForm.reset();
    seedDefaultDates();
    await loadDestinations();
    renderBudgetPanel();
    renderDashboard();
  });

  elements.budgetDestinationPicker.addEventListener('change', () => {
    selectedDestinationId = elements.budgetDestinationPicker.value || null;
    renderBudgetPanel();
    renderItinerary();
  });

  elements.expenseDestination.addEventListener('change', () => {
    selectedDestinationId = elements.expenseDestination.value || selectedDestinationId;
    renderBudgetPanel();
    renderItinerary();
  });

  elements.itineraryList.addEventListener('click', (event) => {
    const card = event.target.closest('.itinerary-card');
    if (!card) return;
    selectedDestinationId = card.dataset.id;
    renderItinerary();
    renderBudgetPanel();
  });

  elements.expenseList.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-expense]');
    if (!button) return;
    await removeExpense(button.dataset.expense);
  });

  elements.itineraryDetail.addEventListener('click', async (event) => {
    const actionButton = event.target.closest('[data-action]');
    if (!actionButton) return;
    const action = actionButton.dataset.action;
    if (action === 'delete-day') {
      await removeDay(actionButton.dataset.dayId);
    } else if (action === 'edit-day') {
      await editDay(actionButton.dataset.dayId);
    } else if (action === 'edit-activities') {
      await editActivities();
    } else if (action === 'edit-budget') {
      await adjustBudget();
    } else if (action === 'delete-destination') {
      await deleteDestination();
    }
  });
}

function setupActions() {
  elements.primaryAction.addEventListener('click', () => {
    switch (currentView) {
      case 'dashboard':
      case 'map':
        switchView('budget');
        focusElement(elements.destinationLocation);
        break;
      case 'budget':
        focusElement(elements.expenseAmount);
        break;
      case 'itinerary':
        openDayForm();
        break;
      default:
        break;
    }
  });

  elements.openQuickDestination.addEventListener('click', () => {
    switchView('budget');
    focusElement(elements.destinationLocation);
  });

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('#emptyStateAdd');
    if (!trigger) return;
    switchView('budget');
    focusElement(elements.destinationLocation);
  });

  elements.logout.addEventListener('click', async () => {
    await supabase.auth.signOut();
    exitApp();
  });

  elements.centerMap.addEventListener('click', () => centerMap());
  elements.toggleHeat.addEventListener('click', () => toggleHeat());
}

async function tryRestoreSession() {
  const { data } = await supabase.auth.getSession();
  const sessionUser = data.session?.user;
  if (sessionUser) {
    await enterApp(sessionUser);
  }

  supabase.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user;
    if (user) {
      await enterApp(user);
    } else {
      exitApp();
    }
  });
}

async function enterApp(user) {
  if (currentUser?.id === user.id && state.profile) {
    return;
  }

  currentUser = user;
  await loadProfile();
  await loadDestinations();

  elements.userName.textContent = state.profile?.name || 'Explorer';
  elements.userEmail.textContent = currentUser.email || '';
  elements.userInitials.textContent = deriveInitials(state.profile?.name || currentUser.email);

  elements.authScreen.classList.add('hidden');
  elements.appShell.classList.remove('hidden');

  if (!mapInstance) {
    initializeMap();
  }

  renderAll();
  switchView(currentView);
}

function exitApp() {
  currentUser = null;
  state.profile = null;
  state.destinations = [];
  selectedDestinationId = null;
  elements.appShell.classList.add('hidden');
  elements.authScreen.classList.remove('hidden');
  clearForms();
}

async function loadProfile() {
  if (!currentUser) return;
  const { data, error } = await supabase.from('profiles').select('id, full_name').eq('id', currentUser.id).single();

  if (error && error.code !== 'PGRST116') {
    console.error('Could not load profile', error);
  }

  if (!data) {
    const name = currentUser.user_metadata?.full_name || currentUser.email?.split('@')[0] || 'Explorer';
    await ensureProfileRecord(currentUser, name);
    state.profile = { id: currentUser.id, name };
    return;
  }

  state.profile = {
    id: data.id,
    name: data.full_name || currentUser.email,
  };
}

async function ensureProfileRecord(user, name) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      full_name: name,
      created_at: new Date().toISOString(),
    });

  if (error) {
    console.error('Failed to ensure profile record', error);
  }
}

async function loadDestinations() {
  if (!currentUser) return;
  const { data, error } = await supabase
    .from('destinations')
    .select(
      `
        id,
        location,
        start_date,
        end_date,
        nights,
        budget,
        activities,
        coordinates,
        place_name,
        created_at,
        updated_at,
        destination_days ( id, title, date, notes, created_at, updated_at ),
        destination_expenses ( id, category, amount, date, notes, created_at )
      `
    )
    .eq('user_id', currentUser.id)
    .order('start_date', { ascending: true });

  if (error) {
    console.error('Failed to load destinations', error);
    return;
  }

  state.destinations = (data || []).map(normalizeDestination);

  if (state.destinations.length) {
    if (!selectedDestinationId || !state.destinations.some((dest) => dest.id === selectedDestinationId)) {
      selectedDestinationId = state.destinations[0].id;
    }
  } else {
    selectedDestinationId = null;
  }

  refreshDestinationSelectors();
}

function normalizeDestination(row) {
  return {
    id: row.id,
    location: row.location,
    startDate: row.start_date,
    endDate: row.end_date,
    nights: row.nights,
    budget: row.budget || 0,
    activities: Array.isArray(row.activities) ? row.activities : [],
    coordinates: row.coordinates,
    placeName: row.place_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    days: (row.destination_days || []).map((day) => ({
      id: day.id,
      title: day.title,
      date: day.date,
      notes: day.notes,
      createdAt: day.created_at,
      updatedAt: day.updated_at,
    })),
    expenses: (row.destination_expenses || []).map((expense) => ({
      id: expense.id,
      category: expense.category,
      amount: expense.amount,
      date: expense.date,
      notes: expense.notes,
      createdAt: expense.created_at,
    })),
  };
}

function renderAll() {
  refreshDestinationSelectors();
  renderDashboard();
  renderBudgetPanel();
  renderItinerary();
  renderMap();
}

function refreshDestinationSelectors() {
  const destinations = getDestinations();
  const options = destinations
    .map((dest) => `<option value="${dest.id}">${escapeHtml(dest.location)}</option>`)
    .join('');

  elements.expenseDestination.innerHTML = `<option value="">Choose destination…</option>${options}`;
  elements.budgetDestinationPicker.innerHTML = `<option value="">All destinations</option>${options}`;

  if (selectedDestinationId && destinations.some((dest) => dest.id === selectedDestinationId)) {
    elements.expenseDestination.value = selectedDestinationId;
    elements.budgetDestinationPicker.value = selectedDestinationId;
  } else if (destinations.length) {
    selectedDestinationId = destinations[0].id;
    elements.expenseDestination.value = selectedDestinationId;
    elements.budgetDestinationPicker.value = selectedDestinationId;
  } else {
    selectedDestinationId = null;
  }
}

function renderDashboard() {
  const destinations = getDestinations();
  const today = new Date();
  const upcoming = destinations
    .filter((dest) => new Date(dest.startDate) >= truncateDate(today))
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  if (upcoming.length) {
    const next = upcoming[0];
    elements.dashboardNextDestination.textContent = next.location;
    const diff = daysBetween(today, new Date(next.startDate));
    elements.dashboardCountdown.textContent = diff === 0 ? 'Happening today!' : `${diff} day${diff === 1 ? '' : 's'} to go`;
  } else if (destinations.length) {
    const sorted = [...destinations].sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    const next = sorted[0];
    elements.dashboardNextDestination.textContent = next.location;
    elements.dashboardCountdown.textContent = 'Already travelling — savor it!';
  } else {
    elements.dashboardNextDestination.textContent = 'No destinations yet';
    elements.dashboardCountdown.textContent = 'Add your first stop to unlock the journey.';
  }

  elements.dashboardTripCount.textContent = destinations.length;

  const totals = destinations.reduce(
    (acc, dest) => {
      acc.budget += dest.budget || 0;
      acc.spent += dest.expenses.reduce((sum, expense) => sum + expense.amount, 0);
      if (dest.activities?.length) {
        dest.activities.slice(0, 3).forEach((act) => acc.activities.add(act));
      }
      return acc;
    },
    { budget: 0, spent: 0, activities: new Set() }
  );

  const budgetLabel = `${currencyFormatter.format(totals.spent)} / ${currencyFormatter.format(totals.budget)}`;
  elements.dashboardBudgetProgress.textContent = budgetLabel;
  const percent = totals.budget ? Math.min((totals.spent / totals.budget) * 100, 100) : 0;
  elements.dashboardBudgetBar.style.width = `${percent}%`;

  const highlights = Array.from(totals.activities).slice(0, 6);
  if (highlights.length) {
    elements.dashboardHighlights.innerHTML = highlights.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join('');
  } else {
    elements.dashboardHighlights.innerHTML = '<span class="tag">Add activities to spotlight marquee moments.</span>';
  }

  if (!destinations.length) {
    elements.upcomingDestinations.innerHTML = '<div class="empty-state"><h3>No destinations</h3><p>Plot your first stop to kick off the adventure.</p></div>';
    return;
  }

  elements.upcomingDestinations.innerHTML = destinations
    .slice()
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
    .map((dest) => {
      const range = formatDateRange(dest.startDate, dest.endDate);
      const spent = dest.expenses.reduce((sum, expense) => sum + expense.amount, 0);
      const remaining = dest.budget ? Math.max(dest.budget - spent, 0) : 0;
      return `
        <article class="destination-card" data-id="${dest.id}">
          <h3>${escapeHtml(dest.location)}</h3>
          <p>${range}</p>
          <div class="card-meta">${dest.nights} night${dest.nights === 1 ? '' : 's'} • Budget ${currencyFormatter.format(dest.budget || 0)}</div>
          <div class="card-meta">${dest.activities.slice(0, 3).map(escapeHtml).join(', ') || 'Add your hero experiences.'}</div>
          <div class="card-meta">Remaining: ${currencyFormatter.format(remaining)}</div>
        </article>
      `;
    })
    .join('');

  elements.upcomingDestinations.querySelectorAll('.destination-card').forEach((card) => {
    card.addEventListener('click', () => {
      selectedDestinationId = card.dataset.id;
      switchView('itinerary');
      renderItinerary();
    });
  });
}

function renderBudgetPanel() {
  const destinations = getDestinations();
  const selected = selectedDestinationId ? getDestinationById(selectedDestinationId) : null;

  if (!destinations.length) {
    elements.budgetSubtitle.textContent = 'Add destinations to unlock budget insights.';
    elements.budgetSummary.innerHTML = '';
    elements.expenseList.innerHTML = '<div class="empty-state"><p>No expenses yet. Start logging to see the picture.</p></div>';
    return;
  }

  if (!selected) {
    elements.budgetSubtitle.textContent = 'Viewing all destinations.';
    const totalBudget = destinations.reduce((sum, dest) => sum + (dest.budget || 0), 0);
    const totalSpent = destinations.reduce(
      (sum, dest) => sum + dest.expenses.reduce((acc, expense) => acc + expense.amount, 0),
      0
    );
    const remaining = Math.max(totalBudget - totalSpent, 0);
    const totalNights = destinations.reduce((sum, dest) => sum + dest.nights, 0);
    const averagePerNight = totalSpent / Math.max(totalNights, 1);

    elements.budgetSummary.innerHTML = `
      <div class="budget-chip"><span>Total budget</span><strong>${currencyFormatter.format(totalBudget)}</strong></div>
      <div class="budget-chip"><span>Total spent</span><strong>${currencyFormatter.format(totalSpent)}</strong></div>
      <div class="budget-chip"><span>Remaining</span><strong>${currencyFormatter.format(remaining)}</strong></div>
      <div class="budget-chip"><span>Average spend per night</span><strong>${currencyFormatter.format(averagePerNight || 0)}</strong></div>
    `;

    const allExpenses = destinations
      .flatMap((dest) => dest.expenses.map((expense) => ({ ...expense, destination: dest.location })))
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    renderExpenseList(allExpenses);
    return;
  }

  elements.budgetSubtitle.textContent = `Currently focused on ${selected.location}.`;
  const spent = selected.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const remaining = Math.max((selected.budget || 0) - spent, 0);
  const perNight = spent / Math.max(selected.nights, 1);

  elements.budgetSummary.innerHTML = `
    <div class="budget-chip"><span>Budget</span><strong>${currencyFormatter.format(selected.budget || 0)}</strong></div>
    <div class="budget-chip"><span>Spent</span><strong>${currencyFormatter.format(spent)}</strong></div>
    <div class="budget-chip"><span>Remaining</span><strong>${currencyFormatter.format(remaining)}</strong></div>
    <div class="budget-chip"><span>Daily average</span><strong>${currencyFormatter.format(perNight || 0)}</strong></div>
  `;

  renderExpenseList(
    selected.expenses
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .map((expense) => ({ ...expense, destination: selected.location }))
  );
}

function renderExpenseList(expenses) {
  if (!expenses.length) {
    elements.expenseList.innerHTML = '<div class="empty-state"><p>No expenses yet. Record the first one to unlock analytics.</p></div>';
    return;
  }

  elements.expenseList.innerHTML = expenses
    .map((expense) => {
      const date = new Date(expense.date);
      const formattedDate = isFinite(date) ? date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : expense.date;
      const notes = expense.notes ? escapeHtml(expense.notes) : '—';
      const categoryLabel = CATEGORY_LABELS[expense.category] || expense.category;
      return `
        <div class="expense-item">
          <div>
            <strong>${escapeHtml(expense.destination)}</strong>
            <div class="card-meta">${escapeHtml(categoryLabel)}</div>
          </div>
          <div>${formattedDate}</div>
          <div class="amount">${currencyFormatter.format(expense.amount)}</div>
          <div>${notes}</div>
          <button class="ghost small" data-expense="${expense.id}" type="button">Remove</button>
        </div>
      `;
    })
    .join('');
}

function renderItinerary() {
  const destinations = getDestinations();
  if (!destinations.length) {
    elements.itineraryList.innerHTML = '<div class="empty-state"><p>No destinations yet. Add one to engineer the itinerary.</p></div>';
    elements.itineraryDetail.innerHTML = `
      <div class="empty-state">
        <h3>Select a destination</h3>
        <p>Pick anywhere from the left to drill into its day-by-day blueprint.</p>
        <button class="ghost" id="emptyStateAdd" type="button">Create destination</button>
      </div>`;
    return;
  }

  elements.itineraryList.innerHTML = destinations
    .map((dest) => {
      const range = formatDateRange(dest.startDate, dest.endDate);
      const activeClass = dest.id === selectedDestinationId ? ' is-active' : '';
      return `
        <article class="itinerary-card${activeClass}" data-id="${dest.id}">
          <strong>${escapeHtml(dest.location)}</strong>
          <span class="card-meta">${range}</span>
          <span class="card-meta">${dest.nights} night${dest.nights === 1 ? '' : 's'}</span>
        </article>
      `;
    })
    .join('');

  const selected = selectedDestinationId ? getDestinationById(selectedDestinationId) : destinations[0];
  if (selected && selectedDestinationId !== selected.id) {
    selectedDestinationId = selected.id;
  }

  renderItineraryDetail(selected);
}

function renderItineraryDetail(destination) {
  if (!destination) {
    elements.itineraryDetail.innerHTML = `
      <div class="empty-state">
        <h3>Select a destination</h3>
        <p>Pick anywhere from the left to drill into its day-by-day blueprint.</p>
        <button class="ghost" id="emptyStateAdd" type="button">Create destination</button>
      </div>`;
    return;
  }

  const range = formatDateRange(destination.startDate, destination.endDate);
  const activities = destination.activities?.length
    ? destination.activities.map((item) => `<span>${escapeHtml(item)}</span>`).join('')
    : '<span>Add your headline experiences.</span>';

  const days = destination.days
    .slice()
    .sort((a, b) => new Date(a.date || destination.startDate) - new Date(b.date || destination.startDate))
    .map((day) => {
      const dateLabel = day.date
        ? new Date(day.date).toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })
        : 'Date flexible';
      const notes = day.notes ? escapeHtml(day.notes).replace(/\n/g, '<br />') : 'No notes yet.';
      return `
        <div class="day-card">
          <div class="day-header">
            <h4 class="day-title">${escapeHtml(day.title)}</h4>
            <div>
              <button class="ghost small" data-action="edit-day" data-day-id="${day.id}" type="button">Edit</button>
              <button class="ghost small" data-action="delete-day" data-day-id="${day.id}" type="button">Remove</button>
            </div>
          </div>
          <div class="day-date">${dateLabel}</div>
          <p class="day-notes">${notes}</p>
        </div>
      `;
    })
    .join('');

  elements.itineraryDetail.innerHTML = `
    <div>
      <h3>${escapeHtml(destination.location)}</h3>
      <div class="detail-meta">
        <span>${range}</span>
        <span>${destination.nights} night${destination.nights === 1 ? '' : 's'}</span>
        <span>Budget ${currencyFormatter.format(destination.budget || 0)}</span>
      </div>
      <div class="detail-actions">
        <button class="ghost small" data-action="edit-activities" type="button">Update experiences</button>
        <button class="ghost small" data-action="edit-budget" type="button">Adjust budget</button>
        <button class="ghost small" data-action="delete-destination" type="button">Remove destination</button>
      </div>
    </div>
    <div>
      <h4>Top experiences</h4>
      <div class="top-activities">${activities}</div>
    </div>
    <div>
      <h4>Day blueprint</h4>
      <div class="day-list">${days || '<div class="card-meta">No days planned yet. Use the form below to architect them.</div>'}</div>
    </div>
    <form id="dayForm" class="form" novalidate>
      <div class="field-group">
        <div class="field">
          <label for="dayTitle">Title</label>
          <input id="dayTitle" name="title" placeholder="Day 1 — Old Town immersion" required />
        </div>
        <div class="field">
          <label for="dayDate">Date</label>
          <input id="dayDate" name="date" type="date" />
        </div>
      </div>
      <div class="field">
        <label for="dayNotes">Highlights &amp; flow</label>
        <textarea id="dayNotes" name="notes" rows="3" placeholder="Morning temple run, street food crawl, sunset drinks"></textarea>
      </div>
      <button class="secondary" type="submit">Add day plan</button>
    </form>
  `;

  const dayForm = document.getElementById('dayForm');
  dayForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const titleInput = document.getElementById('dayTitle');
    const dateInput = document.getElementById('dayDate');
    const notesInput = document.getElementById('dayNotes');

    const title = titleInput.value.trim();
    const date = dateInput.value;
    const notes = notesInput.value.trim();

    if (!title) {
      return;
    }

    const { error } = await supabase.from('destination_days').insert({
      destination_id: destination.id,
      title,
      date: date || null,
      notes,
    });

    if (error) {
      console.error(error);
      return;
    }

    await loadDestinations();
    renderItinerary();
  });
}

function renderMap() {
  if (!mapInstance) return;
  const destinations = getDestinations().filter((dest) => dest.coordinates);
  mapMarkers.forEach((marker) => marker.remove());
  mapMarkers = [];
  if (routeLine) {
    routeLine.remove();
    routeLine = null;
  }

  if (!destinations.length) {
    mapInstance.setView([20, 0], 2);
    if (heatLayer) {
      heatLayer.remove();
      heatLayer = null;
    }
    return;
  }

  const sorted = destinations.slice().sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
  const coords = [];

  sorted.forEach((dest, index) => {
    const marker = L.marker([dest.coordinates.lat, dest.coordinates.lng], {
      icon: L.divIcon({
        className: 'map-marker',
        html: `<span>${index + 1}</span>`;
*** End Patch