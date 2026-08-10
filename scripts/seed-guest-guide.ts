// Seed the guestGuide config on a property's overrides doc.
// Usage: npx tsx scripts/seed-guest-guide.ts [propertySlug]
//
// Writes with { merge: true } and only touches the `guestGuide` field — it will
// not disturb anything the admin UI has written to propertyOverrides.
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as admin from 'firebase-admin';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const serviceAccountPath = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH;
if (!serviceAccountPath) {
  console.error('FIREBASE_ADMIN_SERVICE_ACCOUNT_PATH not set in .env.local');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(path.resolve(serviceAccountPath)),
});

const db = admin.firestore();

const MAP_URL =
  'https://www.google.com/maps/d/u/0/viewer?mid=1KGS8M8z9YF24TjVxeixWJYDr3gB6Uis';

const prahovaGuide = {
  enabled: true,

  wifi: { network: 'coman_guest', password: 'athome' },

  contacts: [
    {
      displayName: { en: 'Bogdan', ro: 'Bogdan' },
      role: { en: 'Your host', ro: 'Gazda' },
      phone: '+40723200868',
      channel: 'whatsapp',
      speaks: ['en', 'ro'],
    },
    {
      displayName: {
        en: 'Corina & Gigi',
        ro: 'Doamna Corina și domnul Gigi',
      },
      role: {
        en: 'They look after the house — they live a few doors down',
        ro: 'Se ocupă de casă — locuiesc la câteva case distanță',
      },
      phone: '+40726114540',
      channel: 'whatsapp',
      speaks: ['ro'],
      prefill: {
        ro: 'Bună ziua, sunt oaspetele de la cabana domnului Bogdan. Am nevoie de ajutor, vă rog să mă sunați.',
      },
    },
    {
      displayName: { en: 'Emergency', ro: 'Urgențe' },
      role: {
        en: 'Ambulance, fire, police · nearest hospital is in Sinaia',
        ro: 'Ambulanță, pompieri, poliție · cel mai apropiat spital este în Sinaia',
      },
      phone: '112',
      channel: 'call',
      speaks: ['en', 'ro'],
    },
  ],

  mapUrl: MAP_URL,

  // Lengths measured from the KML traces on the map above.
  routes: [
    {
      name: { en: 'From the gate — trailhead', ro: 'De la poartă — intrarea pe traseu' },
      kind: 'walk',
      km: 0.4,
    },
    {
      name: { en: 'Trei Brazi – Cheile Râșnoavei', ro: 'Trei Brazi – Cheile Râșnoavei' },
      kind: 'hike',
      km: 9,
    },
    {
      name: { en: 'Secăria – Sinaia', ro: 'Secăria – Sinaia' },
      kind: 'hike',
      km: 20.1,
    },
    {
      name: { en: 'Creasta Baiului', ro: 'Creasta Baiului' },
      kind: 'bike',
      km: 24,
    },
    {
      name: { en: 'Barajul Paltinu loop', ro: 'Tur Barajul Paltinu' },
      kind: 'car',
      km: 48.5,
    },
  ],

  // Transcribed from the printed Welcome Book (obvious typos fixed). Ordered so
  // that one array serves both tiers: a guest sees the operational sections first
  // and 'before you go' last; a public visitor sees only the tier:'public' ones,
  // which fall in a sensible selling order on their own.
  //
  // House rule on distances: always a RANGE, never a single figure. DN1 traffic
  // makes a liar out of any exact number.
  sections: [
    {
      id: 'things-to-know',
      tier: 'guest',
      title: { en: 'Things to know', ro: 'Bine de știut' },
      body: {
        en: 'Wi-Fi — a high-speed fibre connection, with a Wi-Fi 6 router and a hotspot.\n\nParking — on the main street, right in front of the property.\n\nHeating — fully automated. For any request or malfunction, please contact us.\n\nTap water — drinkable, supplied by the city company. We still suggest bottled water for extra safety.\n\nFirewood — available for an extra fee. Please ask us.\n\nSupplies — extra supplies on request. Fees may apply.\n\nBedsheets & towels — extra sets on request, for a small fee.\n\nCleaning — everything is carefully sanitised. A typical house prep takes about 6 hours; linens and towels are washed at 90°C, toilets and slippers disinfected.',
        ro: 'Wi-Fi — conexiune pe fibră, cu router Wi-Fi 6 și hotspot.\n\nParcare — pe strada principală, chiar în fața proprietății.\n\nÎncălzire — complet automatizată. Pentru orice solicitare sau defecțiune, vă rugăm să ne contactați.\n\nApa de la robinet — potabilă, furnizată de compania orașului. Vă recomandăm totuși apă îmbuteliată, pentru siguranță.\n\nLemne de foc — disponibile contra cost. Vă rugăm să ne cereți.\n\nConsumabile — la cerere. Se pot aplica taxe.\n\nLenjerie și prosoape — seturi suplimentare la cerere, contra unei mici taxe.\n\nCurățenie — totul este igienizat cu atenție. Pregătirea casei durează în jur de 6 ore; lenjeria și prosoapele se spală la 90°C, toaletele și papucii se dezinfectează.',
      },
    },
    {
      id: 'house-rules',
      tier: 'guest',
      title: { en: 'House rules', ro: 'Regulile casei' },
      body: {
        en: 'No smoking or vaping inside the house. Please smoke in the designated area outside, and use the ashtray provided.\n\nNo unregistered guests. Please tell us if you would like to add anyone to your booking.\n\nNo parties or large gatherings. Drug use and excessive drinking are not allowed.\n\nNo pets or animals of any kind on the property. Please don’t feed the dogs, cats or wildlife.\n\nNever leave a fire unattended. Put out the BBQ or the fireplace before going to sleep or leaving the house.\n\nPlease don’t flush anything inorganic or bulky — the risk of blocking the sewage is real.\n\nThe bins are near the entrance gate. Please don’t leave rubbish or food waste outside.\n\nPlease tell us about any damage or malfunction straight away, so we can repair or replace it.\n\nNo excessive noise, music or rowdy behaviour. We are grateful to you for not disturbing the neighbours.',
        ro: 'Fumatul și vapatul sunt interzise în casă. Vă rugăm să fumați în zona amenajată de afară și să folosiți scrumiera.\n\nFără oaspeți neînregistrați. Vă rugăm să ne anunțați dacă doriți să adăugați pe cineva la rezervare.\n\nFără petreceri sau grupuri mari. Consumul de droguri și excesul de alcool nu sunt permise.\n\nFără animale de companie sau animale de orice fel pe proprietate. Vă rugăm să nu hrăniți câinii, pisicile sau animalele sălbatice.\n\nNu lăsați niciodată focul nesupravegheat. Stingeți grătarul sau șemineul înainte de culcare sau înainte de a pleca de acasă.\n\nVă rugăm să nu aruncați în toaletă obiecte neorganice sau voluminoase — riscul de înfundare a canalizării este real.\n\nPubelele sunt lângă poarta de la intrare. Vă rugăm să nu lăsați gunoi sau resturi de mâncare afară.\n\nVă rugăm să ne spuneți imediat despre orice stricăciune sau defecțiune, ca să o putem repara sau înlocui.\n\nFără zgomot excesiv, muzică tare sau gălăgie. Vă mulțumim că nu deranjați vecinii.',
      },
    },
    {
      id: 'appliances',
      tier: 'guest',
      title: { en: 'Appliances & electronics', ro: 'Electrocasnice și electronice' },
      body: {
        en: 'Television — two ways to watch: cable TV, and streaming (HBO Max, SkyShowtime) through the Apple TV. To switch to the Apple TV, press any button on its remote, or change the source with the TV remote. On streaming apps, please use the “Comarnic Guest” profile.\n\nSound system — two Apple HomePods in the living room. They start automatically when the Apple TV plays, or by voice — “Hey Siri, play some jazz music”. They are linked to an Apple Music account, and controlled by voice only, so please don’t move them.\n\nDishwasher — use it whenever you like. The pods are in a basket on the back of the cabinet door under the sink. For a full load we recommend programme 2.\n\nHeating — a Bosch gas boiler with smart thermostats in each room. Please don’t change any settings on the boiler; for anything unusual, contact us.\n\nAlso in the house — a Bluetooth speaker on the terrace (instructions on the paper next to it), washing machine (pods under the sink), gas stove and oven, fridge, microwave, coffee maker, electric kettle, hair dryer, blender, crockery and cutlery, pots, and pans inside the oven.',
        ro: 'Televizor — două variante: cablu TV și streaming (HBO Max, SkyShowtime) prin Apple TV. Pentru a comuta pe Apple TV, apăsați orice buton pe telecomanda lui sau schimbați sursa de pe telecomanda televizorului. În aplicațiile de streaming, vă rugăm să folosiți profilul „Comarnic Guest”.\n\nSistem audio — două boxe Apple HomePod în living. Pornesc automat când merge Apple TV sau la comandă vocală — „Hey Siri, play some jazz music”. Sunt conectate la un cont Apple Music și se controlează exclusiv vocal, așa că vă rugăm să nu le mutați.\n\nMașina de spălat vase — o puteți folosi oricând. Tabletele sunt într-un coșuleț pe spatele ușii de dulap de sub chiuvetă. Pentru o mașină plină recomandăm programul 2.\n\nÎncălzire — centrală pe gaz Bosch, cu termostate inteligente în fiecare cameră. Vă rugăm să nu modificați setările centralei; pentru orice problemă, contactați-ne.\n\nMai găsiți în casă — boxă Bluetooth pe terasă (instrucțiunile sunt pe hârtia de lângă ea), mașină de spălat rufe (detergentul e sub chiuvetă), aragaz și cuptor pe gaz, frigider, cuptor cu microunde, filtru de cafea, fierbător electric, uscător de păr, blender, veselă și tacâmuri, oale și tigăi (în cuptor).',
      },
    },
    {
      id: 'emergency',
      tier: 'guest',
      title: { en: 'Emergency', ro: 'Urgențe' },
      body: {
        en: 'Fire extinguishers: one in the entrance hallway next to the toilet, one next to the fireplace, one on the terrace. Please locate them when you arrive.\n\nFirst aid kit: in the ground floor toilet.\n\nWhen you call 112, your address is Str. Secăriei nr 197, Comarnic, Prahova county.\n\nThe nearest city hospital is in Sinaia, Str. Spitalului 2.\n\nTaxi: 0799 027 767',
        ro: 'Stingătoare: unul pe holul de la intrare lângă toaletă, unul lângă șemineu și unul pe terasă. Vă rugăm să le identificați la sosire.\n\nTrusa de prim ajutor: în toaleta de la parter.\n\nCând sunați la 112, adresa este Str. Secăriei nr 197, Comarnic, județul Prahova.\n\nCel mai apropiat spital orășenesc este în Sinaia, Str. Spitalului 2.\n\nTaxi: 0799 027 767',
      },
    },

    {
      id: 'welcome',
      tier: 'public',
      title: { en: 'Welcome', ro: 'Bine ați venit' },
      body: {
        en: 'Welcome to our home, and thank you for choosing to stay with us. This place is close to our hearts, and we hope it becomes a warm spot for you too. Settle in, unwind, and let the magic of the place weave its spell.',
        ro: 'Bine ați venit în casa noastră și vă mulțumim că ați ales să stați la noi. Locul acesta ne este drag și sperăm să devină un loc cald și pentru voi. Așezați-vă, respirați și lăsați magia locului să își facă treaba.',
      },
    },
    {
      id: 'host',
      tier: 'public',
      title: { en: 'Meet your host', ro: 'Gazda' },
      body: {
        en: 'Hello, my name is Bogdan and I am happy to share my house with you. I built this place some years ago as a family retreat and a basecamp for our mountain adventures. It is a place where each stone tells a tale, and every corner holds some warmth.\n\nIt has been a while since my children were running around and their laughter filled the yard. Here they found their childhood playground, and here we and our friends bonded over the beauty of nature.\n\nFor me you are more than just guests — you are part of a story that keeps growing with the joy of everyone who stays. Enjoy, and respect the warmth in the corners.',
        ro: 'Bună, mă numesc Bogdan și mă bucur să împart casa asta cu voi. Am construit-o acum câțiva ani ca refugiu de familie și ca tabără de bază pentru drumețiile noastre la munte. E un loc în care fiecare piatră spune o poveste și fiecare colț păstrează un pic de căldură.\n\nA trecut ceva vreme de când copiii mei alergau prin curte și râsetele lor umpleau locul. Aici și-au găsit terenul de joacă al copilăriei, și tot aici ne-am apropiat, noi și prietenii noștri, de frumusețea naturii.\n\nPentru mine sunteți mai mult decât niște oaspeți — sunteți parte dintr-o poveste care crește cu bucuria fiecăruia care stă aici. Bucurați-vă și aveți grijă de căldura din colțuri.',
      },
    },
    {
      id: 'about-house',
      tier: 'public',
      title: { en: 'About the house', ro: 'Despre casă' },
      body: {
        en: 'The house is the perfect backdrop for family and friends to enjoy the outdoors and unwind. The terrace looks out over sunsets on the hills, and the fully equipped kitchen covers anything you might want to cook.\n\nEvenings are well spent by the indoor fireplace, or grilling at the outdoor BBQ. The yard — with its playground, zip line and hammocks — is made for both fun and for doing nothing at all.\n\n3 bedrooms · 2 bathrooms · BBQ, firepit and fireplace · high-speed internet',
        ro: 'Casa e locul potrivit pentru familie și prieteni care vor aer liber și liniște. Terasa dă spre apusurile de peste dealuri, iar bucătăria complet utilată acoperă orice ați vrea să gătiți.\n\nSerile trec bine lângă șemineul din casă sau la grătarul de afară. Curtea — cu locul de joacă, tiroliana și hamacurile — e făcută și pentru distracție, și pentru a nu face absolut nimic.\n\n3 dormitoare · 2 băi · grătar, vatră de foc și șemineu · internet rapid',
      },
    },
    {
      id: 'rooms',
      tier: 'public',
      title: { en: 'Your rooms', ro: 'Camerele' },
      body: {
        en: 'Main bedroom — first floor, king-size double bed, storage cabinets, wood-clad walls, and a balcony with chairs and a coffee table.\n\nSecond bedroom — ground floor, sleeps 3–4, with a double bed and a bunk bed, in a cosy and welcoming room.\n\nKids’ bedroom — first floor, with a bunk bed, desk, swing, toys and pillows. Ideal for children, and cosy for one adult. Please don’t use the upper bunk if you are over 50 kg.\n\nLiving & kitchen — a spacious living room with fireplace, TV, sound system, games and a book collection; a modern kitchen and a dining area that seats a family comfortably.',
        ro: 'Dormitorul principal — la etaj, pat dublu king-size, dulapuri, pereți îmbrăcați în lemn și balcon cu scaune și măsuță de cafea.\n\nAl doilea dormitor — la parter, pentru 3–4 persoane, cu un pat dublu și un pat supraetajat, într-o cameră primitoare.\n\nCamera copiilor — la etaj, cu pat supraetajat, birou, leagăn, jucării și perne. Ideală pentru copii și confortabilă pentru un adult. Vă rugăm să nu folosiți patul de sus dacă aveți peste 50 kg.\n\nLiving și bucătărie — living spațios cu șemineu, TV, sistem audio, jocuri și o colecție de cărți; bucătărie modernă și o zonă de luat masa unde încape confortabil o familie.',
      },
    },
    {
      id: 'kitchen',
      tier: 'public',
      title: { en: 'The kitchen', ro: 'Bucătăria' },
      body: {
        en: 'The kitchen and dining area are the heart of the house. Equipped with all the essentials, the space caters comfortably for two families. The table seats five with ease, and there are extra chairs on the terrace.\n\nFridge, microwave, coffee maker, electric kettle, dishwasher, gas stove and oven, blender, washing machine, dishes, pots, pans and cutlery. A high chair for toddlers is available — you will find it on the main bedroom’s balcony.\n\nTea, coffee and sugar, basic condiments, dish soap and dishcloths are complimentary.',
        ro: 'Bucătăria și zona de luat masa sunt inima casei. Utilată cu tot ce trebuie, face față confortabil la două familii. La masă încap lejer cinci persoane, iar pe terasă sunt scaune în plus.\n\nFrigider, cuptor cu microunde, filtru de cafea, fierbător electric, mașină de spălat vase, aragaz și cuptor pe gaz, blender, mașină de spălat rufe, veselă, oale, tigăi și tacâmuri. Există și un scaun de masă pentru copii mici — îl găsiți pe balconul dormitorului principal.\n\nCeaiul, cafeaua și zahărul, condimentele de bază, detergentul de vase și lavetele sunt din partea casei.',
      },
    },
    {
      id: 'living-room',
      tier: 'public',
      title: { en: 'The living room', ro: 'Livingul' },
      body: {
        en: 'The indoor fireplace makes the evenings, and it comes with everything you need to start a fire; special wood chunks are available on request, for an extra fee.\n\nThe TV carries cable and streaming (HBO Max, SkyShowtime) through the Apple TV, and two Apple HomePods handle the music, linked to an Apple Music account.',
        ro: 'Șemineul din casă face serile, și vine cu tot ce trebuie ca să aprindeți focul; la cerere avem și lemne speciale, contra cost.\n\nTelevizorul are cablu și streaming (HBO Max, SkyShowtime) prin Apple TV, iar muzica e treaba celor două boxe Apple HomePod, conectate la un cont Apple Music.',
      },
    },
    {
      id: 'terrace',
      tier: 'public',
      title: { en: 'The terrace', ro: 'Terasa' },
      body: {
        en: 'The terrace was always our favourite place. Mornings begin with coffee at a table set for six, against the backdrop of the hills. Shaded by trees, it stays pleasantly cool even on hot summer days. With a strong Wi-Fi signal, it is also a good place to work, surrounded by birdsong.\n\nIn the evening the BBQ area takes over — laid-back dinners, grilling, laughter under the open sky. There is a Bluetooth speaker on the left side of the table, ready for your music.\n\nAs night falls, low light pollution reveals a genuinely spectacular sky.',
        ro: 'Terasa a fost dintotdeauna locul nostru preferat. Diminețile încep cu o cafea la o masă de șase persoane, cu dealurile în față. Umbrită de copaci, rămâne plăcut de răcoroasă chiar și în zilele toride de vară. Semnalul Wi-Fi e bun, așa că e și un loc bun de lucru, cu păsările pe fundal.\n\nSeara preia grătarul — cine fără grabă, fum, râsete sub cerul liber. Pe partea stângă a mesei e o boxă Bluetooth, gata pentru muzica voastră.\n\nIar când se lasă noaptea, poluarea luminoasă scăzută scoate la iveală un cer cu adevărat spectaculos.',
      },
    },
    {
      id: 'yard',
      tier: 'public',
      title: { en: 'The yard', ro: 'Curtea' },
      body: {
        en: 'BBQ — right next to the terrace, fully equipped for evening cookouts. Wood and coal on request.\n\nFirepit — beside the BBQ, with a 15-litre cauldron for cosy nights and outdoor cooking. Wood on request, for a small fee.\n\nPlayground — a wooden playground with swings and a hammock chair, in the back yard.\n\nHammocks — several, set among the trees.\n\nSwing & lounger — a three-seater garden swing; the cushions are in the storage box behind it.\n\nZip line — about 30 m long, and the children’s clear favourite. It safely carries an adult of up to 90 kg. Free to use, at your own risk.',
        ro: 'Grătar — chiar lângă terasă, complet echipat pentru serile de gătit afară. Lemne și cărbune la cerere.\n\nVatră de foc — lângă grătar, cu un ceaun de 15 litri, pentru seri lungi și gătit în aer liber. Lemne la cerere, contra unei mici taxe.\n\nLoc de joacă — un loc de joacă din lemn, cu leagăne și un scaun-hamac, în curtea din spate.\n\nHamacuri — mai multe, întinse între copaci.\n\nBalansoar — un balansoar de grădină cu trei locuri; pernele sunt în lada din spatele lui.\n\nTiroliană — circa 30 m și clar favorita copiilor. Susține în siguranță și un adult de până la 90 kg. Se folosește gratuit, pe propria răspundere.',
      },
    },
    {
      id: 'getting-around',
      tier: 'public',
      title: { en: 'Getting around', ro: 'Cum vă deplasați' },
      body: {
        en: 'By car — the property is well connected to everything on the Prahova Valley (DN1) and the Doftana Valley (DJ101S and DJ102I). Expect heavy traffic in peak season and at weekends.\n\nBy train — Comarnic is a stop for most trains between Bucharest, the Prahova Valley and Brașov. A good option for a day trip to Brașov on busy summer days.\n\nBy bike — if you like climbing, this is the place. A good day ride is Secăria – Doftana Valley – Câmpina – Comarnic, or something more adventurous from Azuga to Secăria along the Baiului ridge.\n\nOn foot — some of the best trailheads are minutes away, from the village into the forest, or a short drive to the Bucegi paths. Ask us and we will match a route to your day and your energy.',
        ro: 'Cu mașina — proprietatea e bine conectată la tot ce înseamnă Valea Prahovei (DN1) și Valea Doftanei (DJ101S și DJ102I). Atenție la trafic în sezon și în weekend.\n\nCu trenul — Comarnic e stație pentru majoritatea trenurilor dintre București, Valea Prahovei și Brașov. O variantă bună pentru o zi la Brașov în verile aglomerate.\n\nCu bicicleta — dacă vă place urcatul, ăsta e locul. O tură bună de o zi e Secăria – Valea Doftanei – Câmpina – Comarnic, sau ceva mai aventuros, din Azuga până în Secăria, pe Creasta Baiului.\n\nPe jos — unele dintre cele mai bune intrări pe trasee sunt la câteva minute, din sat direct în pădure, sau la o scurtă distanță cu mașina de potecile din Bucegi. Întrebați-ne și vă potrivim un traseu cu ziua și cu energia voastră.',
      },
    },
    {
      id: 'things-to-do',
      tier: 'public',
      title: { en: 'Things to do', ro: 'Ce puteți face' },
      body: {
        en: 'Mountain biking — forest tracks start right from the village. For longer rides, try the Doftana Valley loop or the Baiului ridge toward Azuga.\n\nHiking — trails of every level fan out from the Bucegi and Baiului mountains. Ask us and we will match one to your day and the weather.\n\nCable cars — from Bușteni (about 30–45 min), a cable car climbs to the Bucegi Plateau at 2,206 m, home of the Sphinx and Babele. Weather permitting.\n\nSki — in winter, Sinaia’s Cota 1400/2000 slopes are about 20–35 min away, with Azuga and Predeal close behind. Rentals and lessons on the mountain.\n\nEnduro & ATV — guided ATV and off-road tours run from Sinaia and the Prahova Valley; machine and guide included, best booked a day ahead.\n\nBungee & zip line — our 30 m garden zip line covers the children. For bigger thrills, Cheile Râșnoavei near Brașov offers bungee jumps up to 140 m and Romania’s highest zip line.\n\nWine tasting — in Azuga (about 25–40 min), the historic Rhein cellars have made sparkling wine since 1892. Book a cellar tour and a tasting, rain or shine.\n\nRainy days — tour Peleș Castle, explore Sinaia’s old town, casino and monastery, or save the Bușteni cable car for clear skies.',
        ro: 'Mountain bike — potecile de pădure încep chiar din sat. Pentru ture mai lungi, încercați bucla Văii Doftanei sau Creasta Baiului spre Azuga.\n\nDrumeții — trasee de toate nivelurile pornesc din Bucegi și din Baiu. Întrebați-ne și vă potrivim unul cu ziua și cu vremea.\n\nTelecabină — din Bușteni (circa 30–45 min), telecabina urcă pe Platoul Bucegi, la 2.206 m, acolo unde sunt Sfinxul și Babele. Dacă ține vremea.\n\nSchi — iarna, pârtiile de la Cota 1400/2000 din Sinaia sunt la circa 20–35 min, iar Azuga și Predeal imediat după. Închirieri și lecții pe munte.\n\nEnduro și ATV — ture ghidate de ATV și off-road pleacă din Sinaia și de pe Valea Prahovei; utilajul și ghidul sunt incluse, cel mai bine rezervate cu o zi înainte.\n\nBungee și tiroliană — tiroliana noastră de 30 m rezolvă partea copiilor. Pentru senzații tari, Cheile Râșnoavei, lângă Brașov, au sărituri cu coarda de până la 140 m și cea mai înaltă tiroliană din România.\n\nDegustare de vinuri — la Azuga (circa 25–40 min), pivnițele istorice Rhein fac vin spumant din 1892. Se rezervă tur de pivniță și degustare, pe orice vreme.\n\nZile ploioase — Castelul Peleș, centrul vechi al Sinaiei, cazinoul și mănăstirea; telecabina de la Bușteni o păstrați pentru o zi senină.',
      },
    },
    {
      id: 'closer-to-home',
      tier: 'public',
      title: { en: 'Closer to home', ro: 'Aproape de casă' },
      body: {
        en: 'Some of our own favourites are within an hour, and all of them are pinned on the map above: Belvedere Comarnic, La Antene, Barajul Paltinu and the lake, Păstrăvăria Doftana, and Vistieru.\n\nAsk us — we will tell you which one suits the weather you have got.',
        ro: 'Câteva dintre locurile noastre preferate sunt la mai puțin de o oră și toate sunt marcate pe harta de mai sus: Belvedere Comarnic, La Antene, Barajul Paltinu și lacul, Păstrăvăria Doftana și Vistieru.\n\nÎntrebați-ne — vă spunem care se potrivește cu vremea pe care o prindeți.',
      },
    },
    {
      id: 'places-to-see',
      tier: 'public',
      title: { en: 'Places to see', ro: 'Locuri de văzut' },
      body: {
        en: 'Peleș Castle, Sinaia — 30–50 minutes by car depending on traffic, or by train. The royal summer residence, and the single most visited thing on the valley.\n\nPaltinu Lake & Dam — about 30–45 minutes by car, with a stunning view and a big sunny meadow that is ideal for a picnic. Don’t forget the frisbee.\n\nThe Sphinx — a natural rock formation in the Bucegi at 2,216 m, and a source of myth and legend. Reachable by cable car from Bușteni, or on a medium-difficulty hike.\n\nIalomița Cave — in Bucegi National Park, a 480 m geological marvel known for its stalactites and the monastery at its entrance. A short but captivating 40-minute tour. About 1.5–2 hours by car, plus a 20-minute walk.\n\nBrașov — about 1.5–2 hours away, and a great day trip. Founded in 1211 by the Teutonic Knights, with a rich old town ringed by the Southern Carpathians. If you are only visiting the city, take the train — the road gets very busy in peak season.\n\nBran Castle — steeped in myth as the reputed home of Dracula, this 14th-century fortress houses medieval artifacts and a deep dive into Romanian history. About 2–2.5 hours by car, and crowded in high season.\n\nSeven Ladders Canyon — an exhilarating climb through gorges and waterfalls, with metal ladders aiding the ascent. One of Europe’s longest zip lines is here too: 3.8 km over 37 segments. About 2–2.5 hours by car.\n\nPoiana Secuilor — near Predeal, surrounded by forest and mountains. Established in 1935, it is the only authentic lodge in the Predeal area, and an easy hike from Cabana Trei Brazi.\n\nCheile Râșnoavei — jagged limestone cliffs and good hiking, near Predeal. Reachable by car, or on foot from Poiana Secuilor.',
        ro: 'Castelul Peleș, Sinaia — 30–50 de minute cu mașina, în funcție de trafic, sau cu trenul. Reședința regală de vară și cel mai vizitat obiectiv de pe vale.\n\nBarajul și Lacul Paltinu — circa 30–45 de minute cu mașina, cu o priveliște superbă și o pajiște mare și însorită, numai bună de picnic. Nu uitați frisbee-ul.\n\nSfinxul — o formațiune stâncoasă naturală din Bucegi, la 2.216 m, în jurul căreia s-au adunat mituri și legende. Se ajunge cu telecabina din Bușteni sau pe un traseu de dificultate medie.\n\nPeștera Ialomiței — în Parcul Natural Bucegi, o minune geologică de 480 m, cunoscută pentru stalactite și pentru mănăstirea de la intrare. Un tur scurt, dar frumos, de 40 de minute. Circa 1,5–2 ore cu mașina, plus 20 de minute de mers pe jos.\n\nBrașov — la circa 1,5–2 ore, excelent pentru o zi întreagă. Fondat în 1211 de Cavalerii Teutoni, cu un centru vechi bogat, înconjurat de Carpații Meridionali. Dacă mergeți doar în oraș, luați trenul — șoseaua e foarte aglomerată în sezon.\n\nCastelul Bran — învăluit în legenda lui Dracula, fortăreața din secolul al XIV-lea adăpostește obiecte medievale și o bucată serioasă de istorie românească. Circa 2–2,5 ore cu mașina și aglomerat în sezon.\n\nCanionul Șapte Scări — o urcare spectaculoasă prin chei și cascade, cu scări metalice care ajută la urcuș. Tot aici e una dintre cele mai lungi tiroliene din Europa: 3,8 km, pe 37 de tronsoane. Circa 2–2,5 ore cu mașina.\n\nPoiana Secuilor — lângă Predeal, înconjurată de pădure și munte. Înființată în 1935, e singura cabană autentică din zona Predeal și se ajunge ușor pe jos de la Cabana Trei Brazi.\n\nCheile Râșnoavei — pereți de calcar și drumeții bune, lângă Predeal. Se ajunge cu mașina sau pe jos din Poiana Secuilor.',
      },
    },
    {
      id: 'places-to-eat',
      tier: 'public',
      title: { en: 'Places to eat', ro: 'Unde mâncați' },
      body: {
        en: 'Alex, Sinaia — a Hungarian restaurant we love: tasty, genuine and not too expensive. Traditional and game dishes — try the bean soup in bread and the venison goulash. Str. Theodor Aman 9, Sinaia.\n\nCabana Schiori, Sinaia — the Skiers’ Hut, quite famous in Sinaia. Really good food, a warm atmosphere, traditional dishes, and live music sometimes. Str. Cota 1400 nr 7, Sinaia.\n\nTaverna Sârbului, Sinaia — Serbian food, very tasty, big dishes. We definitely recommend it. You may need a reservation in peak season. Calea Codrului 39E, Sinaia.\n\nAntonia, Comarnic — a local restaurant, good if you want something close by, or home delivery (tel 0736 647 459). Decent prices, fair value. Str. Poiana 139, Comarnic.\n\nCernica, Comarnic — a living piece of communist-era hospitality. The food is good; don’t expect anything fancy. Worth a visit just to watch the waiters. DN1 108, Comarnic.',
        ro: 'Alex, Sinaia — un restaurant unguresc pe care îl iubim: gustos, autentic și nu foarte scump. Mâncare tradițională și preparate din vânat — încercați ciorba de fasole în pâine și gulașul de căprioară. Str. Theodor Aman 9, Sinaia.\n\nCabana Schiori, Sinaia — destul de cunoscută în Sinaia. Mâncare foarte bună, atmosferă caldă, preparate tradiționale și, uneori, muzică live. Str. Cota 1400 nr 7, Sinaia.\n\nTaverna Sârbului, Sinaia — mâncare sârbească, foarte gustoasă, porții mari. O recomandăm cu încredere. S-ar putea să aveți nevoie de rezervare în sezon. Calea Codrului 39E, Sinaia.\n\nAntonia, Comarnic — un restaurant local, bun dacă vreți ceva aproape, sau livrare la domiciliu (tel. 0736 647 459). Prețuri decente, raport corect. Str. Poiana 139, Comarnic.\n\nCernica, Comarnic — o bucată vie de ospitalitate din epoca comunistă. Mâncarea e bună; nu vă așteptați la rafinamente. Merită o vizită și numai ca să vă uitați la ospătari. DN1 108, Comarnic.',
      },
    },
    {
      id: 'nearest',
      tier: 'public',
      title: { en: 'Your nearest…', ro: 'Cel mai apropiat…' },
      body: {
        en: 'Supermarket — a big Kaufland in the village centre, with anything you might need. Str. Republicii 4, Comarnic.\n\nLocal shop — for basics, drinks and a lively local atmosphere, there is a small shop and pub right across the street. Str. Secăriei 196, Comarnic.\n\nPharmacy — two in Comarnic, usually open until 8pm on weekdays, 6pm on Saturday and 2pm on Sunday. Str. Republicii 70, Comarnic.\n\nTrain station — in the centre of Comarnic, on the main road, on the right-hand side heading toward Bucharest.\n\nHospital — the nearest city hospital is in Sinaia, Str. Spitalului 2.',
        ro: 'Supermarket — un Kaufland mare în centrul localității, cu tot ce v-ar putea trebui. Str. Republicii 4, Comarnic.\n\nMagazin local — pentru lucruri de bază, băuturi și un pic de atmosferă locală, e un magazin mic cu bar chiar peste drum. Str. Secăriei 196, Comarnic.\n\nFarmacie — două în Comarnic, de obicei deschise până la 20:00 în timpul săptămânii, 18:00 sâmbăta și 14:00 duminica. Str. Republicii 70, Comarnic.\n\nGară — în centrul Comarnicului, pe șoseaua principală, pe partea dreaptă în sensul spre București.\n\nSpital — cel mai apropiat spital orășenesc este în Sinaia, Str. Spitalului 2.',
      },
    },
    {
      id: 'history',
      tier: 'public',
      title: { en: 'Comarnic — a piece of history', ro: 'Comarnic — o bucată de istorie' },
      body: {
        en: 'Comarnic was first documented on 27 May 1510, when it was under the control of the Margineni noblemen. By the 17th century it had passed to the Cantacuzino and Filipescu families, and two centuries later it became the property of Prince Gheorghe Bibescu.\n\nThe name and the local toponymy come from sheep farming. Comarnic — like Breaza — is believed to have been established by Transylvanian shepherds who stopped here on their way to the Danube’s ponds. Philologists trace the name to “comarnic”, the word shepherds in the Bârsa Country used for the room at the sheepfold where cheese was kept. Sheep shearing took place here at least until the 18th century.\n\nThe main occupation was the carriage trade. In 1694 the settlement was one of the 12 villages on the Câmpina–Brașov trade route, carrying merchants’ goods on horseback along mountain paths and later in caravans — close to a local monopoly by the 18th century.\n\nLocal names like Valea Lanii and Dealul Lanii still point to that shepherding heritage, as do the villages the settlers founded: Podu Neagului and Vatra Satului, now parts of Comarnic.',
        ro: 'Comarnicul e atestat documentar pentru prima dată pe 27 mai 1510, când se afla sub stăpânirea boierilor Mărgineni. În secolul al XVII-lea trecuse la familiile Cantacuzino și Filipescu, iar două secole mai târziu a devenit proprietatea domnitorului Gheorghe Bibescu.\n\nNumele localității și toponimia locală vin din păstorit. Se crede că, la fel ca Breaza, Comarnicul a fost întemeiat de ciobani ardeleni care se opreau aici în drumul lor spre bălțile Dunării. Filologii leagă numele de „comarnic”, cuvântul folosit de ciobanii din Țara Bârsei pentru încăperea de la stână unde se ținea brânza. Tunsul oilor s-a făcut aici cel puțin până în secolul al XVIII-lea.\n\nOcupația principală a fost cărăușia. În 1694, așezarea era unul dintre cele 12 sate de pe drumul comercial Câmpina–Brașov, transportând mărfurile negustorilor călare pe poteci de munte și, mai târziu, cu caravanele — aproape un monopol local până în secolul al XVIII-lea.\n\nNume locale precum Valea Lanii și Dealul Lanii amintesc și azi de moștenirea pastorală, la fel ca satele întemeiate de așezători: Podu Neagului și Vatra Satului, astăzi părți din Comarnic.',
      },
    },

    {
      id: 'before-you-go',
      tier: 'guest',
      title: { en: 'Before you go', ro: 'Înainte de plecare' },
      body: {
        en: 'Linens — please leave the beds unmade, and put used towels and dishcloths in the bin upstairs.\n\nDishes — rinse and load the dishwasher, and run the cycle before you leave.\n\nFood — please empty the fridge and cupboards of open and perishable food.\n\nLights — make sure lights, appliances and electronics are off.\n\nFireplace — if you used it, remove the ash (there is a bin outside, next to the BBQ). Please don’t leave wood burning.\n\nWindows & doors — closed and locked, please.\n\nKeys — return them to the lockbox and message us when you leave.',
        ro: 'Lenjerie — vă rugăm să lăsați paturile nefăcute și să puneți prosoapele și lavetele folosite în coșul de la etaj.\n\nVase — clătiți-le și puneți-le în mașina de spălat vase, apoi porniți un ciclu înainte de plecare.\n\nMâncare — vă rugăm să goliți frigiderul și dulapurile de alimente deschise sau perisabile.\n\nLumini — asigurați-vă că luminile, electrocasnicele și electronicele sunt oprite.\n\nȘemineu — dacă l-ați folosit, scoateți cenușa (există o găleată afară, lângă grătar). Vă rugăm să nu lăsați lemne care ard.\n\nFerestre și uși — vă rugăm să le închideți și încuiați.\n\nChei — lăsați-le în cutia de chei și scrieți-ne la plecare.',
      },
    },
  ],
};

const GUIDES: Record<string, typeof prahovaGuide> = {
  'prahova-mountain-chalet': prahovaGuide,
};

async function main() {
  const slug = process.argv[2] || 'prahova-mountain-chalet';
  const guide = GUIDES[slug];

  if (!guide) {
    console.error(`No seed content defined for "${slug}". Known: ${Object.keys(GUIDES).join(', ')}`);
    process.exit(1);
  }

  const ref = db.collection('propertyOverrides').doc(slug);
  const before = await ref.get();
  if (!before.exists) {
    console.error(`propertyOverrides/${slug} does not exist — refusing to create it here.`);
    process.exit(1);
  }

  await ref.set({ guestGuide: guide }, { merge: true });

  const after = (await ref.get()).data()?.guestGuide;
  console.log(`Wrote guestGuide to propertyOverrides/${slug}`);
  console.log(`  contacts: ${after?.contacts?.length ?? 0}`);
  console.log(`  routes:   ${after?.routes?.length ?? 0}`);
  console.log(`  sections: ${after?.sections?.length ?? 0}`);
  console.log(`  wifi:     ${after?.wifi?.network ?? '(none)'}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
