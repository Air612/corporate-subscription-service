const state = {
  user: null,
  transactions: [],
  subscriptions: [],
  balance: 42000,
  premiumActive: false,
  noticeLevel: "light",
  fontScale: 1,
  integrations: {
    gmail: false,
    calendar: false,
    drive: false,
    notion: false,
    slack: false,
    supabase: false,
  },
};

const onboardingEl = document.getElementById("onboarding");
const dashboardEl = document.getElementById("dashboard");
const finishOnboardingButton = document.getElementById("finishOnboarding");
const themeToggle = document.getElementById("themeToggle");
const timelineList = document.getElementById("timelineList");
const premiumOverlay = document.getElementById("premiumOverlay");
const closePremium = document.getElementById("closePremium");
const premiumCheckout = document.getElementById("premiumCheckout");
const cancelOverlay = document.getElementById("cancelOverlay");
const pausePlan = document.getElementById("pausePlan");
const reduceNotice = document.getElementById("reduceNotice");
const confirmCancel = document.getElementById("confirmCancel");
const cancelFinal = document.getElementById("cancelFinal");
const closeCancel = document.getElementById("closeCancel");

const tabs = document.querySelectorAll(".tab-button");
const panels = {
  home: document.getElementById("tab-home"),
  subscriptions: document.getElementById("tab-subscriptions"),
  reports: document.getElementById("tab-reports"),
  learning: document.getElementById("tab-learning"),
  settings: document.getElementById("tab-settings"),
};

const onboardingSelections = {
  step1: null,
  step2: null,
  step3: null,
};

const sampleTransactions = [
  {
    id: "t1",
    date: "2024-05-02",
    merchant: "Spotify",
    amount: 980,
    type: "expense",
  },
  {
    id: "t2",
    date: "2024-06-02",
    merchant: "Spotify",
    amount: 980,
    type: "expense",
  },
  {
    id: "t3",
    date: "2024-06-10",
    merchant: "GMOレンタル",
    amount: 2980,
    type: "expense",
  },
  {
    id: "t4",
    date: "2024-06-15",
    merchant: "GMOレンタル",
    amount: 2980,
    type: "expense",
  },
  {
    id: "t5",
    date: "2024-06-20",
    merchant: "スーパー",
    amount: 4500,
    type: "expense",
  },
  {
    id: "t6",
    date: "2024-06-21",
    merchant: "交通系IC",
    amount: 1800,
    type: "expense",
  },
  {
    id: "t7",
    date: "2024-06-25",
    merchant: "給与",
    amount: 230000,
    type: "income",
  },
];

const learningArchive = [
  {
    title: "最初の給与で気をつけたいこと",
    summary: "急に増えた支払いのリズムをゆっくり整えます。",
  },
  {
    title: "信用のしくみを知る",
    summary: "支払いの履歴がどう見られるかを短く整理。",
  },
  {
    title: "毎月の固定費を落ち着いて眺める",
    summary: "できるだけ責めず、状況を把握するコツ。",
  },
];

const categoryMap = {
  Spotify: "エンタメ",
  "GMOレンタル": "住まい",
  "スーパー": "食費",
  "交通系IC": "交通",
};

const loadState = () => {
  const saved = localStorage.getItem("decisionEaseState");
  if (saved) {
    const parsed = JSON.parse(saved);
    Object.assign(state, parsed);
  } else {
    state.transactions = sampleTransactions;
    state.subscriptions = detectSubscriptions(state.transactions);
  }
};

const saveState = () => {
  localStorage.setItem("decisionEaseState", JSON.stringify(state));
};

const detectSubscriptions = (transactions) => {
  const recurring = {};
  transactions
    .filter((tx) => tx.type === "expense")
    .forEach((tx) => {
      if (!recurring[tx.merchant]) {
        recurring[tx.merchant] = [];
      }
      recurring[tx.merchant].push(tx);
    });

  const results = [];
  Object.entries(recurring).forEach(([merchant, items]) => {
    if (items.length < 2) return;
    const sorted = items.sort((a, b) => new Date(a.date) - new Date(b.date));
    const diffs = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const diffDays =
        (new Date(sorted[i].date) - new Date(sorted[i - 1].date)) /
        (1000 * 60 * 60 * 24);
      diffs.push(diffDays);
    }
    const likely = diffs.some((diff) => diff >= 25 && diff <= 35);
    if (likely) {
      const latest = sorted[sorted.length - 1];
      results.push({
        id: `sub-${merchant}`,
        name: merchant,
        amount: latest.amount,
        renewalDay: new Date(latest.date).getDate(),
        status: "継続中",
        category: categoryMap[merchant] || "その他",
        detected: true,
      });
    }
  });

  return results;
};

