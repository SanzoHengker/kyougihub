import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  increment,
  arrayUnion,
  runTransaction
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCbipFABepd7QzlQagV-EB3SYEgjP_jfjg",
  authDomain: "kyougihub19.firebaseapp.com",
  projectId: "kyougihub19",
  storageBucket: "kyougihub19.firebasestorage.app",
  messagingSenderId: "962636997823",
  appId: "1:962636997823:web:29a94c2b2f264a762e120a"
};

const OWNER_EMAIL = "sanzokece@gmail.com";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let currentUser = null;
let profile = null;

let posts = [];
let teams = [];
let teamRequests = [];
let adminRequests = [];

let selectedRegistrationPostId = null;

let unsubscribeList = [];
let isSigningUp = false;

const ROLE_LABEL = {
  player: "Player",
  teamLeader: "Team Leader",
  teamManager: "Team Manager",
  coach: "Coach",
  admin: "Admin",
  owner: "Owner"
};

const TRANSLATIONS = {
  en: "Scrim, tournament, recruitment and community promotion hub.",
  ms: "Hub scrim, tournament, recruitment dan promosi komuniti.",
  id: "Hub scrim, turnamen, rekrutmen dan promosi komunitas.",
  tl: "Hub para sa scrim, tournament, recruitment at community promotion.",
  zh: "训练赛、锦标赛、招募和社区推广中心。",
  ta: "Scrim, போட்டி, recruitment மற்றும் community promotion hub."
};

const BANKS = [
  "Affin Bank Berhad",
  "Affin Islamic Bank Berhad",
  "Agrobank / Bank Pertanian Malaysia Berhad",
  "Alliance Bank Malaysia Berhad",
  "Alliance Islamic Bank Berhad",
  "Al Rajhi Banking & Investment Corporation (Malaysia) Berhad",
  "AmBank (M) Berhad",
  "AmBank Islamic Berhad",
  "Bangkok Bank Berhad",
  "Bank Islam Malaysia Berhad",
  "Bank Kerjasama Rakyat Malaysia Berhad / Bank Rakyat",
  "Bank Muamalat Malaysia Berhad",
  "Bank Negara Malaysia",
  "Bank of America Malaysia Berhad",
  "Bank of China (Malaysia) Berhad",
  "Bank Pembangunan Malaysia Berhad",
  "Bank Simpanan Nasional / BSN",
  "BNP Paribas Malaysia Berhad",
  "CIMB Bank Berhad",
  "CIMB Islamic Bank Berhad",
  "Citibank Berhad",
  "Deutsche Bank (Malaysia) Berhad",
  "Export-Import Bank of Malaysia Berhad / EXIM Bank",
  "Hong Leong Bank Berhad",
  "Hong Leong Islamic Bank Berhad",
  "HSBC Amanah Malaysia Berhad",
  "HSBC Bank Malaysia Berhad",
  "India International Bank Malaysia Berhad",
  "Industrial and Commercial Bank of China Malaysia Berhad / ICBC",
  "J.P. Morgan Chase Bank Berhad",
  "Kuwait Finance House Malaysia Berhad",
  "Malayan Banking Berhad / Maybank",
  "Maybank Islamic Berhad",
  "MBSB Bank Berhad",
  "MBSB Bank Islamic Berhad",
  "MUFG Bank Malaysia Berhad",
  "OCBC Al-Amin Bank Berhad",
  "OCBC Bank Malaysia Berhad",
  "Public Bank Berhad",
  "Public Islamic Bank Berhad",
  "RHB Bank Berhad",
  "RHB Islamic Bank Berhad",
  "SME Bank",
  "Standard Chartered Bank Malaysia Berhad",
  "Standard Chartered Saadiq Berhad",
  "Sumitomo Mitsui Banking Corporation Malaysia Berhad",
  "United Overseas Bank Malaysia Berhad / UOB"
].map((name) => {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  const initials = name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return { name, slug, initials };
});

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function toast(message, type = "info") {
  const box = $("#toast");

  box.textContent = message;
  box.classList.remove("hidden");

  if (type === "error") {
    box.style.borderColor = "rgba(255,77,109,.65)";
  } else if (type === "success") {
    box.style.borderColor = "rgba(32,210,132,.65)";
  } else {
    box.style.borderColor = "rgba(255,255,255,.15)";
  }

  clearTimeout(window.__toastTimer);

  window.__toastTimer = setTimeout(() => {
    box.classList.add("hidden");
  }, 3800);
}

function money(value) {
  const n = Number(value || 0);

  return `RM ${n.toLocaleString("en-MY", {
    minimumFractionDigits: n % 1 ? 2 : 0,
    maximumFractionDigits: 2
  })}`;
}

function normalizePhone(phone) {
  let clean = String(phone || "").replace(/[^0-9]/g, "");

  if (!clean) return "";
  if (clean.startsWith("0")) clean = "6" + clean;
  if (clean.startsWith("1")) clean = "60" + clean;

  return clean;
}

function whatsappLink(phone) {
  const clean = normalizePhone(phone);
  return clean ? `https://wasap.my/${clean}` : "#";
}

function isOwnerEmail(email) {
  return String(email || "").toLowerCase() === OWNER_EMAIL.toLowerCase();
}

function isOwner() {
  return currentUser && isOwnerEmail(currentUser.email);
}

function isApprovedAdmin() {
  return isOwner() || (profile?.role === "admin" && profile?.status === "active");
}

function isActiveAccount() {
  return isOwner() || profile?.status === "active";
}

function requireLogin() {
  if (!currentUser) {
    toast("Please login first.", "error");
    showTab("auth");
    return false;
  }

  return true;
}

function requireActiveAccount() {
  if (!requireLogin()) return false;

  if (!isActiveAccount()) {
    toast("Your account is pending approval.", "error");
    return false;
  }

  return true;
}

function getTier(avgStar) {
  const star = Number(avgStar || 0);

  if (star >= 150) return "Tier 1";
  if (star >= 100) return "Tier 2";
  if (star >= 50) return "Tier 3";

  return "Tier 4";
}

function parsePlayers(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, mlId, server, role, age] = line
        .split(",")
        .map((x) => x?.trim() || "-");

      return {
        name,
        mlId,
        server,
        role,
        age
      };
    });
}

function createdMillis(item) {
  return item.createdAt?.toMillis?.() || item.updatedAt?.toMillis?.() || 0;
}

function canCreateTeam() {
  return ["teamLeader", "teamManager", "admin", "owner"].includes(profile?.role) || isOwner();
}

