

## Références Refero

Voici les patterns utilisés par les grandes apps pour organiser le chat + micro :

### ChatGPT (iOS)
- **Barre d'input** : `[+] [champ texte "Ask anything"] [mic] [send/waveform]`
- Le micro est **dans la barre d'input**, pas un écran séparé
- Chips de suggestion au-dessus quand le chat est vide
- Design minimaliste, dark mode

### Google Gemini (iOS)
- Mode écoute : le micro remplace la barre d'input avec un gros bouton central + texte "Listening..."
- Bascule clavier ↔ micro via des icônes à côté du bouton
- Transcription live affichée au-dessus du micro

### Microsoft Copilot (iOS)
- Gros bouton micro central bleu sous le champ texte
- Compteur de caractères dans le champ
- Toggle "Use GPT-4" au-dessus

---

## Recommandation pour Pick

Le **pattern ChatGPT** est le plus adapté : micro intégré directement dans la barre d'input du chatbot overlay existant, sans écran séparé.

## Plan d'implémentation

### 1. Bouton "Parle à Pick" → ouvre le chatbot overlay
**Fichier** : `src/components/pick/HomeScreen.tsx`
- Le bouton appelle déjà `onOpenChat()` ✅ — rien à changer ici

### 2. Ajouter un bouton micro dans la barre d'input du chatbot
**Fichier** : `src/components/pick/PickChatOverlay.tsx`

Layout actuel : `[input] [send]`
Nouveau layout : `[mic] [input] [send]`

Implémentation :
- Importer `useScribe` de `@elevenlabs/react` (déjà utilisé dans VoiceChat.tsx)
- Bouton rond `Mic` / `MicOff` à gauche du champ texte
- Au clic : fetch token via `scribe-token` edge function (existe déjà), puis `scribe.connect()` avec micro
- Pendant l