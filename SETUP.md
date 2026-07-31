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
    match /photos/{doc} {
      allow read: if true;
      allow create: if request.resource.data.url is string
        && request.resource.data.caption is string
        && request.resource.data.caption.size() <= 100
        && request.resource.data.uploader is string
        && request.resource.data.uploader.size() <= 30;
      allow update, delete: if false;
    }
    match /guestbook/{doc} {
      allow read: if true;
      allow create: if request.resource.data.name is string
        && request.resource.data.name.size() > 0
        && request.resource.data.name.size() <= 30
        && request.resource.data.message is string
        && request.resource.data.message.size() > 0
        && request.resource.data.message.size() <= 1000;
      allow update, delete: if false;
    }
  }
}
```

4. Click **Publish**.

Visitors can read and add entries, but nobody can edit or delete through the site — if something inappropriate is ever posted, you delete it yourself in the Firebase console (Firestore → the collection → delete the document).

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
      allow write: if request.resource.size < 8 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
    match /{allPaths=**} {
      allow read, write: if false;
    }
  }
}
```

4. Click **Publish**.

Only images under 8 MB can be uploaded, and only into the `photos/` folder. (The site also shrinks photos in the browser before uploading, so most uploads are well under 1 MB.)

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
