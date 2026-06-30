# Formula Copy

Extension Chrome — copiez les formules KaTeX en code source LaTeX propre.

[English](README.md)

## Installation

1. Ouvrez `chrome://extensions`, activez le mode développeur
2. Chargez l'extension non empaquetée en sélectionnant ce répertoire
3. Ouvrez chatgpt.com — l'icône devient verte quand l'extension est active

## Utilisation

- Sélectionnez du texte avec des formules, **Ctrl+C**, collez pour obtenir du LaTeX (`$…$` / `$$…$$`)
- Cliquez sur l'icône pour activer/désactiver sur n'importe quel site
- Icône verte = actif sur le site actuel, grise = inactif

## Fonctionnalités

- Formule seule, texte mixte, tableaux HTML pris en charge
- Texte sans formules laissé intact
- N'interfère pas avec le bouton de copie des blocs de code de ChatGPT
- Interface en 8 langues

## Tests

```bash
npm install
npm test
```
