# Markpad

Ένας ελαφρύς Markdown editor φτιαγμένος με **Electron**.



## Χαρακτηριστικά

- **Light / Dark theme** — εναλλαγή με το κουμπί πάνω δεξιά ή `Cmd/Ctrl+T`. Η επιλογή αποθηκεύεται.
- **File browser** στην αριστερή στήλη — άνοιγμα φακέλου, φωλιασμένοι υποφάκελοι, κλικ σε αρχείο για άνοιγμα.
- **Toolbar με κουμπιά Markdown** — δεν χρειάζεται να ξέρεις το συντακτικό:
  headings, bold, italic, strikethrough, blockquote, inline code, code block,
  bulleted / numbered / task lists, link, image, πίνακας, οριζόντια γραμμή.
  Τα κουμπιά λειτουργούν πάνω στην επιλεγμένη περιοχή (toggle on/off).
- **Τρεις προβολές**: `Code` (μόνο κώδικας) · `Split` (κώδικας + preview) · `Preview` (μόνο φορμαρισμένο).
  Συντομεύσεις `Cmd/Ctrl+1 / 2 / 3`.
- Live preview με GitHub-flavored Markdown, sanitized με DOMPurify.
- Status bar: όνομα αρχείου, ένδειξη μη αποθηκευμένων αλλαγών, θέση cursor, μέτρημα λέξεων.
- **Link map (Graph)** — χάρτης όλων των σημειώσεων του φακέλου, τύπου Obsidian.

## Link map

Το κουμπί **Graph** στο sidebar σαρώνει τον φάκελο και σχεδιάζει κάθε `.md` αρχείο
ως κόμβο, με ακμές τα links μεταξύ τους. Ο χάρτης καταλαμβάνει ολόκληρο το κύριο pane.

Αναγνωρίζει:

| Μορφή | Παράδειγμα |
| --- | --- |
| Wikilinks | `[[Note]]`, `[[Note\|alias]]`, `[[Note#heading]]`, `[[folder/Note]]` |
| Markdown links | `[text](note.md)`, `[text](../folder/note.md)`, percent-encoded ονόματα |

Αγνοεί σωστά external URLs, `mailto:`, εικόνες, σκέτα anchors (`#section`), καθώς και
ό,τι βρίσκεται μέσα σε inline ή fenced code blocks. Διπλά links προς τον ίδιο στόχο
μετρούν μία φορά. Παραλείπονται `node_modules`, `.git`, `dist` κ.λπ.

Χειρισμός:

- **Σύρσιμο** — μετακίνηση (ή σύρε έναν κόμβο για να τον αναδιατάξεις)
- **Scroll** — zoom γύρω από τον κέρσορα
- **Κλικ** — εστίαση στον κόμβο και στους γείτονές του
- **Διπλό κλικ** — άνοιγμα του αρχείου και επιστροφή στον editor
- **Rescan / Fit / Locate** στο toolbar

Το μέγεθος του κόμβου δείχνει πόσα links έχει· ο ανοιχτός φάκελος έχει μπλε δακτύλιο·
τα orphans (χωρίς κανένα link) εμφανίζονται ως μικρές μεμονωμένες κουκκίδες. Το sidebar
δείχνει σύνολα σημειώσεων, links, orphans και σπασμένων links.

Ο γράφος είναι γραμμένος από το μηδέν σε canvas ([src/graph.js](src/graph.js)) — force-directed
layout με spatial grid, χωρίς εξωτερική βιβλιοθήκη. Το layout είναι ντετερμινιστικό, οπότε
ο ίδιος φάκελος δίνει πάντα τον ίδιο χάρτη.

## Εκτέλεση

```bash
npm install
npm start
```

Άνοιγμα συγκεκριμένου αρχείου: `npm start -- path/to/file.md`

## Συντομεύσεις

