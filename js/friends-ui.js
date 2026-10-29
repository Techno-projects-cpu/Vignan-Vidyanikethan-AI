/**
 * Friends, requests, people search and the notification feed.
 *
 * Rendered into #view-friends. Mobile first: large tap targets, one column,
 * and tabs that scroll sideways instead of wrapping.
 */

import * as ui from "./ui.js?v=17";
import { onSocialChange, social, socialState, syncSocial } from "./social.js?v=17";
import { AVATAR_PATTERNS, avatarSeed, decorateAvatar } from "./avatars.js?v=17";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const TABS = ["friends", "requests", "find", "alerts"];
let activeTab = "friends";
let searchResults = [];
let searchTerm = "";
let searchBusy = false;
let suggested = [];
let suggestBusy = false;
let initialised = false;
let lastSignature = "";

const openView = (view) => window.dispatchEvent(new CustomEvent("vignan:view", { detail: { view } }));
const openChat = (detail) => window.dispatchEvent(new CustomEvent("vignan:open-chat", { detail }));
const openGame = (gameId) => window.dispatchEvent(new CustomEvent("vignan:open-game", { detail: { gameId } }));

export function relativeTime(value) {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return "";
  const seconds = Math.round((Date.now() - time) / 1000);
  if (seconds < 45) return "just now";
  if (seconds < 3600) return `${Math.round(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} h ago`;
  if (seconds < 604800) return `${Math.round(seconds / 86400)} d ago`;
  return new Date(time).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function avatarLetter(name) {
  return String(name || "V").trim().charAt(0).toUpperCase() || "V";
}

/** One monogram avatar, patterned from the student's name or their pinned seed. */
function avatar(name, online = false, size = "", seed = "") {
  const node = ui.element("span", `social-avatar${size ? ` ${size}` : ""}`);
  decorateAvatar(node, { name, seed, online });
  return node;
}

/**
 * A compact "you" strip with the swatch picker.
 *
 * Eight taps is the whole feature: it changes how your friends see you, needs no
 * upload and no extra storage, and works offline.
 */
function renderAvatarPicker(body, data) {
  const me = data.self || {};
  const current = me.avatarSeed || "";
  const wrap = ui.element("div", "social-me");
  wrap.appendChild(avatar(me.username || "You", true, "large", current));
  const copy = ui.element("div", "social-me-copy");
  copy.appendChild(ui.element("strong", "", me.username || "You"));
  copy.appendChild(ui.element("small", "", "This is how classmates see you."));
  wrap.appendChild(copy);

  const swatches = ui.element("div", "avatar-swatches");
  swatches.setAttribute("role", "group");
  swatches.setAttribute("aria-label", "Choose your avatar");
  AVATAR_PATTERNS.forEach((pattern, index) => {
    const seed = avatarSeed(index);
    const swatch = ui.element("button", "avatar-swatch");
    swatch.type = "button";
    decorateAvatar(swatch, { name: me.username || "You", seed });
    swatch.dataset.seed = seed;
    swatch.setAttribute("aria-label", `${pattern} avatar`);
    swatch.setAttribute("aria-pressed", String(current === seed));
    if (current === seed) swatch.classList.add("active");
    swatch.addEventListener("click", async () => {
      if (swatch.disabled) return;
      swatches.querySelectorAll("button").forEach((node) => { node.disabled = true; });
      try {
        await social.setAvatar(seed);
        ui.showToast("Avatar saved for your classmates.", "success");
        // Keep the header and Settings in step with the shared choice.
        window.dispatchEvent(new CustomEvent("vignan:avatar", { detail: { seed } }));
        await syncSocial();
      } catch (error) {
        ui.showToast(error.message, "error");
      } finally {
        swatches.querySelectorAll("button").forEach((node) => { node.disabled = false; });
      }
      lastSignature = "";
      renderFriends();
    });
    swatches.appendChild(swatch);
  });
  wrap.appendChild(swatches);
  body.appendChild(wrap);
}

function presence(row) {
  const bits = [];
  bits.push(row.online ? "Online" : "Offline");
  if (row.streak) bits.push(`${row.streak} day streak`);
  if (row.xp) bits.push(`${row.xp} XP`);
  return bits.join(" · ");
}

function personRow({ name, subtitle, online, actions = [], avatarNode = null }) {
  const row = ui.element("div", "social-row");
  row.appendChild(avatarNode || avatar(name, online));
  const copy = ui.element("div", "social-row-copy");
  copy.appendChild(ui.element("strong", "", name));
  copy.appendChild(ui.element("small", "", subtitle));
  row.appendChild(copy);
  if (actions.length) {
    const tools = ui.element("div", "social-row-actions");
    for (const action of actions) tools.appendChild(action);
    row.appendChild(tools);
  }
  return row;
}

function button(label, className, onClick, { ariaLabel = "", action = "" } = {}) {
  const node = ui.element("button", className, label);
  node.type = "button";
  if (ariaLabel) node.setAttribute("aria-label", ariaLabel);
  if (action) node.dataset.action = action;
  node.addEventListener("click", onClick);
  return node;
}

function requireLogin(container) {
  const box = ui.element("div", "social-gate");
  box.appendChild(ui.element("span", "social-gate-mark", "✦"));
  box.appendChild(ui.element("h3", "", "Friends need a student account"));
  box.appendChild(ui.element(
    "p",
    "",
    "Log in to add classmates, send messages and play chess or quiz duels. Guest mode keeps working for asking, quizzes and flashcards.",
  ));
  const actions = ui.element("div", "social-gate-actions");
  actions.appendChild(button("Log in or register", "button primary", () => openView("progress")));
  box.appendChild(actions);
  container.appendChild(box);
}

function renderTabs(root) {
  const data = socialState().data;
  const wrap = ui.element("div", "social-tabs");
  wrap.setAttribute("role", "tablist");
  wrap.setAttribute("aria-label", "Friends sections");
  const labels = {
    friends: `Friends${data?.friends?.length ? ` ${data.friends.length}` : ""}`,
    requests: "Requests",
    find: "Find people",
    alerts: "Alerts",
  };
  for (const tab of TABS) {
    const id = `friends-tab-${tab}`;
    const node = ui.element("button", `social-tab${activeTab === tab ? " active" : ""}`, labels[tab]);
    node.type = "button";
    node.id = id;
    node.dataset.tab = tab;
    node.setAttribute("role", "tab");
    node.setAttribute("aria-selected", String(activeTab === tab));
    node.setAttribute("aria-controls", "friends-panel-body");
    if (tab === "requests" && data?.requests?.incoming?.length) {
      const badge = ui.element("span", "social-tab-badge", String(data.requests.incoming.length));
      node.appendChild(badge);
    }
    if (tab === "alerts" && Number(data?.unread) > 0) {
      const badge = ui.element("span", "social-tab-badge", data.unread > 9 ? "9+" : String(data.unread));
      node.appendChild(badge);
    }
    node.addEventListener("click", () => {
      activeTab = tab;
      if (tab === "alerts" && Number(socialState().data?.unread) > 0) {
        social.markRead().then(() => syncSocial()).catch(() => {});
      }
      renderFriends();
      // Switching tabs is a natural moment to pick up a new request or friend.
      syncSocial().catch(() => {});
    });
    wrap.appendChild(node);
  }
  root.appendChild(wrap);
}

/**
 * Open the Find tab with the cursor already in the search box.
 *
 * The empty Friends tab used to say "find a classmate by username" without
 * giving the student anything to press, which is why "add friends" seemed to be
 * missing. Every empty state now links straight here.
 */
export function openAddFriend() {
  activeTab = "find";
  lastSignature = "";
  renderFriends();
  const input = $("#friends-search-input");
  if (input) {
    input.focus({ preventScroll: false });
    input.scrollIntoView({ block: "center", behavior: "smooth" });
  }
}

function renderFriendsTab(body, data) {
  if (data.self?.username) renderAvatarPicker(body, data);
  const friends = data.friends || [];
  if (!friends.length) {
    body.appendChild(ui.emptyState("◇", "No friends yet", "Type a classmate's username and send a request. You can also share a game code from Play."));
    const add = button("Add a friend", "button primary", () => openAddFriend(), { action: "add-friend" });
    add.id = "friends-empty-add";
    body.appendChild(add);
    if (data.requests?.outgoing?.length) {
      body.appendChild(ui.element("p", "social-hint", `${data.requests.outgoing.length} request waiting for an answer.`));
    }
    return;
  }
  const head = ui.element("div", "social-alerts-head");
  head.appendChild(ui.element("h3", "social-subhead", `${friends.length} friend${friends.length === 1 ? "" : "s"}`));
  const addMore = button("Add friend", "button ghost small", () => openAddFriend(), { action: "add-friend" });
  addMore.id = "friends-add-more";
  head.appendChild(addMore);
  body.appendChild(head);

  const list = ui.element("div", "social-list");
  for (const friend of friends) {
    const actions = [
      button("Message", "button ghost small", () => openChat({ friendId: friend.id }), { action: "message" }),
      button("Play", "button ghost small", () => openChat({ friendId: friend.id, play: true }), { action: "play" }),
    ];
    const remove = button("Remove", "social-icon-button", async () => {
      const confirmed = await ui.confirmDialog({
        title: `Remove ${friend.username}?`,
        message: "You can always send a new friend request later.",
        confirmLabel: "Remove",
        danger: true,
      });
      if (!confirmed) return;
      try {
        await social.removeFriend(friend.id);
        ui.showToast(`${friend.username} was removed.`, "info");
        await syncSocial();
      } catch (error) {
        ui.showToast(error.message, "error");
      }
    }, { ariaLabel: `Remove ${friend.username}` });
    remove.textContent = "×";
    actions.push(remove);
    list.appendChild(personRow({
      name: friend.username,
      subtitle: presence(friend),
      online: friend.online,
      avatarNode: avatar(friend.username, friend.online, "", friend.avatarSeed),
      actions,
    }));
  }
  body.appendChild(list);
  body.appendChild(ui.element("p", "social-hint", "Tap Message to open a private chat. Only friends can message you."));
}

function renderRequestsTab(body, data) {
  const incoming = data.requests?.incoming || [];
  const outgoing = data.requests?.outgoing || [];
  if (!incoming.length && !outgoing.length) {
    body.appendChild(ui.emptyState("↗", "No open requests", "When a classmate wants to connect, it will appear here."));
    const find = button("Find a friend to add", "button primary", () => openAddFriend(), { action: "add-friend" });
    find.id = "friends-requests-add";
    body.appendChild(find);
    return;
  }
  if (incoming.length) {
    body.appendChild(ui.element("h3", "social-subhead", "Waiting for you"));
    const list = ui.element("div", "social-list");
    for (const request of incoming) {
      const actions = [
        button("Accept", "button primary small", async () => {
          try {
            await social.respondFriend(request.id, true);
            ui.showToast(`You and ${request.from.username} are now friends.`, "success");
            await syncSocial();
          } catch (error) {
            ui.showToast(error.message, "error");
          }
        }, { action: "accept" }),
        button("Decline", "button ghost small", async () => {
          try {
            await social.respondFriend(request.id, false);
            await syncSocial();
          } catch (error) {
            ui.showToast(error.message, "error");
          }
        }, { action: "decline" }),
      ];
      list.appendChild(personRow({
        name: request.from.username,
        subtitle: `Asked ${relativeTime(request.createdAt)}`,
        actions,
      }));
    }
    body.appendChild(list);
  }
  if (outgoing.length) {
    body.appendChild(ui.element("h3", "social-subhead", "You asked"));
    const list = ui.element("div", "social-list");
    for (const request of outgoing) {
      list.appendChild(personRow({
        name: request.to.username,
        subtitle: `Sent ${relativeTime(request.createdAt)} · still waiting`,
      }));
    }
    body.appendChild(list);
  }
}

async function runSearch() {
  searchBusy = true;
  renderFriends();
  try {
    const data = await social.people(searchTerm);
    searchResults = data.people || [];
  } catch (error) {
    searchResults = [];
    ui.showToast(error.message, "error");
  } finally {
    searchBusy = false;
    renderFriends();
  }
}

async function loadSuggestions() {
  if (suggestBusy) return;
  suggestBusy = true;
  try {
    const data = await social.suggestions();
    suggested = data.people || [];
  } catch {
    suggested = [];
  } finally {
    suggestBusy = false;
    lastSignature = "";
    renderFriends();
  }
}

function renderFindTab(body) {
  const form = ui.element("form", "social-search");
  const input = document.createElement("input");
  input.type = "search";
  input.id = "friends-search-input";
  input.placeholder = "Search a username";
  input.autocomplete = "off";
  input.spellcheck = false;
  input.value = searchTerm;
  input.setAttribute("aria-label", "Search students by username");
  form.appendChild(input);
  const submit = ui.element("button", "button primary", searchBusy ? "Searching…" : "Search");
  submit.type = "submit";
  submit.disabled = searchBusy;
  form.appendChild(submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim().toLowerCase();
    if (value.length < 2) {
      ui.showToast("Type at least two letters of a username.", "warning");
      return;
    }
    searchTerm = value;
    runSearch();
  });
  body.appendChild(form);
  body.appendChild(ui.element("p", "social-hint", "Usernames are public. Age, gender and exact results stay private."));

  if (searchTerm && !searchResults.length && !searchBusy) {
    body.appendChild(ui.emptyState("⌕", "No student found", "Check the spelling, or ask them to open Friends once so their profile appears."));
    return;
  }
  const rows = searchResults.length ? searchResults : suggested;
  if (!rows.length) {
    if (!suggestBusy) loadSuggestions();
    body.appendChild(ui.element("p", "social-hint", suggestBusy ? "Looking for classmates…" : "No other students yet. Share the site with your class — everyone who opens Friends appears here."));
    return;
  }
  if (!searchResults.length) body.appendChild(ui.element("h3", "social-subhead", "Classmates you can add"));
  const list = ui.element("div", "social-list");
  for (const person of rows) {
    let action;
    if (person.relationship === "friend") {
      action = button("Message", "button ghost small", () => openChat({ friendId: person.id }), { action: "message" });
    } else if (person.relationship === "requested") {
      action = ui.element("span", "chip", "Requested");
    } else if (person.relationship === "incoming") {
      action = button("Answer in Requests", "button ghost small", () => {
        activeTab = "requests";
        renderFriends();
      }, { action: "answer" });
    } else {
      action = button("Add friend", "button primary small", async (event) => {
        event.currentTarget.disabled = true;
        try {
          await social.requestFriend(person.username);
          person.relationship = "requested";
          ui.showToast(`Request sent to ${person.username}.`, "success");
          await syncSocial();
        } catch (error) {
          ui.showToast(error.message, "error");
          event.currentTarget.disabled = false;
          return;
        }
        renderFriends();
      }, { action: "add" });
    }
    list.appendChild(personRow({
      name: person.username,
      subtitle: presence(person),
      online: person.online,
      avatarNode: avatar(person.username, person.online, "", person.avatarSeed),
      actions: [action],
    }));
  }
  body.appendChild(list);
}