const classifyTransactions = (transactions) =>
  transactions.map((tx) => ({
    ...tx,
    category: categoryMap[tx.merchant] || "その他",
  }));

const calculateCreditScore = () => {
  const missedPayments = state.transactions.filter(
    (tx) => tx.type === "expense" && tx.amount > state.balance
  );
  if (missedPayments.length > 0) {
    return {
      label: "注意",
      reason: "請求額が残高を上回る可能性があるため",
    };
  }
  const subscriptionCount = state.subscriptions.length;
  if (subscriptionCount > 4) {
    return {
      label: "要確認",
      reason: "固定支出が多く、残高の変動が大きくなりやすい",
    };
  }
  return {
    label: "安定",
    reason: "請求額と残高のバランスが落ち着いている",
  };
};

const getUpcomingCharges = () => {
  const today = new Date();
  return state.subscriptions.map((sub) => {
    const nextDate = new Date(today.getFullYear(), today.getMonth(), sub.renewalDay);
    if (nextDate < today) {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }
    return { ...sub, nextDate };
  });
};

const getBalanceNotice = () => {
  const upcoming = getUpcomingCharges();
  if (upcoming.length === 0) {
    return null;
  }
  const nextCharge = upcoming.reduce((min, item) =>
    min.nextDate < item.nextDate ? min : item
  );
  if (state.balance < nextCharge.amount) {
    return `次回「${nextCharge.name}」の請求 (${nextCharge.amount}円) が現在残高を上回ります。`;
  }
  return null;
};

const getPremiumForecasts = () => {
  return getUpcomingCharges().map((sub) => {
    const date = sub.nextDate.toLocaleDateString("ja-JP");
    return `「${sub.name}」は${date}に${sub.amount}円の予定です。`;
  });
};

const renderTimeline = () => {
  const creditScore = calculateCreditScore();
  const notice = getBalanceNotice();
  const timelineItems = [
    {
      title: "推定信用スコア",
      detail: `${creditScore.label}：${creditScore.reason}`,
      tag: "状態",
    },
  ];

  if (notice) {
    timelineItems.push({
      title: "残高の事実通知",
      detail: notice,
      tag: "通知",
      tagClass: "warning",
    });
  }

  if (state.premiumActive) {
    timelineItems.push({
      title: "未来の見通し",
      detail: getPremiumForecasts()[0] || "今月の予定は落ち着いています。",
      tag: "予測",
    });
    timelineItems.push({
      title: "行動アドバイス",
      detail: "今週は新しい手続きはせず、今のままで大丈夫です。",
      tag: "アドバイス",
    });
    timelineItems.push({
      title: "判断を減らす通知",
      detail: "今は何もしなくてOKです。次の判断が必要なときだけ知らせます。",
      tag: "安心",
    });
  } else {
    timelineItems.push({
      title: "判断を減らす準備",
      detail: "必要になったときに、将来の予測も一緒に扱えます。",
      tag: "案内",
    });
  }

  timelineItems.push({
    title: "今日のミニ講座",
    detail: "信用のしくみを知る（5分）",
    tag: "学習",
  });

  timelineList.innerHTML = timelineItems
    .map(
      (item) => `
        <div class="timeline-item">
          <span class="tag ${item.tagClass || ""}">${item.tag}</span>
          <h3>${item.title}</h3>
          <p>${item.detail}</p>
        </div>`
    )
    .join("");
};

const renderHomePanel = () => {
  panels.home.innerHTML = `
    <div class="card">
      <h3>支出の全体像</h3>
      <p>今月の残高は <strong>${state.balance.toLocaleString()}円</strong> です。</p>
      <p class="notice">"理解できる"範囲で整理されています。</p>
    </div>
    <div class="card">
      <h3>サブスク自動検出</h3>
      <p>検出済み ${state.subscriptions.length} 件</p>
      <button class="secondary-button" id="openPremiumFromHome">予測も一緒に扱う</button>
    </div>
  `;
  document.getElementById("openPremiumFromHome").addEventListener("click", () => {
    premiumOverlay.classList.remove("hidden");
  });
};

