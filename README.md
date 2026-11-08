# Portofoliu de afaceri: hub central

Un singur repo care leagă toate afacerile: fiecare are brand, ofertă și canale separate, dar toate folosesc același motor de conținut, aceeași monitorizare și același registru (`hub/brands.json`).

```
creatorhub-live/
├── index.html                  Landing CreatorHub (existent)
├── hub/
│   ├── brands.json             Registrul tuturor afacerilor (audiență, ofertă, ton, platforme, URL-uri)
│   └── content/content_calendar.py   Claude → calendar de conținut → CSV pentru Postiz/Buffer/Metricool
├── pbn/                        ⭐ Platforma Paint-by-Numbers (cod de producție, vezi pbn/README.md)
├── businesses/                 Planurile fiecărei afaceri
│   ├── pbn.md                  Tablou din poza ta: preț, furnizori, legal, lansare
│   ├── ai-agency.md            Agenție AI pentru clinici dentare: arhitectură WhatsApp→Make→HubSpot, email, preț
│   ├── community.md            Comunitate Skool: curriculum, lead magnet, lansare în 7 zile, retenție
│   ├── faceless.md             Cont faceless de educație financiară: 10 scripturi, branding, monetizare
│   ├── copywriting.md          Studio de copywriting: livrabile AIDA, emailuri, ghid de ton
│   └── creator-brand.md        Brand fitness/ASMR/lifestyle cu persona anonimă (versiune conformă cu platformele)
├── ops/healthcheck.py          Self-checkup: HTTP, TLS, coada PBN
└── .github/workflows/
    ├── ci.yml                  Teste la fiecare push (motor, API, scripturi)
    └── healthcheck.yml         Verificare orară + issue automat dacă pică ceva
```

## Ordinea recomandată (ca să faceți bani cât mai repede)

| Prioritate | Afacere | De ce | Prima sumă realistă |
|---|---|---|---|
| 1 | **PBN** | Produs fizic cu marjă de ~75%, cerere de cadouri, cod deja scris | Primele comenzi în 2-3 săptămâni (Crăciunul e aproape) |
| 2 | **Agenția AI** | Bilet mare (4.900 lei setup), 1-2 clienți acoperă costurile | 1 client în 30-45 de zile de outreach |
| 3 | **Copywriting** | Zero investiție, folosiți textele portofoliului ca exemple | Imediat, din rețeaua proprie |
| 4 | **Faceless + comunitate** | Audiența crește lent (3-6 luni), apoi venit recurent | Luna 3-6 |
| 5 | **Brand creator** | Potențial mare, dar risc de platformă; construiți întâi audiența SFW | Luna 2-4 |

Afacerile se ajută între ele: conturile faceless și creator vând ghiduri și trimit trafic spre PBN (cadouri), agenția își folosește propriile automatizări ca demo, iar studioul de copywriting scrie textele pentru toate.

## Ce e automatizat și ce rămâne la voi

| Automatizat | Rămâne la om |
|---|---|
| Generarea catalogului, procesarea pozelor, rețeta de vopsea | QA-ul vizual al fiecărui model înainte de publicare |
| Calendarul de conținut (scripturi, caption-uri, hashtag-uri) | Aprobarea postărilor și filmarea |
| Programarea postărilor (Postiz/Metricool) | Răspunsurile la comentarii și DM-uri importante |
| Monitorizare orară + alertă pe telefon (issue GitHub) | Deciziile de preț, furnizori, bani |
| Teste la fiecare modificare de cod | Merge-ul în producție |

Nicio postare nu pleacă fără aprobare umană: un cont blocat costă mai mult decât 5 minute de verificare.

## Unelte recomandate (și cum se leagă)

- **Claude Code** (aici): cod, deploy, mentenanță. Rulați `/code-review`, `/security-review` înainte de lansare.
- **Supabase**: Postgres + Auth + Storage gestionate, alternativă la docker-compose. `pbn/db/schema.sql` rulează direct.
- **Cloudflare R2**: stocare compatibilă S3, fără costuri de trafic de ieșire (bine pentru imagini).
- **Make.com / Zapier**: fluxurile agenției și legătura plată → comandă → email.
- **Postiz** (self-hosted) sau **Metricool**: programare multi-platformă din CSV.
- **Canva / Figma**: creative și mockup-uri, cu conectorii din sesiune.
- **Stripe / Netopia + SmartBill/Oblio**: plăți și facturare automată.

## Pornire rapidă

```bash
pip install -r pbn/requirements.txt anthropic pydantic
python -m pytest -q pbn/tests
python hub/content/content_calendar.py --brand pbn --days 7
python ops/healthcheck.py
```
