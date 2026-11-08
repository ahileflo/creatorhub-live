# 🚀 Lansarea Pas cu Gust — Android, iOS, Windows

Pas cu Gust este o **aplicație web instalabilă (PWA)**. Același cod merge pe:

| Platformă | Instalare directă (gratuit, imediat) | Magazin oficial |
|---|---|---|
| Android | Chrome → meniu ⋮ → „Instalează aplicația” | Google Play (prin PWABuilder) |
| iPhone / iPad | Safari → Partajează → „Adaugă pe ecranul principal” | App Store (prin PWABuilder + Mac) |
| Windows | Edge / Chrome → iconița „Instalează” din bara de adrese | Microsoft Store (prin PWABuilder) |

Pașii de mai jos se fac **în ordine**. Pașii 1–3 fac aplicația publică pe internet; pașii 4–6 o urcă în magazine.

---

## 1. Publică site-ul (GitHub Pages) — 5 minute

1. Fă merge la branch în `main`.
2. GitHub → repo `creatorhub-live` → **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Workflow-ul `.github/workflows/pages.yml` publică automat la fiecare push în `main`.
4. Aplicația va fi la: **https://ahileflo.github.io/creatorhub-live/pascugust/**

Din acest moment oricine o poate deschide și instala pe Android, iPhone și Windows.

## 2. Cloud-ul (Supabase) — ✅ creat, mai ai 2 setări de făcut

Deja făcut: proiectul Supabase `recikeep` (nume intern; îl poți redenumi în „Pas cu Gust” din Settings → General, e doar cosmetic) (Frankfurt, plan Free, id `ttvdkkmjboivafypztnk`), tabelul cu RLS, bucket-ul privat pentru poze/clipuri (50 MB/fișier), funcția de ștergere a contului și cheile puse în `recikeep/index.html`.

Mai trebuie făcut de tine în https://supabase.com/dashboard/project/ttvdkkmjboivafypztnk (aceste setări nu se pot schimba din acest mediu):

1. **Authentication → URL Configuration**
   - Site URL: `https://ahileflo.github.io/creatorhub-live/pascugust/`
   - Redirect URLs: adaugă același link.
2. **Authentication → Emails → Magic Link**: pune codul în email, ca să meargă și în aplicațiile instalate:
   ```
   <h2>Codul tău Pas cu Gust</h2>
   <p style="font-size:28px;letter-spacing:4px"><b>{{ .Token }}</b></p>
   <p>sau <a href="{{ .ConfirmationURL }}">intră direct în aplicație</a></p>
   ```
3. (Când ai mai mulți utilizatori) **Authentication → SMTP**: un server de email propriu. Serverul implicit trimite doar câteva emailuri pe oră.

> ⚠️ Pe planul Free, proiectele se **pun pe pauză după ~7 zile fără activitate** (cum e acum `memoryflow`). Pentru o aplicație publică în magazine ia în calcul planul Pro sau intră săptămânal.

> ℹ️ Supabase afișează o avertizare pentru `delete_my_account`: utilizatorii logați o pot apela. E intenționat: funcția șterge doar contul celui care o apelează.

## 3. Verifică înainte de magazine

- Deschide aplicația pe telefon → instaleaz-o → adaugă o rețetă cu poză și clip → fă un GIF → intră în cont → verifică dacă apare și pe al doilea dispozitiv.
- Rulează https://www.pwabuilder.com cu adresa aplicației. Ar trebui să treacă manifestul, service worker-ul și iconițele.

---

## 4. Google Play (Android)

**Cost:** taxă unică de 25 $. **Durată:** 2–4 săptămâni, din cauza testării obligatorii.

1. Creează contul în [Google Play Console](https://play.google.com/console) (verificare de identitate cu act).
2. PWABuilder → *Package for stores* → **Android** → package ID `ro.pascugust.app` → descarcă pachetul (`.aab` + cheia de semnare). **Păstrează cheia de semnare în siguranță**: fără ea nu mai poți publica actualizări.
3. **Digital Asset Links:** fișierul `assetlinks.json` din pachet trebuie pus la **rădăcina domeniului**: `https://DOMENIU/.well-known/assetlinks.json`.
   - Pe `ahileflo.github.io/creatorhub-live` asta nu se poate, pentru că rădăcina e alt repo. Ai două variante:
     - (a) un domeniu propriu, ex. `pascugust.ro` → GitHub Pages → Custom domain (recomandat); sau
     - (b) repo-ul `ahileflo/ahileflo.github.io` cu fișierul în `.well-known/`.
   - Fără el aplicația merge, dar afișează bara de adrese a browserului.
4. Play Console → aplicație nouă → completează:
   - fișa magazinului (în română, capturi de ecran, iconița de 512 px din `pascugust/icons/`);
   - **Politica de confidențialitate:** `.../pascugust/confidentialitate.html`;
   - **Siguranța datelor:** email (opțional, pentru cont), poze/video (opțional, conținut de la utilizator), criptate în tranzit, utilizatorul poate cere ștergerea;
   - **Ștergerea contului:** există în aplicație (☁️ Cont → Șterge contul); ca link web poți pune adresa aplicației.
5. Conturile personale noi trebuie să facă un **test închis cu minimum 12 testeri, timp de 14 zile**, înainte de producție. Abia apoi trimiți la publicare.

## 5. Microsoft Store (Windows)

**Cost:** de regulă gratuit pentru persoane fizice (verifică la înscriere). **Durată:** câteva zile.

1. Cont în [Partner Center](https://partner.microsoft.com/dashboard) → rezervă numele „Pas cu Gust”.
2. PWABuilder → **Windows** → completează Package ID / Publisher din Partner Center → descarcă `.msixbundle`.
3. Partner Center → submission nou → urcă pachetul, capturi și link-ul la politica de confidențialitate.

## 6. App Store (iPhone / iPad)

**Cost:** 99 $ pe an (Apple Developer Program). **Ai nevoie de un Mac cu Xcode.**

1. Înscrie-te la https://developer.apple.com/programs/.
2. PWABuilder → **iOS** → descarcă proiectul Xcode → deschide-l pe Mac → setează echipa și bundle ID-ul `ro.pascugust.app` → *Archive* → urcă în App Store Connect.
3. App Store Connect: fișa în română, capturi pentru iPhone 6,7" și 6,5", politica de confidențialitate, „App Privacy” (aceleași date ca la Google), cont demo pentru recenzori.
4. ⚠️ Apple respinge uneori aplicațiile care „doar împachetează un site” (regula 4.2). Pas cu Gust are funcții reale (offline, cameră, cronometru, GIF, cont), dar aprobarea nu e garantată. Până atunci, utilizatorii de iPhone o pot instala direct din Safari.

---

## Ce rămâne la tine (nu se poate face automat)

- conturile de dezvoltator (identitate, plăți): Google, Apple, Microsoft;
- crearea proiectului Supabase și lipirea cheilor (pasul 2);
- păstrarea cheii de semnare Android;
- recrutarea celor 12 testeri pentru Google Play;
- trimiterea la recenzie în fiecare magazin.
