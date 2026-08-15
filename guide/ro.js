// Ghidul de utilizare — română.
// Încărcat la cerere (vezi guide.js), ca textul să nu intre în pornirea aplicației.
export default {
  intro:
    'Kultura ține evidența unui eveniment auto de la prima înscriere până la ' +
    'raportul final: cine vine, unde parchează, cine a ajuns deja, ce are de ' +
    'făcut echipa. Mai jos e tot parcursul, în ordinea în care se întâmplă.',

  navTitle: 'Cum te miști prin aplicație',
  nav: [
    { name: 'Acasă', what: 'Rezumatul zilei: aflux, program, taskurile tale, anunțuri.' },
    { name: 'Mașini', what: 'Lista participanților, înscrierile de aprobat, pass-urile și raportul.' },
    { name: 'Taskuri', what: 'Ce are de făcut echipa. Ca listă sau ca tablă (kanban).' },
    { name: 'Evenimente', what: 'Evenimentele tale, cu dată și locație.' },
    { name: 'Echipa', what: 'Cine are cont și ce rol are.' },
    { name: 'Poartă', what: 'Ecranul de check-in. Se folosește pe tabletă, la intrare.' },
    { name: 'Setări', what: 'Zone, backup, votare, feedback, linkuri publice — și ghidul ăsta.' },
  ],
  navTip:
    'Apasă Ctrl-K (sau ⌘-K pe Mac, ori lupa din antet) ca să sari instant la ' +
    'orice mașină, invitat, eveniment sau task, fără să cauți prin meniuri.',

  rolesTitle: 'Ce poți face, în funcție de rol',
  rolesNote:
    'Rolul ți-l dă un admin din pagina Echipa. Dacă un buton din ghid nu îți ' +
    'apare pe ecran, aproape sigur rolul tău nu îl include — nu e o defecțiune.',
  roles: [
    { name: 'member', can: 'Vede datele. Fără acțiuni de administrare.' },
    { name: 'gate', can: 'Doar ecranul porții. Aplicația pornește blocată acolo — potrivit pentru contul dat unui voluntar.' },
    { name: 'staff', can: 'Check-in, zone, aprobare înscrieri, listă neagră, anunțuri, feedback.' },
    { name: 'admin', can: 'Tot, plus SMS, backup, GDPR, votare și ștergeri.' },
  ],

  phases: [
    {
      title: 'Cu 2–4 săptămâni înainte',
      sub: 'Pregătești terenul: evenimentul, programul, înscrierile.',
      steps: [
        {
          title: 'Creezi evenimentul',
          where: 'Evenimente → Adaugă',
          body: 'Pui data și locația. Apar automat pe pagina publică de program și pe ecranul de Acasă, cu numărătoare inversă.',
        },
        {
          title: 'Pui programul',
          where: 'Acasă → Program → +',
          body: 'Fiecare etapă are oră și titlu. Se vede public pe pagina de agendă, cu etapa curentă marcată — participanții văd singuri ce urmează.',
        },
        {
          title: 'Deschizi înscrierile',
          where: 'Setări → Pagini publice → „Înscriere mașină"',
          body: 'Iei linkul cu „Copiază linkul", sau codul QR (printabil, pentru afiș). Formularul le spune pe loc dacă mașina e deja înscrisă și acceptă maxim 3 înscrieri pe oră de pe aceeași conexiune, ca protecție anti-spam.',
          role: 'admin',
        },
        {
          title: 'Pregătești zonele de parcare',
          where: 'Hartă → încarcă planul · Setări → Zone',
          body: 'Încarci planul terenului și pui capacitatea fiecărei zone. Mai târziu, la poartă, vei vedea în timp real câte locuri mai sunt libere în fiecare zonă.',
        },
        {
          title: 'Pornești SMS-urile automate',
          where: 'SMS Center → Automatizări',
          body: 'Opțional. Poți trimite SMS la aprobarea înscrierii, SMS de bun venit la sosire, și remindere cu 24h și 2h înainte. În șabloane folosești {{prenume}}, {{nume}}, {{marca}}, {{model}}, {{numar}}, {{categoria}}.',
          role: 'admin',
        },
      ],
    },
    {
      title: 'Cu o zi înainte',
      sub: 'Golești coada, printezi, pregătești tabletele.',
      steps: [
        {
          title: 'Aprobi înscrierile',
          where: 'Mașini → coloana „Înscrise"',
          body: 'Fiecare card se deschide pentru detalii. Poți Aproba (devine mașină, cu zonă alocată), pune pe Așteptare, sau Respinge. Ai grijă la semnalizări: ⛔ înseamnă că placa e pe lista neagră, ⧉ că placa există deja în sistem.',
        },
        {
          title: 'Printezi pass-urile',
          where: 'Mașini → Pass-uri',
          body: 'Generează un card A6 pentru fiecare mașină din lista filtrată, cu codul QR de check-in. Dacă vrei doar o parte, filtrează întâi lista.',
        },
        {
          title: 'Pregătești tabletele de la poartă',
          where: 'Poartă',
          body: 'Pe fiecare dispozitiv de la intrare: deschizi Poartă, apeși pe 📍 numele porții și îl scrii („Poarta A", „Intrare VIP") ca să știi mai târziu pe unde a intrat fiecare mașină, apoi apeși butonul kiosk 🖥. Aplicația se blochează pe ecranul porții și ecranul nu se mai stinge.',
          tip: 'Ca să ieși din kiosk: apeși butonul roșu de kiosk din antet și confirmi. Alternativ, ții apăsat 1,5 secunde pe titlul „Poartă — Check-in".',
        },
        {
          title: 'Faci un backup',
          where: 'Setări → Copii de siguranță → Fă backup acum',
          body: 'Există și unul automat în fiecare noapte, dar unul manual chiar înainte de eveniment nu strică niciodată.',
          role: 'admin',
        },
      ],
    },
    {
      title: 'În ziua evenimentului',
      sub: 'Aici se întâmplă totul. Ecranul principal e Poarta.',
      steps: [
        {
          title: 'Check-in la poartă',
          where: 'Poartă',
          body: 'Scanezi codul QR de pe pass (sau cauți după numărul de înmatriculare) → apare cardul mașinii → apeși Sosit. Mașinile deja sosite au buton Plecare, pentru când pleacă de pe teren. Zona se poate schimba direct din listă.',
          tip: 'Merge și fără internet. Check-in-urile se salvează pe dispozitiv și urcă singure când revine semnalul — pastila din antet arată câte așteaptă. Nu reinstala aplicația și nu goli datele cât timp mai sunt în așteptare.',
        },
        {
          title: 'Peretele de sosiri',
          where: 'Poartă → 🖥 Perete sosiri',
          body: 'Ecran gândit pentru proiector: ultimele sosiri, cu sunet la fiecare mașină nouă. Butonul de prezentare pornește derularea automată.',
        },
        {
          title: 'Vezi cine e prezent acum',
          where: 'Acasă → Aflux',
          body: 'Prezenți acum, Plecați, Total sosiri, Ultimele 15 minute — plus defalcare pe ore, zone, mărci, orașe și pe poartă.',
        },
      ],
    },
    {
      title: 'La final',
      sub: 'Votarea și feedbackul se deschid când evenimentul se apropie de sfârșit.',
      steps: [
        {
          title: 'Deschizi votarea „Best Car"',
          where: 'Setări → Votare Best Car',
          body: 'Alegi evenimentul și apeși Deschide. Linkul îl iei din Setări → Pagini publice („Votare Best Car"), unde ai și cod QR printabil. Un vot per dispozitiv, care se poate schimba. Clasamentul e live, iar podiumul apare automat și pe peretele de sosiri — bun pentru proiector la premiere.',
          tip: 'Nu uita să apeși Închide când s-a terminat votarea.',
          role: 'admin',
        },
        {
          title: 'Ceri feedback',
          where: 'Setări → Feedback → Copiază linkul',
          body: 'Participanții dau o notă în stele și, dacă vor, un comentariu. Răspunsurile apar tot acolo, în Setări → Feedback.',
        },
      ],
    },
    {
      title: 'După eveniment',
      sub: 'Tragi linie și faci curat.',
      steps: [
        {
          title: 'Scoți raportul',
          where: 'Mașini → Raport',
          body: 'Sumar printabil (sau salvat ca PDF din dialogul de print): total mașini, prezenți, sosiri pe ore, top zone, mărci și orașe, media și distribuția feedbackului, plus comentariile.',
        },
        {
          title: 'Cureți pozele rămase',
          where: 'Setări → Curăță poze orfane',
          body: 'Arată întâi ce ar șterge și cât spațiu eliberează. Se șterge doar dacă confirmi.',
          role: 'admin',
        },
        {
          title: 'Backup final',
          where: 'Setări → Fă backup acum → Descarcă',
          body: 'Ca să ai o copie a evenimentului și în afara sistemului.',
          role: 'admin',
        },
      ],
    },
  ],

  autoTitle: 'Ce se întâmplă de la sine',
  autoNote: 'Nu trebuie să faci nimic pentru lucrurile astea:',
  auto: [
    'Backup în fiecare noapte (se păstrează ultimele 30)',
    'Remindere de eveniment (cu 24h și 2h înainte) și de taskuri',
    'Sincronizare din Google Sheets, la câteva minute',
    'SMS de bun venit la sosire și SMS la aprobare, dacă le-ai bifat',
    'Notificare când intră o înscriere nouă',
    'Curățarea automată a jurnalelor vechi',
  ],

  troubleTitle: 'Când ceva nu merge',
  trouble: [
    { p: 'Nu merge internetul la poartă',
      f: 'Continuă normal. Check-in-urile se salvează local și urcă singure. Nu reinstala aplicația și nu goli datele — ai pierde ce nu s-a sincronizat încă.' },
    { p: 'Ai rămas blocat în kiosk',
      f: 'Butonul roșu de kiosk din antet → confirmi. Sau ții apăsat 1,5 secunde pe titlul porții.' },
    { p: 'Aplicația arată o versiune veche',
      f: 'Închide-o complet și redeschide. Versiunea nouă se activează la a doua pornire.' },
    { p: 'Cineva zice că nu se poate înscrie',
      f: 'Probabil a atins limita de 3 înscrieri pe oră. Poate încerca mai târziu, sau îl adaugi tu manual din Mașini → Adaugă.' },
    { p: 'Pagina de votare zice că votarea nu e deschisă',
      f: 'Normal — trebuie deschisă întâi din Setări → Votare Best Car.' },
    { p: 'Nu pleacă SMS-urile',
      f: 'SMS Center → verifică furnizorul și că automatizarea e bifată.' },
    { p: 'Ceva a crăpat pe telefonul cuiva',
      f: 'Setări → Erori raportate arată ce s-a întâmplat, pe ce dispozitiv și când.' },
    { p: 'Cineva a șters din greșeală date',
      f: 'Setări → Copii de siguranță → Restaurează. Aduce înapoi ce s-a șters, fără să atingă ce s-a creat între timp.' },
    { p: 'Cineva cere ștergerea datelor sale',
      f: 'Setări → GDPR → cauți după placă, telefon, email sau nume → verifici rezultatele → ștergi definitiv, inclusiv pozele.' },
  ],
};
