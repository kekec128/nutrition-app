const STORAGE_KEY = "linea-chiara-wellness-v1";
const QUOTES = [
  "I progressi sani nascono dalla ripetizione paziente.",
  "La routine serena che ripeti conta più della giornata perfetta.",
  "Piccoli check-in possono cambiare abitudini di lungo periodo.",
  "La costanza è una strategia più gentile dell’intensità.",
];
const INGREDIENT_LIBRARY = {
  uova: { calories: 155, protein: 13, carbs: 1, fat: 11 },
  pollo: { calories: 165, protein: 31, carbs: 0, fat: 4 },
  riso: { calories: 130, protein: 3, carbs: 28, fat: 0.3 },
  pasta: { calories: 157, protein: 6, carbs: 30, fat: 1 },
  yogurt: { calories: 63, protein: 5, carbs: 7, fat: 1.5 },
  spinaci: { calories: 23, protein: 3, carbs: 4, fat: 0.4 },
  pomodori: { calories: 18, protein: 1, carbs: 4, fat: 0.2 },
  tonno: { calories: 132, protein: 29, carbs: 0, fat: 1 },
  fagioli: { calories: 127, protein: 9, carbs: 22, fat: 0.5 },
  tofu: { calories: 120, protein: 12, carbs: 2, fat: 7 },
  avocado: { calories: 160, protein: 2, carbs: 9, fat: 15 },
  avena: { calories: 389, protein: 17, carbs: 66, fat: 7 },
  salmone: { calories: 208, protein: 20, carbs: 0, fat: 13 },
  patate: { calories: 77, protein: 2, carbs: 17, fat: 0.1 },
  formaggio: { calories: 320, protein: 22, carbs: 2, fat: 26 },
  pane: { calories: 265, protein: 9, carbs: 49, fat: 3.2 },
  "olio d'oliva": { calories: 884, protein: 0, carbs: 0, fat: 100 },
  funghi: { calories: 22, protein: 3, carbs: 3, fat: 0.3 },
  broccoli: { calories: 35, protein: 2.8, carbs: 7, fat: 0.4 },
  ceci: { calories: 164, protein: 9, carbs: 27, fat: 2.6 },
};

const todayKey = new Date().toISOString().slice(0, 10);
const state = loadState();

const dailyForm = document.querySelector("#dailyForm");
const goalsForm = document.querySelector("#goalsForm");

const heroCalories = document.querySelector("#heroCalories");
const heroWater = document.querySelector("#heroWater");
const heroWeight = document.querySelector("#heroWeight");
const todayHeading = document.querySelector("#todayHeading");
const todayMessage = document.querySelector("#todayMessage");
const snapshotWeight = document.querySelector("#snapshotWeight");
const snapshotCalories = document.querySelector("#snapshotCalories");
const snapshotWater = document.querySelector("#snapshotWater");
const summaryGrid = document.querySelector("#summaryGrid");
const insightsGrid = document.querySelector("#insightsGrid");
const chartCaption = document.querySelector("#chartCaption");
const chartCanvas = document.querySelector("#weightChart");
const streakValue = document.querySelector("#streakValue");
const habitDots = document.querySelector("#habitDots");
const quoteCard = document.querySelector("#quoteCard");
const pantryForm = document.querySelector("#pantryForm");
const pantryStatus = document.querySelector("#pantryStatus");
const recipeSourceBadge = document.querySelector("#recipeSourceBadge");
const recipeResults = document.querySelector("#recipeResults");
const generateRecipesButton = document.querySelector("#generateRecipesButton");

const goalWeightInput = document.querySelector("#goalWeight");
const goalCaloriesInput = document.querySelector("#goalCalories");
const goalWaterInput = document.querySelector("#goalWater");

const goalWeightLabel = document.querySelector("#goalWeightLabel");
const goalCaloriesLabel = document.querySelector("#goalCaloriesLabel");
const goalWaterLabel = document.querySelector("#goalWaterLabel");
const goalWeightBar = document.querySelector("#goalWeightBar");
const goalCaloriesBar = document.querySelector("#goalCaloriesBar");
const goalWaterBar = document.querySelector("#goalWaterBar");

dailyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(dailyForm);
  const entry = {
    date: todayKey,
    weight: Number(formData.get("weight") || 0),
    calories: Number(formData.get("caloriesIn") || 0),
    water: Number(formData.get("waterLiters") || 0),
  };

  state.entries = [entry, ...state.entries.filter((item) => item.date !== todayKey)].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  persistState();
  render();
});

goalsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const formData = new FormData(goalsForm);
  state.goals = {
    weight: Number(formData.get("goalWeight") || 0),
    calories: Number(formData.get("goalCalories") || 0),
    water: Number(formData.get("goalWater") || 0),
  };
  persistState();
  render();
});

pantryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(pantryForm);
  const ingredients = parseIngredients(formData.get("pantryIngredients"));
  const goal = formData.get("recipeGoal");

  if (!ingredients.length) {
    pantryStatus.textContent = "Inserisci almeno due ingredienti per generare ricette utili.";
    return;
  }

  generateRecipesButton.disabled = true;
  generateRecipesButton.textContent = "Generazione...";
  pantryStatus.textContent = "Sto costruendo idee ricetta a partire dai tuoi ingredienti.";

  try {
    let recipes = [];
    let source = "Modalità smart locale";

    if (window.location.protocol.startsWith("http")) {
      try {
        const response = await fetch("/api/generate-recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ingredients, goal }),
        });
        if (response.ok) {
          const payload = await response.json();
          recipes = payload.recipes || [];
          source = payload.model ? `Modalità AI · ${payload.model}` : "Modalità AI";
        }
      } catch (error) {
        console.warn("Generazione ricette AI non disponibile, uso il generatore locale.", error);
      }
    }

    if (!recipes.length) {
      recipes = generateLocalRecipes(ingredients, goal);
    }

    state.recipes = recipes;
    persistState();
    recipeSourceBadge.textContent = source;
    pantryStatus.textContent =
      source === "Modalità smart locale"
        ? "Ricette generate localmente a partire dagli ingredienti inseriti."
        : "Ricette generate con l’AI e salvate nella tua sessione.";
    renderRecipes();
  } finally {
    generateRecipesButton.disabled = false;
    generateRecipesButton.textContent = "Genera ricette";
  }
});

