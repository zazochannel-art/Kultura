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

Două câmpuri opționale țin de înscrieri:
- **Locuri disponibile** — de la câte mașini încolo cine se mai înscrie intră pe
  lista de așteptare. Lăsat gol (sau 0) înseamnă **fără limită**, nu zero locuri.
- **Acord de participare** — textul pe care participantul trebuie să-l bifeze la
  înscriere. Lăsat gol, nu se cere niciun acord.

Apoi pune-i statusul **Activ**. Toată aplicația se leagă de evenimentul activ:
mașinile, taskurile și invitații pe care îi adaugi de acum înainte se atașează
automat de el, iar listele arată doar ce ține de el. Sus, în antet, e un
selector din care poți oricând schimba evenimentul în lucru sau alege
**Toate evenimentele**.

> **Când termini evenimentul**, pune-i statusul **Finalizat**. Datele lui nu se
> șterg — ies doar din vedere, iar aplicația trece la următorul eveniment, gol
> și gata de pregătit. Ca să te uiți înapoi, alege evenimentul din selectorul
> de sus.

### 1b. Conectează Telegram (o dată, cinci minute)
**Setări → Telegram.** Deschide Telegram, scrie-i lui **@BotFather** comanda
`/newbot`, dă-i un nume, și primești un token. Lipești tokenul în Setări și
apeși **Conectează botul**.

De ce merită: SMS-ul costă bani per mesaj și, în acest sistem, **nu a fost
niciodată configurat un furnizor** — adică niciun mesaj automat n-a plecat
vreodată. Telegram e gratuit și duce mai mult decât text: numărul de concurs,
zona, programul, linkul de confirmare.

