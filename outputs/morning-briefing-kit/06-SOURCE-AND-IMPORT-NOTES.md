# Verificări și integrare — 7 septembrie 2026

## Ce am citit și reorganizat

Am citit integral fișierul încărcat, inclusiv toate cele 11 secțiuni, tabelele și lista de surse. Am verificat structura curentă din `frontend/src/features/briefings/model.ts`, `BriefingDocument.java` și `BriefingValidator.java`; șablonul respectă cheile implementate, nu propune o schemă nouă pe care Admin nu ar accepta-o.

| Secțiune originală | Destinație în forma recomandată |
|---|---|
| Rezumat executiv | Cinci idei, cu rol separat pentru DAX, Nasdaq-100/NQ și ES. |
| 1. Piețele asiatice | Registru Asia/participare, fără repetarea acelorași variații în fiecare capitol. |
| 2. China | Un fapt central și distincția creditare/stabilitate versus cerere. |
| 3. Japonia | JPY/BOJ în macro; implicații condiționale și detalii secundare de verificat. |
| 4. Semiconductori | O temă comună, apoi consecințe distincte pentru DAX și NQ. |
| 5. Auto | Context sectorial secundar; costuri/tarife revalidate înainte de prezentarea ca noutăți. |
| 6. FX și randamente | Tabel de observații cu momente și disponibilitate; fără sincronizare inventată. |
| 7. Mărfuri | Tabel macro și riscuri; cupru indisponibil, identitatea petrolului explicită. |
| 8. Futures SUA | Identitate NQ/ES, calendar cash versus futures și lacune directe. |
| 9. Geopolitică/comerț | Știre prioritară energie plus risc neprogramat. |
| 10. Transmitere către Europa | Fișa DAX și detaliile sectoriale; nu o a doua copie a rezumatului. |
| 11. Concluzii/calendar | Trei fișe, calendar verificabil și checklist înainte de Ready. |

Nu am extins automat fiecare temă asiatică într-o pretinsă observație ES/NQ. Interpretările noi sunt declarate ca scenarii condiționale.

## Probleme concrete identificate în sursă

- Ora-limită a informațiilor, intervalul exact și orele multor cotații lipsesc. „Snapshot mai devreme” și „ultimele referințe” nu sunt timestampuri.
- US2Y este descris ca referință de vineri, alături de observații prezentate pentru luni. Nu sunt un set simultan.
- Nasdaq Composite apare cu −0,29%, în timp ce cerința de produs este Nasdaq-100/NQ. Nu sunt același instrument.
- „S&P 500 futures” sugerează o familie relevantă pentru ES, dar nu identifică un contract, sursa prețului, baza variației sau intervalul de tranzacționare.
- Recapitalizarea Chinei apare ca aproximativ 54 mld. USD în corp/titlul bibliografic, 47 în slugul URL Reuters și 53 în titlul FT. Poate exista o explicație editorială/valutară/de revizie; nu este rezolvată prin presupunere.
- Nu există observații pentru DE2Y/DE10Y. Cuprul este deja explicit neconfirmat și trebuie să rămână astfel.
- „Nu a fost anunțat” este uneori mai puternic decât dovada oferită. Recomandarea este „nu am identificat în sursele consultate până la...”.
- ASML este context sectorial european; nu trebuie folosit drept dovadă directă a participării componentelor DAX. Verificați separat compoziția și contribuțiile indicelui.
- Probabilitățile Fed/BOJ fără metodă, instrument și oră trebuie reverificate sau omise din top-line.

## Ce am verificat pe web și ce nu

