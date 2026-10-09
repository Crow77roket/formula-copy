# Formula Copy

Chrome-Erweiterung — kopieren Sie KaTeX-Formeln als sauberen LaTeX-Quellcode.

[English](../README.md)

## Installation

1. Öffnen Sie `chrome://extensions`, aktivieren Sie den Entwicklermodus
2. Laden Sie die entpackte Erweiterung und wählen Sie dieses Verzeichnis
3. Öffnen Sie chatgpt.com — das Symbol wird grün, wenn aktiv

## Verwendung

- Text mit Formeln auswählen, **Ctrl+C**, einfügen ergibt LaTeX (`$…$` / `$$…$$`)
- Klicken Sie auf das Symbol, um die Erweiterung auf beliebigen Seiten zu aktivieren
- Grünes Symbol = aktiv, graues Symbol = inaktiv
- Klicken Sie oben im Popup auf die kleine Schaltfläche neben der Sprachauswahl,
  um zwischen `$...$` / `$$...$$` (Standard, Schaltfläche zeigt `$`) und
  `\(...\)` / `\[...\]` (Schaltfläche zeigt `\(\)`) zu wechseln. Bewegen Sie den
  Mauszeiger darüber, um vollständige Beispiele der Formelbegrenzer zu sehen.
  Ihre Auswahl wird automatisch lokal gespeichert und gilt sofort für alle
  aktivierten Websites, ohne die Seite neu zu laden.

## Funktionen

- Einzelne Formeln, gemischter Text, HTML-Tabellen werden unterstützt
- Text ohne Formeln bleibt unverändert
- Beeinträchtigt nicht die Code-Block-Kopierfunktion von ChatGPT
- 8 Sprachen für die Benutzeroberfläche

## Tests

```bash
npm install
npm test
```