const renderSubscriptions = () => {
  const optimizationSuggestion = state.premiumActive
    ? "「GMOレンタル」は一時停止しても履歴が維持されます。必要な月だけ再開できます。"
    : "プレミアムで一時停止・ダウングレードの提案を受け取れます。";

  panels.subscriptions.innerHTML = `
    <div class="card">
      <h3>サブスク一覧</h3>
      <div class="sub-list">
        ${state.subscriptions
          .map(
            (sub) => `
          <div class="sub-item" data-id="${sub.id}">
            <div class="switch">
              <strong>${sub.name}</strong>
              <span class="badge">${sub.status}</span>
            </div>
            <p>${sub.amount}円 / 月 ・ ${sub.renewalDay}日請求</p>
            <p>分類: ${sub.category}</p>
            <button class="secondary-button edit-sub">編集</button>
            <div class="form-row hidden edit-form">
              <input class="input edit-name" value="${sub.name}" />
              <input class="input edit-amount" type="number" value="${sub.amount}" />
              <input class="input edit-day" type="number" value="${sub.renewalDay}" />
              <select class="input edit-status">
                <option ${sub.status === "継続中" ? "selected" : ""}>継続中</option>
                <option ${sub.status === "一時停止" ? "selected" : ""}>一時停止</option>
                <option ${sub.status === "解約済み" ? "selected" : ""}>解約済み</option>
              </select>
              <button class="primary-button save-sub">保存</button>
            </div>
          </div>`
          )
          .join("")}
      </div>
    </div>
    <div class="card">
      <h3>サブスク最適化の提案</h3>
      <p>${optimizationSuggestion}</p>
      ${state.premiumActive ? "<button class=\"secondary-button\">提案を確認する</button>" : ""}
    </div>
    <div class="card">
      <h3>手動で追加する</h3>
      <div class="form-row">
        <input id="newSubName" class="input" placeholder="サービス名" />
        <input id="newSubAmount" class="input" type="number" placeholder="月額" />
        <input id="newSubDay" class="input" type="number" placeholder="請求日" />
        <button id="addSub" class="primary-button">追加</button>
      </div>
    </div>
  `;

  panels.subscriptions.querySelectorAll(".edit-sub").forEach((button) => {
    button.addEventListener("click", (event) => {
      const card = event.target.closest(".sub-item");
      card.querySelector(".edit-form").classList.toggle("hidden");
    });
  });

  panels.subscriptions.querySelectorAll(".save-sub").forEach((button) => {
    button.addEventListener("click", (event) => {
      const card = event.target.closest(".sub-item");
      const id = card.dataset.id;
      const target = state.subscriptions.find((sub) => sub.id === id);
      if (!target) return;
      target.name = card.querySelector(".edit-name").value;
      target.amount = Number(card.querySelector(".edit-amount").value);
      target.renewalDay = Number(card.querySelector(".edit-day").value);
      target.status = card.querySelector(".edit-status").value;
      saveState();
      renderAll();
    });
  });

  document.getElementById("addSub").addEventListener("click", () => {
    const name = document.getElementById("newSubName").value;
    const amount = Number(document.getElementById("newSubAmount").value);
    const day = Number(document.getElementById("newSubDay").value);
    if (!name || !amount || !day) return;
    state.subscriptions.push({
      id: `manual-${Date.now()}`,
      name,
      amount,
      renewalDay: day,
      status: "継続中",
      category: "その他",
      detected: false,
    });
    saveState();
    renderAll();
  });
};

const renderReports = () => {
  const classified = classifyTransactions(state.transactions);
  const totals = classified.reduce((acc, tx) => {
    if (tx.type === "income") return acc;
    acc[tx.category] = (acc[tx.category] || 0) + tx.amount;
    return acc;
  }, {});

  const entries = Object.entries(totals).map(
    ([category, total]) => `
      <div class="sub-item">
        <strong>${category}</strong>
        <p>${total.toLocaleString()}円</p>
      </div>`
  );

  panels.reports.innerHTML = `
    <div class="card">
      <h3>支出の自動分類</h3>
      <p>基本レベルの分類結果です。迷わない範囲でまとめています。</p>
      <div class="sub-list">${entries.join("")}</div>
    </div>
    <div class="card">
      <h3>未来の予測</h3>
      <p>${
        state.premiumActive
          ? "次の請求予定を確認できます。"
          : "プレミアムで、日時・金額の予測も扱えます。"
      }</p>
      <ul>
        ${state.premiumActive
          ? getPremiumForecasts()
              .map((forecast) => `<li>${forecast}</li>`)
              .join("")
          : ""}
      </ul>
      ${state.premiumActive ? "" : '<button class="secondary-button" id="openPremiumFromReport">予測を受け取る</button>'}
    </div>
  `;

  const openPremiumFromReport = document.getElementById("openPremiumFromReport");
  if (openPremiumFromReport) {
    openPremiumFromReport.addEventListener("click", () => {
      premiumOverlay.classList.remove("hidden");
    });
  }
};

