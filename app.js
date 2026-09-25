import { auth, provider, db } from "./firebase-config.js";

import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

import {
  collection,
  query,
  onSnapshot,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  getDocs,
  writeBatch,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js";

/* ========================================
   DOM
======================================== */

const scheduleList = document.getElementById("scheduleList");
const emptyState = document.getElementById("emptyState");
const emptyStateTitle = emptyState.querySelector("h3");
const emptyStateText = emptyState.querySelector("p");
const resultCount = document.getElementById("resultCount");

const totalCount = document.getElementById("totalCount");
const monthlyCount = document.getElementById("monthlyCount");
const joinedCount = document.getElementById("joinedCount");
const nextGameContent = document.getElementById("nextGameContent");

const searchInput = document.getElementById("searchInput");
const areaFilter = document.getElementById("areaFilter");
const statusFilter = document.getElementById("statusFilter");
const sortSelect = document.getElementById("sortSelect");
const dateTabs = document.querySelectorAll(".date-tab");

const scheduleDialog = document.getElementById("scheduleDialog");
const scheduleForm = document.getElementById("scheduleForm");
const formTitle = document.getElementById("formTitle");
const formError = document.getElementById("formError");
const saveButton = scheduleForm.querySelector(".save-button");

const scheduleId = document.getElementById("scheduleId");
const eventName = document.getElementById("eventName");
const eventDate = document.getElementById("eventDate");
const eventArea = document.getElementById("eventArea");
const startTime = document.getElementById("startTime");
const endTime = document.getElementById("endTime");
const eventPlace = document.getElementById("eventPlace");
const eventPrice = document.getElementById("eventPrice");
const eventStatus = document.getElementById("eventStatus");
const eventMemo = document.getElementById("eventMemo");

const openFormButton = document.getElementById("openFormButton");
const heroAddButton = document.getElementById("heroAddButton");
const emptyAddButton = document.getElementById("emptyAddButton");
const closeFormButton = document.getElementById("closeFormButton");
const cancelFormButton = document.getElementById("cancelFormButton");

const deleteDialog = document.getElementById("deleteDialog");
const cancelDeleteButton = document.getElementById("cancelDeleteButton");
const confirmDeleteButton = document.getElementById("confirmDeleteButton");

const clearSampleButton = document.getElementById("clearSampleButton");

const themeButton = document.getElementById("themeButton");
const themeIcon = document.getElementById("themeIcon");

const toast = document.getElementById("toast");
const toastMessage = document.getElementById("toastMessage");
const toastIcon = document.getElementById("toastIcon");

const authLoading = document.getElementById("authLoading");
const loginView = document.getElementById("loginView");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");

const userMenu = document.getElementById("userMenu");
const userPhoto = document.getElementById("userPhoto");
const userName = document.getElementById("userName");
const logoutButton = document.getElementById("logoutButton");

const appContent = document.getElementById("appContent");

/* ========================================
   アプリの状態
======================================== */

const STORAGE_KEY = "hoopFinderSchedulesV2";
const THEME_KEY = "hoopFinderTheme";
const MIGRATION_KEY_PREFIX = "hoopFinderMigrationDone:";

let selectedDateFilter = "upcoming";
let deleteTargetId = null;
let toastTimer = null;
let currentUser = null;
let schedules = [];
let unsubscribeSchedules = null;

openFormButton.hidden = true;

/* ========================================
   日付関係
======================================== */

function getDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getRelativeDate(days) {
  const date = new Date();

  date.setDate(date.getDate() + days);

  return getDateKey(date);
}

function parseDate(dateString) {
  return new Date(`${dateString}T00:00:00`);
}

function formatDate(dateString) {
  const date = parseDate(dateString);

  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function getMonthAndDay(dateString) {
  const date = parseDate(dateString);

  return {
    month: `${date.getMonth() + 1}月`,
    day: date.getDate(),
    weekday: new Intl.DateTimeFormat("ja-JP", {
      weekday: "short",
    }).format(date),
  };
}

function getDateTime(schedule) {
  return new Date(`${schedule.date}T${schedule.startTime}:00`);
}

function isPastSchedule(schedule) {
  return schedule.date < getDateKey(new Date());
}

/* ========================================
   入力内容を安全に表示
======================================== */

function escapeHTML(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* ========================================
   表示状態
======================================== */

function resetEmptyStateText() {
  emptyStateTitle.textContent = "予定が見つかりませんでした";
  emptyStateText.textContent =
    "検索条件を変更するか、新しい予定を追加してください。";
}

function showScheduleLoading() {
  resultCount.textContent = "予定を同期しています...";

  scheduleList.hidden = false;
  emptyState.hidden = true;

  scheduleList.innerHTML = "";

  const message = document.createElement("p");

  message.className = "next-game-empty";
  message.textContent = "Firestoreから予定を読み込んでいます...";

  scheduleList.appendChild(message);

  totalCount.textContent = "0";
  monthlyCount.textContent = "0";
  joinedCount.textContent = "0";

  nextGameContent.innerHTML =
    '<p class="next-game-empty">次の予定を確認しています...</p>';
}

function showScheduleError() {
  schedules = [];

  scheduleList.innerHTML = "";
  scheduleList.hidden = true;

  emptyState.hidden = false;

  emptyStateTitle.textContent = "予定を読み込めませんでした";
  emptyStateText.textContent =
    "通信状態を確認して、ページを再読み込みしてください。";

  resultCount.textContent = "読み込みエラー";

  totalCount.textContent = "0";
  monthlyCount.textContent = "0";
  joinedCount.textContent = "0";

  nextGameContent.innerHTML =
    '<p class="next-game-empty">予定を読み込めませんでした。</p>';
}

/* ========================================
   予定を絞り込む
======================================== */

function getFilteredSchedules() {
  const today = getDateKey(new Date());

  const tomorrowDate = new Date();

  tomorrowDate.setDate(tomorrowDate.getDate() + 1);

  const tomorrow = getDateKey(tomorrowDate);

  const keyword = searchInput.value.trim().toLowerCase();
  const selectedArea = areaFilter.value;
  const selectedStatus = statusFilter.value;

  const filteredSchedules = schedules.filter((schedule) => {
    if (
      selectedDateFilter === "upcoming" &&
      schedule.date < today
    ) {
      return false;
    }

    if (
      selectedDateFilter === "today" &&
      schedule.date !== today
    ) {
      return false;
    }

    if (
      selectedDateFilter === "tomorrow" &&
      schedule.date !== tomorrow
    ) {
      return false;
    }

    if (
      selectedDateFilter === "joined" &&
      (!schedule.joined || schedule.date < today)
    ) {
      return false;
    }

    if (
      selectedDateFilter === "past" &&
      schedule.date >= today
    ) {
      return false;
    }

    if (
      selectedArea !== "all" &&
      schedule.area !== selectedArea
    ) {
      return false;
    }

    if (
      selectedStatus !== "all" &&
      schedule.status !== selectedStatus
    ) {
      return false;
    }

    const searchableText = `
      ${schedule.name ?? ""}
      ${schedule.place ?? ""}
      ${schedule.area ?? ""}
      ${schedule.memo ?? ""}
    `.toLowerCase();

    if (
      keyword &&
      !searchableText.includes(keyword)
    ) {
      return false;
    }

    return true;
  });

  filteredSchedules.sort((firstSchedule, secondSchedule) => {
    if (sortSelect.value === "dateDesc") {
      return (
        getDateTime(secondSchedule) -
        getDateTime(firstSchedule)
      );
    }

    if (sortSelect.value === "priceAsc") {
      return (
        Number(firstSchedule.price) -
        Number(secondSchedule.price)
      );
    }

    return (
      getDateTime(firstSchedule) -
      getDateTime(secondSchedule)
    );
  });

  return filteredSchedules;
}

/* ========================================
   募集状況のCSSクラス
======================================== */

function getStatusClass(status) {
  if (status === "募集中") {
    return "status-open";
  }

  if (status === "残りわずか") {
    return "status-few";
  }

  return "status-closed";
}

/* ========================================
   予定カードを作成
======================================== */

function createScheduleCard(schedule, index) {
  const dateInformation = getMonthAndDay(schedule.date);
  const past = isPastSchedule(schedule);

  const card = document.createElement("article");

  card.className = "schedule-card";

  card.style.animationDelay = `${Math.min(
    index * 0.05,
    0.3
  )}s`;

  if (schedule.joined) {
    card.classList.add("is-joined");
  }

  if (past) {
    card.classList.add("is-past");
  }

  let joinButtonText = "参加する";
  let joinButtonClass = "join-button";
  let joinButtonDisabled = "";

  if (schedule.joined) {
    joinButtonText = "✓ 参加予定";
    joinButtonClass += " joined";
  }

  if (past) {
    joinButtonText = "終了";
    joinButtonDisabled = "disabled";
  } else if (
    schedule.status === "締切" &&
    !schedule.joined
  ) {
    joinButtonText = "締切";
    joinButtonDisabled = "disabled";
  }

  const sampleBadge = schedule.isSample
    ? '<span class="sample-badge">SAMPLE</span>'
    : "";

  const memoText = schedule.memo
    ? `<p class="schedule-memo">${escapeHTML(
      schedule.memo
    )}</p>`
    : '<p class="schedule-memo">メモはありません。</p>';

  card.innerHTML = `
    <div class="schedule-date">
      <span>${escapeHTML(dateInformation.month)}</span>
      <strong>${dateInformation.day}</strong>
      <span>${escapeHTML(dateInformation.weekday)}</span>
    </div>

    <div class="schedule-main">
      <div class="schedule-title-row">
        <h3>${escapeHTML(schedule.name)}</h3>
        ${sampleBadge}
      </div>

      <div class="schedule-meta">
        <span>
          🕐 ${escapeHTML(
    schedule.startTime
  )}〜${escapeHTML(schedule.endTime)}
        </span>

        <span>
          📍 ${escapeHTML(schedule.place)}
        </span>

        <span>
          💴 ${Number(
    schedule.price
  ).toLocaleString("ja-JP")}円
        </span>
      </div>

      ${memoText}
    </div>

    <div class="schedule-side">
      <span class="status-badge ${getStatusClass(
    schedule.status
  )}">
        ${escapeHTML(schedule.status)}
      </span>

      <div class="card-buttons">
        <button
          class="${joinButtonClass}"
          type="button"
          data-action="join"
          data-id="${schedule.id}"
          ${joinButtonDisabled}
        >
          ${joinButtonText}
        </button>

        <button
          class="edit-button"
          type="button"
          data-action="edit"
          data-id="${schedule.id}"
          aria-label="${escapeHTML(
    schedule.name
  )}を編集"
          title="編集"
        >
          ✎
        </button>

        <button
          class="delete-button"
          type="button"
          data-action="delete"
          data-id="${schedule.id}"
          aria-label="${escapeHTML(
    schedule.name
  )}を削除"
          title="削除"
        >
          ×
        </button>
      </div>
    </div>
  `;

  return card;
}

/* ========================================
   予定一覧を表示
======================================== */

function renderSchedules() {
  resetEmptyStateText();

  const filteredSchedules =
    getFilteredSchedules();

  scheduleList.innerHTML = "";

  resultCount.textContent =
    `${filteredSchedules.length}件の予定`;

  if (filteredSchedules.length === 0) {
    scheduleList.hidden = true;
    emptyState.hidden = false;
  } else {
    scheduleList.hidden = false;
    emptyState.hidden = true;

    filteredSchedules.forEach(
      (schedule, index) => {
        const card = createScheduleCard(
          schedule,
          index
        );

        scheduleList.appendChild(card);
      }
    );
  }

  updateDashboard();
}

/* ========================================
   集計を更新
======================================== */

function updateDashboard() {
  const now = new Date();

  const today = getDateKey(now);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const futureSchedules =
    schedules.filter(
      (schedule) =>
        schedule.date >= today
    );

  const thisMonthSchedules =
    schedules.filter((schedule) => {
      const scheduleDate =
        parseDate(schedule.date);

      return (
        scheduleDate.getFullYear() ===
        currentYear &&
        scheduleDate.getMonth() ===
        currentMonth
      );
    });

  const joinedSchedules =
    schedules.filter(
      (schedule) =>
        schedule.joined &&
        schedule.date >= today
    );

  totalCount.textContent =
    futureSchedules.length;

  monthlyCount.textContent =
    thisMonthSchedules.length;

  joinedCount.textContent =
    joinedSchedules.length;

  renderNextGame();
}

/* ========================================
   次の開催予定を表示
======================================== */

function renderNextGame() {
  const today =
    getDateKey(new Date());

  const upcomingSchedules =
    schedules
      .filter(
        (schedule) =>
          schedule.date >= today &&
          schedule.status !== "締切"
      )
      .sort(
        (
          firstSchedule,
          secondSchedule
        ) =>
          getDateTime(firstSchedule) -
          getDateTime(secondSchedule)
      );

  const nextGame =
    upcomingSchedules[0];

  if (!nextGame) {
    nextGameContent.innerHTML = `
      <p class="next-game-empty">
        現在、参加できる予定はありません。
      </p>
    `;

    return;
  }

  nextGameContent.innerHTML = `
    <span class="next-game-date">
      ${escapeHTML(
    formatDate(nextGame.date)
  )}
    </span>

    <h2>${escapeHTML(
    nextGame.name
  )}</h2>

    <dl>
      <div>
        <dt>TIME</dt>

        <dd>
          ${escapeHTML(
    nextGame.startTime
  )}〜${escapeHTML(
    nextGame.endTime
  )}
        </dd>
      </div>

      <div>
        <dt>PLACE</dt>
        <dd>${escapeHTML(
    nextGame.place
  )}</dd>
      </div>

      <div>
        <dt>PRICE</dt>

        <dd>
          ${Number(
    nextGame.price
  ).toLocaleString(
    "ja-JP"
  )}円
        </dd>
      </div>
    </dl>
  `;
}

/* ========================================
   Firestore
======================================== */

function getSchedulesCollection(uid) {
  return collection(
    db,
    "users",
    uid,
    "schedules"
  );
}

function stopScheduleSubscription() {
  if (unsubscribeSchedules) {
    unsubscribeSchedules();

    unsubscribeSchedules = null;
  }
}

function subscribeToSchedules(uid) {
  stopScheduleSubscription();

  showScheduleLoading();

  const schedulesQuery = query(
    getSchedulesCollection(uid)
  );

  unsubscribeSchedules = onSnapshot(
    schedulesQuery,

    (snapshot) => {
      if (
        !currentUser ||
        currentUser.uid !== uid
      ) {
        return;
      }

      schedules =
        snapshot.docs.map(
          (scheduleDocument) => ({
            id: scheduleDocument.id,
            ...scheduleDocument.data(),
          })
        );

      renderSchedules();
    },

    (error) => {
      console.error(
        "Firestoreの読み込みに失敗しました:",
        error
      );

      if (
        !currentUser ||
        currentUser.uid !== uid
      ) {
        return;
      }

      showScheduleError();

      showToast(
        "予定の読み込みに失敗しました",
        "!"
      );
    }
  );
}

/* ========================================
   旧localStorageの予定を移行
======================================== */

function readLegacySchedules() {
  const savedData =
    localStorage.getItem(STORAGE_KEY);

  if (!savedData) {
    return [];
  }

  try {
    const parsedData =
      JSON.parse(savedData);

    return Array.isArray(parsedData)
      ? parsedData
      : [];
  } catch (error) {
    console.error(
      "旧localStorageデータの読み込みに失敗しました:",
      error
    );

    return [];
  }
}

async function migrateLocalSchedulesOnce(
  user
) {
  const migrationKey =
    `${MIGRATION_KEY_PREFIX}${user.uid}`;

  if (
    localStorage.getItem(
      migrationKey
    )
  ) {
    return;
  }

  const legacySchedules =
    readLegacySchedules();

  if (
    legacySchedules.length === 0
  ) {
    return;
  }

  const schedulesCollection =
    getSchedulesCollection(
      user.uid
    );

  const existingSnapshot =
    await getDocs(
      schedulesCollection
    );

  if (!existingSnapshot.empty) {
    localStorage.setItem(
      migrationKey,
      "skipped-existing-firestore-data"
    );

    return;
  }

  const batch =
    writeBatch(db);

  legacySchedules.forEach(
    (schedule) => {
      const newScheduleRef =
        doc(
          schedulesCollection
        );

      const {
        id: legacyId,
        ...legacyData
      } = schedule;

      batch.set(
        newScheduleRef,
        {
          ...legacyData,
          createdAt:
            serverTimestamp(),
          updatedAt:
            serverTimestamp(),
        }
      );
    }
  );

  await batch.commit();

  localStorage.setItem(
    migrationKey,
    "done"
  );

  showToast(
    "これまでの予定をFirestoreへ移行しました",
    "✓"
  );
}

/* ========================================
   新規登録フォームを開く
======================================== */

function openNewScheduleForm() {
  if (!currentUser) {
    return;
  }

  scheduleForm.reset();

  scheduleId.value = "";

  formTitle.textContent =
    "新しい予定を追加";

  formError.textContent = "";

  eventDate.min =
    getDateKey(new Date());

  eventDate.value =
    getRelativeDate(1);

  startTime.value = "18:00";
  endTime.value = "21:00";

  eventStatus.value = "募集中";

  scheduleDialog.showModal();

  setTimeout(() => {
    eventName.focus();
  }, 100);
}

/* ========================================
   編集フォームを開く
======================================== */

function openEditScheduleForm(id) {
  const schedule =
    schedules.find(
      (item) =>
        item.id === id
    );

  if (!schedule) {
    showToast(
      "予定が見つかりませんでした",
      "!"
    );

    return;
  }

  scheduleForm.reset();

  scheduleId.value =
    schedule.id;

  eventName.value =
    schedule.name;

  eventDate.value =
    schedule.date;

  eventArea.value =
    schedule.area;

  startTime.value =
    schedule.startTime;

  endTime.value =
    schedule.endTime;

  eventPlace.value =
    schedule.place;

  eventPrice.value =
    schedule.price;

  eventStatus.value =
    schedule.status;

  eventMemo.value =
    schedule.memo ?? "";

  formTitle.textContent =
    "予定を編集";

  formError.textContent = "";

  eventDate.min = "";

  scheduleDialog.showModal();

  setTimeout(() => {
    eventName.focus();
  }, 100);
}

/* ========================================
   フォームの入力確認
======================================== */

function validateForm() {
  if (
    !eventName.value.trim() ||
    !eventDate.value ||
    !eventArea.value ||
    !startTime.value ||
    !endTime.value ||
    !eventPlace.value.trim() ||
    eventPrice.value === ""
  ) {
    return "必須項目をすべて入力してください。";
  }

  if (
    endTime.value <=
    startTime.value
  ) {
    return "終了時間は開始時間より後に設定してください。";
  }

  const price =
    Number(eventPrice.value);

  if (
    !Number.isFinite(price) ||
    price < 0 ||
    price > 100000
  ) {
    return "参加費は0円から100,000円の範囲で入力してください。";
  }

  return "";
}

function setSaveButtonLoading(
  isLoading
) {
  saveButton.disabled =
    isLoading;

  saveButton.textContent =
    isLoading
      ? "保存中..."
      : "予定を保存";
}

/* ========================================
   予定を追加・更新
======================================== */

async function handleFormSubmit(
  event
) {
  event.preventDefault();

  if (!currentUser) {
    formError.textContent =
      "ログインし直してください。";

    return;
  }

  const validationMessage =
    validateForm();

  if (validationMessage) {
    formError.textContent =
      validationMessage;

    return;
  }

  if (!navigator.onLine) {
    formError.textContent =
      "オフラインのため保存できません。通信状態を確認してください。";

    return;
  }

  const editingId =
    scheduleId.value;

  const scheduleData = {
    name:
      eventName.value.trim(),

    date:
      eventDate.value,

    area:
      eventArea.value,

    startTime:
      startTime.value,

    endTime:
      endTime.value,

    place:
      eventPlace.value.trim(),

    price:
      Number(eventPrice.value),

    status:
      eventStatus.value,

    memo:
      eventMemo.value.trim(),

    isSample: false,

    updatedAt:
      serverTimestamp(),
  };

  setSaveButtonLoading(true);

  formError.textContent = "";

  try {
    if (editingId) {
      const scheduleRef =
        doc(
          db,
          "users",
          currentUser.uid,
          "schedules",
          editingId
        );

      await updateDoc(
        scheduleRef,
        scheduleData
      );

      showToast(
        "予定を更新しました",
        "✓"
      );
    } else {
      await addDoc(
        getSchedulesCollection(
          currentUser.uid
        ),
        {
          ...scheduleData,
          joined: false,
          createdAt:
            serverTimestamp(),
        }
      );

      showToast(
        "新しい予定を追加しました",
        "✓"
      );
    }

    scheduleDialog.close();
  } catch (error) {
    console.error(
      "予定の保存に失敗しました:",
      error
    );

    formError.textContent =
      "予定を保存できませんでした。通信状態を確認して、もう一度お試しください。";
  } finally {
    setSaveButtonLoading(false);
  }
}

/* ========================================
   参加予定を切り替える
======================================== */

async function toggleJoined(id) {
  if (!currentUser) {
    return;
  }

  const schedule =
    schedules.find(
      (item) =>
        item.id === id
    );

  if (!schedule) {
    return;
  }

  if (
    isPastSchedule(schedule)
  ) {
    showToast(
      "終了した予定には参加登録できません",
      "!"
    );

    return;
  }

  if (
    schedule.status ===
    "締切" &&
    !schedule.joined
  ) {
    showToast(
      "この予定は募集を締め切っています",
      "!"
    );

    return;
  }

  if (!navigator.onLine) {
    showToast(
      "オフラインのため変更できません",
      "!"
    );

    return;
  }

  try {
    const scheduleRef =
      doc(
        db,
        "users",
        currentUser.uid,
        "schedules",
        id
      );

    const nextJoined =
      !schedule.joined;

    await updateDoc(
      scheduleRef,
      {
        joined: nextJoined,
        updatedAt:
          serverTimestamp(),
      }
    );

    showToast(
      nextJoined
        ? "参加予定に追加しました"
        : "参加予定を解除しました",

      nextJoined
        ? "✓"
        : "−"
    );
  } catch (error) {
    console.error(
      "参加状態の変更に失敗しました:",
      error
    );

    showToast(
      "参加状態を変更できませんでした",
      "!"
    );
  }
}

/* ========================================
   削除確認を開く
======================================== */

function openDeleteConfirmation(
  id
) {
  const schedule =
    schedules.find(
      (item) =>
        item.id === id
    );

  if (!schedule) {
    return;
  }

  deleteTargetId = id;

  deleteDialog.showModal();
}

/* ========================================
   予定を削除
======================================== */

async function deleteSchedule() {
  if (
    !deleteTargetId ||
    !currentUser
  ) {
    return;
  }

  if (!navigator.onLine) {
    showToast(
      "オフラインのため削除できません",
      "!"
    );

    return;
  }

  const targetId =
    deleteTargetId;

  confirmDeleteButton.disabled =
    true;

  confirmDeleteButton.textContent =
    "削除中...";

  try {
    const scheduleRef =
      doc(
        db,
        "users",
        currentUser.uid,
        "schedules",
        targetId
      );

    await deleteDoc(
      scheduleRef
    );

    deleteTargetId = null;

    deleteDialog.close();

    showToast(
      "予定を削除しました",
      "✓"
    );
  } catch (error) {
    console.error(
      "予定の削除に失敗しました:",
      error
    );

    showToast(
      "予定を削除できませんでした",
      "!"
    );
  } finally {
    confirmDeleteButton.disabled =
      false;

    confirmDeleteButton.textContent =
      "削除する";
  }
}

/* ========================================
   サンプルデータを削除
======================================== */

async function clearSampleSchedules() {
  if (!currentUser) {
    return;
  }

  const sampleSchedules =
    schedules.filter(
      (schedule) =>
        schedule.isSample
    );

  if (
    sampleSchedules.length === 0
  ) {
    showToast(
      "削除できるサンプルはありません",
      "!"
    );

    return;
  }

  if (!navigator.onLine) {
    showToast(
      "オフラインのため削除できません",
      "!"
    );

    return;
  }

  clearSampleButton.disabled =
    true;

  try {
    const batch =
      writeBatch(db);

    sampleSchedules.forEach(
      (schedule) => {
        const scheduleRef =
          doc(
            db,
            "users",
            currentUser.uid,
            "schedules",
            schedule.id
          );

        batch.delete(
          scheduleRef
        );
      }
    );

    await batch.commit();

    showToast(
      "サンプル予定を削除しました",
      "✓"
    );
  } catch (error) {
    console.error(
      "サンプル予定の削除に失敗しました:",
      error
    );

    showToast(
      "サンプル予定を削除できませんでした",
      "!"
    );
  } finally {
    clearSampleButton.disabled =
      false;
  }
}

/* ========================================
   完了メッセージ
======================================== */

function showToast(
  message,
  icon = "✓"
) {
  clearTimeout(toastTimer);

  toastMessage.textContent =
    message;

  toastIcon.textContent =
    icon;

  toast.classList.add("show");

  toastTimer = setTimeout(
    () => {
      toast.classList.remove(
        "show"
      );
    },
    2800
  );
}

/* ========================================
   ダークモード
======================================== */

function applyTheme(theme) {
  const isDarkMode =
    theme === "dark";

  document.body.classList.toggle(
    "dark-mode",
    isDarkMode
  );

  themeIcon.textContent =
    isDarkMode
      ? "☀️"
      : "🌙";
}

function initializeTheme() {
  const savedTheme =
    localStorage.getItem(
      THEME_KEY
    );

  if (savedTheme) {
    applyTheme(savedTheme);

    return;
  }

  const prefersDarkMode =
    window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;

  applyTheme(
    prefersDarkMode
      ? "dark"
      : "light"
  );
}

function toggleTheme() {
  const darkModeEnabled =
    document.body.classList.contains(
      "dark-mode"
    );

  const newTheme =
    darkModeEnabled
      ? "light"
      : "dark";

  localStorage.setItem(
    THEME_KEY,
    newTheme
  );

  applyTheme(newTheme);
}

/* ========================================
   Firebase Authentication
======================================== */

async function handleLogin() {
  loginError.textContent = "";

  loginButton.disabled = true;

  loginButton.textContent =
    "ログイン中...";

  try {
    await signInWithPopup(
      auth,
      provider
    );
  } catch (error) {
    console.error(
      "Googleログインに失敗しました:",
      error
    );

    if (
      error.code ===
      "auth/popup-closed-by-user" ||
      error.code ===
      "auth/cancelled-popup-request"
    ) {
      loginError.textContent =
        "ログインがキャンセルされました。";
    } else if (
      error.code ===
      "auth/unauthorized-domain"
    ) {
      loginError.textContent =
        "このURLはFirebaseで承認されていません。承認済みドメインを確認してください。";
    } else {
      loginError.textContent =
        "ログインに失敗しました。もう一度お試しください。";
    }
  } finally {
    loginButton.disabled = false;

    loginButton.textContent =
      "Googleでログイン";
  }
}

async function handleLogout() {
  logoutButton.disabled = true;

  try {
    await signOut(auth);
  } catch (error) {
    console.error(
      "ログアウトに失敗しました:",
      error
    );

    showToast(
      "ログアウトに失敗しました",
      "!"
    );
  } finally {
    logoutButton.disabled = false;
  }
}

onAuthStateChanged(
  auth,

  async (user) => {
    /*
      アカウントが変わった瞬間に
      直前のユーザーのデータを消す
    */

    stopScheduleSubscription();

    schedules = [];
    deleteTargetId = null;

    if (scheduleDialog.open) {
      scheduleDialog.close();
    }

    if (deleteDialog.open) {
      deleteDialog.close();
    }

    authLoading.hidden = true;

    /* 未ログイン */
    if (!user) {
      currentUser = null;

      userMenu.hidden = true;
      appContent.hidden = true;
      openFormButton.hidden = true;

      loginView.hidden = false;

      userName.textContent = "";

      userPhoto.src = "";
      userPhoto.hidden = true;

      return;
    }

    /* ログイン済み */

    currentUser = user;

    loginView.hidden = true;
    userMenu.hidden = false;
    appContent.hidden = false;
    openFormButton.hidden = false;

    userName.textContent =
      user.displayName ||
      "ユーザー";

    if (user.photoURL) {
      userPhoto.src =
        user.photoURL;

      userPhoto.alt =
        `${user.displayName ||
        "ユーザー"
        }のアイコン`;

      userPhoto.hidden = false;
    } else {
      userPhoto.src = "";
      userPhoto.hidden = true;
    }

    showScheduleLoading();

    /*
      以前localStorageに保存していた
      予定があれば初回だけ移行
    */

    try {
      await migrateLocalSchedulesOnce(
        user
      );
    } catch (error) {
      console.error(
        "旧予定の移行に失敗しました:",
        error
      );

      showToast(
        "以前の予定を移行できませんでした。旧データは端末に残っています。",
        "!"
      );
    }

    /*
      移行中にログアウトした場合などは
      このユーザーの監視を開始しない
    */

    if (
      !auth.currentUser ||
      auth.currentUser.uid !==
      user.uid
    ) {
      return;
    }

    subscribeToSchedules(
      user.uid
    );
  },

  (error) => {
    console.error(
      "認証状態の確認に失敗しました:",
      error
    );

    authLoading.hidden = true;
    loginView.hidden = false;
    appContent.hidden = true;
    userMenu.hidden = true;
    openFormButton.hidden = true;

    loginError.textContent =
      "ログイン状態を確認できませんでした。ページを再読み込みしてください。";
  }
);

/* ========================================
   イベント登録
======================================== */

loginButton.addEventListener(
  "click",
  handleLogin
);

logoutButton.addEventListener(
  "click",
  handleLogout
);

openFormButton.addEventListener(
  "click",
  openNewScheduleForm
);

heroAddButton.addEventListener(
  "click",
  openNewScheduleForm
);

emptyAddButton.addEventListener(
  "click",
  openNewScheduleForm
);

closeFormButton.addEventListener(
  "click",
  () => {
    scheduleDialog.close();
  }
);

cancelFormButton.addEventListener(
  "click",
  () => {
    scheduleDialog.close();
  }
);

scheduleForm.addEventListener(
  "submit",
  handleFormSubmit
);

searchInput.addEventListener(
  "input",
  renderSchedules
);

areaFilter.addEventListener(
  "change",
  renderSchedules
);

statusFilter.addEventListener(
  "change",
  renderSchedules
);

sortSelect.addEventListener(
  "change",
  renderSchedules
);

clearSampleButton.addEventListener(
  "click",
  clearSampleSchedules
);

themeButton.addEventListener(
  "click",
  toggleTheme
);

/* 日付タブ */

dateTabs.forEach((tab) => {
  tab.addEventListener(
    "click",
    () => {
      dateTabs.forEach(
        (otherTab) => {
          otherTab.classList.remove(
            "active"
          );
        }
      );

      tab.classList.add(
        "active"
      );

      selectedDateFilter =
        tab.dataset.filter;

      renderSchedules();
    }
  );
});

/* 予定カード内のボタン */

scheduleList.addEventListener(
  "click",
  (event) => {
    const clickedButton =
      event.target.closest(
        "button[data-action]"
      );

    if (!clickedButton) {
      return;
    }

    const action =
      clickedButton.dataset.action;

    const id =
      clickedButton.dataset.id;

    if (action === "join") {
      toggleJoined(id);
    }

    if (action === "edit") {
      openEditScheduleForm(id);
    }

    if (action === "delete") {
      openDeleteConfirmation(id);
    }
  }
);

/* 削除確認 */

cancelDeleteButton.addEventListener(
  "click",
  () => {
    deleteTargetId = null;

    deleteDialog.close();
  }
);

confirmDeleteButton.addEventListener(
  "click",
  deleteSchedule
);

/* モーダル外側を押したら閉じる */

scheduleDialog.addEventListener(
  "click",
  (event) => {
    if (
      event.target ===
      scheduleDialog
    ) {
      scheduleDialog.close();
    }
  }
);

deleteDialog.addEventListener(
  "click",
  (event) => {
    if (
      event.target ===
      deleteDialog
    ) {
      deleteTargetId = null;

      deleteDialog.close();
    }
  }
);

/* 入力開始時にエラーを消す */

scheduleForm.addEventListener(
  "input",
  () => {
    formError.textContent = "";
  }
);

/* ========================================
   アプリ開始
======================================== */

initializeTheme();