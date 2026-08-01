# Setup Guide

The site is plain HTML/CSS/JS — no build step. Two things to set up: **Firebase** (backend) and **GitHub Pages** (hosting). About 15 minutes total.

## 1. Personalize the site

- **[index.html](index.html)** — replace `故 신○○` with your father's name, and fill in the birth/passing dates in `.hero-dates`. Adjust the hero message if you'd like.
- **Portrait photo** — add his photo as `assets/portrait.jpg`. If the file is missing, an elegant fallback is shown instead.

## 2. Create the Firebase project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and sign in with your Google account.
2. **Create a project** → name it (e.g. `dad-memorial`) → Google Analytics is not needed (turn it off).
3. In the project, click the **web icon `</>`** ("Add app") → register the app (any nickname, do **not** check Firebase Hosting).
4. You'll see a `firebaseConfig` code block. Copy those values into **[js/firebase-config.js](js/firebase-config.js)**, replacing the `YOUR_...` placeholders.
   - These keys are safe to commit publicly — they identify the project; the security rules below are what protect the data.

## 3. Enable Firestore (guestbook + photo list)

1. In the Firebase console: **Build → Firestore Database → Create database**.
2. Choose a location close to you (e.g. `asia-northeast3` for Seoul) → start in **production mode**.
3. Go to the **Rules** tab and replace the contents with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAdmin() {
      return request.auth != null
        && request.auth.token.email == 'shinjsu92@gmail.com';
    }
    match /photos/{doc} {
      allow read: if true;
      // Anyone can submit a photo, but only as "pending" (approved: false).
      allow create: if request.resource.data.approved == false
        && request.resource.data.url is string
        && request.resource.data.path is string
        && request.resource.data.caption is string
        && request.resource.data.caption.size() <= 100
        && request.resource.data.uploader is string
        && request.resource.data.uploader.size() <= 30;
      // Only the family account can approve or delete.
      allow update, delete: if isAdmin();
    }
    match /guestbook/{doc} {
      allow read: if true;
      // Posting requires the memorial code.
      allow create: if request.resource.data.passcode == '0705'
        && request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 30
        && request.resource.data.message is string
        && request.resource.data.message.size() > 0
        && request.resource.data.message.size() <= 1000;
      allow update, delete: if isAdmin();
    }
    match /mail/{doc} {
      // The site writes notification requests here; the Trigger Email
      // extension picks them up and emails the family. Nobody can read them.
      allow read, update, delete: if false;
      allow create: if request.resource.data.keys().hasOnly(['to', 'message'])
        && request.resource.data.to == 'shinjsu92@gmail.com'
        && request.resource.data.message.keys().hasOnly(['subject', 'text'])
        && request.resource.data.message.subject is string
        && request.resource.data.message.subject.size() <= 200
        && request.resource.data.message.text is string
        && request.resource.data.message.text.size() <= 2000;
    }
  }
}
```

4. Click **Publish**.

Photos submitted by visitors are hidden until you approve them on the site (sign in via the "가족 로그인" link in the footer). Guestbook posts require the memorial code. If anything inappropriate slips through, you can delete it on the site (photos) or in the Firebase console (guestbook: Firestore → `guestbook` → delete the document).

## 4. Enable Storage (photo files)

1. In the console: **Build → Storage → Get started**.
2. **Note:** Firebase now requires the **Blaze (pay-as-you-go)** plan to enable Storage. You must add a billing card, but there is a permanent free quota (5 GB storage, ~1 GB/day downloads) — a family memorial site will almost certainly stay at **$0/month**. You can set a budget alert in Google Cloud for peace of mind.
3. Go to the **Rules** tab and replace the contents with:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /photos/{file} {
      allow read: if true;
      allow create: if request.resource.size < 8 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
      allow update: if false;
      allow delete: if request.auth != null
        && request.auth.token.email == 'shinjsu92@gmail.com';
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

4. Click **Publish**.

Only images under 8 MB can be uploaded, only into the `photos/` folder, and only the family account can delete files. (The site also shrinks photos in the browser before uploading, so most uploads are well under 1 MB.)

## 4b. Enable Google sign-in (for the family login)

The photo approval queue requires you to sign in with Google on the site:

1. Firebase console → **Build → Authentication → Get started**.
2. **Sign-in method** tab → **Google** → Enable → pick a support email → Save.
3. On the site, use the small **가족 로그인** link in the footer. Only `shinjsu92@gmail.com` is treated as the family account — anyone else who signs in is rejected.

## 4c. Email notifications (Trigger Email extension)

To get an email at shinjsu92@gmail.com whenever someone submits a photo or writes in the guestbook:

1. **Create a Gmail app password** (Gmail blocks plain password logins):
   - Go to [myaccount.google.com](https://myaccount.google.com) → **Security** → make sure **2-Step Verification** is on.
   - Then Security → **App passwords** (search "app passwords" in the account search bar) → create one named e.g. `memorial-site` → copy the 16-character password.
2. In the Firebase console: **Extensions** (left sidebar, under Build or Run) → **Explore extensions** → search **"Trigger Email from Firestore"** (by Firebase) → **Install**.
3. During install, configure:
   - **Email documents collection:** `mail`
   - **SMTP connection URI:** `smtps://shinjsu92%40gmail.com:YOUR_APP_PASSWORD@smtp.gmail.com:465` (note: `@` in the email is written `%40`; remove spaces from the app password)
   - **Default FROM address:** `shinjsu92@gmail.com`
   - Everything else can stay default.
4. Make sure the Firestore rules include the `mail` collection block from section 3 above.

The site writes a small document to the `mail` collection after each photo submission or guestbook post, and the extension emails it to you. The rules only allow mail addressed to you, with short subject/text — nobody can use it to email anyone else.

## 5. Deploy to GitHub Pages

1. Commit and push everything to your GitHub repository's `main` branch.
2. On GitHub: **Settings → Pages → Source: Deploy from a branch → Branch: `main` / (root)** → Save.
3. After a minute the site is live at `https://<your-username>.github.io/<repo-name>/`.

## 6. Authorize your domain in Firebase

Firebase blocks requests from unknown domains for some services. To be safe:

1. Firebase console → **Authentication → Settings → Authorized domains** (you may need to click "Get started" on Authentication first).
2. Add `<your-username>.github.io`.

## Ongoing care

- **Delete unwanted content:** Firebase console → Firestore (guestbook/photo entries) or Storage (photo files).
- **Cost check:** Firebase console → Usage tab. At family scale everything fits in the free quota.
- **Sharing:** the site is public to anyone with the link, and upload/guestbook are open by design — share the link with people you trust.
