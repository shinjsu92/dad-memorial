# 아버지 추모 홈페이지 (Dad Memorial Website)

A memorial website for my father — photo gallery and guestbook, in Korean.

- **Hosting:** GitHub Pages (static HTML/CSS/JS, no build step)
- **Backend:** Firebase — Firestore (guestbook, photo metadata) + Storage (photo files)

## Getting started

See **[SETUP.md](SETUP.md)** for the full step-by-step guide (personalizing the site, creating the Firebase project, security rules, and deploying to GitHub Pages).

## Structure

```
index.html            The whole site (hero, gallery, guestbook)
css/style.css         Styles
js/app.js             Gallery + guestbook logic (Firebase SDK via CDN)
js/firebase-config.js Your Firebase project keys (paste from console)
assets/portrait.jpg   Your father's portrait (you add this)
```