function notificationCopy(row) {
  const copy = { title: row.title, text: row.body };
  if (row.kind === "message") copy.action = "Open chat";
  if (row.kind === "game_invite" || row.kind === "game_start" || row.kind === "game_finish") copy.action = "Open game";
  if (row.kind === "friend_request") copy.action = "Review request";
  return copy;
}

function renderAlertsTab(body, data) {
  const rows = data.notifications || [];
  if (!rows.length) {
    body.appendChild(ui.emptyState("◌", "Nothing new", "Friend requests, messages and game invites show up here."));
    return;
  }
  const head = ui.element("div", "social-alerts-head");
  head.appendChild(ui.element("h3", "social-subhead", "Recent"));
  const markAll = button("Mark all read", "button ghost small", async () => {
    try {
      await social.markRead();
      await syncSocial();
    } catch (error) {
      ui.showToast(error.message, "error");
    }
  });
  markAll.disabled = Number(data.unread) === 0;
  head.appendChild(markAll);
  body.appendChild(head);

  const list = ui.element("div", "social-list");
  for (const row of rows) {
    const copy = notificationCopy(row);
    const node = ui.element("button", `social-alert${row.read ? "" : " unread"}`);
    node.type = "button";
    const dot = ui.element("span", "social-alert-dot");
    node.appendChild(dot);
    const text = ui.element("span", "social-alert-copy");
    text.appendChild(ui.element("strong", "", copy.title));
    if (copy.text) text.appendChild(ui.element("small", "", copy.text));
    text.appendChild(ui.element("span", "social-alert-time", relativeTime(row.createdAt)));
    node.appendChild(text);
    node.addEventListener("click", async () => {
      try {
        if (!row.read) await social.markRead([row.id]);
      } catch {
        // Reading is best-effort; the action still runs.
      }
      if (row.kind === "message" && row.data?.threadId) openChat({ threadId: row.data.threadId });
      else if (row.data?.gameId) openGame(row.data.gameId);
      else if (row.kind === "friend_request") {
        activeTab = "requests";
        renderFriends();
      }
      syncSocial().catch(() => {});
    });
    list.appendChild(node);
  }
  body.appendChild(list);
}

