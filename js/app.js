import { firebaseConfig } from "./firebase-config.js";

const ADMIN_EMAIL = "shinjsu92@gmail.com";
const GUESTBOOK_CODE = "0705";

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");

// ===== 스크롤 시 부드럽게 나타나기 =====
const revealObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

document.querySelectorAll("main section, .footer").forEach((el) => {
  el.classList.add("reveal");
  revealObserver.observe(el);
});

// ===== 공통 요소 =====
const photoGrid = document.getElementById("photo-grid");
const galleryEmpty = document.getElementById("gallery-empty");
const pendingBox = document.getElementById("admin-pending");
const pendingGrid = document.getElementById("pending-grid");
const pendingEmpty = document.getElementById("pending-empty");
const guestbookList = document.getElementById("guestbook-list");
const guestbookEmpty = document.getElementById("guestbook-empty");
const guestbookForm = document.getElementById("guestbook-form");
const gbStatus = document.getElementById("gb-status");
const uploadModal = document.getElementById("upload-modal");
const uploadForm = document.getElementById("upload-form");
const uploadStatus = document.getElementById("upload-status");
const uploadSubmit = document.getElementById("upload-submit");
const adminLoginBtn = document.getElementById("admin-login");
const adminLogoutBtn = document.getElementById("admin-logout");
const adminInfo = document.getElementById("admin-info");

let photos = []; // 라이트박스 탐색용 (승인된 사진)
let db = null;
let storage = null;
let auth = null;
let fs = null; // firestore 모듈
let st = null; // storage 모듈
let au = null; // auth 모듈
let isAdmin = false;
let unsubPending = null;

if (!configured) {
  document.getElementById("setup-notice-gallery").hidden = false;
  document.getElementById("setup-notice-guestbook").hidden = false;
  document.getElementById("open-upload").disabled = true;
  guestbookForm.querySelector("button[type=submit]").disabled = true;
  adminLoginBtn.hidden = true;
} else {
  init();
}

async function init() {
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
  );
  fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  st = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");
  au = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js");

  const app = initializeApp(firebaseConfig);
  db = fs.getFirestore(app);
  storage = st.getStorage(app);
  auth = au.getAuth(app);

  au.onAuthStateChanged(auth, (user) => {
    isAdmin = !!user && user.email === ADMIN_EMAIL;
    updateAdminUI(user);
  });

  watchPhotos();
  watchGuestbook();
}

// ===== 가족(관리자) 로그인 =====
adminLoginBtn.addEventListener("click", async () => {
  try {
    const provider = new au.GoogleAuthProvider();
    const cred = await au.signInWithPopup(auth, provider);
    if (cred.user.email !== ADMIN_EMAIL) {
      alert("가족 계정이 아닙니다.");
      await au.signOut(auth);
    }
  } catch (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      console.error("로그인 실패:", err);
      alert("로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.");
    }
  }
});

adminLogoutBtn.addEventListener("click", () => au.signOut(auth));

function updateAdminUI(user) {
  adminLoginBtn.hidden = isAdmin;
  adminLogoutBtn.hidden = !isAdmin;
  adminInfo.hidden = !isAdmin;
  adminInfo.textContent = isAdmin ? user.email : "";
  pendingBox.hidden = !isAdmin;

  if (isAdmin && !unsubPending) {
    watchPending();
  } else if (!isAdmin && unsubPending) {
    unsubPending();
    unsubPending = null;
  }
  renderPhotos(); // 삭제 버튼 표시/숨김 갱신
}

// ===== 사진첩 (승인된 사진) =====
function watchPhotos() {
  // orderBy 없이 where만 사용해 복합 색인 없이 동작하도록 하고, 정렬은 브라우저에서 합니다.
  const q = fs.query(
    fs.collection(db, "photos"),
    fs.where("approved", "==", true),
    fs.limit(300)
  );
  fs.onSnapshot(q, (snap) => {
    photos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderPhotos();
  }, (err) => {
    console.error("사진첩 불러오기 실패:", err);
    galleryEmpty.textContent = "사진첩을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    galleryEmpty.hidden = false;
  });
}