function isMyTeam(team) {
  if (!currentUser) return false;
  if (isApprovedAdmin()) return true;

  return (
    team.createdBy === currentUser.uid ||
    team.leaderUids?.includes(currentUser.uid) ||
    team.managerUids?.includes(currentUser.uid)
  );
}

function isMyManagedTeam(team) {
  if (!currentUser) return false;
  if (isApprovedAdmin()) return true;

  return team.managerUids?.includes(currentUser.uid);
}

function getRegistrations(post) {
  return post.registrations || post.reservations || [];
}

function registrationCount(post) {
  return getRegistrations(post).length;
}

function postTitle(post) {
  return (
    post.tournamentName ||
    post.teamName ||
    post.communityName ||
    post.recruitTitle ||
    post.title ||
    "Untitled Post"
  );
}

function postTypeLabel(type) {
  return {
    scrim: "Scrim",
    tournament: "Tournament",
    recruitPlayer: "Player Recruitment",
    recruitStaff: "Manager / Coach Recruitment",
    advertisement: "Advertisement",
    adOrder: "Advertisement Order"
  }[type] || type;
}

function getPostScheduleStatus(post) {
  if (post.status === "cancelled") return "cancelled";
  if (post.status === "closed") return "closed";

  if (!post.date || !post.time) {
    return post.status || "active";
  }

  const start = new Date(`${post.date}T${post.time}`);

  if (Number.isNaN(start.getTime())) {
    return "scheduled";
  }

  const now = new Date();
  const durationHours = post.type === "tournament" ? 12 : 3;
  const end = new Date(start.getTime() + durationHours * 60 * 60 * 1000);

  if (now < start) return "upcoming";
  if (now >= start && now <= end) return "live";

  return "ended";
}

function badge(text, style = "") {
  return `<span class="badge ${style}">${esc(text)}</span>`;
}

function bankImage(bank) {
  return `
    <img
      class="bank-logo"
      src="bank-logos/${esc(bank.slug)}.png"
      alt="${esc(bank.name)}"
      onerror="this.outerHTML='<span class=&quot;bank-fallback&quot;>${esc(bank.initials)}</span>'"
    />
  `;
}

function updateBankPreview() {
  const select = $("#tourBank");
  const bank = BANKS.find((item) => item.name === select.value) || BANKS[0];

  $("#bankPreview").innerHTML = `
    <div class="bank-card">
      ${bankImage(bank)}

      <div>
        <b>${esc(bank.name)}</b>
        <p class="muted small" style="margin:.15rem 0 0">
          Logo fallback will show if bank logo file is missing.
        </p>
      </div>
    </div>
  `;
}

function populateBankSelect() {
  const select = $("#tourBank");

  select.innerHTML = BANKS.map((bank) => {
    return `<option value="${esc(bank.name)}">${esc(bank.name)}</option>`;
  }).join("");

  updateBankPreview();
}

