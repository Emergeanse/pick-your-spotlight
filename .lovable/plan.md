

## Plan : Simplifier "Pick choisit pour toi" et detecter le mode groupe dans le chat

### Changements

#### 1. Supprimer les etapes intermediaires de "Pick choisit pour toi"
**Fichier** : `src/components/pick/HomeScreen.tsx`

- Au clic sur "Pick choisit pour toi", appeler directement `generateTonightPick()` au lieu de `setFlowStep("who")`
- Supprimer le bloc de rendu conditionnel `flowStep !== "idle"` (lignes 770-810) qui affiche les etapes Who/What/Exploration
- Utiliser les valeurs par defaut : `explorationLevel=5`, `whatChoice="both"`
- Resultat : clic → chargement → Tonight's Pick directement

#### 2. Ajouter un tool "suggest_pick_together" dans l'Edge Function pick-chat
**Fichier** : `supabase/functions/pick-chat/index.ts`

- Ajouter un second outil `suggest_pick_together` que l'IA peut appeler quand elle detecte que l'utilisateur est a plusieurs
- Ajouter dans le system prompt (modes premium et free) une instruction :
  > "Si l'utilisateur mentionne qu'il est avec quelqu'un (copine, potes, famille, groupe, on est deux/trois/plusieurs, soiree entre amis...), utilise l'outil suggest_pick_together pour lui proposer le mode Pick Together."
- Le backend renvoie `{ type: "pick_together" }` quand cet outil est appele

#### 3. Gerer la reponse "pick_together" cote client
**Fichier** : `src/components/pick/VoiceChat.tsx`

- Quand la reponse du chat est `type: "pick_together"`, afficher le message de l'IA puis proposer un bouton "Lancer Pick Together" qui navigue vers `/app/pick-together`

### Resultat

```text
Avant :  "Pick choisit pour toi" → Qui → Quoi → Exploration → Tonight's Pick
Apres :  "Pick choisit pour toi" → Tonight's Pick (direct)

Chat :   "On est deux ce soir" → Pick propose d'aller sur Pick Together
```

### Ce qui ne change pas
- Le flux "Parle a Pick" reste identique (chat → suggestion → Tonight's Pick)
- Les preferences (exploration, type media) gardent leurs valeurs par defaut et restent configurables dans le profil