| Πλήκτρα | Ενέργεια |
| --- | --- |
| `Cmd/Ctrl+N` | Νέο αρχείο |
| `Cmd/Ctrl+O` | Άνοιγμα αρχείου |
| `Cmd/Ctrl+Shift+O` | Άνοιγμα φακέλου |
| `Cmd/Ctrl+S` | Αποθήκευση |
| `Cmd/Ctrl+Shift+S` | Αποθήκευση ως… |
| `Cmd/Ctrl+B / I / E / K` | Bold / Italic / Code / Link |
| `Cmd/Ctrl+1 / 2 / 3` | Code / Split / Preview |
| `Cmd/Ctrl+T` | Εναλλαγή theme |
| `Cmd/Ctrl+\` | Εμφάνιση/απόκρυψη sidebar |

## Δομή

| Αρχείο | Ρόλος |
| --- | --- |
| `main.js` | Electron main process — παράθυρο, native menu, IPC για filesystem |
| `preload.js` | Ασφαλές γεφύρωμα (`contextBridge`) + rendering Markdown με `marked` |
| `src/index.html` | Δομή UI |
| `src/styles.css` | Themes (CSS variables) + στυλ preview |
| `src/renderer.js` | Λογική UI — file tree, editor, toolbar, preview, splitter, graph wiring |
| `src/graph.js` | Force-directed link graph σε canvas (χωρίς dependencies) |
| `src/vendor/purify.min.js` | DOMPurify (αντίγραφο από `node_modules`) |

Το parsing των links γίνεται στο main process (`graph:build` στο [main.js](main.js)),
όχι στον renderer — έτσι το I/O δεν μπλοκάρει το UI.

## Πακετάρισμα (distro/)

```bash
npm run icon          # ξαναφτιάχνει build/icon.png + build/icons/ από το icon.svg
npm run dist          # mac + linux
npm run dist:mac      # μόνο macOS  (dmg + zip, arm64 & x64)
npm run dist:linux    # μόνο Linux  (deb, amd64 & arm64)
npm run pack          # unpacked build, χωρίς installer — για γρήγορο έλεγχο
```

Τα πακέτα βγαίνουν στον φάκελο `distro/`:

| Αρχείο | Πλατφόρμα |
| --- | --- |
| `Markpad-1.0.0-mac-arm64.dmg` | macOS, Apple Silicon |
| `Markpad-1.0.0-mac-x64.dmg` | macOS, Intel |
| `Markpad-1.0.0-arm64-mac.zip` / `Markpad-1.0.0-mac.zip` | macOS zip (για auto-update ή manual install) |
| `markpad_1.0.0_amd64.deb` | Debian / Ubuntu, x86-64 |
| `markpad_1.0.0_arm64.deb` | Debian / Ubuntu, ARM64 |

Ρυθμίσεις: [electron-builder.yml](electron-builder.yml). Το εικονίδιο παράγεται από το
[build/icon.svg](build/icon.svg) μέσω του [scripts/make-icon.js](scripts/make-icon.js),
που κάνει render με το ίδιο το Electron — δεν χρειάζεται ImageMagick/sharp.

### Εγκατάσταση του .deb

```bash
sudo apt install ./markpad_1.0.0_amd64.deb
```

Εγκαθίσταται στο `/opt/Markpad`, με desktop entry, εικονίδια hicolor (16→1024) και
file association για `.md`.

### ⚠️ Το macOS build είναι unsigned

Δεν υπάρχει Apple Developer certificate, οπότε το `identity: null` στο
`electron-builder.yml` παρακάμπτει το code signing. Στο πρώτο άνοιγμα το Gatekeeper
θα μπλοκάρει την εφαρμογή. Λύση για τον χρήστη:

```bash
xattr -cr /Applications/Markpad.app
```

ή δεξί κλικ στο app → **Open** → **Open**. Για κανονική διανομή χρειάζεται
Developer ID certificate + notarization (βγάλε το `identity: null` και βάλε
`CSC_LINK` / `CSC_KEY_PASSWORD` + `notarize`).

### ⚠️ Placeholder homepage

Το `homepage` στο [package.json](package.json) είναι `https://example.com/markpad` —
το ζητάει υποχρεωτικά το deb target. Άλλαξέ το στο πραγματικό URL του project.