export function renderFriends() {
  const root = $("#friends-panel");
  if (!root) return;
  const social_ = socialState();
  const data = social_.data;
  const signature = JSON.stringify({
    signedIn: social_.signedIn,
    retryable: Boolean(social_.error),
    loaded: social_.loaded,
    error: social_.error,
    tab: activeTab,
    results: searchResults.map((row) => `${row.id}:${row.relationship}:${row.online}`),
    term: searchTerm,
    suggested: suggested.map((row) => `${row.id}:${row.relationship}`),
    busy: searchBusy,
    unread: data?.unread,
    me: data?.self?.avatarSeed || "",
    friends: data?.friends?.map((row) => `${row.id}:${row.online}:${row.xp}:${row.streak}`),
    requests: data?.requests,
    alerts: data?.notifications?.map((row) => `${row.id}:${row.read}`),
  });
  if (signature === lastSignature) return;
  lastSignature = signature;

  root.textContent = "";
  if (!social_.signedIn) {
    requireLogin(root);
    return;
  }
  if (!data) {
    if (social_.error) {
      // A bare hint left the student with no way forward; offer the retry inline.
      const box = ui.element("div", "social-empty social-error-card");
      box.appendChild(ui.element("p", "social-hint", social_.error));
      const retry = ui.element("button", "button primary", "Try again");
      retry.type = "button";
      retry.addEventListener("click", () => {
        lastSignature = "";
        retry.disabled = true;
        syncSocial({ silent: false }).catch(() => {}).finally(() => {
          lastSignature = "";
          renderFriends();
        });
      });
      box.appendChild(retry);
      root.appendChild(box);
      return;
    }
    root.appendChild(ui.element("p", "social-hint", "Loading your friends…"));
    return;
  }
  renderTabs(root);
  const body = ui.element("div", "social-tab-body");
  body.id = "friends-panel-body";
  body.setAttribute("role", "tabpanel");
  body.setAttribute("aria-labelledby", `friends-tab-${activeTab}`);
  root.appendChild(body);
  if (activeTab === "friends") renderFriendsTab(body, data);
  else if (activeTab === "requests") renderRequestsTab(body, data);
  else if (activeTab === "find") {
    renderFindTab(body);
    if (!searchTerm && !suggested.length && !suggestBusy) loadSuggestions();
  }
  else renderAlertsTab(body, data);
}