function renderPhotos() {
  photoGrid.innerHTML = "";
  galleryEmpty.hidden = photos.length > 0;
  photos.forEach((p, i) => {
    const card = buildPhotoCard(p, () => openLightbox(i));
    if (isAdmin) {
      const del = document.createElement("button");
      del.className = "photo-del";
      del.textContent = "✕";
      del.title = "사진 삭제";
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("이 사진을 삭제할까요?")) deletePhoto(p);
      });
      card.appendChild(del);
    }
    photoGrid.appendChild(card);
  });
}

function buildPhotoCard(p, onClick) {
  const card = document.createElement("div");
  card.className = "photo-card";
  card.setAttribute("role", "button");
  card.tabIndex = 0;

  const img = document.createElement("img");
  img.src = p.url;
  img.alt = p.caption || "추모 사진";
  img.loading = "lazy";
  card.appendChild(img);

  const metaText = [p.caption, p.uploader && `- ${p.uploader}`].filter(Boolean).join(" ");
  if (metaText) {
    const meta = document.createElement("div");
    meta.className = "photo-meta";
    meta.textContent = metaText;
    card.appendChild(meta);
  }

  if (onClick) {
    card.addEventListener("click", onClick);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") onClick();
    });
  }
  return card;
}

// ===== 승인 대기 사진 (가족 전용) =====
function watchPending() {
  const q = fs.query(
    fs.collection(db, "photos"),
    fs.where("approved", "==", false),
    fs.limit(100)
  );
  unsubPending = fs.onSnapshot(q, (snap) => {
    const pending = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    renderPending(pending);
  }, (err) => console.error("대기 사진 불러오기 실패:", err));
}

function renderPending(pending) {
  pendingGrid.innerHTML = "";
  pendingEmpty.hidden = pending.length > 0;
  pending.forEach((p) => {
    const card = buildPhotoCard(p, null);

    const actions = document.createElement("div");
    actions.className = "pending-actions";

    const approve = document.createElement("button");
    approve.className = "btn btn-primary";
    approve.textContent = "승인";
    approve.addEventListener("click", async () => {
      try {
        await fs.updateDoc(fs.doc(db, "photos", p.id), { approved: true });
      } catch (err) {
        console.error("승인 실패:", err);
        alert("승인에 실패했습니다.");
      }
    });

    const reject = document.createElement("button");
    reject.className = "btn btn-danger";
    reject.textContent = "삭제";
    reject.addEventListener("click", () => {
      if (confirm("이 사진을 삭제할까요?")) deletePhoto(p);
    });

    actions.append(approve, reject);
    card.appendChild(actions);
    pendingGrid.appendChild(card);
  });
}

async function deletePhoto(p) {
  try {
    await fs.deleteDoc(fs.doc(db, "photos", p.id));
    if (p.path) {
      await st.deleteObject(st.ref(storage, p.path)).catch((err) => {
        // 파일이 이미 없더라도 문서 삭제는 유지합니다.
        console.warn("저장소 파일 삭제 실패:", err);
      });
    }
  } catch (err) {
    console.error("삭제 실패:", err);
    alert("삭제에 실패했습니다.");
  }
}

// ===== 사진 업로드 (누구나, 승인 후 게시) =====
document.getElementById("open-upload").addEventListener("click", () => {
  uploadModal.hidden = false;
});

uploadModal.querySelectorAll("[data-close-modal]").forEach((el) =>
  el.addEventListener("click", () => {
    uploadModal.hidden = true;
    uploadForm.reset();
    uploadStatus.textContent = "";
  })
);

uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = document.getElementById("up-file").files[0];
  if (!file) return;

  uploadSubmit.disabled = true;
  uploadStatus.textContent = "사진을 준비하는 중...";

  try {
    const blob = await resizeImage(file, 1600, 0.85);
    uploadStatus.textContent = "업로드 중...";

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const path = `photos/${id}.jpg`;
    const storageRef = st.ref(storage, path);
    await st.uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    const url = await st.getDownloadURL(storageRef);

    await fs.addDoc(fs.collection(db, "photos"), {
      url,
      path,
      caption: document.getElementById("up-caption").value.trim(),
      uploader: document.getElementById("up-name").value.trim(),
      approved: false,
      createdAt: fs.serverTimestamp(),
    });

    uploadStatus.textContent = "사진이 접수되었습니다. 가족 확인 후 게시됩니다. 감사합니다.";
    uploadForm.reset();
    setTimeout(() => {
      uploadModal.hidden = true;
      uploadStatus.textContent = "";
    }, 2000);
  } catch (err) {
    console.error("업로드 실패:", err);
    uploadStatus.textContent = "업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    uploadSubmit.disabled = false;
  }
});