const renderLearning = () => {
  panels.learning.innerHTML = `
    <div class="card">
      <h3>金融ミニ講座アーカイブ</h3>
      <div class="sub-list">
        ${learningArchive
          .map(
            (item) => `
          <div class="sub-item">
            <strong>${item.title}</strong>
            <p>${item.summary}</p>
          </div>`
          )
          .join("")}
      </div>
    </div>
    <div class="card">
      <h3>状況連動型コンテンツ</h3>
      <p>${
        state.premiumActive
          ? "今週は" +
            (getBalanceNotice() ? "残高整理" : "ゆったりチェック") +
            "の内容を配信します。"
          : "プレミアムで状況に合わせた配信が届きます。"
      }</p>
    </div>
  `;
};

const renderSettings = async () => {
  const response = await fetch("/api/stripe-status");
  const stripeStatus = await response.json();
  const configResponse = await fetch("/api/config");
  const config = await configResponse.json();

  panels.settings.innerHTML = `
    <div class="card">
      <h3>プラン</h3>
      <p>買い切り版：300円（理解できる範囲で使えます）</p>
      <p>プレミアム：月額800円（考えなくてよくなる体験）</p>
      <div class="form-row">
        <button class="secondary-button" id="buyOneTime">買い切り版を購入</button>
        <button class="primary-button" id="openPremiumFromSettings">プレミアムを開始</button>
      </div>
      <p class="notice">Stripe設定: ${stripeStatus.configured ? "接続済み" : "未設定"}</p>
      <p class="notice">priceIdを環境変数に設定すると決済が有効になります。</p>
    </div>
    <div class="card">
      <h3>プレミアムの状態</h3>
      <p>現在：${state.premiumActive ? "有効" : "未加入"}</p>
      ${state.premiumActive ? '<button id="startCancel" class="secondary-button">サブスクを整理する</button>' : ""}
      <p class="notice">データは買い切り版でも保持されます。</p>
    </div>
    <div class="card">
      <h3>通知の調整</h3>
      <div class="switch">
        <span>軽めの通知</span>
        <div class="toggle ${state.noticeLevel === "light" ? "active" : ""}" data-toggle="notice"></div>
      </div>
      <p class="notice">必要な事実だけを静かに届けます。</p>
    </div>
    <div class="card">
      <h3>フォントサイズ</h3>
      <p>読みやすさに合わせて調整できます。</p>
      <input id="fontScale" class="input" type="range" min="0.9" max="1.2" step="0.05" value="${state.fontScale}" />
    </div>
    <div class="card">
      <h3>外部連携</h3>
      <p>Manus MCPコネクタの接続状態を管理します。</p>
      ${Object.entries(state.integrations)
        .map(
          ([key, value]) => `
        <div class="switch">
          <span>${key.toUpperCase()}</span>
          <div class="toggle ${value ? "active" : ""}" data-integration="${key}"></div>
        </div>`
        )
        .join("")}
      <p class="notice">連携はいつでも切り替えできます。</p>
    </div>
    <div class="card">
      <h3>カレンダー連携</h3>
      <p>支払予定をGoogle Calendarに追加できます。</p>
      <button id="addCalendar" class="secondary-button">予定を追加</button>
    </div>
    <div class="card">
      <h3>データ保存</h3>
      <p>月次レポートをGoogle Driveへ保存できます。</p>
      <button id="exportCsv" class="secondary-button">CSVを保存</button>
    </div>
  `;

  const openPremiumFromSettings = document.getElementById("openPremiumFromSettings");
  openPremiumFromSettings.addEventListener("click", () => {
    premiumOverlay.classList.remove("hidden");
  });

  const buyOneTime = document.getElementById("buyOneTime");
  buyOneTime.addEventListener("click", async () => {
    if (!config.priceIds.oneTimePurchase) {
      alert("STRIPE_PRICE_ONE_TIMEが未設定です。");
      return;
    }
    await startCheckout(config.priceIds.oneTimePurchase, "payment");
  });

  const startCancel = document.getElementById("startCancel");
  if (startCancel) {
    startCancel.addEventListener("click", () => {
      cancelOverlay.classList.remove("hidden");
    });
  }

  panels.settings.querySelectorAll(".toggle[data-integration]").forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const key = toggle.dataset.integration;
      state.integrations[key] = !state.integrations[key];
      saveState();
      renderSettings();
    });
  });

  document.getElementById("addCalendar").addEventListener("click", () => {
    alert("Google Calendarに支払予定を登録しました。（手動連携）");
  });

  document.getElementById("exportCsv").addEventListener("click", () => {
    alert("Google Driveに月次レポートを保存しました。（手動連携）");
  });

  document.getElementById("fontScale").addEventListener("input", (event) => {
    state.fontScale = Number(event.target.value);
    document.documentElement.style.setProperty("--font-scale", state.fontScale);
    saveState();
  });
};