export function initFriendsUI() {
  if (initialised) return;
  initialised = true;
  onSocialChange(() => {
    lastSignature = "";
    renderFriends();
    updateSocialBadges();
  });
  window.addEventListener("vignan:social-refresh", () => syncSocial());
  renderFriends();
  updateSocialBadges();
}

export function updateSocialBadges() {
  const data = socialState().data;
  const unread = Number(data?.unread) || 0;
  const requests = data?.requests?.incoming?.length || 0;
  for (const node of $$('[data-social-badge="chat"]')) {
    node.dataset.badge = unread ? (unread > 9 ? "9+" : String(unread)) : "";
  }
  for (const node of $$('[data-social-badge="friends"]')) {
    node.dataset.badge = requests ? (requests > 9 ? "9+" : String(requests)) : "";
  }
  const count = $("#social-bell-count");
  if (count) {
    count.textContent = unread > 9 ? "9+" : String(unread);
    count.hidden = unread === 0;
  }
  $("#social-bell")?.classList.toggle("has-alerts", unread > 0);
  const dot = $("#account-dot");
  if (dot && unread > 0) dot.classList.add("has-alerts");
  else dot?.classList.remove("has-alerts");
}

export function focusFriendsTab(tab = "friends") {
  if (TABS.includes(tab)) activeTab = tab;
  lastSignature = "";
  renderFriends();
}