// 휴대폰 사진이 너무 크지 않도록 긴 변 기준으로 줄여서 올립니다.
function resizeImage(file, maxSize, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (Math.max(width, height) > maxSize) {
        const scale = maxSize / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("이미지 변환 실패"))),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("이미지를 읽을 수 없습니다"));
    };
    img.src = objectUrl;
  });
}

// ===== 라이트박스 =====
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const lightboxCaption = document.getElementById("lightbox-caption");
let lightboxIndex = 0;

function openLightbox(i) {
  lightboxIndex = i;
  updateLightbox();
  lightbox.hidden = false;
}

function updateLightbox() {
  const p = photos[lightboxIndex];
  if (!p) return;
  lightboxImg.src = p.url;
  lightboxImg.alt = p.caption || "추모 사진";
  lightboxCaption.textContent = [p.caption, p.uploader && `- ${p.uploader}`]
    .filter(Boolean)
    .join(" ");
}

lightbox.querySelector(".lightbox-close").addEventListener("click", () => (lightbox.hidden = true));
lightbox.querySelector(".lightbox-prev").addEventListener("click", () => {
  lightboxIndex = (lightboxIndex - 1 + photos.length) % photos.length;
  updateLightbox();
});
lightbox.querySelector(".lightbox-next").addEventListener("click", () => {
  lightboxIndex = (lightboxIndex + 1) % photos.length;
  updateLightbox();
});
lightbox.addEventListener("click", (e) => {
  if (e.target === lightbox) lightbox.hidden = true;
});
document.addEventListener("keydown", (e) => {
  if (lightbox.hidden) return;
  if (e.key === "Escape") lightbox.hidden = true;
  if (e.key === "ArrowLeft") lightbox.querySelector(".lightbox-prev").click();
  if (e.key === "ArrowRight") lightbox.querySelector(".lightbox-next").click();
});

// ===== 방명록 =====
function watchGuestbook() {
  const q = fs.query(
    fs.collection(db, "guestbook"),
    fs.orderBy("createdAt", "desc"),
    fs.limit(200)
  );
  fs.onSnapshot(q, (snap) => {
    renderGuestbook(snap.docs.map((d) => d.data()));
  }, (err) => {
    console.error("방명록 불러오기 실패:", err);
    guestbookEmpty.textContent = "방명록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.";
    guestbookEmpty.hidden = false;
  });
}

function renderGuestbook(entries) {
  guestbookList.innerHTML = "";
  guestbookEmpty.hidden = entries.length > 0;
  entries.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "guestbook-item";

    const head = document.createElement("div");
    head.className = "gb-head";

    const author = document.createElement("span");
    author.className = "gb-author";
    author.textContent = entry.name || "익명";

    const date = document.createElement("span");
    date.className = "gb-date";
    if (entry.createdAt?.toDate) {
      date.textContent = entry.createdAt.toDate().toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    head.append(author, date);

    const body = document.createElement("p");
    body.className = "gb-body";
    body.textContent = entry.message || "";

    li.append(head, body);
    guestbookList.appendChild(li);
  });
}

guestbookForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = document.getElementById("gb-name").value.trim();
  const message = document.getElementById("gb-message").value.trim();
  const code = document.getElementById("gb-code").value.trim();
  if (!name || !message) return;

  gbStatus.classList.remove("ok");
  if (code !== GUESTBOOK_CODE) {
    gbStatus.textContent = "추모 코드가 올바르지 않습니다.";
    return;
  }

  const submitBtn = guestbookForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    await fs.addDoc(fs.collection(db, "guestbook"), {
      name,
      message,
      passcode: code,
      createdAt: fs.serverTimestamp(),
    });
    guestbookForm.reset();
    gbStatus.classList.add("ok");
    gbStatus.textContent = "소중한 글이 등록되었습니다. 감사합니다.";
    setTimeout(() => (gbStatus.textContent = ""), 3000);
  } catch (err) {
    console.error("방명록 등록 실패:", err);
    gbStatus.textContent = "글을 남기지 못했습니다. 잠시 후 다시 시도해 주세요.";
  } finally {
    submitBtn.disabled = false;
  }
});