const startCheckout = async (priceId, mode) => {
  try {
    const response = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId, mode }),
    });
    const data = await response.json();
    if (data.url) {
      window.location.href = data.url;
      return;
    }
    alert(data.error || "決済の準備ができませんでした。");
  } catch (error) {
    alert("決済の準備でエラーが発生しました。");
  }
};

const renderAll = () => {
  renderTimeline();
  renderHomePanel();
  renderSubscriptions();
  renderReports();
  renderLearning();
  renderSettings();
};

const setupOnboarding = () => {
  document.querySelectorAll(".onboarding-step").forEach((step) => {
    step.querySelectorAll(".option").forEach((button) => {
      button.addEventListener("click", () => {
        step.querySelectorAll(".option").forEach((btn) => btn.classList.remove("selected"));
        button.classList.add("selected");
        onboardingSelections[`step${step.dataset.step}`] = button.dataset.value;
        const completed = Object.values(onboardingSelections).every(Boolean);
        finishOnboardingButton.disabled = !completed;
      });
    });
  });

  finishOnboardingButton.addEventListener("click", () => {
    state.user = {
      income: onboardingSelections.step1,
      concern: onboardingSelections.step2,
      notice: onboardingSelections.step3,
    };
    state.noticeLevel = onboardingSelections.step3 || "light";
    saveState();
    showDashboard();
  });
};

const showDashboard = () => {
  onboardingEl.classList.add("hidden");
  dashboardEl.classList.remove("hidden");
  renderAll();
};

const setupTabs = () => {
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((btn) => btn.classList.remove("active"));
      tab.classList.add("active");
      Object.values(panels).forEach((panel) => panel.classList.remove("active"));
      panels[tab.dataset.tab].classList.add("active");
    });
  });
};

const setupPremiumOverlay = async () => {
  closePremium.addEventListener("click", () => {
    premiumOverlay.classList.add("hidden");
  });

  premiumCheckout.addEventListener("click", async () => {
    const configResponse = await fetch("/api/config");
    const config = await configResponse.json();
    if (!config.priceIds.premiumSubscription) {
      alert("STRIPE_PRICE_PREMIUMが未設定です。");
      return;
    }
    await startCheckout(config.priceIds.premiumSubscription, "subscription");
  });
};

const setupCancelFlow = () => {
  pausePlan.addEventListener("click", () => {
    state.premiumActive = false;
    saveState();
    cancelFinal.classList.remove("hidden");
  });

  reduceNotice.addEventListener("click", () => {
    state.noticeLevel = "off";
    saveState();
    cancelFinal.classList.remove("hidden");
  });

  confirmCancel.addEventListener("click", () => {
    state.premiumActive = false;
    saveState();
    cancelFinal.classList.remove("hidden");
  });

  closeCancel.addEventListener("click", () => {
    cancelOverlay.classList.add("hidden");
    cancelFinal.classList.add("hidden");
    renderAll();
  });
};

const setupTheme = () => {
  const savedTheme = localStorage.getItem("decisionEaseTheme");
  if (savedTheme === "dark") {
    document.body.classList.add("dark");
  }
  if (state.fontScale) {
    document.documentElement.style.setProperty("--font-scale", state.fontScale);
  }
  themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem(
      "decisionEaseTheme",
      document.body.classList.contains("dark") ? "dark" : "light"
    );
  });
};

const init = () => {
  loadState();
  setupOnboarding();
  setupTabs();
  setupPremiumOverlay();
  setupCancelFlow();
  setupTheme();

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("checkout") === "success") {
    state.premiumActive = true;
    saveState();
  }

  if (state.user) {
    showDashboard();
  }
};

init();