setupRevealAnimations();
render();

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      entries: [],
      goals: {
        weight: 68,
        calories: 1800,
        water: 2.2,
      },
      recipes: [],
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      entries: parsed.entries || [],
      goals: parsed.goals || {
        weight: 68,
        calories: 1800,
        water: 2.2,
      },
      recipes: parsed.recipes || [],
    };
  } catch (error) {
    console.error("Errore nella lettura dello stato locale", error);
    return {
      entries: [],
      goals: {
        weight: 68,
        calories: 1800,
        water: 2.2,
      },
      recipes: [],
    };
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function render() {
  populateForms();
  renderHero();
  renderTracker();
  renderSummary();
  renderInsights();
  renderRecipes();
  renderGoals();
  renderStreak();
  renderChart();
}

function renderRecipes() {
  const recipes = state.recipes || [];
  if (!recipes.length) {
    recipeResults.innerHTML = `
      <article class="recipe-card">
        <div class="recipe-card__topline">
          <div>
            <h3>Le idee ricetta compariranno qui</h3>
            <p>Inserisci i tuoi ingredienti per generare pasti semplici con stima nutrizionale.</p>
          </div>
          <span>Pronto</span>
        </div>
      </article>
    `;
    return;
  }

  recipeResults.innerHTML = recipes
    .map(
      (recipe) => `
        <article class="recipe-card">
          <div class="recipe-card__topline">
            <div>
              <h3>${recipe.name}</h3>
              <p>${recipe.summary}</p>
            </div>
            <span>${recipe.style}</span>
          </div>
          <div class="recipe-card__macros">
            <article><strong>${Math.round(recipe.calories)}</strong><span>kcal</span></article>
            <article><strong>${Math.round(recipe.protein)}g</strong><span>proteine</span></article>
            <article><strong>${Math.round(recipe.carbs)}g</strong><span>carboidrati</span></article>
            <article><strong>${Math.round(recipe.fat)}g</strong><span>grassi</span></article>
          </div>
          <p><strong>Ingredienti:</strong> ${recipe.ingredients.join(", ")}</p>
          <ol class="recipe-card__list">
            ${recipe.steps.map((step) => `<li>${step}</li>`).join("")}
          </ol>
        </article>
      `
    )
    .join("");
}

function populateForms() {
  const todayEntry = getTodayEntry();
  if (todayEntry) {
    dailyForm.elements.weight.value = todayEntry.weight || "";
    dailyForm.elements.caloriesIn.value = todayEntry.calories || "";
    dailyForm.elements.waterLiters.value = todayEntry.water || "";
  }

  goalWeightInput.value = state.goals.weight || "";
  goalCaloriesInput.value = state.goals.calories || "";
  goalWaterInput.value = state.goals.water || "";
}

function renderHero() {
  const todayEntry = getTodayEntry();
  heroCalories.textContent = Math.round(todayEntry?.calories || 0);
  heroWater.textContent = `${(todayEntry?.water || 0).toFixed(1)}L`;
  heroWeight.textContent = todayEntry?.weight ? `${todayEntry.weight.toFixed(1)}kg` : "--";
}

function renderTracker() {
  const todayEntry = getTodayEntry();
  if (!todayEntry) {
    todayHeading.textContent = "Nessun check-in per ora";
    todayMessage.textContent =
      "Inizia con un check-in semplice e lascia che la dashboard rifletta il tuo ritmo quotidiano.";
    snapshotWeight.textContent = "Peso: --";
    snapshotCalories.textContent = "Calorie: 0";
    snapshotWater.textContent = "Acqua: 0.0L";
    return;
  }

  todayHeading.textContent = "Il check-in di oggi è salvato";
  todayMessage.textContent =
    todayEntry.water >= state.goals.water
      ? "L’idratazione è ben impostata oggi. Continua con questo ritmo sereno."
      : "Hai registrato le basi. Un po’ più d’acqua aiuterebbe a completare la giornata.";
  snapshotWeight.textContent = `Peso: ${todayEntry.weight ? `${todayEntry.weight.toFixed(1)} kg` : "--"}`;
  snapshotCalories.textContent = `Calorie: ${Math.round(todayEntry.calories)} kcal`;
  snapshotWater.textContent = `Acqua: ${todayEntry.water.toFixed(1)}L`;
}

function renderSummary() {
  const recentEntries = [...state.entries].slice(-7);
  const totals = recentEntries.reduce(
    (accumulator, entry) => {
      accumulator.calories += entry.calories || 0;
      accumulator.water += entry.water || 0;
      accumulator.logged += 1;
      return accumulator;
    },
    { calories: 0, water: 0, logged: 0 }
  );
  const averageCalories = totals.logged ? Math.round(totals.calories / totals.logged) : 0;
  const averageWater = totals.logged ? (totals.water / totals.logged).toFixed(1) : "0.0";
  const habitScore = Math.round((totals.logged / 7) * 100);

  chartCaption.textContent = `${recentEntries.length || 0} check-in recenti`;
  summaryGrid.innerHTML = `
    <article class="summary-card">
      <p>Calorie settimanali</p>
      <strong>${averageCalories} kcal</strong>
      <span>Media giornaliera</span>
    </article>
    <article class="summary-card">
      <p>Idratazione</p>
      <strong>${averageWater} L</strong>
      <span>Media giornaliera</span>
    </article>
    <article class="summary-card">
      <p>Abitudini</p>
      <strong>${habitScore}%</strong>
      <span>Giorni registrati questa settimana</span>
    </article>
  `;
}

function renderInsights() {
  const todayEntry = getTodayEntry();
  const entries = [...state.entries].slice(-7);
  const averageCalories =
    entries.length > 0 ? entries.reduce((sum, item) => sum + (item.calories || 0), 0) / entries.length : 0;
  const calorieDelta = todayEntry ? todayEntry.calories - (state.goals.calories || 0) : 0;
  const hydrationState = !todayEntry ? "orange" : todayEntry.water >= state.goals.water ? "green" : "red";
  const calorieState = !todayEntry ? "orange" : Math.abs(calorieDelta) <= 150 ? "green" : calorieDelta > 150 ? "red" : "orange";
  const habitState = entries.length >= 5 ? "green" : entries.length >= 3 ? "orange" : "red";

  insightsGrid.innerHTML = `
    ${buildInsightCard(
      hydrationState,
      hydrationState === "green" ? "L’idratazione va bene" : hydrationState === "orange" ? "L’idratazione è moderata" : "L’idratazione è bassa",
      hydrationState === "green"
        ? "Stai raggiungendo il tuo obiettivo acqua oggi."
        : hydrationState === "orange"
          ? "Un po’ più d’acqua renderebbe la giornata più equilibrata."
          : "Sei ancora sotto il tuo obiettivo di idratazione."
    )}
    ${buildInsightCard(
      calorieState,
      calorieState === "green" ? "Le calorie sono ben allineate" : calorieState === "orange" ? "Le calorie sono leggermente fuori target" : "Le calorie stanno salendo troppo",
      todayEntry
        ? `L’assunzione di oggi è ${Math.abs(Math.round(calorieDelta))} kcal ${calorieDelta >= 0 ? "sopra" : "sotto"} il tuo obiettivo.`
        : "Registra le calorie di oggi per sbloccare questo consiglio."
    )}
    ${buildInsightCard(
      habitState,
      habitState === "green" ? "La costanza è forte" : habitState === "orange" ? "La costanza sta crescendo" : "La costanza ha bisogno di supporto",
      entries.length
        ? `La tua media sugli ultimi 7 giorni è ${Math.round(averageCalories)} kcal con ${entries.length} check-in registrati.`
        : "Anche 3 check-in a settimana possono rendere il trend molto più chiaro."
    )}
  `;
}

function renderGoals() {
  const latestWeight = getLatestWeight();
  const todayEntry = getTodayEntry();
  const startWeight = state.entries[0]?.weight || latestWeight || 0;
  const currentWeight = latestWeight || 0;

  const weightProgress = calculateWeightProgress(startWeight, currentWeight, state.goals.weight || 0);
  const caloriesProgress = calculatePercent(todayEntry?.calories || 0, state.goals.calories || 0);
  const waterProgress = calculatePercent(todayEntry?.water || 0, state.goals.water || 0);

  goalWeightLabel.textContent = state.goals.weight
    ? `${currentWeight ? currentWeight.toFixed(1) : "--"} / ${state.goals.weight.toFixed(1)} kg`
    : "Nessun obiettivo";
  goalCaloriesLabel.textContent = state.goals.calories
    ? `${Math.round(todayEntry?.calories || 0)} / ${state.goals.calories} kcal`
    : "Nessun obiettivo";
  goalWaterLabel.textContent = state.goals.water
    ? `${(todayEntry?.water || 0).toFixed(1)} / ${state.goals.water.toFixed(1)} L`
    : "Nessun obiettivo";

  goalWeightBar.style.width = `${weightProgress}%`;
  goalCaloriesBar.style.width = `${caloriesProgress}%`;
  goalWaterBar.style.width = `${waterProgress}%`;
}

function renderStreak() {
  const dates = state.entries.map((entry) => entry.date).sort((a, b) => b.localeCompare(a));
  let streak = 0;
  let cursor = new Date();

  while (dates.includes(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  streakValue.textContent = streak;
  habitDots.innerHTML = Array.from({ length: 7 }, (_, index) => {
    const active = index < Math.min(streak, 7) ? "is-active" : "";
    return `<span class="${active}"></span>`;
  }).join("");
  quoteCard.textContent = `"${QUOTES[streak % QUOTES.length]}"`;
}

function renderChart() {
  const ctx = chartCanvas.getContext("2d");
  const { width, height } = chartCanvas;
  ctx.clearRect(0, 0, width, height);

  roundRect(ctx, 0, 0, width, height, 24);
  ctx.fillStyle = "#fffdf8";
  ctx.fill();

  const points = state.entries.filter((entry) => entry.weight).slice(-7);
  if (points.length < 2) {
    ctx.fillStyle = "#6c796d";
    ctx.font = "600 18px Manrope";
    ctx.textAlign = "center";
    ctx.fillText("Aggiungi almeno due pesate per vedere il trend.", width / 2, height / 2);
    return;
  }

  const pad = { top: 32, right: 28, bottom: 44, left: 44 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const values = points.map((entry) => entry.weight);
  const min = Math.min(...values) - 0.4;
  const max = Math.max(...values) + 0.4;

  ctx.strokeStyle = "rgba(108, 121, 109, 0.12)";
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i += 1) {
    const y = pad.top + (chartHeight / 3) * i;
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  ctx.beginPath();
  points.forEach((point, index) => {
    const x = pad.left + (chartWidth / (points.length - 1)) * index;
    const y = pad.top + ((max - point.weight) / (max - min || 1)) * chartHeight;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = "#87b493";
  ctx.lineWidth = 4;
  ctx.stroke();

  points.forEach((point, index) => {
    const x = pad.left + (chartWidth / (points.length - 1)) * index;
    const y = pad.top + ((max - point.weight) / (max - min || 1)) * chartHeight;

    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#648b71";
    ctx.stroke();

    ctx.fillStyle = "#233127";
    ctx.font = "600 12px Manrope";
    ctx.textAlign = "center";
    ctx.fillText(point.weight.toFixed(1), x, y - 14);
  });
}

function buildInsightCard(level, title, copy) {
  return `
    <article class="insight-pill insight-pill--${level}">
      <div class="indicator"></div>
      <div>
        <h3>${title}</h3>
        <p>${copy}</p>
      </div>
    </article>
  `;
}

function calculatePercent(current, target) {
  if (!target) return 0;
  return Math.max(0, Math.min(100, (current / target) * 100));
}

function calculateWeightProgress(start, current, goal) {
  if (!start || !current || !goal || start <= goal) {
    return 0;
  }
  const total = start - goal;
  const completed = start - current;
  return Math.max(0, Math.min(100, (completed / total) * 100));
}

function getTodayEntry() {
  return state.entries.find((entry) => entry.date === todayKey);
}

function getLatestWeight() {
  const last = [...state.entries].reverse().find((entry) => entry.weight);
  return last?.weight || 0;
}

function parseIngredients(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function generateLocalRecipes(ingredients, goal) {
  const unique = [...new Set(ingredients)];
  const anchor = unique.slice(0, 5);

  return [
    buildLocalRecipe(anchor, goal, "Bowl nutriente", [
      "Cuoci l’ingrediente base finché è morbido.",
      "Scalda insieme la fonte proteica e le verdure con un condimento semplice.",
      "Assembla tutto in una bowl e completa con erbe o olio se disponibili.",
    ]),
    buildLocalRecipe(anchor.slice().reverse(), goal, "Padella salva-dispensa", [
      "Taglia gli ingredienti in pezzi piccoli e uniformi.",
      "Cuoci prima quelli più densi, poi aggiungi i più delicati.",
      "Servi caldo come piatto unico rapido.",
    ]),
    buildLocalRecipe([...anchor.slice(1), anchor[0]].filter(Boolean), goal, "Piatto proteico veloce", [
      "Prepara la fonte proteica e gli eventuali cereali o legumi.",
      "Aggiungi una parte vegetale per dare equilibrio al piatto.",
      "Impiatta tutto insieme e condisci in modo leggero.",
    ]),
  ];
}

function buildLocalRecipe(ingredients, goal, baseName, steps) {
  const matched = ingredients.filter((ingredient) => INGREDIENT_LIBRARY[ingredient]);
  const usable = matched.length ? matched : ["uova", "riso", "spinaci"];
  const totals = usable.reduce(
    (accumulator, ingredient) => {
      const factor = ingredient === "olio d'oliva" ? 0.12 : ingredient === "avena" ? 0.45 : 1.4;
      const nutrition = INGREDIENT_LIBRARY[ingredient];
      accumulator.calories += nutrition.calories * factor;
      accumulator.protein += nutrition.protein * factor;
      accumulator.carbs += nutrition.carbs * factor;
      accumulator.fat += nutrition.fat * factor;
      return accumulator;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const suffix =
    goal === "high-protein"
      ? "Alta in proteine"
      : goal === "light"
        ? "Leggera"
        : goal === "comfort"
          ? "Comfort"
          : "Bilanciata";

  return {
    name: `${suffix} ${baseName}`,
    style:
      goal === "high-protein"
        ? "alta in proteine"
        : goal === "light"
          ? "leggera"
          : goal === "comfort"
            ? "comfort"
            : "bilanciata",
    summary: `Una proposta pratica costruita con ${usable.join(", ")}.`,
    ingredients: usable,
    steps,
    calories: goal === "light" ? totals.calories * 0.84 : totals.calories,
    protein: goal === "high-protein" ? totals.protein * 1.16 : totals.protein,
    carbs: goal === "light" ? totals.carbs * 0.82 : totals.carbs,
    fat: goal === "comfort" ? totals.fat * 1.12 : totals.fat,
  };
}

function setupRevealAnimations() {
  const items = document.querySelectorAll(".reveal, .footer");
  items.forEach((item) => {
    const rect = item.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.92) {
      item.classList.add("is-visible");
    }
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
        }
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  items.forEach((item) => observer.observe(item));
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}