function showTab(tabId) {
  if (tabId === "admin" && !isApprovedAdmin()) {
    toast("Only owner and approved admins can access admin panel.", "error");
    return;
  }

  if (tabId === "teamManagement" && !requireLogin()) {
    return;
  }

  $$(".section").forEach((section) => {
    section.classList.toggle("active-section", section.id === tabId);
  });

  $$(".tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderAuthMini() {
  const box = $("#authMini");

  if (!currentUser) {
    box.innerHTML = `<button class="btn primary" data-tab-target="auth">Login / Sign Up</button>`;
    return;
  }

  const roleText = ROLE_LABEL[profile?.role] || "User";
  const statusText = profile?.status === "pending" ? "Pending" : "Active";

  box.innerHTML = `
    <span class="user-pill">
      ${esc(profile?.displayName || currentUser.email)} · ${esc(roleText)} · ${esc(statusText)}
    </span>

    <button class="btn ghost" id="logoutBtn">Logout</button>
  `;

  $("#logoutBtn").addEventListener("click", async () => {
    await signOut(auth);
    toast("Logged out.");
  });
}

function renderRoleAccess() {
  $$(".admin-only").forEach((el) => {
    el.classList.toggle("hidden", !isApprovedAdmin());
  });

  $$(".owner-only").forEach((el) => {
    el.classList.toggle("hidden", !isOwner());
  });
}

async function ensureUserDoc(user, extra = {}) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  const chosenRole = extra.role || null;
  const finalRole = isOwnerEmail(user.email) ? "owner" : chosenRole || "player";
  const displayName = extra.displayName || user.displayName || user.email.split("@")[0];

  if (!snap.exists() || chosenRole) {
    await setDoc(
      ref,
      {
        uid: user.uid,
        email: user.email.toLowerCase(),
        displayName,
        role: finalRole,
        status: finalRole === "admin" ? "pending" : "active",
        updatedAt: serverTimestamp(),
        ...(!snap.exists() ? { createdAt: serverTimestamp() } : {})
      },
      { merge: true }
    );

    if (finalRole === "admin") {
      await setDoc(
        doc(db, "adminRequests", user.uid),
        {
          uid: user.uid,
          email: user.email.toLowerCase(),
          displayName,
          requestedRole: "admin",
          status: "pending",
          ownerEmail: OWNER_EMAIL,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
    }
  }

  if (snap.exists() && finalRole === "owner" && snap.data().role !== "owner") {
    await setDoc(
      ref,
      {
        role: "owner",
        status: "active",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );
  }
}

async function loadProfile() {
  if (!currentUser) {
    profile = null;
    renderAuthMini();
    renderRoleAccess();
    renderAll();
    return;
  }

  await ensureUserDoc(currentUser);

  const snap = await getDoc(doc(db, "users", currentUser.uid));
  profile = snap.exists() ? snap.data() : null;

  renderAuthMini();
  renderRoleAccess();
  renderAll();
}

function resetSubscriptions() {
  unsubscribeList.forEach((unsub) => unsub());
  unsubscribeList = [];
}

function startRealtimeListeners() {
  resetSubscriptions();

  unsubscribeList.push(
    onSnapshot(collection(db, "posts"), (snapshot) => {
      posts = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => createdMillis(b) - createdMillis(a));

      renderAll();
    })
  );

  unsubscribeList.push(
    onSnapshot(collection(db, "teams"), (snapshot) => {
      teams = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => {
          const points = Number(b.rankPoints || 0) - Number(a.rankPoints || 0);
          if (points !== 0) return points;

          return Number(b.wins || 0) - Number(a.wins || 0);
        });

      renderAll();
    })
  );

  if (currentUser) {
    unsubscribeList.push(
      onSnapshot(
        query(collection(db, "teamJoinRequests"), where("targetUid", "==", currentUser.uid)),
        (snapshot) => {
          teamRequests = snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .sort((a, b) => createdMillis(b) - createdMillis(a));

          renderTeamManagement();
        }
      )
    );
  }

  if (isOwner()) {
    unsubscribeList.push(
      onSnapshot(collection(db, "adminRequests"), (snapshot) => {
        adminRequests = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((a, b) => createdMillis(b) - createdMillis(a));

        renderAdmin();
      })
    );
  }
}

function scamCheck(payload) {
  const text = Object.values(payload)
    .filter((value) => typeof value === "string" || typeof value === "number")
    .join(" ")
    .toLowerCase();

  const keywords = [
    "double money",
    "duit berganda",
    "guaranteed profit",
    "investment",
    "pinjaman segera",
    "loan approved",
    "free diamond",
    "hack account",
    "account seller",
    "jual account",
    "deposit now",
    "telegram only",
    "scam",
    "fake receipt",
    "judi",
    "betting"
  ];

  const matched = keywords.filter((word) => text.includes(word));

  return {
    blocked: matched.length > 0,
    reason: matched.join(", ")
  };
}

async function createPost(type, data) {
  if (!requireActiveAccount()) return;

  const check = scamCheck(data);

  const payload = {
    ...data,
    type,
    createdBy: currentUser.uid,
    createdByEmail: currentUser.email.toLowerCase(),
    createdByName: profile?.displayName || currentUser.email,
    status: check.blocked ? "blocked" : "active",
    blockReason: check.blocked ? check.reason : "",
    reservations: [],
    registrations: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await addDoc(collection(db, "posts"), payload);

  if (check.blocked) {
    toast("AI bot blocked this post because it looks risky.", "error");
  } else {
    toast("Post submitted successfully.", "success");
  }
}

function renderFeed() {
  const filter = $("#feedFilter").value;

  const visiblePosts = posts.filter((post) => {
    if (post.status !== "active" && post.status !== "closed") return false;
    if (post.type === "adOrder") return false;
    if (filter !== "all" && post.type !== filter) return false;

    return true;
  });

  $("#feedList").innerHTML = visiblePosts.length
    ? visiblePosts.map(renderPostCard).join("")
    : `<div class="empty">No post found.</div>`;
}

function renderPostCard(post) {
  const type = postTypeLabel(post.type);
  const status = getPostScheduleStatus(post);
  const totalRegistered = registrationCount(post);

  let details = "";

  if (post.type === "scrim") {
    details = `
      <li><b>Team:</b> ${esc(post.teamName)}</li>
      <li><b>Date:</b> ${esc(post.date)} · ${esc(post.time)}</li>
      <li><b>Format:</b> ${esc(post.format)}</li>
      <li><b>Live Score:</b> ${Number(post.scoreA || 0)} - ${Number(post.scoreB || 0)}</li>
      <li><b>Registered:</b> ${totalRegistered}</li>
    `;
  }

  if (post.type === "tournament") {
    details = `
      <li><b>Tournament:</b> ${esc(post.tournamentName)}</li>
      <li><b>Date:</b> ${esc(post.date)} · ${esc(post.time)}</li>
      <li><b>Fee:</b> ${money(post.registrationFee)}</li>
      <li><b>Prizepool:</b> ${money(post.prizepool)}</li>
      <li><b>Slots:</b> ${totalRegistered}/${Number(post.maxParticipant || 0)}</li>
      <li><b>Venue:</b> ${esc(post.venueType)}${post.location ? ` · ${esc(post.location)}` : ""}</li>
      <li><b>Format:</b> ${esc(post.format)}</li>
      <li><b>Bank:</b> ${esc(post.bankName)}</li>
      <li><b>Account:</b> ${esc(post.bankAccount)}</li>
      <li>
        <b>Receipt:</b>
        <a class="btn ghost" target="_blank" href="${esc(post.whatsappUrl)}">
          Send Receipt Via WhatsApp
        </a>
      </li>
    `;
  }

  if (post.type === "recruitPlayer") {
    details = `
      <li><b>Team:</b> ${esc(post.teamName)}</li>
      <li><b>Highest Rank:</b> ${esc(post.highestRank)}</li>
      <li><b>Role:</b> ${esc(post.mlRole)}</li>
      <li><b>Winrate:</b> ${esc(post.winrate)}%</li>
      <li><b>Location:</b> ${esc(post.location)}</li>
      <li><b>Age:</b> ${esc(post.age)}</li>
      <li><b>Reserved:</b> ${(post.reservations || []).length}</li>
    `;
  }

  if (post.type === "recruitStaff") {
    details = `
      <li><b>Team:</b> ${esc(post.teamName)}</li>
      <li><b>Looking For:</b> ${esc(post.lookingFor)}</li>
      <li><b>Requirement:</b> ${esc(post.requirement)}</li>
      <li><b>Reserved:</b> ${(post.reservations || []).length}</li>
    `;
  }

  if (post.type === "advertisement") {
    details = `
      <li><b>Community / Store:</b> ${esc(post.communityName)}</li>
      <li><b>Country:</b> ${esc(post.country)}</li>
      <li><b>Language:</b> ${esc(post.language)}</li>
      <li><b>Promotion:</b> ${esc(post.text)}</li>
      ${
        post.link
          ? `<li><a class="btn ghost" target="_blank" href="${esc(post.link)}">Open Link</a></li>`
          : ""
      }
    `;
  }

  const isCreator = currentUser && post.createdBy === currentUser.uid;
  const canCloseTournament = post.type === "tournament" && (isCreator || isApprovedAdmin());

  const supportsRegister = ["scrim", "tournament"].includes(post.type);
  const canRegister = supportsRegister && post.status === "active";
  const canReserve = ["recruitPlayer", "recruitStaff"].includes(post.type);

  return `
    <article class="card post-card">
      <div class="row-actions">
        ${badge(type)}
        ${badge(status, status === "live" ? "success" : status === "ended" || status === "closed" ? "danger" : "warning")}
      </div>

      <div>
        <h3>${esc(postTitle(post))}</h3>
        <p class="muted small">By ${esc(post.createdByName || post.createdByEmail || "User")}</p>
      </div>

      <ul class="post-meta">
        ${details}
      </ul>

      <div class="row-actions">
        ${
          canRegister
            ? `<button class="btn primary" data-action="openRegistration" data-id="${esc(post.id)}">Register</button>`
            : ""
        }

        ${
          supportsRegister && !canRegister
            ? `<button class="btn ghost" type="button" disabled>Registration Closed</button>`
            : ""
        }

        ${
          canReserve
            ? `<button class="btn primary" data-action="reserve" data-id="${esc(post.id)}">Reserve Slot</button>`
            : ""
        }

        ${
          canCloseTournament && post.status !== "closed"
            ? `<button class="btn ghost" data-action="closeTournament" data-id="${esc(post.id)}">Close Registration</button>`
            : ""
        }

        ${
          isCreator && post.type === "scrim"
            ? `
              <button class="btn ghost" data-action="scoreA" data-id="${esc(post.id)}">+ Team</button>
              <button class="btn ghost" data-action="scoreB" data-id="${esc(post.id)}">+ Opponent</button>
            `
            : ""
        }
      </div>
    </article>
  `;
}

function renderTeams() {
  $("#teamsList").innerHTML = teams.length
    ? teams.map(renderTeamCard).join("")
    : `<div class="empty">No team registered yet.</div>`;

  fillTeamSelects();
}

function renderTeamCard(team) {
  const players = team.players || [];

  return `
    <article class="card">
      <div class="row-actions">
        ${badge(team.tier || getTier(team.averageStar), "success")}
        ${badge(`${Number(team.rankPoints || 0)} pts`)}
      </div>

      <h3 style="margin-top:.8rem">${esc(team.name)}</h3>

      <p class="muted small">
        W ${Number(team.wins || 0)} ·
        D ${Number(team.draws || 0)} ·
        L ${Number(team.losses || 0)}
      </p>

      <div class="player-list">
        ${players.map((p) => `
          <div class="player-item">
            <b>${esc(p.name)}</b>

            <p class="muted small" style="margin:.2rem 0 0">
              ID: ${esc(p.mlId)} · Server: ${esc(p.server)} · ${esc(p.role)} · Age ${esc(p.age)}
            </p>
          </div>
        `).join("")}
      </div>
    </article>
  `;
}

function renderLeaderboard() {
  const sorted = [...teams].sort((a, b) => {
    const points = Number(b.rankPoints || 0) - Number(a.rankPoints || 0);
    if (points !== 0) return points;

    return Number(b.wins || 0) - Number(a.wins || 0);
  });

  if (!sorted.length) {
    $("#leaderboardList").innerHTML = `<div class="empty">No leaderboard data yet.</div>`;
    return;
  }

  $("#leaderboardList").innerHTML = `
    <table class="table">
      <thead>
        <tr>
          <th>#</th>
          <th>Team</th>
          <th>Tier</th>
          <th>Points</th>
          <th>Win</th>
          <th>Draw</th>
          <th>Loss</th>
          <th>Total Scrim</th>
        </tr>
      </thead>

      <tbody>
        ${sorted.map((team, index) => `
          <tr>
            <td>${index + 1}</td>
            <td><b>${esc(team.name)}</b></td>
            <td>${esc(team.tier || getTier(team.averageStar))}</td>
            <td>${Number(team.rankPoints || 0)}</td>
            <td>${Number(team.wins || 0)}</td>
            <td>${Number(team.draws || 0)}</td>
            <td>${Number(team.losses || 0)}</td>
            <td>${Number(team.totalScrims || 0)}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}

function renderLive() {
  const livePosts = posts.filter((post) => {
    if (post.status === "blocked" || post.status === "cancelled") return false;
    if (!["scrim", "tournament"].includes(post.type)) return false;

    const status = getPostScheduleStatus(post);
    return ["upcoming", "live"].includes(status);
  });

  $("#liveList").innerHTML = livePosts.length
    ? livePosts.map(renderPostCard).join("")
    : `<div class="empty">No live or upcoming scrim/tournament.</div>`;
}

function fillTeamSelects() {
  const myTeams = teams.filter(isMyTeam);
  const managedTeams = teams.filter(isMyManagedTeam);

  const option = (team) => `<option value="${esc(team.id)}">${esc(team.name)}</option>`;

  $("#roleTeamSelect").innerHTML = myTeams.length
    ? myTeams.map(option).join("")
    : `<option value="">No team access</option>`;

  $("#resultTeamSelect").innerHTML = managedTeams.length
    ? managedTeams.map(option).join("")
    : `<option value="">No managed team</option>`;

  $("#opponentTeamSelect").innerHTML = teams.length
    ? teams.map(option).join("")
    : `<option value="">No opponent team</option>`;
}

function renderTeamManagement() {
  if (!currentUser) {
    $("#myTeamsPanel").innerHTML = `<div class="empty">Login first.</div>`;
    $("#teamInbox").innerHTML = "";
    $("#bracketTools").innerHTML = "";
    return;
  }

  const myTeams = teams.filter(isMyTeam);

  $("#myTeamsPanel").innerHTML = myTeams.length
    ? myTeams.map(renderTeamCard).join("")
    : `<div class="empty">No team access yet.</div>`;

  const pendingRequests = teamRequests.filter((request) => request.status === "pending");

  $("#teamInbox").innerHTML = pendingRequests.length
    ? pendingRequests.map((request) => `
      <div class="player-item">
        <b>${esc(request.teamName)}</b>

        <p class="muted small">
          ${esc(request.requesterName || request.requesterEmail)}
          wants to add you as ${esc(request.requestRole)}.
        </p>

        <div class="row-actions">
          <button class="btn success" data-action="approveTeamRequest" data-id="${esc(request.id)}">Approve</button>
          <button class="btn danger" data-action="rejectTeamRequest" data-id="${esc(request.id)}">Reject</button>
        </div>
      </div>
    `).join("")
    : `<div class="empty">No pending request.</div>`;

  fillTeamSelects();
  renderBracketTools();
}

function tournamentReadyForBracket(post) {
  const totalRegistered = registrationCount(post);
  const full = totalRegistered >= Number(post.maxParticipant || 0);
  const closed = post.status === "closed" || post.registrationClosed === true;

  return post.type === "tournament" && (full || closed);
}

function renderBracketTools() {
  const myTournaments = posts.filter((post) => {
    return post.type === "tournament" &&
      post.createdBy === currentUser?.uid &&
      tournamentReadyForBracket(post);
  });

  if (!myTournaments.length) {
    $("#bracketTools").innerHTML = `<div class="empty">No tournament is ready for bracket yet.</div>`;
    return;
  }

  $("#bracketTools").innerHTML = myTournaments.map((post) => `
    <div class="player-item">
      <div class="row-actions">
        <h4>${esc(post.tournamentName)}</h4>
        ${badge(`${registrationCount(post)}/${post.maxParticipant} teams`)}
      </div>

      <div class="row-actions" style="margin-top:.7rem">
        <button class="btn primary" data-action="generateBracket" data-id="${esc(post.id)}">Generate Bracket</button>
        <button class="btn ghost" data-action="advanceBracket" data-id="${esc(post.id)}">Advance Round</button>
      </div>

      ${renderBracket(post)}
    </div>
  `).join("");
}

function renderBracket(post) {
  const rounds = post.bracket?.rounds || [];

  if (!rounds.length) {
    return `<div class="empty" style="margin-top:.8rem">No bracket yet.</div>`;
  }

  return `
    <div class="bracket">
      ${rounds.map((round, roundIndex) => `
        <div>
          <h4>${esc(round.name || `Round ${roundIndex + 1}`)}</h4>

          ${round.matches.map((match, matchIndex) => `
            <div class="match">
              <b>${esc(match.a || "TBD")} vs ${esc(match.b || "BYE")}</b>
              <p class="muted small">Winner: ${esc(match.winner || "-")}</p>

              <div class="row-actions">
                ${
                  match.a
                    ? `<button class="btn ghost" data-action="setWinner" data-id="${esc(post.id)}" data-round="${roundIndex}" data-match="${matchIndex}" data-winner="${esc(match.a)}">${esc(match.a)} Win</button>`
                    : ""
                }

                ${
                  match.b
                    ? `<button class="btn ghost" data-action="setWinner" data-id="${esc(post.id)}" data-round="${roundIndex}" data-match="${matchIndex}" data-winner="${esc(match.b)}">${esc(match.b)} Win</button>`
                    : ""
                }
              </div>
            </div>
          `).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function renderAdmin() {
  if (!isApprovedAdmin()) return;

  const pendingAdmins = adminRequests.filter((request) => request.status === "pending");

  $("#adminRequestsList").innerHTML = pendingAdmins.length
    ? pendingAdmins.map((request) => `
      <div class="player-item">
        <b>${esc(request.displayName || request.email)}</b>
        <p class="muted small">${esc(request.email)}</p>

        <div class="row-actions">
          <button class="btn success" data-action="approveAdmin" data-id="${esc(request.id)}">Approve</button>
          <button class="btn danger" data-action="rejectAdmin" data-id="${esc(request.id)}">Reject</button>
        </div>
      </div>
    `).join("")
    : `<div class="empty">No pending admin request.</div>`;

  const orders = posts.filter((post) => post.type === "adOrder");

  $("#adOrdersList").innerHTML = orders.length
    ? orders.map((order) => `
      <div class="player-item">
        <b>${esc(order.communityName)}</b>

        <ul class="info-list" style="margin-top:.5rem">
          <li><b>Country:</b> ${esc(order.country)}</li>
          <li><b>Language:</b> ${esc(order.language)}</li>
          <li><b>Payer Name:</b> ${esc(order.payerName)}</li>
          <li><b>Status:</b> ${esc(order.status)}</li>
        </ul>

        <div class="row-actions" style="margin-top:.7rem">
          <a class="btn primary" target="_blank" href="${esc(order.whatsappUrl)}">Contact Customer</a>
          <button class="btn danger" data-action="deletePost" data-id="${esc(order.id)}">Delete</button>
        </div>
      </div>
    `).join("")
    : `<div class="empty">No advertisement order yet.</div>`;

  const blocked = posts.filter((post) => post.status === "blocked");

  $("#blockedPostsList").innerHTML = blocked.length
    ? blocked.map((post) => `
      <div class="player-item">
        <b>${esc(postTitle(post))}</b>
        <p class="muted small">Type: ${esc(postTypeLabel(post.type))}</p>
        <p class="muted small">Reason: ${esc(post.blockReason || "Risky content")}</p>

        <div class="row-actions">
          <button class="btn success" data-action="approveBlockedPost" data-id="${esc(post.id)}">Approve Post</button>
          <button class="btn danger" data-action="deletePost" data-id="${esc(post.id)}">Delete</button>
        </div>
      </div>
    `).join("")
    : `<div class="empty">No blocked post.</div>`;
}

function renderAll() {
  renderAuthMini();
  renderRoleAccess();
  renderFeed();
  renderTeams();
  renderLeaderboard();
  renderLive();
  renderTeamManagement();
  renderAdmin();
}

function openRegistrationPage(postId) {
  if (!requireActiveAccount()) return;

  const post = posts.find((item) => item.id === postId);

  if (!post) {
    toast("Post not found.", "error");
    return;
  }

  if (!["scrim", "tournament"].includes(post.type)) {
    toast("This post does not support registration.", "error");
    return;
  }

  if (post.status !== "active") {
    toast("Registration for this post is closed.", "error");
    return;
  }

  selectedRegistrationPostId = postId;

  const isTournament = post.type === "tournament";

  $("#registrationPostSummary").innerHTML = `
    <ul class="info-list">
      <li><b>Type:</b> ${esc(postTypeLabel(post.type))}</li>
      <li><b>Name:</b> ${esc(postTitle(post))}</li>
      <li><b>Date:</b> ${esc(post.date || "-")} · ${esc(post.time || "-")}</li>
      <li><b>Format:</b> ${esc(post.format || "-")}</li>

      ${
        isTournament
          ? `
            <li><b>Fee:</b> ${money(post.registrationFee)}</li>
            <li><b>Prizepool:</b> ${money(post.prizepool)}</li>
            <li><b>Slots:</b> ${registrationCount(post)}/${Number(post.maxParticipant || 0)}</li>
            <li>
              <b>Receipt WhatsApp:</b>
              <a class="btn ghost" href="${esc(post.whatsappUrl)}" target="_blank">
                Open WhatsApp
              </a>
            </li>
          `
          : `<li><b>Registered:</b> ${registrationCount(post)}</li>`
      }
    </ul>
  `;

  $("#registrationForm").reset();

  if (isTournament && post.whatsappUrl) {
    $("#regReceiptLink").value = post.whatsappUrl;
    $("#regReceiptLink").required = true;
  } else {
    $("#regReceiptLink").value = "";
    $("#regReceiptLink").required = false;
  }

  showTab("registration");
}

async function submitRegistration() {
  if (!requireActiveAccount()) return;

  if (!selectedRegistrationPostId) {
    toast("No selected post.", "error");
    return;
  }

  const teamName = $("#regTeamName").value.trim();
  const leaderName = $("#regLeaderName").value.trim();
  const leaderPhone = normalizePhone($("#regLeaderPhone").value.trim());
  const receiptWhatsappLink = $("#regReceiptLink").value.trim();

  if (!teamName || !leaderName || !leaderPhone) {
    toast("Please complete all required details.", "error");
    return;
  }

  const postRef = doc(db, "posts", selectedRegistrationPostId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(postRef);

    if (!snap.exists()) {
      throw new Error("Post not found.");
    }

    const post = snap.data();

    if (!["scrim", "tournament"].includes(post.type)) {
      throw new Error("This post does not support registration.");
    }

    if (post.status !== "active") {
      throw new Error("Registration is closed.");
    }

    const registrations = post.registrations || post.reservations || [];

    const alreadyRegistered = registrations.some((item) => {
      return item.uid === currentUser.uid || item.leaderPhone === leaderPhone;
    });

    if (alreadyRegistered) {
      throw new Error("You already registered for this post.");
    }

    if (post.type === "tournament" && registrations.length >= Number(post.maxParticipant || 0)) {
      throw new Error("Tournament is fully booked.");
    }

    const nextRegistrations = [
      ...registrations,
      {
        uid: currentUser.uid,
        email: currentUser.email.toLowerCase(),
        displayName: profile?.displayName || currentUser.email,
        teamName,
        leaderName,
        leaderPhone,
        leaderWhatsappUrl: whatsappLink(leaderPhone),
        receiptWhatsappLink,
        registeredAt: new Date().toISOString()
      }
    ];

    const updates = {
      registrations: nextRegistrations,
      updatedAt: serverTimestamp()
    };

    if (post.type === "tournament" && nextRegistrations.length >= Number(post.maxParticipant || 0)) {
      updates.status = "closed";
      updates.registrationClosed = true;
    }

    transaction.update(postRef, updates);
  });

  $("#registrationForm").reset();
  selectedRegistrationPostId = null;

  toast("Registration submitted successfully.", "success");
  showTab("home");
}

async function reservePost(postId) {
  if (!requireActiveAccount()) return;

  const ref = doc(db, "posts", postId);

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(ref);

    if (!snap.exists()) {
      throw new Error("Post not found.");
    }

    const post = snap.data();

    if (profile.role === "player" && post.type !== "recruitPlayer") {
      throw new Error("Player account can only reserve player recruitment slots.");
    }

    if (!["recruitPlayer", "recruitStaff"].includes(post.type)) {
      throw new Error("Use Register button for scrim or tournament.");
    }

    if (post.status !== "active") {
      throw new Error("This post is not open.");
    }

    const reservations = post.reservations || [];

    const alreadyReserved = reservations.some((item) => item.uid === currentUser.uid);

    if (alreadyReserved) {
      throw new Error("You already reserved this slot.");
    }

    const nextReservations = [
      ...reservations,
      {
        uid: currentUser.uid,
        email: currentUser.email.toLowerCase(),
        displayName: profile?.displayName || currentUser.email,
        role: profile?.role || "user",
        reservedAt: new Date().toISOString()
      }
    ];

    transaction.update(ref, {
      reservations: nextReservations,
      updatedAt: serverTimestamp()
    });
  });

  toast("Slot reserved successfully.", "success");
}

async function closeTournament(postId) {
  const post = posts.find((item) => item.id === postId);

  if (!post) return;

  if (!currentUser || (post.createdBy !== currentUser.uid && !isApprovedAdmin())) {
    toast("No permission.", "error");
    return;
  }

  await updateDoc(doc(db, "posts", postId), {
    status: "closed",
    registrationClosed: true,
    updatedAt: serverTimestamp()
  });

  toast("Registration closed.", "success");
}

async function generateBracket(postId) {
  const post = posts.find((item) => item.id === postId);

  if (!post || post.createdBy !== currentUser?.uid) {
    toast("No permission.", "error");
    return;
  }

  const participants = getRegistrations(post).map((item) => {
    return item.teamName || item.displayName || item.email;
  });

  if (participants.length < 2) {
    toast("Need at least 2 registered teams.", "error");
    return;
  }

  const matches = [];

  for (let i = 0; i < participants.length; i += 2) {
    matches.push({
      a: participants[i],
      b: participants[i + 1] || "",
      winner: participants[i + 1] ? "" : participants[i]
    });
  }

  await updateDoc(doc(db, "posts", postId), {
    bracket: {
      rounds: [
        {
          name: "Round 1",
          matches
        }
      ]
    },
    updatedAt: serverTimestamp()
  });

  toast("Bracket generated.", "success");
}

async function setWinner(postId, roundIndex, matchIndex, winner) {
  const post = posts.find((item) => item.id === postId);

  if (!post || post.createdBy !== currentUser?.uid) {
    toast("No permission.", "error");
    return;
  }

  const bracket = structuredClone(post.bracket || { rounds: [] });

  bracket.rounds[roundIndex].matches[matchIndex].winner = winner;

  await updateDoc(doc(db, "posts", postId), {
    bracket,
    updatedAt: serverTimestamp()
  });

  toast("Winner updated.", "success");
}

async function advanceBracket(postId) {
  const post = posts.find((item) => item.id === postId);

  if (!post || post.createdBy !== currentUser?.uid) {
    toast("No permission.", "error");
    return;
  }

  const bracket = structuredClone(post.bracket || { rounds: [] });

  if (!bracket.rounds.length) {
    toast("Generate bracket first.", "error");
    return;
  }

  const latestRound = bracket.rounds[bracket.rounds.length - 1];
  const winners = latestRound.matches.map((match) => match.winner).filter(Boolean);

  if (winners.length !== latestRound.matches.length) {
    toast("Please set every match winner first.", "error");
    return;
  }

  if (winners.length === 1) {
    toast(`${winners[0]} is champion.`, "success");
    return;
  }

  const nextMatches = [];

  for (let i = 0; i < winners.length; i += 2) {
    nextMatches.push({
      a: winners[i],
      b: winners[i + 1] || "",
      winner: winners[i + 1] ? "" : winners[i]
    });
  }

  bracket.rounds.push({
    name: `Round ${bracket.rounds.length + 1}`,
    matches: nextMatches
  });

  await updateDoc(doc(db, "posts", postId), {
    bracket,
    updatedAt: serverTimestamp()
  });

  toast("Next round created.", "success");
}

async function approveTeamRequest(requestId) {
  const request = teamRequests.find((item) => item.id === requestId);

  if (!request) return;

  const teamRef = doc(db, "teams", request.teamId);

  await updateDoc(teamRef, {
    [request.requestRole === "manager" ? "managerUids" : "leaderUids"]: arrayUnion(currentUser.uid),
    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "teamJoinRequests", requestId), {
    status: "approved",
    updatedAt: serverTimestamp()
  });

  toast("Request approved.", "success");
}

async function rejectTeamRequest(requestId) {
  await updateDoc(doc(db, "teamJoinRequests", requestId), {
    status: "rejected",
    updatedAt: serverTimestamp()
  });

  toast("Request rejected.");
}

async function approveAdmin(uid) {
  if (!isOwner()) {
    toast("Only owner can approve admin.", "error");
    return;
  }

  await updateDoc(doc(db, "users", uid), {
    role: "admin",
    status: "active",
    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "adminRequests", uid), {
    status: "approved",
    updatedAt: serverTimestamp()
  });

  toast("Admin approved.", "success");
}

async function rejectAdmin(uid) {
  if (!isOwner()) {
    toast("Only owner can reject admin.", "error");
    return;
  }

  await updateDoc(doc(db, "users", uid), {
    role: "player",
    status: "active",
    updatedAt: serverTimestamp()
  });

  await updateDoc(doc(db, "adminRequests", uid), {
    status: "rejected",
    updatedAt: serverTimestamp()
  });

  toast("Admin request rejected.");
}

async function handleClick(event) {
  const tabTarget = event.target.closest("[data-tab-target]")?.dataset.tabTarget;
  const tab = event.target.closest("[data-tab]")?.dataset.tab;

  if (tabTarget) {
    showTab(tabTarget);
  }

  if (tab) {
    showTab(tab);
  }

  const actionButton = event.target.closest("[data-action]");

  if (!actionButton) return;

  const action = actionButton.dataset.action;
  const id = actionButton.dataset.id;

  try {
    if (action === "openRegistration") openRegistrationPage(id);
    if (action === "reserve") await reservePost(id);
    if (action === "closeTournament") await closeTournament(id);

    if (action === "scoreA") {
      await updateDoc(doc(db, "posts", id), {
        scoreA: increment(1),
        updatedAt: serverTimestamp()
      });
    }

    if (action === "scoreB") {
      await updateDoc(doc(db, "posts", id), {
        scoreB: increment(1),
        updatedAt: serverTimestamp()
      });
    }

    if (action === "approveTeamRequest") await approveTeamRequest(id);
    if (action === "rejectTeamRequest") await rejectTeamRequest(id);

    if (action === "generateBracket") await generateBracket(id);
    if (action === "advanceBracket") await advanceBracket(id);

    if (action === "setWinner") {
      await setWinner(
        id,
        Number(actionButton.dataset.round),
        Number(actionButton.dataset.match),
        actionButton.dataset.winner
      );
    }

    if (action === "approveAdmin") await approveAdmin(id);
    if (action === "rejectAdmin") await rejectAdmin(id);

    if (action === "approveBlockedPost") {
      if (!isApprovedAdmin()) {
        throw new Error("No permission.");
      }

      await updateDoc(doc(db, "posts", id), {
        status: "active",
        blockReason: "",
        updatedAt: serverTimestamp()
      });

      toast("Post approved.", "success");
    }

    if (action === "deletePost") {
      if (!isApprovedAdmin()) {
        throw new Error("No permission.");
      }

      await deleteDoc(doc(db, "posts", id));
      toast("Deleted.");
    }
  } catch (error) {
    toast(error.message, "error");
  }
}

function initForms() {
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await signInWithEmailAndPassword(
        auth,
        $("#loginEmail").value.trim().toLowerCase(),
        $("#loginPassword").value
      );

      event.target.reset();
      showTab("home");
      toast("Login successful.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#signupForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    const displayName = $("#signupName").value.trim();
    const email = $("#signupEmail").value.trim().toLowerCase();
    const password = $("#signupPassword").value;
    const selectedRole = $("#signupRole").value;

    try {
      isSigningUp = true;

      const credential = await createUserWithEmailAndPassword(auth, email, password);

      currentUser = credential.user;

      await updateProfile(credential.user, {
        displayName
      });

      await ensureUserDoc(credential.user, {
        displayName,
        role: selectedRole
      });

      isSigningUp = false;

      await loadProfile();
      startRealtimeListeners();

      event.target.reset();

      const message =
        selectedRole === "admin"
          ? "Account created. Admin access is pending owner approval."
          : `Account created successfully as ${ROLE_LABEL[selectedRole] || selectedRole}.`;

      toast(message, "success");
      showTab("home");
    } catch (error) {
      isSigningUp = false;
      toast(error.message, "error");
    }
  });

  $("#forgotPasswordBtn").addEventListener("click", async () => {
    const email = $("#loginEmail").value.trim().toLowerCase() || prompt("Enter your email:");

    if (!email) return;

    try {
      await sendPasswordResetEmail(auth, email);
      toast("Password reset link sent to email.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#registrationForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await submitRegistration();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#scrimForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await createPost("scrim", {
        teamName: $("#scrimTeamName").value.trim(),
        date: $("#scrimDate").value,
        time: $("#scrimTime").value,
        format: $("#scrimFormat").value,
        scoreA: 0,
        scoreB: 0
      });

      event.target.reset();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#tournamentForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      const venueType = $("#tourVenueType").value;
      const phone = $("#tourPhone").value.trim();

      await createPost("tournament", {
        tournamentName: $("#tourName").value.trim(),
        date: $("#tourDate").value,
        time: $("#tourTime").value,
        registrationFee: Number($("#tourFee").value),
        prizepool: Number($("#tourPrizepool").value),
        maxParticipant: Number($("#tourMax").value),
        venueType,
        location: venueType === "offline" ? $("#tourLocation").value.trim() : "",
        format: $("#tourFormat").value,
        bankName: $("#tourBank").value,
        bankAccount: $("#tourBankAccount").value.trim(),
        organizerPhonePrivate: normalizePhone(phone),
        whatsappUrl: whatsappLink(phone),
        registrationClosed: false
      });

      event.target.reset();
      updateBankPreview();
      $("#tourLocationWrap").classList.add("hidden");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#recruitPlayerForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await createPost("recruitPlayer", {
        teamName: $("#rpTeam").value.trim(),
        highestRank: $("#rpRank").value.trim(),
        mlRole: $("#rpRole").value,
        winrate: Number($("#rpWinrate").value),
        location: $("#rpLocation").value.trim(),
        age: Number($("#rpAge").value)
      });

      event.target.reset();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#recruitStaffForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    try {
      await createPost("recruitStaff", {
        teamName: $("#rsTeam").value.trim(),
        lookingFor: $("#rsLookingFor").value,
        requirement: $("#rsRequirement").value.trim()
      });

      event.target.reset();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#adOrderForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!requireActiveAccount()) return;

    try {
      const phone = $("#adPhone").value.trim();

      await addDoc(collection(db, "posts"), {
        type: "adOrder",
        communityName: $("#adName").value.trim(),
        country: $("#adCountry").value.trim(),
        language: $("#adLanguage").value.trim(),
        payerName: $("#adPayerName").value.trim(),
        customerPhonePrivate: normalizePhone(phone),
        whatsappUrl: whatsappLink(phone),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email.toLowerCase(),
        createdByName: profile?.displayName || currentUser.email,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      event.target.reset();
      toast("Advertisement order submitted. Status: pending.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#teamForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!requireActiveAccount()) return;

    if (!canCreateTeam()) {
      toast("Only team leader, team manager, admin or owner can create team.", "error");
      return;
    }

    try {
      const averageStar = Number($("#teamAverageStar").value);
      const tier = getTier(averageStar);

      await addDoc(collection(db, "teams"), {
        name: $("#teamName").value.trim(),
        players: parsePlayers($("#teamPlayers").value),
        averageStar,
        tier,
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email.toLowerCase(),
        createdByName: profile?.displayName || currentUser.email,
        leaderUids: profile?.role === "teamLeader" ? [currentUser.uid] : [],
        managerUids: profile?.role === "teamManager" || isOwner() ? [currentUser.uid] : [],
        rankPoints: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        totalScrims: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      event.target.reset();
      toast(`Team created as ${tier}.`, "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#addTeamRoleForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!requireActiveAccount()) return;

    try {
      const teamId = $("#roleTeamSelect").value;
      const team = teams.find((item) => item.id === teamId);

      if (!team || !isMyTeam(team)) {
        throw new Error("You do not have access to this team.");
      }

      const email = $("#roleTargetEmail").value.trim().toLowerCase();

      const userSnapshot = await getDocs(
        query(collection(db, "users"), where("email", "==", email))
      );

      if (userSnapshot.empty) {
        throw new Error("User email not found. Ask them to sign up first.");
      }

      const userDoc = userSnapshot.docs[0].data();

      await addDoc(collection(db, "teamJoinRequests"), {
        teamId,
        teamName: team.name,
        targetUid: userDoc.uid,
        targetEmail: userDoc.email,
        targetName: userDoc.displayName,
        requesterUid: currentUser.uid,
        requesterEmail: currentUser.email.toLowerCase(),
        requesterName: profile?.displayName || currentUser.email,
        requestRole: $("#roleAccessType").value,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      event.target.reset();
      toast("Approval request sent to user's inbox.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#scrimResultForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!requireActiveAccount()) return;

    try {
      const teamId = $("#resultTeamSelect").value;
      const opponentId = $("#opponentTeamSelect").value;
      const outcome = $("#resultOutcome").value;
      const score = $("#resultScore").value.trim();

      const myTeam = teams.find((team) => team.id === teamId);
      const opponentTeam = teams.find((team) => team.id === opponentId);

      if (!myTeam || !isMyManagedTeam(myTeam)) {
        throw new Error("Only team manager can upload result for this team.");
      }

      if (!opponentTeam || opponentTeam.id === myTeam.id) {
        throw new Error("Choose valid opponent team.");
      }

      const myUpdate = {
        totalScrims: increment(1),
        updatedAt: serverTimestamp()
      };

      const opponentUpdate = {
        totalScrims: increment(1),
        updatedAt: serverTimestamp()
      };

      if (outcome === "win") {
        myUpdate.rankPoints = increment(3);
        myUpdate.wins = increment(1);
        opponentUpdate.losses = increment(1);
      }

      if (outcome === "draw") {
        myUpdate.rankPoints = increment(1);
        myUpdate.draws = increment(1);
        opponentUpdate.rankPoints = increment(1);
        opponentUpdate.draws = increment(1);
      }

      if (outcome === "loss") {
        myUpdate.losses = increment(1);
        opponentUpdate.rankPoints = increment(3);
        opponentUpdate.wins = increment(1);
      }

      await updateDoc(doc(db, "teams", myTeam.id), myUpdate);
      await updateDoc(doc(db, "teams", opponentTeam.id), opponentUpdate);

      await addDoc(collection(db, "scrimResults"), {
        teamId: myTeam.id,
        teamName: myTeam.name,
        opponentId: opponentTeam.id,
        opponentName: opponentTeam.name,
        outcome,
        score,
        uploadedBy: currentUser.uid,
        uploadedByEmail: currentUser.email.toLowerCase(),
        createdAt: serverTimestamp()
      });

      event.target.reset();
      toast("Scrim result uploaded.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });

  $("#adminAdUploadForm").addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!isApprovedAdmin()) {
      toast("Only owner or approved admin can upload advertisement.", "error");
      return;
    }

    try {
      await addDoc(collection(db, "posts"), {
        type: "advertisement",
        communityName: $("#adminAdName").value.trim(),
        country: $("#adminAdCountry").value.trim(),
        language: $("#adminAdLanguage").value.trim(),
        text: $("#adminAdText").value.trim(),
        link: $("#adminAdLink").value.trim(),
        createdBy: currentUser.uid,
        createdByEmail: currentUser.email.toLowerCase(),
        createdByName: profile?.displayName || currentUser.email,
        status: "active",
        reservations: [],
        registrations: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      event.target.reset();
      toast("Advertisement published.", "success");
    } catch (error) {
      toast(error.message, "error");
    }
  });
}

function initStaticEvents() {
  document.body.addEventListener("click", handleClick);

  $("#feedFilter").addEventListener("change", renderFeed);

  $("#tourVenueType").addEventListener("change", () => {
    const offline = $("#tourVenueType").value === "offline";

    $("#tourLocationWrap").classList.toggle("hidden", !offline);
    $("#tourLocation").required = offline;
  });

  $("#tourBank").addEventListener("change", updateBankPreview);

  $("#languageSelect").addEventListener("change", () => {
    const lang = $("#languageSelect").value;

    localStorage.setItem("kyougiLang", lang);

    $("#tagline").textContent = TRANSLATIONS[lang] || TRANSLATIONS.en;
  });
}

function initApp() {
  $("#year").textContent = new Date().getFullYear();

  const savedLang = localStorage.getItem("kyougiLang") || "en";

  $("#languageSelect").value = savedLang;
  $("#tagline").textContent = TRANSLATIONS[savedLang] || TRANSLATIONS.en;

  populateBankSelect();
  initStaticEvents();
  initForms();

  onAuthStateChanged(auth, async (user) => {
    currentUser = user;

    if (isSigningUp) return;

    await loadProfile();
    startRealtimeListeners();
  });
}

initApp();