- [Calendarul oficial NYSE](https://www.nyse.com/trade/hours-calendars) confirmă închiderea cash pentru Labor Day, luni 7 septembrie 2026.
- [Calendarul CME](https://www.cmegroup.com/trading-hours.html) tratează separat programul de sărbătoare. Nu am stabilit în acest kit ora exactă de închidere/deschidere a fiecărui contract ES/NQ; nu am dedus-o din secțiuni ClearPort/FX care apar pe aceeași pagină.
- [Specificațiile CME ES](https://www.cmegroup.com/markets/equities/sp/e-mini-sandp500.contractSpecs.html) și [NQ](https://www.cmegroup.com/markets/equities/nasdaq/e-mini-nasdaq-100.contractSpecs.html) susțin identitatea produselor. Nu stabilesc prin sine ce contract ori ce cotație a folosit autorul raportului.
- [Nasdaq: Composite versus Nasdaq-100](https://www.nasdaq.com/newsroom/nasdaq-composite-vs-nasdaq-100-what-investors-should-know) confirmă distincția dintre indicii menționați. [NDX](https://indexes.nasdaq.com/Index/Overview/NDX) este referința pentru Nasdaq-100 cash.
- [Pagina Eurostat citată](https://ec.europa.eu/eurostat/web/products-euro-indicators/w/2-14082026-ap) menționează următoarea publicare a agregatelor la 7 septembrie 2026. Această verificare confirmă data, nu ora 12:00 România din tabelul primit.
- Deschiderea directă a celor două URL-uri Reuters verificate (Global Markets și Oil din 7 septembrie) a returnat erori de acces în instrumentul de navigare. Aceasta NU dovedește că articolele sunt false. Căutarea a găsit titlul Global Markets într-o [republicare atribuită Reuters](https://in.marketscreener.com/news/asia-tech-shares-rally-others-hesitant-as-oil-rises-ce785bdbdd81f02d); nu am folosit acest rezultat pentru a certifica toate numerele din document.
- Nu am reverificat integral cotațiile, NFP/consensul, probabilitățile, incidentele maritime, exporturile Coreei, rezervele Japoniei, politica OPEC+, tarifele sau toate sursele din bibliografie. Calendarul Sentix și ora/datele exacte Destatis rămân de verificat.

Prin urmare, rescrierea este o transformare editorială cu verificări limitate ale identităților și calendarului, nu un nou raport de piață integral documentat independent. Nu am introdus date aflate ulterior pentru a pretinde disponibilitate dimineața.

## Legătura cu Admin

| Conținut lizibil | Câmp implementat |
|---|---|
| Antet și cutoff | editorialDate / slot / editorialTimezone / coverageStart / coverageEnd / referenceTime |
| Cinci idei | translations.ro.summary |
| Registru | translations.ro.facts |
| Știri cu oră verificată | translations.ro.news |
| Calendar cu timestamp/status verificat | translations.ro.events |
| Snapshot macro cu moment real | translations.ro.macro |
| Trei fișe | translations.ro.scenarios; chei DAX, NASDAQ_100, ES |
| Confirmare / observație | main / risks / limitations, fără chei noi |
| Surse și lacune | sourcesAndLimitations și sursele fiecărui element |

În schema actuală, `news.publishedAt`, `events.scheduledAt`, `macro.observedAt` și orele rădăcină sunt obligatorii. Nu se pot importa „necunoscut” sau null în locul lor. Faptele permit time/availableAt null cu explicația disponibilității. De aceea exemplul JSON nu fabrică arrays numerice sau calendaristice pentru a umple editorul.

Fișierul 05 este JSON sintactic valid, dar are cinci marcaje de completare. Importul real trebuie să respingă timestampurile-marcaj. Verificarea structurală cu marcaje înlocuite într-o copie exclusiv de test nu transformă metadatele în informații reale. Promptul pentru execuțiile viitoare cere date reale și zero marcaje în exportul final.

## Cum aș simplifica interfața Admin pentru această rutină

Intrare principală: „Publică briefingul de dimineață”. Data de azi, Europe/Bucharest și ASIA sunt vizibile, preselectate. Acțiunea dominantă este „Lipește briefingul generat”. După parsare: rezumat + trei fișe + avertismentele de date, apoi previzualizare și publicare. Editorul complet rămâne pentru corecții, nu ca formular obligatoriu completat zilnic manual.

LONDON/recap se mută vizual într-o zonă secundară „Actualizări opționale”. Lipsa lor este normală pentru cadența de o dată pe zi; o eventuală schimbare a mesajelor și selecției Today trebuie implementată explicit, fără a redenumi conținutul ASIA. Actuala implementare încă folosește pragurile și fallback-ul descrise în livrarea anterioară.

Această simplificare este o recomandare de produs în acest kit, nu o modificare de interfață executată. Cererea curentă a fost tratată ca livrare a conținutului, promptului și șablonului reutilizabil.
