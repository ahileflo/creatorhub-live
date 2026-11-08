# Agenție de automatizare AI pentru clinici dentare din România

## Cele 3 probleme pe care le rezolvați

1. **Programările ratate (no-show 10-20%)**. Un scaun gol o oră înseamnă 300-800 lei pierduți. Soluția e o confirmare automată pe WhatsApp cu 24-48 h înainte și reprogramare dintr-un singur mesaj.
2. **Lead-uri care primesc răspuns prea târziu**. Mesajele venite seara sau în weekend pe WhatsApp, Facebook sau formularul de pe site primesc răspuns luni, când pacientul a plecat deja la altă clinică. Soluția e un asistent care răspunde în sub un minut, califică cererea (urgență, tratament, buget, asigurare) și propune ore libere.
3. **Pacienți care nu revin** (control la 6 luni, igienizare, tratamente începute). Soluția e un flux de reactivare din CRM, cu mesaje personalizate.

## Arhitectura: WhatsApp → Make.com → HubSpot

```
Pacient ──WhatsApp──► WhatsApp Business Platform (prin 360dialog / Twilio / Wati)
                           │ webhook (mesaj nou)
                           ▼
                    Make.com scenariu „Inbound”
   1. Webhook → 2. HubSpot: Search contact după telefon (dacă nu există → Create contact, sursa=WhatsApp)
   3. Data store Make: istoricul conversației (ultimele 10 mesaje, cheie = telefon)
   4. Claude (modul HTTP sau Anthropic): system prompt cu lista de servicii, prețuri orientative, program,
      reguli: nu dă diagnostic, urgențele → telefon. Output JSON: {intent, reply, wants_booking, slot_pref, urgency}
   5. Router:
       ├─ intent=programare → Google Calendar/Cal.com: sloturi libere → propune 3 → la confirmare creează eveniment
       │                      → HubSpot: Deal „Programare” stage=Booked
       ├─ urgency=high      → notificare Slack/SMS către recepție + răspuns „vă sunăm în 5 minute”
       └─ altele            → răspuns + HubSpot note
   6. WhatsApp: send message (în fereastra de 24h = mesaj liber; în afara ei = TEMPLATE aprobat)

Make.com scenariu „Reminders” (programat la fiecare oră):
   HubSpot/Calendar: programări peste 24h → WhatsApp template „confirmare” cu butoane [Confirm] [Reprogramez]
   Răspuns „Reprogramez” → intră în fluxul de programare de mai sus
```

Ce trebuie verificat înainte:
- **Politica Meta din 2026** interzice chatbot-urile AI de uz general pe WhatsApp Business. Un asistent dedicat programărilor unei clinici e permis. Țineți-l strict pe subiect.
- Din iulie 2025, Meta taxează **per mesaj template** (marketing, utilitar, autentificare). Mesajele utilitare trimise în fereastra de 24h sunt gratuite. Includeți costul în abonament.
- **GDPR**: datele medicale sunt date sensibile. Asistentul nu cere detalii clinice, iar clinica semnează cu voi un DPA (acord de prelucrare a datelor), voi fiind persoana împuternicită. Stocați cât mai puțin.

## Email la rece (personalizat, fără presiune)

> **Subiect:** {Clinica} — 3 programări pe care le-ați pierdut weekendul trecut?
>
> Bună ziua, dr. {Nume},
>
> Am scris duminică seară pe WhatsApp-ul clinicii (ca pacient de test) la 21:40 și am primit răspuns luni la 10:15. Nu e o critică: e normal, recepția nu lucrează duminica.
>
> Doar că, la clinicile cu care lucrăm, cam 30% din cereri vin în afara programului, iar jumătate dintre acești pacienți se programează unde primesc primul răspuns.
>
> Am construit un asistent WhatsApp care răspunde în sub un minut, propune ore libere din calendarul dvs. și trimite confirmări automate cu o zi înainte. La o clinică din {oraș}, absențele au scăzut de la 14% la 6% în 8 săptămâni.
>
> Vă pot arăta în 15 minute pe telefonul meu cum ar arăta pentru {Clinica}, cu serviciile și programul dvs. Dacă nu vi se pare util, ne oprim acolo.
>
> {Semnătură}

Cifrele din email trebuie să fie **ale voastre**. Până aveți un client real, folosiți „estimăm, pe baza datelor din industrie…”.

## Preț

| | Starter | **Growth** ⭐ | Pro |
|---|---|---|---|
| Setup (o singură dată) | 2.900 lei | 4.900 lei | 8.900 lei |
| Lunar | 790 lei | 1.490 lei | 2.490 lei |
| Include | Răspuns + calificare + notificare recepție | + programare în calendar, remindere, HubSpot | + reactivare pacienți, raport lunar de no-show, mai multe locații |

Garanție: „Dacă în 60 de zile nu recuperați cel puțin costul lunar din programări salvate, lunile următoare sunt gratuite până când îl recuperați.” Un singur pacient de implant acoperă abonamentul pe un an.

Livrare: păstrați scenariul Make ca șablon, iar fiecare clinică nouă înseamnă doar configurare (aproximativ 4-6 ore).
