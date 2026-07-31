import { firebaseConfig } from "./firebase-config.js";

const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith("YOUR_");

// ===== 공통 요소 =====
const photoGrid = document.getElementById("photo-grid");
const galleryEmpty = document.getElementById("gallery-empty");
const guestbookList = document.getElementById("guestbook-list");
const guestbookEmpty = document.getElementById("guestbook-empty");
const guestbookForm = document.getElementById("guestbook-form");
const uploadModal = document.getElementById("upload-modal");
const uploadForm = document.getElementById("upload-form");
const uploadStatus = document.getElementById("upload-status");
const uploadSubmit = document.getElementById("upload-submit");

let photos = []; // 라이트박스 탐색용
let db = null;
let storage = null;
let fs = null; // firestore 모듈
let st = null; // storage 모듈

if (!configured) {
  document.getElementById("setup-notice-gallery").hidden = false;
  document.getElementById("setup-notice-guestbook").hidden = false;
  document.getElementById("open-upload").disabled = true;
  guestbookForm.querySelector("button[type=submit]").disabled = true;
} else {
  init();
}

async function init() {
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
  );
  fs = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  st = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js");

  const app = initializeApp(firebaseConfig);
  db = fs.getFirestore(app);
  storage = st.getStorage(app);

  watchPhotos();
  watchGuestbook();
}

// ===== 사진첩 =====
function watchPhotos() {
  const q = fs.query(
    fs.collection(db, "photos"),
    fs.orderBy("createdAt", "desc"),
    fs.limit(200)
  );
  fs.onSnapshot(q, (snap) => {
    photos = snap.docs.map((d) => d.data());
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
    const card = document.createElement("button");
    card.type = "button";
    card.className = "photo-card";
    card.setAttribute("aria-label", p.caption || "사진 크게 보기");

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

    card.addEventListener("click", () => openLightbox(i));
    photoGrid.appendChild(card);
  });
}

// ===== 사진 업로드 =====
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
    const storageRef = st.ref(storage, `photos/${id}.jpg`);
    await st.uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    const url = await st.getDownloadURL(storageRef);

    await fs.addDoc(fs.collection(db, "photos"), {
      url,
      caption: document.getElementById("up-caption").value.trim(),
      uploader: document.getElementById("up-name").value.trim(),
      createdAt: fs.serverTimestamp(),
    });

    uploadStatus.textContent = "사진이 등록되었습니다. 감사합니다.";
    uploadForm.reset();
    setTimeout(() => {
      uploadModal.hidden = true;
      uploadStatus.textContent = "";
    }, 1200);
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
  if (!name || !message) return;

  const submitBtn = guestbookForm.querySelector("button[type=submit]");
  submitBtn.disabled = true;
  try {
    await fs.addDoc(fs.collection(db, "guestbook"), {
      name,
      message,
      createdAt: fs.serverTimestamp(),
    });
    guestbookForm.reset();
  } catch (err) {
    console.error("방명록 등록 실패:", err);
    alert("글을 남기지 못했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    submitBtn.disabled = false;
  }
});