Tot acolo pune și **adresa publică a aplicației** (butonul „Folosește adresa
curentă" o completează singur). Fără ea, linkul de confirmare din mesaje rămâne
gol.

Participanții se conectează deschizând linkul personal pe care li-l trimiți.
Cine nu are Telegram primește SMS ca până acum.

### 1c. Uită-te pe Acasă ce mai lipsește
De acum, pe **Acasă** apare o listă scurtă cu ce nu e pus la punct pentru
evenimentul în lucru: programul gol, mașinile fără zonă, capacitatea nesetată,
lista de start neînghețată, participanții neconectați pe Telegram, backupul
vechi. Fiecare rând te duce direct unde se rezolvă, iar lista **dispare** când
nu mai lipsește nimic — nu e un panou permanent de ignorat.

În **Setări → Telegram** ai și trei pastile cu starea canalelor: Telegram, SMS
și adresa publică. Galben înseamnă „configurat, dar nu ajunge la nimeni" —
starea în care botul a stat conectat cu zero participanți legați.

### 2. Pune programul
**Acasă → Program → +.** Fiecare etapă are oră și titlu. Se vede public pe
`agenda.html`, cu marcaj pe etapa curentă.

### 3. Deschide înscrierile
Linkul îl iei din **Setări → Pagini publice** → „Înscriere mașină" →
*Copiază linkul* sau *Cod QR* (printabil, pentru afiș).

Tot acolo alegi **pentru ce eveniment** e linkul. Lăsat pe „Evenimentul curent
(automat)", linkul urmează mereu evenimentul activ — bun pentru un QR permanent.
Ales un eveniment anume, linkul rămâne al lui pentru totdeauna — asta vrei pe un
afiș printat, ca să nu ajungă înscrierile pe evenimentul de anul viitor.

Formularul le spune pe loc dacă mașina e deja înscrisă și acceptă maxim
**3 înscrieri pe oră de pe aceeași conexiune** (protecție anti-spam).

Dacă ai pus un număr de locuri, formularul anunță când au mai rămas sub 10 și,
când s-au ocupat, **rămâne deschis** — cine se înscrie intră pe lista de
așteptare și e anunțat în mesajul de confirmare. Nu se pierde nicio înscriere;
tu decizi mai târziu pe cine promovezi.

Dacă ai pus un acord de participare, textul apare în formular și trebuie bifat
plus semnat cu numele — semnătura rămâne pe înscriere.

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

Semnalizarea de listă neagră **rămâne pe mașină și după aprobare**: o vezi pe
cardul din **Mașini**, în detaliul mașinii (cu motivul) și la poartă. Merge și
fără internet.

Poți **Aprobi** (devine mașină, cu zonă), pune pe **Așteptare**, sau **Respingi**.

Dacă evenimentul are un număr de locuri, apare și tabul **Listă de așteptare**,
cu înscrierile venite după ce s-au ocupat locurile (marcate și pe card). Se
aprobă exact la fel — le promovezi când se eliberează un loc. Poți muta manual
pe listă orice înscriere, din detaliul ei.

Când evenimentul cere un acord de participare, detaliul înscrierii arată
**✓ Acord semnat**, cu numele și ora.

### 7. Printează pass-urile
**Mașini → Pass-uri.** Generează un card A6 pentru fiecare mașină din lista
filtrată, cu QR-ul de check-in. Filtrează întâi dacă vrei doar o parte.

Pe pass e tipărit mare și **numărul de concurs** — numărul pe care mașina îl
poartă pe parbriz. Se dă automat, în ordinea înscrierii, și reîncepe de la 1 la
fiecare eveniment. Îl vezi și pe cardul mașinii, iar la poartă și în jurizare
poți căuta direct după el (scrii doar cifra).

> **Imediat după ce printezi: îngheață lista.** Evenimente → editează
> evenimentul → **Îngheață lista de start**. De atunci numerele existente nu se
> mai pot schimba, orice ai face cu importurile. Mașinile care se înscriu târziu
> primesc numere în continuare. Dacă printezi fără să îngheți, aplicația te
> întreabă o dată — nu e o interdicție, e o reamintire.

### 7b. Cere confirmarea participării
Mementoul de cu 24 de ore înainte conține un link personal: participantul apasă
**Da, vin** sau **Nu pot veni**. Îl vezi apoi pe cardul mașinii.

Un „nu pot veni" nu e doar o informație: **eliberează locul** și urcă automat
prima înscriere de pe lista de așteptare în coada normală, ca s-o aprobi. Nu
trebuie să stai cu ochii pe listă.

Textul mementoului se schimbă din **SMS Center → Automatizări**. Variabilele
noi: `{{numar_concurs}}`, `{{zona}}` și `{{confirmare}}` (linkul).

> **Toate mesajele merg prin bot** acolo unde participantul s-a conectat:
> campania din SMS Center, mesajul de bun venit la sosire, cel de la aprobare,
> mementourile și mesajul individual. SMS-ul rămâne rezervă pentru cine nu e
> conectat. Sub lista de destinatari din SMS Center scrie exact cum se împarte:
> câți primesc pe Telegram și câți prin SMS.
>
> Cine e conectat pe Telegram primește mesajele **chiar dacă n-are număr de
> telefon în fișă**.

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

### Jurizare
**Mașini → Jurizare** (staff și admin). Un ecran pe tot telefonul, gândit ca să
stai în fața mașinii: numărul de concurs, mașina, și zece butoane de la 1 la 10.
Apeși o dată — nota se salvează. Te răzgândești — apeși altă notă, se
înlocuiește; nu se adună note.

- Sus vezi **câte mașini ai punctat** din total.
- Filtrul **Nepunctate** îți lasă doar ce n-ai văzut încă.
- Cauți după număr, marcă, model sau proprietar.
- **Rezultate** arată media per mașină, grupată **pe clase**, cu 🏆 pe câștigător.
  Fiecare jurat are o singură notă per mașină, deci media e media panelului.
  Dacă e egalitate, se marchează amândoi — decide juriul, nu aplicația.

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

Votarea publică e separată de **Jurizare**: una e premiul publicului, cealaltă
al juriului. Pentru premiile pe clase te uiți în **Mașini → Jurizare →
Rezultate**.

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
| **Cineva a ajuns pe lista de așteptare din greșeală** | Deschide înscrierea din **Mașini → Listă de așteptare** și aprob-o normal. Lista nu blochează nimic, e doar o coadă |
| **Nu apare butonul Jurizare** | E doar pentru staff și admin. Verifică rolul contului în **Setări → Utilizatori** |
| **`vote.html` zice „votarea nu e deschisă"** | Normal — trebuie deschisă din **Setări → Votare Best Car** |
| **Nu pleacă SMS-urile** | **SMS Center** → verifică furnizorul și că automatizarea e bifată |
| **Ceva a crăpat pe telefonul cuiva** | **Setări → Erori raportate** arată ce s-a întâmplat, pe ce dispozitiv și când |
| **Ai șters o mașină din greșeală** | Imediat: butonul **Anulează** din notificare. Mai târziu: **Setări → Șterse recent** → *Adu înapoi*. Mașina revine cu numărul ei de concurs (sau cu unul nou, dacă între timp l-a luat altcineva). Coșul ține 30 de zile |
| **Vrei să încerci ceva fără să strici date reale** | **Evenimente → Adaugă** (sau editează unul) → bifează **Eveniment de probă**. Paginile publice îl ignoră complet, deci nicio înscriere reală nu poate ajunge acolo. Când termini: **Setări → Golește evenimentul de probă** |
| **Lucrezi fără internet în afara porții** | Sus apare o bandă roșie cu câte modificări așteaptă. Schimbarea stării unei mașini și zona se salvează local și pleacă singure când revine semnalul. Aprobarea unei înscrieri și aducerea din coș **cer conexiune** — aplicația îți spune, nu tace |
| **Ai importat un fișier greșit** | **Setări → Șterse recent → Importuri recente** → *Anulează importul*. Mută în coș tot lotul dintr-o apăsare. Dacă reimporți același fișier, mașinile se întorc, nu se dublează |
| **Cineva a șters din greșeală date** | **Setări → Copii de siguranță → Restaurează.** Aduce înapoi ce s-a șters, **fără** să atingă ce s-a creat între timp. Vezi întâi lista de verificare, apoi confirmi |
| **Cineva cere ștergerea datelor (GDPR)** | **Setări → GDPR** → caută după placă/telefon/email/nume → verifici rezultatele → ștergi definitiv (inclusiv pozele) |

---

## Ce se întâmplă automat

Nu trebuie să faci nimic pentru:

- **Backup zilnic** la 03:17 (se păstrează ultimele 30). În **Setări → Copii de
  siguranță** apare o linie verde cât timp totul e în regulă; dacă devine roșie,
  backupul automat s-a oprit și trebuie să te uiți
- **Remindere** de eveniment (24h și 2h înainte) și de taskuri
- **Sincronizare Google Sheets** la 5 minute
- **SMS de bun venit** la sosire și **SMS la aprobare** (dacă sunt bifate)
- **Numărul de concurs** la fiecare mașină nouă, în ordinea înscrierii, separat
  pentru fiecare eveniment
- **Golirea coșului** după 30 de zile (mașinile șterse dispar definitiv abia
  atunci)
- **Promovarea de pe lista de așteptare** când cineva anunță că nu mai vine
- **Notificare push** la o înscriere nouă
- **Curățare** automată, în fiecare noapte: contoarele anti-spam, erorile
  raportate (peste 14 zile) și jurnalul de activitate (peste un an)
