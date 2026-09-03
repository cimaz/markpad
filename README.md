# Markpad

Ένας ελαφρύς, **local-first** Markdown editor φτιαγμένος με [Electron](https://www.electronjs.org/).
Γράφεις Markdown χωρίς να ξέρεις το συντακτικό απ' έξω, βλέπεις live preview, και
πλοηγείσαι στις σημειώσεις σου με έναν χάρτη συνδέσεων τύπου Obsidian.

![Ο editor σε split view](docs/editor.png)

---

## Τι κάνει

Το Markpad ανοίγει έναν **φάκελο** με `.md` αρχεία και σου δίνει τρία εργαλεία πάνω του:
έναν editor με κουμπιά για κάθε στοιχείο Markdown, μια ζωντανή προεπισκόπηση, και έναν
γράφο που δείχνει πώς συνδέονται τα αρχεία μεταξύ τους.

Δεν υπάρχει cloud, λογαριασμός ή βάση δεδομένων — τα αρχεία σου μένουν απλά `.md` στον δίσκο.

## Δυνατότητες

### ✍️ Editor με toolbar

Κάθε στοιχείο Markdown έχει κουμπί, ώστε να μην χρειάζεται να θυμάσαι το συντακτικό:

| Ομάδα | Κουμπιά |
| --- | --- |
| Επικεφαλίδες | `H1` `H2` `H3` |
| Έμφαση | **Bold** · *Italic* · ~~Strikethrough~~ |
| Μπλοκ | Blockquote · inline code · code block |
| Λίστες | Bulleted · numbered · task list (`- [ ]`) |
| Ένθετα | Link · image · πίνακας · οριζόντια γραμμή |

Τα κουμπιά δουλεύουν πάνω στην **επιλεγμένη περιοχή** και λειτουργούν ως toggle — π.χ.
επιλέγεις κείμενο που είναι ήδη bold και το κουμπί το ξε-bold-άρει. Το `Tab` βάζει
δύο κενά αντί να φύγει η εστίαση.

### 👁️ Τρεις προβολές

`Code` (μόνο ο κώδικας) · `Split` (κώδικας + preview δίπλα-δίπλα) · `Preview` (μόνο το
φορμαρισμένο αποτέλεσμα). Εναλλαγή με τα κουμπιά ή `Cmd/Ctrl+1 / 2 / 3`.

Η προεπισκόπηση χρησιμοποιεί GitHub-flavored Markdown ([`marked`](https://marked.js.org/))
και το HTML περνά από sanitization με [DOMPurify](https://github.com/cure53/DOMPurify)
πριν εμφανιστεί. Ανανεώνεται καθώς πληκτρολογείς.

### 📁 File browser

Δενδρική προβολή του φακέλου στα αριστερά — φωλιασμένοι υποφάκελοι που ανοίγουν με κλικ,
lazy loading, το ανοιχτό αρχείο τονισμένο. Τα Markdown αρχεία ξεχωρίζουν οπτικά από τα
υπόλοιπα. Κρυφά αρχεία (`.dotfiles`) παραλείπονται.

### 🕸️ Link map

![Ο χάρτης συνδέσεων](docs/graph.png)

Το κουμπί **Graph** στο sidebar σαρώνει τον φάκελο και σχεδιάζει κάθε σημείωση ως κόμβο,
με ακμές τις μεταξύ τους συνδέσεις. Αναγνωρίζει:

| Μορφή | Παραδείγματα |
| --- | --- |
| **Wikilinks** | `[[Note]]` · `[[Note\|alias]]` · `[[Note#heading]]` · `[[folder/Note]]` |
| **Markdown links** | `[κείμενο](note.md)` · `[κείμενο](../folder/note.md)` · ονόματα με percent-encoding |

Αγνοεί σωστά external URLs, `mailto:`, εικόνες, σκέτα anchors (`#section`) και ό,τι
βρίσκεται μέσα σε inline ή fenced code. Διπλά links προς τον ίδιο στόχο μετρούν μία φορά.
Παραλείπονται φάκελοι όπως `node_modules`, `.git`, `dist`.

**Χειρισμός:** σύρσιμο για μετακίνηση (ή σύρε κόμβο για αναδιάταξη) · scroll για zoom ·
κλικ για εστίαση στους γείτονες · **διπλό κλικ για άνοιγμα** του αρχείου. Στο toolbar:
`Rescan` (νέα σάρωση), `Fit` (zoom to fit), `Locate` (κεντράρισμα στο ανοιχτό αρχείο).

Το μέγεθος κόμβου δείχνει πλήθος συνδέσεων · το ανοιχτό αρχείο έχει μπλε δακτύλιο ·
τα orphans (χωρίς καμία σύνδεση) είναι μικρές μεμονωμένες κουκκίδες. Το sidebar δείχνει
σύνολα σημειώσεων, συνδέσεων, orphans και σπασμένων links.

Ο γράφος είναι γραμμένος από το μηδέν σε `<canvas>` — force-directed layout με spatial
grid, **χωρίς εξωτερική βιβλιοθήκη**. Το layout είναι ντετερμινιστικό, οπότε ο ίδιος
φάκελος δίνει πάντα τον ίδιο χάρτη.

### 🌗 Light / Dark theme

Εναλλαγή με το κουμπί πάνω δεξιά ή `Cmd/Ctrl+T`. Η επιλογή αποθηκεύεται και ισχύει και
για τον χάρτη.

### Και μικρότερα

- **Session restore** — ανοίγει ξανά τον τελευταίο φάκελο, αρχείο, theme και view.
- **File associations** — διπλό κλικ σε `.md` από το Finder / file manager ανοίγει το Markpad
  (μετά την εγκατάσταση ενός πακέτου).
- **Status bar** — όνομα αρχείου, ένδειξη μη αποθηκευμένων αλλαγών, θέση cursor, μέτρημα λέξεων.
- Προειδοποίηση πριν κλείσεις αρχείο με μη αποθηκευμένες αλλαγές.

## Ξεκίνημα από τον κώδικα

Απαιτείται [Node.js](https://nodejs.org/) 18+.

```bash
git clone https://github.com/cimaz/markpad.git
cd markpad
npm install
npm start
```

Άνοιγμα συγκεκριμένου αρχείου: `npm start -- path/to/file.md`

## Πακετάρισμα

```bash
npm run dist          # macOS + Linux
npm run dist:mac      # macOS  — .dmg + .zip (arm64 & x64)
npm run dist:linux    # Linux  — .deb (amd64 & arm64)
npm run pack          # unpacked build, χωρίς installer (γρήγορος έλεγχος)
```

Τα πακέτα βγαίνουν στον φάκελο `distro/`. Το εικονίδιο παράγεται αυτόματα από το
[`build/icon.svg`](build/icon.svg) — γίνεται render με το ίδιο το Electron, οπότε δεν
χρειάζεται ImageMagick ή sharp. Ρυθμίσεις: [`electron-builder.yml`](electron-builder.yml).

### Εγκατάσταση του `.deb`

```bash
sudo apt install ./distro/markpad_1.0.0_amd64.deb
```

Εγκαθίσταται στο `/opt/Markpad` με desktop entry, εικονίδια hicolor και file association για `.md`.

### Σημείωση για macOS

Τα builds είναι **unsigned** (δεν υπάρχει Apple Developer certificate). Στο πρώτο άνοιγμα:
δεξί κλικ στο app → **Open** → **Open**, ή `xattr -cr /Applications/Markpad.app`.

## Συντομεύσεις

| Πλήκτρα | Ενέργεια |
| --- | --- |
| `Cmd/Ctrl` + `N` | Νέο αρχείο |
| `Cmd/Ctrl` + `O` | Άνοιγμα αρχείου |
| `Cmd/Ctrl` + `Shift` + `O` | Άνοιγμα φακέλου |
| `Cmd/Ctrl` + `S` | Αποθήκευση |
| `Cmd/Ctrl` + `Shift` + `S` | Αποθήκευση ως… |
| `Cmd/Ctrl` + `B` / `I` / `E` / `K` | Bold / Italic / Inline code / Link |
| `Cmd/Ctrl` + `1` / `2` / `3` | Code / Split / Preview |
| `Cmd/Ctrl` + `T` | Εναλλαγή light / dark |
| `Cmd/Ctrl` + `\` | Εμφάνιση / απόκρυψη sidebar |

## Πώς είναι φτιαγμένο

| Αρχείο | Ρόλος |
| --- | --- |
| [`main.js`](main.js) | Electron main process — παράθυρο, native menu, IPC για filesystem, parsing των links (`graph:build`) |
| [`preload.js`](preload.js) | Ασφαλές γεφύρωμα (`contextBridge`) + rendering Markdown με `marked` |
| [`src/index.html`](src/index.html) | Δομή UI |
| [`src/styles.css`](src/styles.css) | Themes (CSS variables) + στυλ preview & graph |
| [`src/renderer.js`](src/renderer.js) | Λογική UI — file tree, editor, toolbar, preview, splitter, graph wiring |
| [`src/graph.js`](src/graph.js) | Force-directed link graph σε canvas, χωρίς dependencies |

**Ασφάλεια:** `contextIsolation: true`, `nodeIntegration: false`, strict Content-Security-Policy,
και το preview HTML περνά πάντα από DOMPurify. Ο renderer δεν έχει πρόσβαση στο filesystem —
όλες οι λειτουργίες αρχείων και το parsing των links γίνονται στο main process και εκτίθενται
μέσω ενός στενού API.

Εξαρτήσεις runtime: μόνο [`marked`](https://marked.js.org/). Το [DOMPurify](https://github.com/cure53/DOMPurify)
αντιγράφεται στο `src/vendor/` κατά το `npm install` ώστε να φορτώνεται κάτω από το CSP.

## Άδεια

[MIT](LICENSE)
