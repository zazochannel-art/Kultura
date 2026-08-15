# Runbook — cum conduci un eveniment cu Kultura

Ghid practic: ce apeși și în ce ordine. Nu e nevoie să știi programare.

> **Același ghid e și în aplicație:** **Setări → Cum funcționează aplicația**.
> Acolo e în trei limbi, funcționează offline și se poate printa — dă-l noilor
> voluntari în loc să le explici de la zero. Documentul de față e versiunea
> lungă, pentru cine organizează.

Pentru partea tehnică (cod, funcții, baze de date) vezi
[`../README.md`](../README.md).

---

## Cuprins

- [Cine ce poate face](#cine-ce-poate-face)
- [Cu 2–4 săptămâni înainte](#cu-24-săptămâni-înainte)
- [Cu o zi înainte](#cu-o-zi-înainte)
- [În ziua evenimentului](#în-ziua-evenimentului)
- [La final](#la-final)
- [După eveniment](#după-eveniment)
- [Când ceva nu merge](#când-ceva-nu-merge)

---

## Cine ce poate face

| Rol | Ce poate |
|---|---|
| **member** | Vede datele |
| **gate** | Doar ecranul porții. Aplicația pornește blocată acolo — potrivit pentru un cont dat unui voluntar |
| **staff** | Check-in, zone, aprobă înscrieri, listă neagră, anunțuri |
| **admin** | Tot: SMS, backup, GDPR, votare, ștergeri |

Rolurile se schimbă din **Echipa**.

---

## Cu 2–4 săptămâni înainte

### 1. Creează evenimentul
**Evenimente → Adaugă.** Pune data și locația — apar pe pagina publică de
program.

### 2. Pune programul
**Acasă → Program → +.** Fiecare etapă are oră și titlu. Se vede public pe
`agenda.html`, cu marcaj pe etapa curentă.

### 3. Deschide înscrierile
Linkul îl iei din **Setări → Pagini publice** → „Înscriere mașină" →
*Copiază linkul* sau *Cod QR* (printabil, pentru afiș).

Formularul le spune pe loc dacă mașina e deja înscrisă și acceptă maxim
**3 înscrieri pe oră de pe aceeași conexiune** (protecție anti-spam).

### 4. Pregătește zonele
**Hartă → încarcă planul** și **Setări → Zone** pentru capacități. La poartă vei
vedea câte locuri mai sunt libere în fiecare zonă.

### 5. Pornește SMS-urile automate (opțional)
**SMS Center → Automatizări:**
- SMS la **aprobarea** înscrierii
- SMS de **bun venit** la sosire
- **Reminder** cu 24h și 2h înainte

Variabile în șabloane: `{{prenume}}`, `{{nume}}`, `{{marca}}`, `{{model}}`,
`{{numar}}`, `{{categoria}}`.

---

## Cu o zi înainte

### 6. Golește coada de înscrieri
**Mașini → coloana „Înscrise".** Fiecare card se deschide pentru detalii.

Ai grijă la semnalizări:
- ⛔ **Listă neagră** — placa e interzisă
- ⧉ **Duplicat** — placa există deja

Poți **Aprobi** (devine mașină, cu zonă), pune pe **Așteptare**, sau **Respingi**.

### 7. Printează pass-urile
**Mașini → Pass-uri.** Generează un card A6 pentru fiecare mașină din lista
filtrată, cu QR-ul de check-in. Filtrează întâi dacă vrei doar o parte.

### 8. Pregătește tabletele de la poartă
Pe fiecare dispozitiv de la intrare:

1. Deschide **Poartă**.
2. Apasă pe **📍 numele porții** și scrie-l („Poarta A", „Intrare VIP"). Așa vei
   ști mai târziu pe unde a intrat fiecare mașină.
3. Apasă butonul **kiosk** (🖥). Aplicația se blochează pe ecranul porții și
   ecranul nu se mai stinge.

> **Ca să ieși din kiosk:** apeși butonul roșu de kiosk din antet și confirmi.
> Alternativ, ții apăsat 1,5 secunde pe titlul „Poartă — Check-in".

### 9. Fă un backup
**Setări → Copii de siguranță → Fă backup acum.** Există și unul automat zilnic
la 03:17, dar unul manual înainte de eveniment nu strică.

---

## În ziua evenimentului

### La poartă

**Scanezi QR-ul** de pe pass (sau cauți după număr) → apare cardul mașinii →
**Sosit**.

- Mașinile deja sosite au buton **Plecare**, pentru când pleacă de pe teren.
- Poți schimba zona direct din listă.
- **Merge și fără internet.** Check-in-urile se salvează local și urcă singure
  când revine semnalul — pastila din antet arată câte așteaptă.
- Dacă placa e pe lista neagră, apare ⛔ la scanare.

### Peretele de sosiri
**Poartă → 🖥 (Perete sosiri)** — ecran pentru proiector cu ultimele sosiri,
sunet la fiecare sosire nouă. Butonul de prezentare pornește derularea automată.

### Cine e prezent acum
**Acasă → Aflux:** Prezenți acum / Plecați / Total sosiri / Ultimele 15 min,
plus defalcare pe ore, zone, mărci, orașe și **pe poartă**.

### Căutare rapidă
**Ctrl/Cmd-K** (sau lupa din antet) — sari instant la orice mașină, invitat,
eveniment sau task.

---

## La final

### 10. Deschide votarea „Best Car"
**Setări → Votare Best Car** → alegi evenimentul → **Deschide**.

Linkul îl iei din **Setări → Pagini publice** (alegi „Votare Best Car" →
*Copiază linkul* sau *Cod QR*). Un vot per dispozitiv, se poate schimba.
Clasamentul e live.

Podiumul (top 3) apare automat și pe **peretele de sosiri** — bun pentru
proiector la premiere.

> Nu uita să apeși **Închide** când s-a terminat votarea.

### 11. Cere feedback
Linkul îl iei direct din **Setări → Feedback → Copiază linkul** (sau din
**Setări → Pagini publice**, unde ai și cod QR printabil). Răspunsurile apar
tot acolo, în **Setări → Feedback**.

---

## După eveniment

### 12. Scoate raportul
**Mașini → Raport.** Sumar printabil (sau salvat ca PDF din dialogul de print):
total mașini, prezenți, sosiri pe ore, top zone/mărci/orașe, media și
distribuția feedback-ului plus comentariile.

### 13. Curăță storage-ul
**Setări → Curăță poze orfane.** Arată întâi ce ar șterge și cât spațiu
eliberează; ștergi doar dacă confirmi.

### 14. Backup final
**Setări → Fă backup acum**, apoi **Descarcă** — ca să ai o copie și în afara
Supabase.

---

## Când ceva nu merge

| Problemă | Ce faci |
|---|---|
| **Nu merge internetul la poartă** | Continuă normal. Check-in-urile se salvează local și urcă singure. Nu reinstala aplicația și nu goli datele — ai pierde ce nu s-a sincronizat |
| **Ai rămas blocat în kiosk** | Buton roșu kiosk în antet → confirmi. Sau ții apăsat 1,5s pe titlul porții |
| **Aplicația arată versiunea veche** | Închide complet și redeschide. Service worker-ul ia versiunea nouă la a doua pornire |
| **Cineva zice că nu se poate înscrie** | Probabil a atins limita de 3/oră. Poate încerca mai târziu sau îl adaugi manual din **Mașini → Adaugă** |
| **`vote.html` zice „votarea nu e deschisă"** | Normal — trebuie deschisă din **Setări → Votare Best Car** |
| **Nu pleacă SMS-urile** | **SMS Center** → verifică furnizorul și că automatizarea e bifată |
| **Ceva a crăpat pe telefonul cuiva** | **Setări → Erori raportate** arată ce s-a întâmplat, pe ce dispozitiv și când |
| **Cineva a șters din greșeală date** | **Setări → Copii de siguranță → Restaurează.** Aduce înapoi ce s-a șters, **fără** să atingă ce s-a creat între timp. Vezi întâi lista de verificare, apoi confirmi |
| **Cineva cere ștergerea datelor (GDPR)** | **Setări → GDPR** → caută după placă/telefon/email/nume → verifici rezultatele → ștergi definitiv (inclusiv pozele) |

---

## Ce se întâmplă automat

Nu trebuie să faci nimic pentru:

- **Backup zilnic** la 03:17 (se păstrează ultimele 30)
- **Remindere** de eveniment (24h și 2h înainte) și de taskuri
- **Sincronizare Google Sheets** la 5 minute
- **SMS de bun venit** la sosire și **SMS la aprobare** (dacă sunt bifate)
- **Notificare push** la o înscriere nouă
- **Curățare** automată a jurnalelor vechi
