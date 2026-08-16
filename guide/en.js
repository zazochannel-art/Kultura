// How-it-works guide — English. Loaded on demand (see guide.js).
export default {
  intro:
    'Kultura runs a car event from the first registration to the final report: ' +
    'who is coming, where they park, who has already arrived, what the team ' +
    'still has to do. Below is the whole run, in the order it happens.',

  navTitle: 'Finding your way around',
  nav: [
    { name: 'Home', what: 'The day at a glance: arrivals, schedule, your tasks, announcements.' },
    { name: 'Cars', what: 'The participant list, registrations waiting for approval, passes and the report.' },
    { name: 'Tasks', what: 'What the team has to do. As a list or as a board.' },
    { name: 'Events', what: 'Your events, with date and location.' },
    { name: 'Team', what: 'Who has an account and what role they hold.' },
    { name: 'Gate', what: 'The check-in screen. Used on a tablet, at the entrance.' },
    { name: 'Settings', what: 'Zones, backups, voting, feedback, public links — and this guide.' },
  ],
  navTip:
    'Press Ctrl-K (or ⌘-K on a Mac, or the magnifier in the header) to jump ' +
    'straight to any car, guest, event or task without hunting through menus.',

  rolesTitle: 'What you can do, by role',
  rolesNote:
    'An admin sets your role on the Team page. If a button described in this ' +
    'guide is nowhere on your screen, your role almost certainly does not ' +
    'include it — nothing is broken.',
  roles: [
    { name: 'member', can: 'Sees the data. No administrative actions.' },
    { name: 'gate', can: 'The gate screen only. The app starts locked there — right for an account handed to a volunteer.' },
    { name: 'staff', can: 'Check-in, zones, approving registrations, the blocklist, announcements, feedback.' },
    { name: 'admin', can: 'Everything, plus SMS, backups, GDPR, voting and deletions.' },
  ],

  phases: [
    {
      title: '2–4 weeks before',
      sub: 'Laying the ground: the event, the schedule, registrations.',
      steps: [
        {
          title: 'Create the event',
          where: 'Events → Add',
          body: 'Set the date and location. They appear automatically on the public schedule page and on Home, with a countdown. Then set its status to Active: everything you add from now on (cars, tasks, guests) attaches to it automatically, and the lists show only what belongs to it. This is also where you can set how many spots are available (blank or 0 = no limit) and the text of a participation waiver, if you want it ticked at registration.',
          tip: 'When the event is over, set its status to Finished. Nothing is deleted — it just leaves the view, and the app moves on to your next event. To look back, pick the event from the header selector, or "All events".',
        },
        {
          title: 'Connect Telegram',
          where: 'Settings → Telegram',
          body: 'Message @BotFather on Telegram with /newbot, get a token, paste it here. Why it is worth it: SMS costs money per message and no provider was ever configured here, so no automatic message has ever gone out. Telegram is free and carries more than text: the entry number, the zone, the schedule, the confirmation link. Anyone without Telegram keeps getting SMS.',
          tip: 'Set the public address of the app in the same place, or the confirmation link in messages comes out empty.',
          role: 'admin',
        },
        {
          title: 'Fill in the schedule',
          where: 'Home → Schedule → +',
          body: 'Each slot has a time and a title. It shows publicly on the agenda page with the current slot highlighted, so participants can see what is next themselves.',
        },
        {
          title: 'Open registrations',
          where: 'Settings → Public pages → "Car registration"',
          body: 'Take the link with "Copy link", or the QR code (printable, for a poster). You also choose which event the link is for: left on automatic it always follows the active event, pinned to one it stays that event\'s link — which is what a printed poster needs. The form tells people on the spot if the car is already registered, and accepts at most 3 registrations per hour from the same connection as spam protection. If you set a number of spots, the form warns when few are left and, once they run out, stays open: whoever registers goes on the waiting list rather than being turned away.',
          role: 'admin',
        },
        {
          title: 'Set up the parking zones',
          where: 'Map → upload the plan · Settings → Zones',
          body: 'Upload the site plan and set each zone\'s capacity. Later, at the gate, you will see in real time how many spots are left in each zone.',
        },
        {
          title: 'Turn on automatic SMS',
          where: 'SMS Center → Automations',
          body: 'Optional. You can send an SMS when a registration is approved, a welcome SMS on arrival, and reminders 24h and 2h before. Templates take {{prenume}}, {{nume}}, {{marca}}, {{model}}, {{numar}}, {{categoria}}.',
          role: 'admin',
        },
      ],
    },
    {
      title: 'The day before',
      sub: 'Clear the queue, print, prepare the tablets.',
      steps: [
        {
          title: 'Approve the registrations',
          where: 'Cars → the "Registered" column',
          body: 'Each card opens for details. You can Approve (it becomes a car, with a zone), put it On hold, or Reject. Watch the flags: ⛔ means the plate is on the blocklist, ⧉ means the plate already exists in the system. The blocklist flag stays on the car after approval too — you see it on the card in the Cars list, and at the gate. If the event has a number of spots, a "Waiting list" tab appears too, holding those who came after the spots ran out — you approve them the same way, when a spot frees up.',
        },
        {
          title: 'Print the passes',
          where: 'Cars → Passes',
          body: 'Generates an A6 card for every car in the filtered list, carrying its check-in QR code. Filter the list first if you only want some of them. The pass also carries the entry number in large print — it is given automatically, in registration order, and restarts from 1 at every event.',
          tip: 'Right after printing, freeze the start list under Events → edit the event. From then on the numbers cannot move, whatever you do with imports; late entries still get numbers.',
        },
        {
          title: 'Prepare the gate tablets',
          where: 'Gate',
          body: 'On each device at the entrance: open Gate, tap 📍 the gate name and type it in ("Gate A", "VIP entrance") so you will know later which way each car came in, then press the kiosk button 🖥. The app locks onto the gate screen and the display stops going to sleep.',
          tip: 'To leave kiosk mode: press the red kiosk button in the header and confirm. Alternatively, press and hold the "Gate — Check-in" title for 1.5 seconds.',
        },
        {
          title: 'Take a backup',
          where: 'Settings → Backups → Back up now',
          body: 'There is an automatic one every night, but a manual one right before the event never hurts.',
          role: 'admin',
        },
      ],
    },
    {
      title: 'On the day',
      sub: 'This is where it all happens. The main screen is the Gate.',
      steps: [
        {
          title: 'Check in at the gate',
          where: 'Gate',
          body: 'Scan the QR code on the pass (or search by plate) → the car\'s card appears → press Arrived. Cars already on site get a Left button for when they drive off. The zone can be changed straight from the list.',
          tip: 'It works with no internet. Check-ins are saved on the device and upload themselves when the signal returns — the pill in the header shows how many are waiting. Do not reinstall the app or clear its data while any are still pending.',
        },
        {
          title: 'The arrivals wall',
          where: 'Gate → 🖥 Arrivals wall',
          body: 'A screen meant for a projector: the latest arrivals, with a sound for each new car. The presentation button starts auto-scrolling.',
        },
        {
          title: 'Judge the cars',
          where: 'Cars → Judging',
          body: 'A full-screen phone view, meant for standing in front of the car: the entry number, the car, and ten buttons from 1 to 10. Press once and the score is saved; press another and it replaces it. The top shows how many you have scored, the "Not scored" filter leaves only what you have not seen, and search works by the number on the windscreen. Results shows the average per car, grouped by class, with 🏆 on the winner.',
          tip: 'Each judge has one score per car, so the average is the panel\'s average. On a tie both are marked — the jury decides, not the app.',
          role: 'staff',
        },
        {
          title: 'See who is here right now',
          where: 'Home → Arrivals',
          body: 'Here now, Left, Total arrivals, Last 15 minutes — plus a breakdown by hour, zone, make, city and gate.',
        },
      ],
    },
    {
      title: 'Towards the end',
      sub: 'Voting and feedback open as the event winds down.',
      steps: [
        {
          title: 'Open "Best Car" voting',
          where: 'Settings → Best Car voting',
          body: 'Pick the event and press Open. Take the link from Settings → Public pages ("Best Car voting"), where there is a printable QR code too. One vote per device, changeable. The standings are live, and the podium appears automatically on the arrivals wall as well — handy on a projector during the awards.',
          tip: 'Remember to press Close when voting is over.',
          role: 'admin',
        },
        {
          title: 'Ask for feedback',
          where: 'Settings → Feedback → Copy link',
          body: 'Participants leave a star rating and, if they want, a comment. The answers show up in the same place, under Settings → Feedback.',
        },
      ],
    },
    {
      title: 'After the event',
      sub: 'Draw the line and tidy up.',
      steps: [
        {
          title: 'Pull the report',
          where: 'Cars → Report',
          body: 'A printable summary (or saved as PDF from the print dialog): total cars, attendance, arrivals per hour, top zones, makes and cities, the feedback average and spread, plus the comments.',
        },
        {
          title: 'Clean up leftover photos',
          where: 'Settings → Clean orphan photos',
          body: 'It shows what it would delete and how much space that frees, first. Nothing is removed unless you confirm.',
          role: 'admin',
        },
        {
          title: 'Final backup',
          where: 'Settings → Back up now → Download',
          body: 'So you hold a copy of the event outside the system too.',
          role: 'admin',
        },
      ],
    },
  ],

  autoTitle: 'What happens on its own',
  autoNote: 'You do not have to do anything for these:',
  auto: [
    'A backup every night (the last 30 are kept)',
    'Event reminders (24h and 2h before) and task reminders',
    'Google Sheets sync, every few minutes',
    'Welcome SMS on arrival and approval SMS, if you enabled them',
    'A notification when a new registration comes in',
    'Automatic cleanup of old logs',
    'An entry number for every new car, counted separately for each event',
    'Emptying the trash after 30 days, and promoting from the waiting list when someone says they cannot come',
  ],

  troubleTitle: 'When something goes wrong',
  trouble: [
    { p: 'No internet at the gate',
      f: 'Carry on as normal. Check-ins are stored locally and upload themselves. Do not reinstall the app or clear its data — you would lose whatever has not synced yet.' },
    { p: 'Stuck in kiosk mode',
      f: 'The red kiosk button in the header → confirm. Or press and hold the gate title for 1.5 seconds.' },
    { p: 'The app is showing an old version',
      f: 'Close it completely and reopen. The new version takes effect on the second start.' },
    { p: 'Someone says they cannot register',
      f: 'They have probably hit the limit of 3 registrations per hour. They can try later, or you add them by hand from Cars → Add.' },
    { p: 'Someone ended up on the waiting list by mistake',
      f: 'Open the registration from Cars → Waiting list and approve it normally. The list blocks nothing, it is only a queue.' },
    { p: 'You cannot see the Judging button',
      f: 'It is for staff and admins only. Check your role on the Team page.' },
    { p: 'The voting page says voting is not open',
      f: 'That is expected — it has to be opened first from Settings → Best Car voting.' },
    { p: 'SMS are not going out',
      f: 'SMS Center → check the provider and that the automation is ticked.' },
    { p: 'Something crashed on someone\'s phone',
      f: 'Settings → Reported errors shows what happened, on which device and when.' },
    { p: 'You deleted a car by mistake',
      f: 'Straight away: the Undo button in the notification. Later: Settings → Recently deleted → Bring back. The trash keeps them 30 days and the car returns with its entry number.' },
    { p: 'You imported the wrong file',
      f: 'Settings → Recently deleted → Recent imports → Undo import. Moves the whole batch to the trash in one tap. Re-importing the same file brings the cars back rather than duplicating them.' },
    { p: 'Someone deleted data by mistake',
      f: 'Settings → Backups → Restore. It brings back what was deleted without touching anything created in the meantime.' },
    { p: 'Someone asks for their data to be deleted',
      f: 'Settings → GDPR → search by plate, phone, email or name → check the results → delete permanently, photos included.' },
  ],
};
