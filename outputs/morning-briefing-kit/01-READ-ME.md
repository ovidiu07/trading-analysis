# O singură informare dimineața, pregătită pentru TradeJAudit

Flux recomandat: sarcină programată → raport lizibil + JSON din aceeași analiză → Admin / ASIA → import → previzualizare → publicare.

Titlu editorial: **Briefing de dimineață — Asia → Europa & pregătire SUA**. Publicați o dată dimineața în ASIA. LONDON și DAY_RECAP rămân opționale, numai pentru informații efectiv noi. Raportul de dimineață nu devine actualizare London sau recapitulare doar pentru că a trecut ora. Pregătirea pentru SUA este prospectivă, nu o relatare a sesiunii americane care nu a avut încă loc.

## Fișiere

1. `02-SCHEDULED-TASK-PROMPT.txt`: prompt complet de înlocuire pentru sarcina existentă. Îl copiați voi în sarcină; nu am modificat programarea externă.
2. `03-DAILY-OUTPUT-TEMPLATE.md`: structura lizibilă, repetabilă în fiecare dimineață.
3. `04-2026-09-07-RESTRUCTURED.md`: rescriere concretă în română a materialului încărcat, cu scenarii distincte DAX, Nasdaq-100/NQ și ES și cu lacunele păstrate explicit.
4. `05-2026-09-07-ADMIN-TEMPLATE.json`: aceeași rescriere mapată pe schema existentă. Este un șablon de finalizare, NU un JSON de publicat direct: marcajele pentru interval, ora-limită și contractele NQ/ES trebuie completate din surse reale. Nu le înlocuiți cu o oră aleasă doar ca importul să treacă.
5. `06-SOURCE-AND-IMPORT-NOTES.md`: surse consultate, limitele verificării, corespondența cu editorul și simplificarea recomandată pentru Admin.

Pentru rapoartele viitoare, promptul cere un JSON complet, fără marcaje, produs automat de sarcina programată. Lipsa unei cotații nu blochează raportul: secțiunea numerică rămâne goală și lacuna este explicată. Lipsa orei-limită reale blochează un export final onest. Ora generării nu este automat ora observației sau ora publicării unei știri.

## De ce exemplul istoric are marcaje

Fișierul primit are data de 7 septembrie 2026, dar nu precizează ora exactă a generării, limita informațională sau toate momentele observațiilor. Contractele futures nu sunt identificate. O rescriere poate organiza și atribui textul, dar nu poate recupera aceste metadate prin presupunere.

Marcajele sunt: `__COVERAGE_START_UTC__`, `__COVERAGE_END_UTC__`, `__REFERENCE_TIME_UTC__`, `__NQ_CONTRACT_VERIFIED__`, `__ES_CONTRACT_VERIFIED__`. Contractul trebuie verificat pentru seria analizată, nu dedus din luna curentă. Dacă nu se poate identifica, eliminați cardul futures corespunzător din JSON și păstrați explicația de indisponibilitate în surse/limitări; raportul lizibil poate păstra un cadru conceptual fără niveluri.

Valorile din exemplul rescris sunt atribuite materialului primit, nu recertificate drept cotații curente. Câmpurile `news`, `events` și `macro` sunt intenționat goale în exemplul JSON, deoarece cer momente precise pe care verificarea de aici nu le-a stabilit. Temele și calendarul propus sunt păstrate ca elemente atribuite și de verificat, nu convertite în observații cu ore inventate.

## Ritualul de dimineață

1. Citiți cele cinci idei și cele trei fișe de instrument; verificați data, ora-limită și statutul piețelor.
2. Revizuiți lacunele și sursele. Un bias „mixt” sau un card indisponibil este un rezultat valid.
3. Copiați numai obiectul JSON din export în „Paste generated briefing”.
4. Verificați previzualizarea, inclusiv limba română și contractele futures; apoi publicați ASIA.
5. Publicați o corecție ca revizie nouă dacă apare o eroare. Nu transformați textul de dimineață în fapte observate după-amiaza.

Nu am schimbat în acest pas interfața aplicației, selecția la pragurile orare, schema serverului sau sarcina externă. Kitul este compatibil cu arhitectura curentă; simplificarea interfeței Admin este descrisă separat ca recomandare.
