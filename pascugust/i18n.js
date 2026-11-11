// Pas cu Gust — traducerile interfeței.
// Fiecare rând: [română, english, español, italiano, français, deutsch].
// {0}, {1} = valori care se schimbă (numere, titluri); se traduc și ele, dacă au o traducere.
'use strict';

const LANGS = {
  ro: { name: 'Română', flag: '🇷🇴', locale: 'ro-RO' },
  en: { name: 'English', flag: '🇬🇧', locale: 'en-GB' },
  es: { name: 'Español', flag: '🇪🇸', locale: 'es-ES' },
  it: { name: 'Italiano', flag: '🇮🇹', locale: 'it-IT' },
  fr: { name: 'Français', flag: '🇫🇷', locale: 'fr-FR' },
  de: { name: 'Deutsch', flag: '🇩🇪', locale: 'de-DE' },
};
const LANG_ORDER = ['ro', 'en', 'es', 'it', 'fr', 'de'];

const UI_ROWS = [
  // antet, navigare
  ['Rețetele tale, cu poze și video', 'Your recipes, with photos and video', 'Tus recetas, con fotos y vídeo', 'Le tue ricette, con foto e video', 'Tes recettes, en photos et vidéo', 'Deine Rezepte, mit Fotos und Video'],
  ['Seria ta de gătit', 'Your cooking streak', 'Tu racha de cocina', 'La tua serie in cucina', 'Ta série de cuisine', 'Deine Koch-Serie'],
  ['Temă', 'Theme', 'Tema', 'Tema', 'Thème', 'Design'],
  ['Limbă', 'Language', 'Idioma', 'Lingua', 'Langue', 'Sprache'],
  ['🌐 Limbă', '🌐 Language', '🌐 Idioma', '🌐 Lingua', '🌐 Langue', '🌐 Sprache'],
  ['🌍 Descoperă', '🌍 Discover', '🌍 Descubrir', '🌍 Scopri', '🌍 Découvrir', '🌍 Entdecken'],
  ['⌃ Glisează în sus pentru următoarea rețetă', '⌃ Swipe up for the next recipe', '⌃ Desliza hacia arriba para la siguiente receta', '⌃ Scorri in su per la prossima ricetta', '⌃ Glisse vers le haut pour la recette suivante', '⌃ Nach oben wischen für das nächste Rezept'],
  ['Cont și sincronizare', 'Account & sync', 'Cuenta y sincronización', 'Account e sincronizzazione', 'Compte et synchronisation', 'Konto & Synchronisierung'],
  ['Descoperă', 'Discover', 'Descubrir', 'Scopri', 'Découvrir', 'Entdecken'],
  ['Rețete', 'Recipes', 'Recetas', 'Ricette', 'Recettes', 'Rezepte'],
  ['Adaugă', 'Add', 'Añadir', 'Aggiungi', 'Ajouter', 'Neu'],
  ['Serie', 'Streak', 'Racha', 'Serie', 'Série', 'Serie'],
  ['Produse', 'Products', 'Productos', 'Prodotti', 'Produits', 'Produkte'],
  // acasă
  ['Ce gătim azi?', 'What are we cooking today?', '¿Qué cocinamos hoy?', 'Cosa cuciniamo oggi?', 'On cuisine quoi aujourd’hui ?', 'Was kochen wir heute?'],
  ['Gătește o rețetă ca să-ți aprinzi seria.', 'Cook a recipe to start your streak.', 'Cocina una receta para empezar tu racha.', 'Cucina una ricetta per accendere la tua serie.', 'Cuisine une recette pour lancer ta série.', 'Koch ein Rezept, um deine Serie zu starten.'],
  ['Ai gătit azi. Revino mâine ca să crească seria.', 'You cooked today. Come back tomorrow to grow your streak.', 'Hoy ya cocinaste. Vuelve mañana para aumentar tu racha.', 'Oggi hai cucinato. Torna domani per far crescere la serie.', 'Tu as cuisiné aujourd’hui. Reviens demain pour faire grandir ta série.', 'Du hast heute gekocht. Komm morgen wieder, damit deine Serie wächst.'],
  ['🔎 Caută rețete, ingrediente…', '🔎 Search recipes, ingredients…', '🔎 Busca recetas, ingredientes…', '🔎 Cerca ricette, ingredienti…', '🔎 Chercher recettes, ingrédients…', '🔎 Rezepte, Zutaten suchen…'],
  ['❤️ Favorite', '❤️ Favourites', '❤️ Favoritas', '❤️ Preferite', '❤️ Favoris', '❤️ Favoriten'],
  ['Toate', 'All', 'Todas', 'Tutte', 'Toutes', 'Alle'],
  ['Ciorbe', 'Soups', 'Sopas', 'Zuppe', 'Soupes', 'Suppen'],
  ['Feluri principale', 'Main dishes', 'Platos principales', 'Piatti principali', 'Plats principaux', 'Hauptgerichte'],
  ['Deserturi', 'Desserts', 'Postres', 'Dolci', 'Desserts', 'Desserts'],
  ['Conserve', 'Preserves', 'Conservas', 'Conserve', 'Conserves', 'Eingemachtes'],
  ['Mic dejun', 'Breakfast', 'Desayuno', 'Colazione', 'Petit-déjeuner', 'Frühstück'],
  ['Salate', 'Salads', 'Ensaladas', 'Insalate', 'Salades', 'Salate'],
  ['Altele', 'Other', 'Otras', 'Altro', 'Autres', 'Sonstiges'],
  ['Nicio rețetă aici încă.', 'No recipes here yet.', 'Aún no hay recetas aquí.', 'Ancora nessuna ricetta qui.', 'Pas encore de recette ici.', 'Hier gibt es noch keine Rezepte.'],
  ['➕ Adaugă prima rețetă', '➕ Add your first recipe', '➕ Añade tu primera receta', '➕ Aggiungi la prima ricetta', '➕ Ajoute ta première recette', '➕ Erstes Rezept hinzufügen'],
  // detaliu
  ['← Rețete', '← Recipes', '← Recetas', '← Ricette', '← Recettes', '← Rezepte'],
  ['← Rețetele mele', '← My recipes', '← Mis recetas', '← Le mie ricette', '← Mes recettes', '← Meine Rezepte'],
  ['🔗 Distribuie', '🔗 Share', '🔗 Compartir', '🔗 Condividi', '🔗 Partager', '🔗 Teilen'],
  ['📤 Trimite', '📤 Send', '📤 Enviar', '📤 Invia', '📤 Envoyer', '📤 Senden'],
  ['👩‍🍳 Gătește pas cu pas', '👩‍🍳 Cook step by step', '👩‍🍳 Cocina paso a paso', '👩‍🍳 Cucina passo dopo passo', '👩‍🍳 Cuisiner pas à pas', '👩‍🍳 Schritt für Schritt kochen'],
  ['✅ Am gătit-o', '✅ I cooked it', '✅ La cociné', '✅ L’ho cucinata', '✅ Je l’ai cuisinée', '✅ Gekocht'],
  ['🎞️ Animație pas cu pas', '🎞️ Step-by-step animation', '🎞️ Animación paso a paso', '🎞️ Animazione passo dopo passo', '🎞️ Animation pas à pas', '🎞️ Schritt-für-Schritt-Animation'],
  ['⬇️ GIF', '⬇️ GIF', '⬇️ GIF', '⬇️ GIF', '⬇️ GIF', '⬇️ GIF'],
  ['🧺 Ingrediente', '🧺 Ingredients', '🧺 Ingredientes', '🧺 Ingredienti', '🧺 Ingrédients', '🧺 Zutaten'],
  ['📋 Pași', '📋 Steps', '📋 Pasos', '📋 Passaggi', '📋 Étapes', '📋 Schritte'],
  ['🗑 Șterge rețeta', '🗑 Delete recipe', '🗑 Eliminar receta', '🗑 Elimina ricetta', '🗑 Supprimer la recette', '🗑 Rezept löschen'],
  ['Atinge pentru sunet', 'Tap for sound', 'Toca para activar el sonido', 'Tocca per l’audio', 'Touche pour le son', 'Tippen für Ton'],
  ['🔇 Fără sunet', '🔇 Muted', '🔇 Sin sonido', '🔇 Senza audio', '🔇 Son coupé', '🔇 Stumm'],
  ['🔊 Cu sunet', '🔊 Sound on', '🔊 Con sonido', '🔊 Audio attivo', '🔊 Son activé', '🔊 Ton an'],
  ['💾 Salvează', '💾 Save', '💾 Guardar', '💾 Salva', '💾 Enregistrer', '💾 Speichern'],
  ['Ți-a plăcut?', 'Did you like it?', '¿Te ha gustado?', 'Ti è piaciuta?', 'Ça t’a plu ?', 'Hat es dir gefallen?'],
  ['Pas cu Gust e gratuit: rețetele tale cu poze și video la fiecare pas, seria de gătit și GIF-uri de trimis prietenilor.', 'Pas cu Gust is free: your recipes with photos and video for every step, a cooking streak and GIFs to send to friends.', 'Pas cu Gust es gratis: tus recetas con fotos y vídeo en cada paso, tu racha de cocina y GIFs para enviar a tus amigos.', 'Pas cu Gust è gratis: le tue ricette con foto e video per ogni passaggio, la serie in cucina e GIF da mandare agli amici.', 'Pas cu Gust est gratuit : tes recettes en photos et vidéo à chaque étape, ta série de cuisine et des GIF à envoyer à tes amis.', 'Pas cu Gust ist kostenlos: deine Rezepte mit Fotos und Video zu jedem Schritt, eine Koch-Serie und GIFs für Freunde.'],
  ['➕ Fă-ți prima rețetă', '➕ Make your first recipe', '➕ Crea tu primera receta', '➕ Crea la tua prima ricetta', '➕ Crée ta première recette', '➕ Erstelle dein erstes Rezept'],
  ['👋 Rețetă trimisă de', '👋 Recipe sent by', '👋 Receta enviada por', '👋 Ricetta inviata da', '👋 Recette envoyée par', '👋 Rezept von'],
  ['cu Pas cu Gust. O poți găti pas cu pas chiar acum sau o poți salva în rețetele tale.', 'with Pas cu Gust. You can cook it step by step right now or save it to your recipes.', 'con Pas cu Gust. Puedes cocinarla paso a paso ahora mismo o guardarla en tus recetas.', 'con Pas cu Gust. Puoi cucinarla passo dopo passo subito o salvarla tra le tue ricette.', 'avec Pas cu Gust. Tu peux la cuisiner pas à pas tout de suite ou l’enregistrer dans tes recettes.', 'mit Pas cu Gust. Du kannst es jetzt Schritt für Schritt kochen oder in deinen Rezepten speichern.'],
  // mod gătit, animație
  ['✕ Închide', '✕ Close', '✕ Cerrar', '✕ Chiudi', '✕ Fermer', '✕ Schließen'],
  ['Închide', 'Close', 'Cerrar', 'Chiudi', 'Fermer', 'Schließen'],
  ['← Înapoi', '← Back', '← Atrás', '← Indietro', '← Retour', '← Zurück'],
  ['Următorul →', 'Next →', 'Siguiente →', 'Avanti →', 'Suivant →', 'Weiter →'],
  ['Termină ✓', 'Finish ✓', 'Terminar ✓', 'Fine ✓', 'Terminer ✓', 'Fertig ✓'],
  ['Gata!', 'Done!', '¡Listo!', 'Fatto!', 'Terminé !', 'Fertig!'],
  ['Poftă bună!', 'Enjoy your meal!', '¡Buen provecho!', 'Buon appetito!', 'Bon appétit !', 'Guten Appetit!'],
  ['Ai terminat', 'You finished', 'Has terminado', 'Hai finito', 'Tu as terminé', 'Du hast fertig gekocht:'],
  ['🔥 Bifează în serie', '🔥 Add to my streak', '🔥 Sumar a mi racha', '🔥 Aggiungi alla serie', '🔥 Ajouter à ma série', '🔥 Zur Serie hinzufügen'],
  ['💾 Salvează și bifează în serie', '💾 Save and add to my streak', '💾 Guardar y sumar a mi racha', '💾 Salva e aggiungi alla serie', '💾 Enregistrer et ajouter à ma série', '💾 Speichern und zur Serie hinzufügen'],
  ['▶ Pornește cronometrul', '▶ Start timer', '▶ Iniciar temporizador', '▶ Avvia il timer', '▶ Lancer le minuteur', '▶ Timer starten'],
  ['⏸ Pauză', '⏸ Pause', '⏸ Pausa', '⏸ Pausa', '⏸ Pause', '⏸ Pause'],
  ['▶ Continuă', '▶ Resume', '▶ Continuar', '▶ Riprendi', '▶ Reprendre', '▶ Weiter'],
  ['✓ Gata', '✓ Done', '✓ Listo', '✓ Fatto', '✓ Terminé', '✓ Fertig'],
  ['⬇️ Salvează GIF', '⬇️ Save GIF', '⬇️ Guardar GIF', '⬇️ Salva GIF', '⬇️ Enregistrer le GIF', '⬇️ GIF speichern'],
  ['⏳ Se creează…', '⏳ Creating…', '⏳ Creando…', '⏳ Creazione…', '⏳ Création…', '⏳ Wird erstellt…'],
  // editare
  ['➕ Rețetă nouă', '➕ New recipe', '➕ Nueva receta', '➕ Nuova ricetta', '➕ Nouvelle recette', '➕ Neues Rezept'],
  ['✏️ Editează rețeta', '✏️ Edit recipe', '✏️ Editar receta', '✏️ Modifica ricetta', '✏️ Modifier la recette', '✏️ Rezept bearbeiten'],
  ['Titlu *', 'Title *', 'Título *', 'Titolo *', 'Titre *', 'Titel *'],
  ['ex: Tochitură moldovenească', 'e.g. Grandma’s apple pie', 'ej.: Tortilla de patatas', 'es.: Lasagne della nonna', 'ex. : Tarte aux pommes de mamie', 'z. B. Omas Apfelkuchen'],
  ['Descriere scurtă', 'Short description', 'Descripción breve', 'Breve descrizione', 'Courte description', 'Kurzbeschreibung'],
  ['Ce o face specială?', 'What makes it special?', '¿Qué la hace especial?', 'Cosa la rende speciale?', 'Qu’est-ce qui la rend spéciale ?', 'Was macht es besonders?'],
  ['Categorie', 'Category', 'Categoría', 'Categoria', 'Catégorie', 'Kategorie'],
  ['Timp total (min)', 'Total time (min)', 'Tiempo total (min)', 'Tempo totale (min)', 'Temps total (min)', 'Gesamtzeit (Min.)'],
  ['Porții', 'Servings', 'Raciones', 'Porzioni', 'Portions', 'Portionen'],
  ['Emoji (dacă nu ai poză)', 'Emoji (if you have no photo)', 'Emoji (si no tienes foto)', 'Emoji (se non hai una foto)', 'Emoji (si tu n’as pas de photo)', 'Emoji (wenn du kein Foto hast)'],
  ['Autor', 'Author', 'Autor', 'Autore', 'Auteur', 'Autor'],
  ['Numele tău', 'Your name', 'Tu nombre', 'Il tuo nome', 'Ton nom', 'Dein Name'],
  ['Poza principală', 'Main photo', 'Foto principal', 'Foto principale', 'Photo principale', 'Hauptfoto'],
  ['📷 Alege / fă o poză', '📷 Choose / take a photo', '📷 Elegir / hacer una foto', '📷 Scegli / scatta una foto', '📷 Choisir / prendre une photo', '📷 Foto wählen / aufnehmen'],
  ['✕ Scoate', '✕ Remove', '✕ Quitar', '✕ Rimuovi', '✕ Retirer', '✕ Entfernen'],
  ['✕ Scoate media', '✕ Remove media', '✕ Quitar archivo', '✕ Rimuovi media', '✕ Retirer le média', '✕ Medien entfernen'],
  ['Câte unul pe rând. Începe cu cantitatea (ex: „250 g făină”) ca să poți scala porțiile.', 'One per line. Start with the quantity (e.g. “250 g flour”) so servings can be scaled.', 'Uno por línea. Empieza por la cantidad (ej.: “250 g de harina”) para poder ajustar las raciones.', 'Uno per riga. Inizia con la quantità (es.: “250 g di farina”) per poter scalare le porzioni.', 'Un par ligne. Commence par la quantité (ex. : « 250 g de farine ») pour pouvoir ajuster les portions.', 'Eine pro Zeile. Beginne mit der Menge (z. B. „250 g Mehl“), damit sich die Portionen umrechnen lassen.'],
  ['500 g carne tocată\n2 cepe\n1 linguriță sare', '500 g minced meat\n2 onions\n1 tsp salt', '500 g de carne picada\n2 cebollas\n1 cucharadita de sal', '500 g di carne macinata\n2 cipolle\n1 cucchiaino di sale', '500 g de viande hachée\n2 oignons\n1 c. à café de sel', '500 g Hackfleisch\n2 Zwiebeln\n1 TL Salz'],
  ['📋 Pași cu poze și video', '📋 Steps with photos and video', '📋 Pasos con fotos y vídeo', '📋 Passaggi con foto e video', '📋 Étapes en photos et vidéo', '📋 Schritte mit Fotos und Video'],
  ['La fiecare pas poți adăuga o poză, un GIF animat sau un clip scurt filmat de tine (clipurile se redau în buclă, ca un GIF).', 'Add a photo, an animated GIF or a short clip you filmed to each step (clips loop, like a GIF).', 'En cada paso puedes añadir una foto, un GIF animado o un clip corto grabado por ti (los clips se repiten en bucle, como un GIF).', 'A ogni passaggio puoi aggiungere una foto, una GIF animata o un breve video girato da te (i video vanno in loop, come una GIF).', 'À chaque étape, ajoute une photo, un GIF animé ou un court clip filmé par toi (les clips tournent en boucle, comme un GIF).', 'Füge zu jedem Schritt ein Foto, ein animiertes GIF oder einen kurzen selbst gedrehten Clip hinzu (Clips laufen in Schleife wie ein GIF).'],
  ['Descrie ce se face la acest pas…', 'Describe what happens in this step…', 'Describe qué se hace en este paso…', 'Descrivi cosa si fa in questo passaggio…', 'Décris ce qu’on fait à cette étape…', 'Beschreibe, was in diesem Schritt passiert…'],
  ['⏲ Cronometru (min)', '⏲ Timer (min)', '⏲ Temporizador (min)', '⏲ Timer (min)', '⏲ Minuteur (min)', '⏲ Timer (Min.)'],
  ['📷 Poză / GIF', '📷 Photo / GIF', '📷 Foto / GIF', '📷 Foto / GIF', '📷 Photo / GIF', '📷 Foto / GIF'],
  ['🎬 Video', '🎬 Video', '🎬 Vídeo', '🎬 Video', '🎬 Vidéo', '🎬 Video'],
  ['➕ Adaugă pas', '➕ Add step', '➕ Añadir paso', '➕ Aggiungi passaggio', '➕ Ajouter une étape', '➕ Schritt hinzufügen'],
  ['📜 Drepturi de autor', '📜 Copyright', '📜 Derechos de autor', '📜 Diritti d’autore', '📜 Droits d’auteur', '📜 Urheberrecht'],
  ['Licența rețetei tale', 'Your recipe’s licence', 'Licencia de tu receta', 'Licenza della tua ricetta', 'Licence de ta recette', 'Lizenz deines Rezepts'],
  ['Toate drepturile rezervate (autorul)', 'All rights reserved (the author)', 'Todos los derechos reservados (el autor)', 'Tutti i diritti riservati (l’autore)', 'Tous droits réservés (l’auteur)', 'Alle Rechte vorbehalten (Autor:in)'],
  ['CC BY 4.0 — liber cu menționarea autorului', 'CC BY 4.0 — free to use with credit', 'CC BY 4.0 — libre citando al autor', 'CC BY 4.0 — libera citando l’autore', 'CC BY 4.0 — libre avec mention de l’auteur', 'CC BY 4.0 — frei mit Namensnennung'],
  ['CC0 — domeniu public, fără drepturi rezervate', 'CC0 — public domain, no rights reserved', 'CC0 — dominio público, sin derechos reservados', 'CC0 — pubblico dominio, nessun diritto riservato', 'CC0 — domaine public, aucun droit réservé', 'CC0 — gemeinfrei, keine Rechte vorbehalten'],
  ['Confirm că textul, pozele și video-urile sunt create de mine sau am dreptul să le folosesc. Nu copiez rețete, poze sau clipuri protejate de pe alte site-uri.', 'I confirm the text, photos and videos are my own or I have the right to use them. I don’t copy protected recipes, photos or clips from other sites.', 'Confirmo que el texto, las fotos y los vídeos son míos o tengo derecho a usarlos. No copio recetas, fotos ni clips protegidos de otros sitios.', 'Confermo che testo, foto e video sono miei o che ho il diritto di usarli. Non copio ricette, foto o video protetti da altri siti.', 'Je confirme que le texte, les photos et les vidéos sont les miens ou que j’ai le droit de les utiliser. Je ne copie pas de recettes, photos ou clips protégés d’autres sites.', 'Ich bestätige, dass Text, Fotos und Videos von mir stammen oder ich sie nutzen darf. Ich kopiere keine geschützten Rezepte, Fotos oder Clips von anderen Seiten.'],
  ['💾 Salvează rețeta', '💾 Save recipe', '💾 Guardar receta', '💾 Salva ricetta', '💾 Enregistrer la recette', '💾 Rezept speichern'],
  ['Renunță', 'Cancel', 'Cancelar', 'Annulla', 'Annuler', 'Abbrechen'],
  // serie
  ['🔥 Seria ta', '🔥 Your streak', '🔥 Tu racha', '🔥 La tua serie', '🔥 Ta série', '🔥 Deine Serie'],
  ['zile la rând', 'days in a row', 'días seguidos', 'giorni di fila', 'jours d’affilée', 'Tage am Stück'],
  ['record', 'best', 'récord', 'record', 'record', 'Rekord'],
  ['rețete gătite', 'recipes cooked', 'recetas cocinadas', 'ricette cucinate', 'recettes cuisinées', 'gekochte Rezepte'],
  ['✅ Ai gătit azi — seria e în siguranță. Ne vedem mâine!', '✅ You cooked today — your streak is safe. See you tomorrow!', '✅ Hoy ya cocinaste: tu racha está a salvo. ¡Hasta mañana!', '✅ Oggi hai cucinato: la serie è salva. A domani!', '✅ Tu as cuisiné aujourd’hui : ta série est sauve. À demain !', '✅ Du hast heute gekocht – deine Serie ist sicher. Bis morgen!'],
  ['⏳ Încă n-ai gătit azi. Deschide o rețetă și apasă „Am gătit-o” sau termină modul pas cu pas.', '⏳ You haven’t cooked today yet. Open a recipe and tap “I cooked it”, or finish step-by-step mode.', '⏳ Hoy aún no has cocinado. Abre una receta y pulsa “La cociné” o termina el modo paso a paso.', '⏳ Oggi non hai ancora cucinato. Apri una ricetta e tocca “L’ho cucinata” o completa la modalità passo dopo passo.', '⏳ Tu n’as pas encore cuisiné aujourd’hui. Ouvre une recette et touche « Je l’ai cuisinée » ou termine le mode pas à pas.', '⏳ Du hast heute noch nicht gekocht. Öffne ein Rezept und tippe auf „Gekocht“ oder beende den Schritt-Modus.'],
  ['📅 Ultimele 5 săptămâni', '📅 Last 5 weeks', '📅 Últimas 5 semanas', '📅 Ultime 5 settimane', '📅 5 dernières semaines', '📅 Letzte 5 Wochen'],
  ['L', 'M', 'L', 'L', 'L', 'Mo'], ['Ma', 'T', 'M', 'M', 'M', 'Di'], ['Mi', 'W', 'X', 'M', 'M', 'Mi'],
  ['J', 'T', 'J', 'G', 'J', 'Do'], ['V', 'F', 'V', 'V', 'V', 'Fr'], ['S', 'S', 'S', 'S', 'S', 'Sa'], ['D', 'S', 'D', 'D', 'D', 'So'],
  ['🏆 Insigne', '🏆 Badges', '🏆 Insignias', '🏆 Badge', '🏆 Badges', '🏆 Abzeichen'],
  ['Prima rețetă', 'First recipe', 'Primera receta', 'Prima ricetta', 'Première recette', 'Erstes Rezept'],
  ['O săptămână', 'One week', 'Una semana', 'Una settimana', 'Une semaine', 'Eine Woche'],
  ['Două săptămâni', 'Two weeks', 'Dos semanas', 'Due settimane', 'Deux semaines', 'Zwei Wochen'],
  ['O lună întreagă', 'A whole month', 'Un mes entero', 'Un mese intero', 'Un mois entier', 'Ein ganzer Monat'],
  ['100 de zile', '100 days', '100 días', '100 giorni', '100 jours', '100 Tage'],
  ['🕘 Istoric', '🕘 History', '🕘 Historial', '🕘 Cronologia', '🕘 Historique', '🕘 Verlauf'],
  ['Încă nimic. Prima rețetă gătită îți aprinde seria!', 'Nothing yet. Your first cooked recipe starts your streak!', 'Aún nada. ¡Tu primera receta cocinada enciende tu racha!', 'Ancora niente. La prima ricetta cucinata accende la tua serie!', 'Rien pour l’instant. Ta première recette cuisinée lance ta série !', 'Noch nichts. Dein erstes gekochtes Rezept startet deine Serie!'],
  ['(rețetă ștearsă)', '(deleted recipe)', '(receta eliminada)', '(ricetta eliminata)', '(recette supprimée)', '(gelöschtes Rezept)'],
  ['💾 Backup', '💾 Backup', '💾 Copia de seguridad', '💾 Backup', '💾 Sauvegarde', '💾 Backup'],
  ['Datele stau doar pe acest dispozitiv. Exportă o copie (include pozele, fără video-uri) ca să nu le pierzi.', 'Your data lives only on this device. Export a copy (photos included, no videos) so you don’t lose it.', 'Tus datos solo están en este dispositivo. Exporta una copia (con fotos, sin vídeos) para no perderlos.', 'I dati restano solo su questo dispositivo. Esporta una copia (foto incluse, senza video) per non perderli.', 'Tes données restent uniquement sur cet appareil. Exporte une copie (photos incluses, sans vidéos) pour ne pas les perdre.', 'Deine Daten liegen nur auf diesem Gerät. Exportiere eine Kopie (mit Fotos, ohne Videos), damit nichts verloren geht.'],
  ['⬇️ Exportă backup', '⬇️ Export backup', '⬇️ Exportar copia', '⬇️ Esporta backup', '⬇️ Exporter la sauvegarde', '⬇️ Backup exportieren'],
  ['⬆️ Importă backup', '⬆️ Import backup', '⬆️ Importar copia', '⬆️ Importa backup', '⬆️ Importer une sauvegarde', '⬆️ Backup importieren'],
  // produse
  ['📦 Produse digitale', '📦 Digital products', '📦 Productos digitales', '📦 Prodotti digitali', '📦 Produits numériques', '📦 Digitale Produkte'],
  ['Transformă rețetele tale originale în cărți de bucate digitale (e-book HTML / PDF) pe care le poți vinde pe Gumroad, Etsy, Payhip sau propriul site. Pas cu Gust nu procesează plăți — tu încarci fișierul exportat unde vrei.', 'Turn your original recipes into digital cookbooks (HTML / PDF e-books) to sell on Gumroad, Etsy, Payhip or your own site. Pas cu Gust doesn’t process payments — you upload the exported file wherever you like.', 'Convierte tus recetas originales en libros de cocina digitales (e-book HTML / PDF) para vender en Gumroad, Etsy, Payhip o tu propia web. Pas cu Gust no procesa pagos: subes el archivo exportado donde quieras.', 'Trasforma le tue ricette originali in ricettari digitali (e-book HTML / PDF) da vendere su Gumroad, Etsy, Payhip o sul tuo sito. Pas cu Gust non gestisce pagamenti: carichi il file esportato dove vuoi.', 'Transforme tes recettes originales en livres de cuisine numériques (e-book HTML / PDF) à vendre sur Gumroad, Etsy, Payhip ou ton propre site. Pas cu Gust ne traite pas les paiements : tu publies le fichier exporté où tu veux.', 'Mach aus deinen eigenen Rezepten digitale Kochbücher (E-Book als HTML / PDF) zum Verkauf auf Gumroad, Etsy, Payhip oder deiner Website. Pas cu Gust wickelt keine Zahlungen ab – du lädst die exportierte Datei hoch, wo du willst.'],
  ['✨ Pachet nou', '✨ New bundle', '✨ Nuevo paquete', '✨ Nuovo pacchetto', '✨ Nouveau pack', '✨ Neues Paket'],
  ['Nume produs', 'Product name', 'Nombre del producto', 'Nome del prodotto', 'Nom du produit', 'Produktname'],
  ['ex: 10 rețete de la bunica', 'e.g. 10 recipes from grandma', 'ej.: 10 recetas de la abuela', 'es.: 10 ricette della nonna', 'ex. : 10 recettes de mamie', 'z. B. 10 Rezepte von Oma'],
  ['Descriere pentru cumpărători', 'Description for buyers', 'Descripción para compradores', 'Descrizione per gli acquirenti', 'Description pour les acheteurs', 'Beschreibung für Käufer:innen'],
  ['Ce primesc cei care cumpără?', 'What do buyers get?', '¿Qué reciben los compradores?', 'Cosa ricevono gli acquirenti?', 'Que reçoivent les acheteurs ?', 'Was bekommen die Käufer:innen?'],
  ['Preț (lei)', 'Price (€)', 'Precio (€)', 'Prezzo (€)', 'Prix (€)', 'Preis (€)'],
  ['Autor / brand', 'Author / brand', 'Autor / marca', 'Autore / brand', 'Auteur / marque', 'Autor / Marke'],
  ['Alege rețetele incluse', 'Choose the recipes to include', 'Elige las recetas incluidas', 'Scegli le ricette incluse', 'Choisis les recettes incluses', 'Wähle die enthaltenen Rezepte'],
  ['Nu ai rețete încă.', 'You have no recipes yet.', 'Aún no tienes recetas.', 'Non hai ancora ricette.', 'Tu n’as pas encore de recettes.', 'Du hast noch keine Rezepte.'],
  ['· rețeta altcuiva, drepturi rezervate — nu se poate vinde', '· someone else’s recipe, rights reserved — can’t be sold', '· receta de otra persona, derechos reservados — no se puede vender', '· ricetta di qualcun altro, diritti riservati — non vendibile', '· recette de quelqu’un d’autre, droits réservés — vente impossible', '· Rezept einer anderen Person, Rechte vorbehalten – nicht verkäuflich'],
  ['➕ Creează produsul', '➕ Create product', '➕ Crear producto', '➕ Crea prodotto', '➕ Créer le produit', '➕ Produkt erstellen'],
  ['Niciun produs încă. Creează primul pachet mai sus.', 'No products yet. Create your first bundle above.', 'Aún no hay productos. Crea tu primer paquete arriba.', 'Ancora nessun prodotto. Crea il primo pacchetto qui sopra.', 'Pas encore de produit. Crée ton premier pack ci-dessus.', 'Noch keine Produkte. Erstelle oben dein erstes Paket.'],
  ['⬇️ E-book HTML', '⬇️ HTML e-book', '⬇️ E-book HTML', '⬇️ E-book HTML', '⬇️ E-book HTML', '⬇️ HTML-E-Book'],
  ['🖨 PDF', '🖨 PDF', '🖨 PDF', '🖨 PDF', '🖨 PDF', '🖨 PDF'],
  ['fără autor', 'no author', 'sin autor', 'senza autore', 'sans auteur', 'ohne Autor'],
  // cont
  ['☁️ Cont și sincronizare', '☁️ Account & sync', '☁️ Cuenta y sincronización', '☁️ Account e sincronizzazione', '☁️ Compte et synchronisation', '☁️ Konto & Synchronisierung'],
  ['Cu un cont, rețetele, pozele, clipurile, seria și produsele tale se sincronizează între telefon, tabletă și calculator. Fără cont, totul rămâne doar pe acest dispozitiv.', 'With an account, your recipes, photos, clips, streak and products sync across phone, tablet and computer. Without one, everything stays on this device only.', 'Con una cuenta, tus recetas, fotos, clips, racha y productos se sincronizan entre móvil, tableta y ordenador. Sin cuenta, todo se queda solo en este dispositivo.', 'Con un account, ricette, foto, video, serie e prodotti si sincronizzano tra telefono, tablet e computer. Senza account, tutto resta solo su questo dispositivo.', 'Avec un compte, tes recettes, photos, clips, ta série et tes produits se synchronisent entre téléphone, tablette et ordinateur. Sans compte, tout reste sur cet appareil.', 'Mit einem Konto werden Rezepte, Fotos, Clips, Serie und Produkte zwischen Handy, Tablet und Computer synchronisiert. Ohne Konto bleibt alles nur auf diesem Gerät.'],
  ['🔐 Intră în cont', '🔐 Sign in', '🔐 Iniciar sesión', '🔐 Accedi', '🔐 Se connecter', '🔐 Anmelden'],
  ['Fără parolă: primești pe email un cod de conectare.', 'No password: we email you a sign-in code.', 'Sin contraseña: te enviamos un código por email.', 'Senza password: ricevi un codice di accesso via email.', 'Sans mot de passe : tu reçois un code de connexion par e-mail.', 'Ohne Passwort: Du bekommst einen Anmeldecode per E-Mail.'],
  ['Email', 'Email', 'Email', 'Email', 'E-mail', 'E-Mail'],
  ['tu@exemplu.ro', 'you@example.com', 'tu@ejemplo.com', 'tu@esempio.it', 'toi@exemple.fr', 'du@beispiel.de'],
  ['📧 Trimite codul', '📧 Send code', '📧 Enviar código', '📧 Invia il codice', '📧 Envoyer le code', '📧 Code senden'],
  ['Codul din email', 'Code from the email', 'Código del email', 'Codice dell’email', 'Code reçu par e-mail', 'Code aus der E-Mail'],
  ['✅ Confirmă', '✅ Confirm', '✅ Confirmar', '✅ Conferma', '✅ Confirmer', '✅ Bestätigen'],
  ['Deconectează serverul', 'Disconnect server', 'Desconectar servidor', 'Scollega server', 'Déconnecter le serveur', 'Server trennen'],
  ['🔌 Conectează serverul', '🔌 Connect server', '🔌 Conectar servidor', '🔌 Collega server', '🔌 Connecter le serveur', '🔌 Server verbinden'],
  ['Cloud-ul nu e configurat încă în această versiune. Introdu adresa proiectului Supabase și cheia publică.', 'The cloud isn’t set up in this version yet. Enter the Supabase project URL and public key.', 'La nube aún no está configurada en esta versión. Introduce la URL del proyecto Supabase y la clave pública.', 'Il cloud non è ancora configurato in questa versione. Inserisci l’URL del progetto Supabase e la chiave pubblica.', 'Le cloud n’est pas encore configuré dans cette version. Saisis l’URL du projet Supabase et la clé publique.', 'Die Cloud ist in dieser Version noch nicht eingerichtet. Gib die Supabase-Projekt-URL und den öffentlichen Schlüssel ein.'],
  ['URL proiect', 'Project URL', 'URL del proyecto', 'URL del progetto', 'URL du projet', 'Projekt-URL'],
  ['Cheie publică (anon / publishable)', 'Public key (anon / publishable)', 'Clave pública (anon / publishable)', 'Chiave pubblica (anon / publishable)', 'Clé publique (anon / publishable)', 'Öffentlicher Schlüssel (anon / publishable)'],
  ['Salvează', 'Save', 'Guardar', 'Salva', 'Enregistrer', 'Speichern'],
  ['Se conectează…', 'Connecting…', 'Conectando…', 'Connessione…', 'Connexion…', 'Verbindung wird hergestellt…'],
  ['Nu mă pot conecta la cloud.', 'Can’t connect to the cloud.', 'No puedo conectar con la nube.', 'Impossibile connettersi al cloud.', 'Impossible de se connecter au cloud.', 'Keine Verbindung zur Cloud.'],
  ['⏳ Se sincronizează…', '⏳ Syncing…', '⏳ Sincronizando…', '⏳ Sincronizzazione…', '⏳ Synchronisation…', '⏳ Synchronisiere…'],
  ['Încă nesincronizat', 'Not synced yet', 'Aún sin sincronizar', 'Non ancora sincronizzato', 'Pas encore synchronisé', 'Noch nicht synchronisiert'],
  ['🔄 Sincronizează acum', '🔄 Sync now', '🔄 Sincronizar ahora', '🔄 Sincronizza ora', '🔄 Synchroniser', '🔄 Jetzt synchronisieren'],
  ['Ieși din cont', 'Sign out', 'Cerrar sesión', 'Esci', 'Se déconnecter', 'Abmelden'],
  ['🗑 Șterge contul', '🗑 Delete account', '🗑 Eliminar cuenta', '🗑 Elimina account', '🗑 Supprimer le compte', '🗑 Konto löschen'],
  ['Șterge definitiv contul și tot ce e salvat în cloud (rețete, poze, clipuri). Datele de pe acest dispozitiv rămân.', 'Permanently deletes your account and everything saved in the cloud (recipes, photos, clips). Data on this device stays.', 'Elimina para siempre tu cuenta y todo lo guardado en la nube (recetas, fotos, clips). Los datos de este dispositivo se conservan.', 'Elimina definitivamente l’account e tutto ciò che è nel cloud (ricette, foto, video). I dati su questo dispositivo restano.', 'Supprime définitivement ton compte et tout ce qui est dans le cloud (recettes, photos, clips). Les données de cet appareil restent.', 'Löscht dein Konto und alles in der Cloud (Rezepte, Fotos, Clips) endgültig. Die Daten auf diesem Gerät bleiben.'],
  ['Șterge contul definitiv', 'Delete account permanently', 'Eliminar cuenta definitivamente', 'Elimina account definitivamente', 'Supprimer définitivement le compte', 'Konto endgültig löschen'],
  ['Politica de confidențialitate', 'Privacy policy', 'Política de privacidad', 'Informativa sulla privacy', 'Politique de confidentialité', 'Datenschutzerklärung'],
  // distribuire
  ['✕', '✕', '✕', '✕', '✕', '✕'],
  ['Oricine are linkul vede rețeta, o poate găti pas cu pas și o poate salva, fără cont. Nu apare în nicio listă publică.', 'Anyone with the link can see the recipe, cook it step by step and save it — no account needed. It isn’t listed anywhere public.', 'Cualquiera con el enlace puede ver la receta, cocinarla paso a paso y guardarla, sin cuenta. No aparece en ninguna lista pública.', 'Chiunque abbia il link vede la ricetta, può cucinarla passo dopo passo e salvarla, senza account. Non compare in nessun elenco pubblico.', 'Toute personne ayant le lien voit la recette, peut la cuisiner pas à pas et l’enregistrer, sans compte. Elle n’apparaît dans aucune liste publique.', 'Alle mit dem Link sehen das Rezept, können es Schritt für Schritt kochen und speichern – ohne Konto. Es erscheint in keiner öffentlichen Liste.'],
  ['Pentru un link cu poze, GIF-uri și clipuri, intră în cont (☁️). Durează un minut.', 'For a link with photos, GIFs and clips, sign in (☁️). It takes a minute.', 'Para un enlace con fotos, GIFs y clips, inicia sesión (☁️). Tarda un minuto.', 'Per un link con foto, GIF e video, accedi (☁️). Ci vuole un minuto.', 'Pour un lien avec photos, GIF et clips, connecte-toi (☁️). Ça prend une minute.', 'Für einen Link mit Fotos, GIFs und Clips melde dich an (☁️). Dauert eine Minute.'],
  ['☁️ Intră în cont', '☁️ Sign in', '☁️ Iniciar sesión', '☁️ Accedi', '☁️ Se connecter', '☁️ Anmelden'],
  ['⚡ Link rapid, doar text', '⚡ Quick text-only link', '⚡ Enlace rápido, solo texto', '⚡ Link rapido, solo testo', '⚡ Lien rapide, texte seul', '⚡ Schneller Link, nur Text'],
  ['Linkul conține doar textul rețetei, fără poze și clipuri.', 'The link only contains the recipe text, no photos or clips.', 'El enlace solo contiene el texto de la receta, sin fotos ni clips.', 'Il link contiene solo il testo della ricetta, senza foto né video.', 'Le lien ne contient que le texte de la recette, sans photos ni clips.', 'Der Link enthält nur den Rezepttext, ohne Fotos und Clips.'],
  ['🔗 Creează link cu poze și video', '🔗 Create link with photos and video', '🔗 Crear enlace con fotos y vídeo', '🔗 Crea link con foto e video', '🔗 Créer un lien avec photos et vidéo', '🔗 Link mit Fotos und Video erstellen'],
  ['✏️ Ai modificat rețeta după ce ai distribuit-o.', '✏️ You changed the recipe after sharing it.', '✏️ Has cambiado la receta después de compartirla.', '✏️ Hai modificato la ricetta dopo averla condivisa.', '✏️ Tu as modifié la recette après l’avoir partagée.', '✏️ Du hast das Rezept nach dem Teilen geändert.'],
  ['⟳ Actualizează linkul', '⟳ Update link', '⟳ Actualizar enlace', '⟳ Aggiorna link', '⟳ Mettre à jour le lien', '⟳ Link aktualisieren'],
  ['🚫 Oprește distribuirea', '🚫 Stop sharing', '🚫 Dejar de compartir', '🚫 Interrompi condivisione', '🚫 Arrêter le partage', '🚫 Teilen beenden'],
  ['⏳ Se publică…', '⏳ Publishing…', '⏳ Publicando…', '⏳ Pubblicazione…', '⏳ Publication…', '⏳ Wird veröffentlicht…'],
  ['⏳ Se face imaginea de previzualizare…', '⏳ Making the preview image…', '⏳ Creando la imagen de vista previa…', '⏳ Creazione dell’anteprima…', '⏳ Création de l’aperçu…', '⏳ Vorschaubild wird erstellt…'],
  ['🔗 Încearcă din nou', '🔗 Try again', '🔗 Intentar de nuevo', '🔗 Riprova', '🔗 Réessayer', '🔗 Erneut versuchen'],
  ['🎬 Acest pas are un clip video în versiunea digitală.', '🎬 This step has a video clip in the digital version.', '🎬 Este paso tiene un vídeo en la versión digital.', '🎬 Questo passaggio ha un video nella versione digitale.', '🎬 Cette étape a une vidéo dans la version numérique.', '🎬 Dieser Schritt hat ein Video in der digitalen Version.'],
  // e-book, GIF
  ['Cuprins', 'Contents', 'Índice', 'Indice', 'Sommaire', 'Inhalt'],
  ['Ingrediente', 'Ingredients', 'Ingredientes', 'Ingredienti', 'Ingrédients', 'Zutaten'],
  ['Mod de preparare', 'Method', 'Preparación', 'Preparazione', 'Préparation', 'Zubereitung'],
  ['Autorul', 'The author', 'El autor', 'L’autore', 'L’auteur', 'Die Autorin / der Autor'],
  ['Creat cu Pas cu Gust', 'Made with Pas cu Gust', 'Hecho con Pas cu Gust', 'Creato con Pas cu Gust', 'Créé avec Pas cu Gust', 'Erstellt mit Pas cu Gust'],
  // mesaje scurte
  ['Adaugă cel puțin un pas', 'Add at least one step', 'Añade al menos un paso', 'Aggiungi almeno un passaggio', 'Ajoute au moins une étape', 'Füge mindestens einen Schritt hinzu'],
  ['Ai ieșit din cont', 'Signed out', 'Has cerrado sesión', 'Sei uscito dall’account', 'Tu es déconnecté', 'Abgemeldet'],
  ['Alege cel puțin o rețetă', 'Choose at least one recipe', 'Elige al menos una receta', 'Scegli almeno una ricetta', 'Choisis au moins une recette', 'Wähle mindestens ein Rezept'],
  ['Bifează confirmarea de originalitate', 'Tick the originality confirmation', 'Marca la confirmación de originalidad', 'Spunta la conferma di originalità', 'Coche la confirmation d’originalité', 'Bestätige, dass die Inhalte von dir sind'],
  ['Clip prea mare (max 50 MB) — filmează scurt, ca un GIF', 'Clip too large (max 50 MB) — keep it short, like a GIF', 'Clip demasiado grande (máx. 50 MB): grábalo corto, como un GIF', 'Video troppo grande (max 50 MB): giralo breve, come una GIF', 'Clip trop lourd (50 Mo max.) — filme court, comme un GIF', 'Clip zu groß (max. 50 MB) – dreh kurz, wie ein GIF'],
  ['Completează URL-ul și cheia', 'Fill in the URL and key', 'Completa la URL y la clave', 'Inserisci URL e chiave', 'Remplis l’URL et la clé', 'URL und Schlüssel ausfüllen'],
  ['Contul a fost șters', 'Account deleted', 'Cuenta eliminada', 'Account eliminato', 'Compte supprimé', 'Konto gelöscht'],
  ['Copiază linkul din căsuță', 'Copy the link from the box', 'Copia el enlace de la casilla', 'Copia il link dalla casella', 'Copie le lien dans la case', 'Kopiere den Link aus dem Feld'],
  ['Email invalid', 'Invalid email', 'Email no válido', 'Email non valida', 'E-mail invalide', 'Ungültige E-Mail'],
  ['Fișier de backup invalid', 'Invalid backup file', 'Archivo de copia no válido', 'File di backup non valido', 'Fichier de sauvegarde invalide', 'Ungültige Backup-Datei'],
  ['Linkul a fost oprit', 'Link stopped', 'Enlace desactivado', 'Link disattivato', 'Lien désactivé', 'Link gestoppt'],
  ['Nu am putut crea GIF-ul', 'Couldn’t create the GIF', 'No se pudo crear el GIF', 'Impossibile creare la GIF', 'Impossible de créer le GIF', 'GIF konnte nicht erstellt werden'],
  ['Permite ferestrele pop-up', 'Allow pop-up windows', 'Permite las ventanas emergentes', 'Consenti i pop-up', 'Autorise les fenêtres pop-up', 'Pop-up-Fenster erlauben'],
  ['Pune un nume produsului', 'Give the product a name', 'Ponle nombre al producto', 'Dai un nome al prodotto', 'Donne un nom au produit', 'Gib dem Produkt einen Namen'],
  ['Pune un titlu rețetei', 'Give the recipe a title', 'Ponle título a la receta', 'Dai un titolo alla ricetta', 'Donne un titre à la recette', 'Gib dem Rezept einen Titel'],
  ['Rețetă ștearsă', 'Recipe deleted', 'Receta eliminada', 'Ricetta eliminata', 'Recette supprimée', 'Rezept gelöscht'],
  ['Se generează e-book-ul…', 'Generating the e-book…', 'Generando el e-book…', 'Creazione dell’e-book…', 'Génération de l’e-book…', 'E-Book wird erstellt…'],
  ['Se pregătește backup-ul…', 'Preparing the backup…', 'Preparando la copia…', 'Preparazione del backup…', 'Préparation de la sauvegarde…', 'Backup wird vorbereitet…'],
  ['⏰ Timpul a expirat!', '⏰ Time’s up!', '⏰ ¡Se acabó el tiempo!', '⏰ Tempo scaduto!', '⏰ C’est l’heure !', '⏰ Zeit ist um!'],
  ['⚠️ Cod greșit sau expirat', '⚠️ Wrong or expired code', '⚠️ Código incorrecto o caducado', '⚠️ Codice errato o scaduto', '⚠️ Code incorrect ou expiré', '⚠️ Falscher oder abgelaufener Code'],
  ['⚠️ Nu am putut salva (spațiu plin?)', '⚠️ Couldn’t save (storage full?)', '⚠️ No se pudo guardar (¿almacenamiento lleno?)', '⚠️ Impossibile salvare (memoria piena?)', '⚠️ Impossible d’enregistrer (stockage plein ?)', '⚠️ Speichern fehlgeschlagen (Speicher voll?)'],
  ['✅ Ai intrat în cont', '✅ Signed in', '✅ Sesión iniciada', '✅ Accesso effettuato', '✅ Connecté', '✅ Angemeldet'],
  ['✅ Backup importat', '✅ Backup imported', '✅ Copia importada', '✅ Backup importato', '✅ Sauvegarde importée', '✅ Backup importiert'],
  ['✅ GIF salvat', '✅ GIF saved', '✅ GIF guardado', '✅ GIF salvata', '✅ GIF enregistré', '✅ GIF gespeichert'],
  ['✅ Linkul e gata', '✅ Link ready', '✅ Enlace listo', '✅ Link pronto', '✅ Lien prêt', '✅ Link ist fertig'],
  ['✅ Rețetă salvată', '✅ Recipe saved', '✅ Receta guardada', '✅ Ricetta salvata', '✅ Recette enregistrée', '✅ Rezept gespeichert'],
  ['✅ Salvată în rețetele tale', '✅ Saved to your recipes', '✅ Guardada en tus recetas', '✅ Salvata tra le tue ricette', '✅ Enregistrée dans tes recettes', '✅ In deinen Rezepten gespeichert'],
  ['💾 Se salvează…', '💾 Saving…', '💾 Guardando…', '💾 Salvataggio…', '💾 Enregistrement…', '💾 Wird gespeichert…'],
  ['📋 Link copiat', '📋 Link copied', '📋 Enlace copiado', '📋 Link copiato', '📋 Lien copié', '📋 Link kopiert'],
  ['📦 Produs creat', '📦 Product created', '📦 Producto creado', '📦 Prodotto creato', '📦 Produit créé', '📦 Produkt erstellt'],
  ['📧 Ți-am trimis codul pe email', '📧 We’ve emailed you the code', '📧 Te hemos enviado el código por email', '📧 Ti abbiamo inviato il codice via email', '📧 Code envoyé par e-mail', '📧 Code per E-Mail gesendet'],
  ['Linkul nu mai există sau e greșit', 'This link no longer exists or is wrong', 'El enlace ya no existe o es incorrecto', 'Il link non esiste più o è errato', 'Ce lien n’existe plus ou est erroné', 'Der Link existiert nicht mehr oder ist falsch'],
  ['Fără internet: linkul nu se poate deschide acum', 'Offline: the link can’t be opened right now', 'Sin conexión: el enlace no se puede abrir ahora', 'Offline: il link non si può aprire ora', 'Hors ligne : impossible d’ouvrir le lien pour l’instant', 'Offline: Der Link kann gerade nicht geöffnet werden'],
  ['Oprești distribuirea? Linkul nu va mai funcționa.', 'Stop sharing? The link will stop working.', '¿Dejar de compartir? El enlace dejará de funcionar.', 'Interrompere la condivisione? Il link smetterà di funzionare.', 'Arrêter le partage ? Le lien ne fonctionnera plus.', 'Teilen beenden? Der Link funktioniert dann nicht mehr.'],
  ['Înlocuiești datele actuale cu cele din backup?', 'Replace your current data with the backup?', '¿Reemplazar tus datos actuales por la copia?', 'Sostituire i dati attuali con il backup?', 'Remplacer tes données actuelles par la sauvegarde ?', 'Aktuelle Daten durch das Backup ersetzen?'],
  ['Ștergi definitiv contul și toate datele din cloud?', 'Permanently delete your account and all cloud data?', '¿Eliminar para siempre tu cuenta y todos los datos de la nube?', 'Eliminare definitivamente l’account e tutti i dati nel cloud?', 'Supprimer définitivement ton compte et toutes les données du cloud ?', 'Konto und alle Cloud-Daten endgültig löschen?'],
  ['Ștergi produsul?', 'Delete this product?', '¿Eliminar el producto?', 'Eliminare il prodotto?', 'Supprimer ce produit ?', 'Produkt löschen?'],
  // feed Descoperă
  ['Glisează în sus pentru următoarea rețetă', 'Swipe up for the next recipe', 'Desliza hacia arriba para la siguiente receta', 'Scorri in su per la prossima ricetta', 'Glisse vers le haut pour la recette suivante', 'Nach oben wischen für das nächste Rezept'],
  ['Gătește', 'Cook', 'Cocinar', 'Cucina', 'Cuisiner', 'Kochen'],
  ['Salvează', 'Save', 'Guardar', 'Salva', 'Enregistrer', 'Speichern'],
  ['Trimite', 'Send', 'Enviar', 'Invia', 'Envoyer', 'Senden'],
  ['Animație', 'Animation', 'Animación', 'Animazione', 'Animation', 'Animation'],
  ['Voce', 'Voice', 'Voz', 'Voce', 'Voix', 'Stimme'],
  ['📊 Creștere','📊 Growth','📊 Crecimiento','📊 Crescita','📊 Croissance','📊 Wachstum'],
  ['← Cont','← Account','← Cuenta','← Account','← Compte','← Konto'],
  ['👥 Utilizatori','👥 Users','👥 Usuarios','👥 Utenti','👥 Utilisateurs','👥 Nutzer:innen'],
  ['conturi în total','accounts in total','cuentas en total','account in totale','comptes au total','Konten insgesamt'],
  ['conturi noi','new accounts','cuentas nuevas','nuovi account','nouveaux comptes','neue Konten'],
  ['Premium activ','active Premium','Premium activo','Premium attivi','Premium actifs','aktive Premium'],
  ['invitați (nivel 1)','invited (level 1)','invitados (nivel 1)','invitati (livello 1)','invités (niveau 1)','Eingeladene (Stufe 1)'],
  ['invitați (nivel 2)','invited (level 2)','invitados (nivel 2)','invitati (livello 2)','invités (niveau 2)','Eingeladene (Stufe 2)'],
  ['instalări','installs','instalaciones','installazioni','installations','Installationen'],
  ['📈 Trafic și activitate','📈 Traffic & activity','📈 Tráfico y actividad','📈 Traffico e attività','📈 Trafic et activité','📈 Traffic & Aktivität'],
  ['deschideri aplicație','app opens','aperturas de la app','aperture dell’app','ouvertures de l’app','App-Öffnungen'],
  ['vizualizări rețete','recipe views','vistas de recetas','visualizzazioni ricette','vues de recettes','Rezeptaufrufe'],
  ['salvări','saves','guardados','salvataggi','enregistrements','Gespeichert'],
  ['începute la gătit','cooking started','empezadas a cocinar','iniziate a cucinare','cuisine commencée','Kochen begonnen'],
  ['gătite până la capăt','cooked to the end','cocinadas hasta el final','cucinate fino alla fine','cuisinées jusqu’au bout','fertig gekocht'],
  ['distribuiri','shares','compartidos','condivisioni','partages','geteilt'],
  ['linkuri de invitație deschise','invite links opened','enlaces de invitación abiertos','link d’invito aperti','liens d’invitation ouverts','geöffnete Einladungslinks'],
  ['GIF-uri și clipuri','GIFs and clips','GIFs y clips','GIF e video','GIF et clips','GIFs und Clips'],
  ['linkuri publice','public links','enlaces públicos','link pubblici','liens publics','öffentliche Links'],
  ['aprecieri','likes','me gusta','mi piace','j’aime','Likes'],
  ['comentarii','comments','comentarios','commenti','commentaires','Kommentare'],
  ['💰 Vânzări (Gumroad)','💰 Sales (Gumroad)','💰 Ventas (Gumroad)','💰 Vendite (Gumroad)','💰 Ventes (Gumroad)','💰 Verkäufe (Gumroad)'],
  ['vânzări','sales','ventas','vendite','ventes','Verkäufe'],
  ['venit brut','gross revenue','ingresos brutos','ricavi lordi','revenu brut','Bruttoumsatz'],
  ['comisioane afiliați','affiliate commissions','comisiones de afiliados','commissioni affiliati','commissions d’affiliés','Affiliate-Provisionen'],
  ['vânzări prin afiliați','affiliate sales','ventas por afiliados','vendite tramite affiliati','ventes via affiliés','Affiliate-Verkäufe'],
  ['📱 Deschideri pe zi','📱 Opens per day','📱 Aperturas por día','📱 Aperture al giorno','📱 Ouvertures par jour','📱 Öffnungen pro Tag'],
  ['👀 Vizualizări pe zi','👀 Views per day','👀 Vistas por día','👀 Visualizzazioni al giorno','👀 Vues par jour','👀 Aufrufe pro Tag'],
  ['🆕 Conturi noi pe zi','🆕 New accounts per day','🆕 Cuentas nuevas por día','🆕 Nuovi account al giorno','🆕 Nouveaux comptes par jour','🆕 Neue Konten pro Tag'],
  ['🎁 Invitații pe zi','🎁 Invites per day','🎁 Invitaciones por día','🎁 Inviti al giorno','🎁 Invitations par jour','🎁 Einladungen pro Tag'],
  ['💰 Venit pe zi','💰 Revenue per day','💰 Ingresos por día','💰 Ricavi al giorno','💰 Revenu par jour','💰 Umsatz pro Tag'],
  ['🏆 Cele mai văzute rețete','🏆 Most viewed recipes','🏆 Recetas más vistas','🏆 Ricette più viste','🏆 Recettes les plus vues','🏆 Meistgesehene Rezepte'],
  ['Încă nu sunt date.','No data yet.','Aún no hay datos.','Ancora nessun dato.','Pas encore de données.','Noch keine Daten.'],
  ['🌍 Limbi','🌍 Languages','🌍 Idiomas','🌍 Lingue','🌍 Langues','🌍 Sprachen'],
  ['Rețete proprii','Own recipes','Recetas propias','Ricette proprie','Recettes perso','Eigene Rezepte'],
  ['Primite prin link','Received by link','Recibidas por enlace','Ricevute tramite link','Reçues par lien','Per Link erhalten'],
  ['Intră în cont ca administrator.','Sign in as the administrator.','Inicia sesión como administrador.','Accedi come amministratore.','Connecte-toi en tant qu’administrateur.','Melde dich als Admin an.'],
  ['Panoul e doar pentru administrator.','This dashboard is for the administrator only.','Este panel es solo para el administrador.','Questo pannello è solo per l’amministratore.','Ce tableau de bord est réservé à l’administrateur.','Dieses Dashboard ist nur für Admins.'],
  ['Se încarcă…','Loading…','Cargando…','Caricamento…','Chargement…','Wird geladen…'],
  ['📊 Panou de creștere','📊 Growth dashboard','📊 Panel de crecimiento','📊 Pannello di crescita','📊 Tableau de croissance','📊 Wachstums-Dashboard'],
  ['Utilizatori, trafic, invitații, Premium, vânzări și comisioane. Doar tu vezi acest panou.','Users, traffic, invites, Premium, sales and commissions. Only you can see this dashboard.','Usuarios, tráfico, invitaciones, Premium, ventas y comisiones. Solo tú ves este panel.','Utenti, traffico, inviti, Premium, vendite e commissioni. Solo tu vedi questo pannello.','Utilisateurs, trafic, invitations, Premium, ventes et commissions. Toi seul vois ce tableau.','Nutzer:innen, Traffic, Einladungen, Premium, Verkäufe und Provisionen. Nur du siehst dieses Dashboard.'],
  ['📊 Deschide panoul','📊 Open dashboard','📊 Abrir panel','📊 Apri pannello','📊 Ouvrir le tableau','📊 Dashboard öffnen'],
  ['⭐ Premium','⭐ Premium','⭐ Premium','⭐ Premium','⭐ Premium','⭐ Premium'],
  ['activ','active','activo','attivo','actif','aktiv'],
  ['Activ până la','Active until','Activo hasta el','Attivo fino al','Actif jusqu’au','Aktiv bis'],
  ['Planul gratuit: 3 linkuri publice active și 2 produse digitale.','Free plan: 3 active public links and 2 digital products.','Plan gratuito: 3 enlaces públicos activos y 2 productos digitales.','Piano gratuito: 3 link pubblici attivi e 2 prodotti digitali.','Offre gratuite : 3 liens publics actifs et 2 produits numériques.','Kostenlos: 3 aktive öffentliche Links und 2 digitale Produkte.'],
  ['Premium: linkuri publice și produse digitale nelimitate, insigna ⭐ și susții aplicația.','Premium: unlimited public links and digital products, the ⭐ badge, and you support the app.','Premium: enlaces públicos y productos digitales ilimitados, la insignia ⭐ y apoyas la app.','Premium: link pubblici e prodotti digitali illimitati, il badge ⭐ e sostieni l’app.','Premium : liens publics et produits numériques illimités, le badge ⭐ et tu soutiens l’app.','Premium: unbegrenzte öffentliche Links und digitale Produkte, das ⭐-Abzeichen, und du unterstützt die App.'],
  ['⭐ Cumpără Premium','⭐ Get Premium','⭐ Comprar Premium','⭐ Acquista Premium','⭐ Passer à Premium','⭐ Premium kaufen'],
  ['⭐ Premium vine în curând','⭐ Premium coming soon','⭐ Premium muy pronto','⭐ Premium in arrivo','⭐ Premium bientôt','⭐ Premium kommt bald'],
  ['Ai cumpărat? Pune cheia de licență primită pe email','Bought it? Enter the licence key from your email','¿Ya lo compraste? Pon la clave de licencia del email','L’hai acquistato? Inserisci la chiave di licenza ricevuta via email','Déjà acheté ? Saisis la clé de licence reçue par e-mail','Gekauft? Gib den Lizenzschlüssel aus der E-Mail ein'],
  ['Activează','Activate','Activar','Attiva','Activer','Aktivieren'],
  ['⭐ Premium activat!','⭐ Premium activated!','⭐ ¡Premium activado!','⭐ Premium attivato!','⭐ Premium activé !','⭐ Premium aktiviert!'],
  ['Cheia nu e validă','The key isn’t valid','La clave no es válida','La chiave non è valida','La clé n’est pas valide','Der Schlüssel ist ungültig'],
  ['Cheia e folosită deja pe alt cont','This key is already used on another account','La clave ya se usa en otra cuenta','La chiave è già usata su un altro account','Cette clé est déjà utilisée sur un autre compte','Der Schlüssel wird bereits in einem anderen Konto verwendet'],
  ['Abonamentul a expirat','The subscription has ended','La suscripción ha terminado','L’abbonamento è scaduto','L’abonnement est terminé','Das Abo ist abgelaufen'],
  ['Comanda a fost rambursată','The order was refunded','El pedido fue reembolsado','L’ordine è stato rimborsato','La commande a été remboursée','Die Bestellung wurde erstattet'],
  ['Premium nu e încă disponibil','Premium isn’t available yet','Premium aún no está disponible','Premium non è ancora disponibile','Premium n’est pas encore disponible','Premium ist noch nicht verfügbar'],
  ['Nu am putut verifica cheia','Couldn’t verify the key','No se pudo verificar la clave','Impossibile verificare la chiave','Impossible de vérifier la clé','Schlüssel konnte nicht geprüft werden'],
  ['🎁 Invită prieteni','🎁 Invite friends','🎁 Invita a amigos','🎁 Invita amici','🎁 Invite des amis','🎁 Freunde einladen'],
  ['🎁 Invită prieteni, creșteți împreună','🎁 Invite friends, grow together','🎁 Invita a amigos, creced juntos','🎁 Invita amici, crescete insieme','🎁 Invite des amis, grandissez ensemble','🎁 Lade Freunde ein, wachst zusammen'],
  ['Prietenul tău primește 30 de zile Premium, iar tu tot 30. Când prietenul tău invită pe cineva, mai primești 7 zile. Fără bani, fără obligații.','Your friend gets 30 days of Premium, and so do you. When your friend invites someone, you get 7 more days. No money, no strings attached.','Tu amigo recibe 30 días de Premium, y tú también. Cuando tu amigo invita a alguien, recibes 7 días más. Sin dinero, sin compromiso.','Il tuo amico riceve 30 giorni di Premium, e anche tu. Quando il tuo amico invita qualcuno, ricevi altri 7 giorni. Niente soldi, nessun obbligo.','Ton ami reçoit 30 jours de Premium, et toi aussi. Quand ton ami invite quelqu’un, tu reçois 7 jours de plus. Sans argent, sans engagement.','Deine Freundin oder dein Freund bekommt 30 Tage Premium, du auch. Lädt sie oder er jemanden ein, bekommst du 7 Tage dazu. Kein Geld, keine Verpflichtung.'],
  ['prieteni invitați','friends invited','amigos invitados','amici invitati','amis invités','eingeladene Freunde'],
  ['invitați de ei','invited by them','invitados por ellos','invitati da loro','invités par eux','von ihnen eingeladen'],
  ['zile câștigate','days earned','días ganados','giorni guadagnati','jours gagnés','gewonnene Tage'],
  ['🎁 Bine ai venit! Ai primit 30 de zile Premium','🎁 Welcome! You got 30 days of Premium','🎁 ¡Bienvenido! Has recibido 30 días de Premium','🎁 Benvenuto! Hai ricevuto 30 giorni di Premium','🎁 Bienvenue ! Tu as reçu 30 jours de Premium','🎁 Willkommen! Du hast 30 Tage Premium bekommen'],
  ['Încearcă Pas cu Gust: rețete pas cu pas, cu poze și video. Cu linkul meu primești 30 de zile Premium gratis!','Try Pas cu Gust: step-by-step recipes with photos and video. With my link you get 30 days of Premium free!','Prueba Pas cu Gust: recetas paso a paso con fotos y vídeo. ¡Con mi enlace recibes 30 días de Premium gratis!','Prova Pas cu Gust: ricette passo dopo passo con foto e video. Con il mio link ricevi 30 giorni di Premium gratis!','Essaie Pas cu Gust : des recettes pas à pas en photos et vidéo. Avec mon lien, tu reçois 30 jours de Premium gratuits !','Probier Pas cu Gust: Rezepte Schritt für Schritt mit Fotos und Video. Mit meinem Link bekommst du 30 Tage Premium gratis!'],
  ['💬 Comentarii','💬 Comments','💬 Comentarios','💬 Commenti','💬 Commentaires','💬 Kommentare'],
  ['Comentariile nu se pot încărca acum.','Comments can’t be loaded right now.','Ahora no se pueden cargar los comentarios.','Impossibile caricare i commenti ora.','Impossible de charger les commentaires pour l’instant.','Kommentare können gerade nicht geladen werden.'],
  ['Niciun comentariu încă. Fii primul!','No comments yet. Be the first!','Aún no hay comentarios. ¡Sé el primero!','Ancora nessun commento. Sii il primo!','Pas encore de commentaire. Sois le premier !','Noch keine Kommentare. Sei die oder der Erste!'],
  ['Scrie un comentariu…','Write a comment…','Escribe un comentario…','Scrivi un commento…','Écris un commentaire…','Schreib einen Kommentar…'],
  ['💬 Trimite','💬 Send','💬 Enviar','💬 Invia','💬 Envoyer','💬 Senden'],
  ['Intră în cont (☁️) ca să apreciezi și să comentezi.','Sign in (☁️) to like and comment.','Inicia sesión (☁️) para dar me gusta y comentar.','Accedi (☁️) per mettere mi piace e commentare.','Connecte-toi (☁️) pour aimer et commenter.','Melde dich an (☁️), um zu liken und zu kommentieren.'],
  ['Intră în cont (☁️) ca să apreciezi','Sign in (☁️) to like','Inicia sesión (☁️) para dar me gusta','Accedi (☁️) per mettere mi piace','Connecte-toi (☁️) pour aimer','Melde dich an (☁️), um zu liken'],
  ['Scrie numele și comentariul','Write your name and comment','Escribe tu nombre y el comentario','Scrivi nome e commento','Écris ton nom et ton commentaire','Schreib Namen und Kommentar'],
  ['Prea multe comentarii. Încearcă peste o oră.','Too many comments. Try again in an hour.','Demasiados comentarios. Inténtalo dentro de una hora.','Troppi commenti. Riprova tra un’ora.','Trop de commentaires. Réessaie dans une heure.','Zu viele Kommentare. Versuch es in einer Stunde wieder.'],
  ['Nu am putut trimite comentariul','Couldn’t send the comment','No se pudo enviar el comentario','Impossibile inviare il commento','Impossible d’envoyer le commentaire','Kommentar konnte nicht gesendet werden'],
  ['Ștergi comentariul?','Delete this comment?','¿Eliminar el comentario?','Eliminare il commento?','Supprimer ce commentaire ?','Kommentar löschen?'],
  ['Planul gratuit are 3 linkuri active. Oprește unul sau treci la Premium ⭐','The free plan has 3 active links. Stop one or upgrade to Premium ⭐','El plan gratuito tiene 3 enlaces activos. Desactiva uno o pásate a Premium ⭐','Il piano gratuito ha 3 link attivi. Disattivane uno o passa a Premium ⭐','L’offre gratuite a 3 liens actifs. Arrête-en un ou passe à Premium ⭐','Kostenlos sind 3 aktive Links möglich. Stoppe einen oder wechsle zu Premium ⭐'],
  ['Planul gratuit are 2 produse. Treci la Premium ⭐ pentru nelimitat','The free plan has 2 products. Upgrade to Premium ⭐ for unlimited','El plan gratuito tiene 2 productos. Pásate a Premium ⭐ para ilimitados','Il piano gratuito ha 2 prodotti. Passa a Premium ⭐ per averne illimitati','L’offre gratuite a 2 produits. Passe à Premium ⭐ pour l’illimité','Kostenlos sind 2 Produkte möglich. Wechsle zu Premium ⭐ für unbegrenzt'],
  ['✨ Inspirație (opțional): link TikTok, Instagram sau YouTube', '✨ Inspiration (optional): TikTok, Instagram or YouTube link', '✨ Inspiración (opcional): enlace de TikTok, Instagram o YouTube', '✨ Ispirazione (facoltativa): link TikTok, Instagram o YouTube', '✨ Inspiration (facultatif) : lien TikTok, Instagram ou YouTube', '✨ Inspiration (optional): TikTok-, Instagram- oder YouTube-Link'],
  ['Linkul apare ca sursă de inspirație, cu credit pentru autor. Rețeta ta trebuie să fie a ta: alt text, pozele și clipurile tale, varianta ta îmbunătățită.', 'The link is shown as your inspiration, credited to its creator. Your recipe must be your own: your words, your photos and clips, your improved version.', 'El enlace aparece como inspiración, con crédito a su autor. Tu receta debe ser tuya: tu texto, tus fotos y clips, tu versión mejorada.', 'Il link appare come fonte d’ispirazione, con credito all’autore. La tua ricetta dev’essere tua: testo, foto e video tuoi, la tua versione migliorata.', 'Le lien apparaît comme source d’inspiration, avec crédit à son auteur. Ta recette doit être la tienne : ton texte, tes photos et clips, ta version améliorée.', 'Der Link wird als Inspiration mit Namensnennung gezeigt. Dein Rezept muss deins sein: eigener Text, eigene Fotos und Clips, deine verbesserte Version.'],
  ['✨ Inspirat de', '✨ Inspired by', '✨ Inspirado en', '✨ Ispirato a', '✨ Inspiré de', '✨ Inspiriert von'],
  ['▶ Arată clipul original', '▶ Show the original clip', '▶ Ver el clip original', '▶ Mostra il video originale', '▶ Voir le clip original', '▶ Originalclip zeigen'],
  ['Linkul de inspirație nu e valid', 'The inspiration link isn’t valid', 'El enlace de inspiración no es válido', 'Il link d’ispirazione non è valido', 'Le lien d’inspiration n’est pas valide', 'Der Inspirationslink ist ungültig'],
  ['✨ Inspirație adăugată. Acum scrie varianta ta!', '✨ Inspiration added. Now write your own version!', '✨ Inspiración añadida. ¡Ahora escribe tu versión!', '✨ Ispirazione aggiunta. Ora scrivi la tua versione!', '✨ Inspiration ajoutée. Écris maintenant ta version !', '✨ Inspiration hinzugefügt. Jetzt schreib deine Version!'],
  ['⬇️ Video', '⬇️ Video', '⬇️ Vídeo', '⬇️ Video', '⬇️ Vidéo', '⬇️ Video'],
  ['✅ Video salvat', '✅ Video saved', '✅ Vídeo guardado', '✅ Video salvato', '✅ Vidéo enregistrée', '✅ Video gespeichert'],
  ['Nu am putut salva clipul', 'Couldn’t save the video', 'No se pudo guardar el vídeo', 'Impossibile salvare il video', 'Impossible d’enregistrer la vidéo', 'Video konnte nicht gespeichert werden'],
  ['❤️ Salvată la favorite', '❤️ Saved to favourites', '❤️ Guardada en favoritas', '❤️ Salvata nelle preferite', '❤️ Ajoutée aux favoris', '❤️ Zu Favoriten hinzugefügt'],
  ['Scoasă de la favorite', 'Removed from favourites', 'Quitada de favoritas', 'Rimossa dalle preferite', 'Retirée des favoris', 'Aus Favoriten entfernt'],
  ['🌍 Rețete din toată lumea', '🌍 Recipes from around the world', '🌍 Recetas de todo el mundo', '🌍 Ricette da tutto il mondo', '🌍 Recettes du monde entier', '🌍 Rezepte aus aller Welt'],
  ['Ai văzut tot! Adaugă o rețetă de-a ta sau revino mâine.', 'You’ve seen them all! Add one of your own or come back tomorrow.', '¡Lo has visto todo! Añade una receta tuya o vuelve mañana.', 'Hai visto tutto! Aggiungi una tua ricetta o torna domani.', 'Tu as tout vu ! Ajoute une recette à toi ou reviens demain.', 'Du hast alles gesehen! Füge ein eigenes Rezept hinzu oder komm morgen wieder.'],
];

// Texte cu valori variabile. Ordinea contează: cele mai specifice primele.
const UI_PATTERNS = [
  ['Clipul se încarcă de pe {0} doar când apeși.', 'The clip loads from {0} only when you tap.', 'El clip se carga desde {0} solo al tocar.', 'Il video si carica da {0} solo quando tocchi.', 'Le clip se charge depuis {0} seulement quand tu touches.', 'Der Clip wird erst beim Tippen von {0} geladen.'],
  ['Pasul {0} / {1}', 'Step {0} / {1}', 'Paso {0} / {1}', 'Passaggio {0} / {1}', 'Étape {0} / {1}', 'Schritt {0} / {1}'],
  ['⏳ Pasul {0}/{1}', '⏳ Step {0}/{1}', '⏳ Paso {0}/{1}', '⏳ Passaggio {0}/{1}', '⏳ Étape {0}/{1}', '⏳ Schritt {0}/{1}'],
  ['Pasul {0}', 'Step {0}', 'Paso {0}', 'Passaggio {0}', 'Étape {0}', 'Schritt {0}'],
  ['📋 {0} pași', '📋 {0} steps', '📋 {0} pasos', '📋 {0} passaggi', '📋 {0} étapes', '📋 {0} Schritte'],
  ['{0} pași · Pas cu Gust', '{0} steps · Pas cu Gust', '{0} pasos · Pas cu Gust', '{0} passaggi · Pas cu Gust', '{0} étapes · Pas cu Gust', '{0} Schritte · Pas cu Gust'],
  ['{0} pași · {1}', '{0} steps · {1}', '{0} pasos · {1}', '{0} passaggi · {1}', '{0} étapes · {1}', '{0} Schritte · {1}'],
  ['{0} pași', '{0} steps', '{0} pasos', '{0} passaggi', '{0} étapes', '{0} Schritte'],
  ['{0} porții', '{0} servings', '{0} raciones', '{0} porzioni', '{0} portions', '{0} Portionen'],
  ['{0} zile la rând', '{0} days in a row', '{0} días seguidos', '{0} giorni di fila', '{0} jours d’affilée', '{0} Tage am Stück'],
  ['{0} zile', '{0} days', '{0} días', '{0} giorni', '{0} jours', '{0} Tage'],
  ['{0} zi', '{0} day', '{0} día', '{0} giorno', '{0} jour', '{0} Tag'],
  ['🔥 {0} la rând!', '🔥 {0} in a row!', '🔥 ¡{0} seguidos!', '🔥 {0} di fila!', '🔥 {0} d’affilée !', '🔥 {0} am Stück!'],
  ['Seria ta de {0} se pierde la miezul nopții — gătește ceva azi!', 'Your streak of {0} ends at midnight — cook something today!', 'Tu racha de {0} se pierde a medianoche: ¡cocina algo hoy!', 'La tua serie di {0} finisce a mezzanotte: cucina qualcosa oggi!', 'Ta série de {0} s’arrête à minuit — cuisine quelque chose aujourd’hui !', 'Deine Serie von {0} endet um Mitternacht – koch heute etwas!'],
  ['🔥 Serie: {0}', '🔥 Streak: {0}', '🔥 Racha: {0}', '🔥 Serie: {0}', '🔥 Série : {0}', '🔥 Serie: {0}'],
  ['{0} Insignă nouă: {1}!', '{0} New badge: {1}!', '{0} ¡Nueva insignia: {1}!', '{0} Nuovo badge: {1}!', '{0} Nouveau badge : {1} !', '{0} Neues Abzeichen: {1}!'],
  ['🔗 Distribuie „{0}”', '🔗 Share “{0}”', '🔗 Compartir «{0}»', '🔗 Condividi «{0}»', '🔗 Partager « {0} »', '🔗 „{0}“ teilen'],
  ['📜 Licența: {0}. O schimbi din ✏️ Editează.', '📜 Licence: {0}. Change it in ✏️ Edit.', '📜 Licencia: {0}. Cámbiala en ✏️ Editar.', '📜 Licenza: {0}. Cambiala in ✏️ Modifica.', '📜 Licence : {0}. Modifie-la dans ✏️ Modifier.', '📜 Lizenz: {0}. Ändern unter ✏️ Bearbeiten.'],
  ['📜 {0}', '📜 {0}', '📜 {0}', '📜 {0}', '📜 {0}', '📜 {0}'],
  ['Ștergi rețeta „{0}”?', 'Delete the recipe “{0}”?', '¿Eliminar la receta «{0}»?', 'Eliminare la ricetta «{0}»?', 'Supprimer la recette « {0} » ?', 'Rezept „{0}“ löschen?'],
  ['⏳ Se urcă {0}/{1}…', '⏳ Uploading {0}/{1}…', '⏳ Subiendo {0}/{1}…', '⏳ Caricamento {0}/{1}…', '⏳ Envoi {0}/{1}…', '⏳ Lade hoch {0}/{1}…'],
  ['✓ Sincronizat la {0}', '✓ Synced at {0}', '✓ Sincronizado a las {0}', '✓ Sincronizzato alle {0}', '✓ Synchronisé à {0}', '✓ Synchronisiert um {0}'],
  ['{0} fișiere nu s-au urcat ({1})', '{0} files failed to upload ({1})', 'No se subieron {0} archivos ({1})', '{0} file non caricati ({1})', '{0} fichiers non envoyés ({1})', '{0} Dateien nicht hochgeladen ({1})'],
  ['{0} rețete · {1}', '{0} recipes · {1}', '{0} recetas · {1}', '{0} ricette · {1}', '{0} recettes · {1}', '{0} Rezepte · {1}'],
  ['{0} lei', '€{0}', '{0} €', '{0} €', '{0} €', '{0} €'],
  ['Rețetă de {0}', 'Recipe by {0}', 'Receta de {0}', 'Ricetta di {0}', 'Recette de {0}', 'Rezept von {0}'],
  ['de {0}', 'by {0}', 'de {0}', 'di {0}', 'par {0}', 'von {0}'],
  ['Rețeta „{0}” pe Pas cu Gust', 'The “{0}” recipe on Pas cu Gust', 'La receta «{0}» en Pas cu Gust', 'La ricetta «{0}» su Pas cu Gust', 'La recette « {0} » sur Pas cu Gust', 'Das Rezept „{0}“ auf Pas cu Gust'],
  ['{0} — Pas cu Gust', '{0} — Pas cu Gust', '{0} — Pas cu Gust', '{0} — Pas cu Gust', '{0} — Pas cu Gust', '{0} — Pas cu Gust'],
  ['✍️ {0}', '✍️ {0}', '✍️ {0}', '✍️ {0}', '✍️ {0}', '✍️ {0}'],
  ['⚠️ {0}', '⚠️ {0}', '⚠️ {0}', '⚠️ {0}', '⚠️ {0}', '⚠️ {0}'],
];

// Rețetele de pornire, traduse. Ordinea ingredientelor și a pașilor e aceeași ca în română.
const SEED_I18N = {
  en: {
    s1: { t: 'Cabbage rolls (sarmale)', d: 'Soft, slow-braised Romanian cabbage rolls with pork and rice, the way they’re made for the holidays.',
      i: ['1 large pickled cabbage', '800 g minced pork', '100 g rice', '2 onions', '1 tbsp tomato paste', '200 g smoked pork', '1 tbsp dried thyme', '2 bay leaves', 'salt and pepper to taste'],
      s: ['Separate the cabbage leaves, cut out the thick central rib and soak them in cold water if they are too salty.', 'Gently fry the finely chopped onion in a little oil until translucent. Add the rinsed rice and stir for 2 minutes.', 'Mix the meat with the cooled onion and rice, tomato paste, thyme, salt and pepper. Knead well.', 'Place a spoonful of filling on each leaf, roll it up tightly and tuck the ends inside.', 'Lay a bed of shredded cabbage in the pot, then the rolls, the smoked pork and the bay leaves. Cover with water.', 'Simmer on low heat, covered, for at least 2½ hours. Serve with sour cream and polenta.'] },
    s2: { t: 'Polenta with cheese and sour cream', d: 'Fluffy Romanian polenta with sheep cheese and thick sour cream. Simple and filling.',
      i: ['1 l water', '250 g cornmeal', '1 tsp salt', '30 g butter', '300 g sheep cheese', '200 g sour cream'],
      s: ['Bring the salted water to the boil. When it bubbles, sprinkle in the cornmeal like rain, stirring constantly.', 'Keep on low heat and stir often with a wooden stick so no lumps form.', 'Stir in the butter at the end until it melts in.', 'Serve the polenta hot, with crumbled cheese on top and a generous spoon of sour cream.'] },
    s3: { t: 'Meatball sour soup (ciorbă de perișoare)', d: 'A tangy Romanian soup with tender meatballs, vegetables and fresh lovage.',
      i: ['500 g minced meat', '50 g rice', '1 egg', '1 carrot', '1 parsnip', '1 onion', '1 bell pepper', '2 tomatoes', '500 ml borș (fermented bran sour)', '1 bunch lovage', 'salt and pepper'],
      s: ['Dice the vegetables and boil them in 2.5 l of water with a little salt.', 'Mix the meat with the rice, egg, salt and pepper. Shape small balls with wet hands.', 'Drop the meatballs into the soup one by one, on low heat, so they don’t fall apart.', 'Add the chopped tomatoes and the separately boiled borș. Simmer for 5 more minutes.', 'Turn off the heat, sprinkle with chopped lovage and adjust the salt and sourness.'] },
    s4: { t: 'Papanași with jam', d: 'Fried sweet-cheese doughnuts with sour cream and blueberry jam.',
      i: ['500 g sweet cottage cheese', '2 eggs', '3 tbsp sugar', '1 sachet vanilla sugar', 'zest of 1 lemon', '250 g flour', '½ tsp baking soda', 'oil for frying', 'sour cream and jam to serve'],
      s: ['Mix the cheese with the eggs, sugar, vanilla and lemon zest.', 'Add the flour mixed with the baking soda until you get a soft, non-sticky dough.', 'Shape doughnuts with a hole and small balls for the “caps”.', 'Fry them in hot oil over medium heat until golden on both sides.', 'Drain the papanași on paper towels, then serve with sour cream and jam.'] },
    s5: { t: 'Eggplant zacuscă', d: 'Homemade Romanian roasted eggplant and pepper spread, for the pantry.',
      i: ['2 kg eggplants', '2 kg red kapia peppers', '1 kg onions', '500 ml tomato passata', '400 ml oil', '3 bay leaves', 'salt and peppercorns'],
      s: ['Roast the eggplants and peppers on the hob or in the oven, then peel them.', 'Chop the eggplant with a wooden knife and finely cut the peppers.', 'Gently fry the chopped onion in the oil until very soft.', 'Add the peppers, then the eggplant, passata, bay leaves, salt and pepper. Simmer on low heat, stirring often.', 'Pour the hot zacuscă into sterilised jars, close them and let them cool wrapped up.'] },
  },
  es: {
    s1: { t: 'Sarmale (rollitos de col)', d: 'Rollitos de col rumanos, tiernos y cocinados a fuego lento, con cerdo y arroz, como se hacen en las fiestas.',
      i: ['1 col fermentada grande', '800 g de carne picada de cerdo', '100 g de arroz', '2 cebollas', '1 cucharada de tomate concentrado', '200 g de cerdo ahumado', '1 cucharada de tomillo seco', '2 hojas de laurel', 'sal y pimienta al gusto'],
      s: ['Separa las hojas de col, corta el nervio grueso del centro y ponlas en remojo en agua fría si están muy saladas.', 'Sofríe la cebolla picada fina en un poco de aceite hasta que esté transparente. Añade el arroz lavado y remueve 2 minutos.', 'Mezcla la carne con la cebolla y el arroz ya fríos, el tomate concentrado, el tomillo, la sal y la pimienta. Amasa bien.', 'Pon una cucharada de relleno en cada hoja, enróllala bien apretada y mete los extremos hacia dentro.', 'Coloca en la olla una capa de col picada, luego los rollitos, el cerdo ahumado y el laurel. Cubre con agua.', 'Cuece a fuego lento, tapado, al menos 2 horas y media. Sirve con nata agria y polenta.'] },
    s2: { t: 'Mămăligă con queso y nata agria', d: 'Polenta rumana esponjosa con queso de oveja y nata agria espesa. Sencilla y saciante.',
      i: ['1 l de agua', '250 g de harina de maíz', '1 cucharadita de sal', '30 g de mantequilla', '300 g de queso de oveja', '200 g de nata agria'],
      s: ['Pon el agua con sal a hervir. Cuando borbotee, echa la harina de maíz como lluvia, removiendo sin parar.', 'Déjala a fuego lento y remueve a menudo con un palo de madera para que no se formen grumos.', 'Añade la mantequilla al final y remueve hasta que se integre.', 'Sirve la mămăligă caliente, con queso desmenuzado por encima y una buena cucharada de nata agria.'] },
    s3: { t: 'Sopa agria de albóndigas (ciorbă de perișoare)', d: 'Sopa rumana ácida con albóndigas tiernas, verduras y levístico fresco.',
      i: ['500 g de carne picada', '50 g de arroz', '1 huevo', '1 zanahoria', '1 chirivía', '1 cebolla', '1 pimiento', '2 tomates', '500 ml de borș (fermento de salvado)', '1 manojo de levístico', 'sal y pimienta'],
      s: ['Corta las verduras en dados y cuécelas en 2,5 l de agua con un poco de sal.', 'Mezcla la carne con el arroz, el huevo, la sal y la pimienta. Forma bolitas con las manos mojadas.', 'Echa las albóndigas a la sopa una a una, a fuego lento, para que no se deshagan.', 'Añade los tomates picados y el borș hervido aparte. Cuece 5 minutos más.', 'Apaga el fuego, espolvorea el levístico picado y ajusta la sal y la acidez.'] },
    s4: { t: 'Papanași con mermelada', d: 'Rosquillas fritas de queso dulce con nata agria y mermelada de arándanos.',
      i: ['500 g de requesón dulce', '2 huevos', '3 cucharadas de azúcar', '1 sobre de azúcar avainillado', 'la ralladura de 1 limón', '250 g de harina', '½ cucharadita de bicarbonato', 'aceite para freír', 'nata agria y mermelada para servir'],
      s: ['Mezcla el queso con los huevos, el azúcar, la vainilla y la ralladura de limón.', 'Añade la harina mezclada con el bicarbonato hasta obtener una masa blanda que no se pegue.', 'Forma rosquillas con agujero y bolitas pequeñas para los “sombreritos”.', 'Fríelas en aceite caliente a fuego medio hasta que estén doradas por ambos lados.', 'Escúrrelas sobre papel absorbente y sírvelas con nata agria y mermelada.'] },
    s5: { t: 'Zacuscă de berenjena', d: 'Crema casera rumana de berenjena y pimiento asados, para la despensa.',
      i: ['2 kg de berenjenas', '2 kg de pimientos rojos kapia', '1 kg de cebollas', '500 ml de tomate triturado', '400 ml de aceite', '3 hojas de laurel', 'sal y pimienta en grano'],
      s: ['Asa las berenjenas y los pimientos en la placa o en el horno y pélalos.', 'Pica la berenjena con un cuchillo de madera y corta los pimientos muy finos.', 'Sofríe la cebolla picada en el aceite hasta que esté muy blanda.', 'Añade los pimientos, luego la berenjena, el tomate, el laurel, la sal y la pimienta. Cuece a fuego lento removiendo a menudo.', 'Pon la zacuscă caliente en tarros esterilizados, ciérralos y déjalos enfriar tapados con una manta.'] },
  },
  it: {
    s1: { t: 'Sarmale (involtini di cavolo)', d: 'Involtini di cavolo romeni, morbidi e cotti a lungo, con maiale e riso, come si fanno per le feste.',
      i: ['1 cavolo fermentato grande', '800 g di carne di maiale macinata', '100 g di riso', '2 cipolle', '1 cucchiaio di concentrato di pomodoro', '200 g di maiale affumicato', '1 cucchiaio di timo secco', '2 foglie di alloro', 'sale e pepe q.b.'],
      s: ['Separa le foglie di cavolo, taglia la costa centrale spessa e mettile a bagno in acqua fredda se sono troppo salate.', 'Fai appassire la cipolla tritata finemente in poco olio finché diventa trasparente. Aggiungi il riso lavato e mescola per 2 minuti.', 'Mescola la carne con cipolla e riso raffreddati, concentrato di pomodoro, timo, sale e pepe. Impasta bene.', 'Metti un cucchiaio di ripieno su ogni foglia, arrotolala stretta e infila le estremità all’interno.', 'Disponi nella pentola uno strato di cavolo tritato, poi gli involtini, il maiale affumicato e l’alloro. Copri con acqua.', 'Cuoci a fuoco basso, con il coperchio, per almeno 2 ore e mezza. Servi con panna acida e polenta.'] },
    s2: { t: 'Mămăligă con formaggio e panna acida', d: 'Polenta romena soffice con formaggio di pecora e panna acida densa. Semplice e saziante.',
      i: ['1 l di acqua', '250 g di farina di mais', '1 cucchiaino di sale', '30 g di burro', '300 g di formaggio di pecora', '200 g di panna acida'],
      s: ['Porta a bollore l’acqua salata. Quando bolle, versa la farina a pioggia mescolando continuamente.', 'Lascia a fuoco basso e mescola spesso con un bastone di legno perché non si formino grumi.', 'Aggiungi il burro alla fine e mescola finché si scioglie.', 'Servi la mămăligă calda, con formaggio sbriciolato sopra e una generosa cucchiaiata di panna acida.'] },
    s3: { t: 'Zuppa acida di polpette (ciorbă de perișoare)', d: 'Zuppa romena acidula con polpette tenere, verdure e levistico fresco.',
      i: ['500 g di carne macinata', '50 g di riso', '1 uovo', '1 carota', '1 pastinaca', '1 cipolla', '1 peperone', '2 pomodori', '500 ml di borș (fermentato di crusca)', '1 mazzetto di levistico', 'sale e pepe'],
      s: ['Taglia le verdure a cubetti e cuocile in 2,5 l di acqua con un po’ di sale.', 'Mescola la carne con riso, uovo, sale e pepe. Forma palline con le mani bagnate.', 'Metti le polpette nella zuppa una alla volta, a fuoco basso, perché non si rompano.', 'Aggiungi i pomodori tritati e il borș bollito a parte. Cuoci ancora 5 minuti.', 'Spegni il fuoco, cospargi di levistico tritato e regola di sale e di acidità.'] },
    s4: { t: 'Papanași con marmellata', d: 'Ciambelle fritte di formaggio dolce con panna acida e marmellata di mirtilli.',
      i: ['500 g di formaggio fresco dolce', '2 uova', '3 cucchiai di zucchero', '1 bustina di vanillina', 'la scorza di 1 limone', '250 g di farina', '½ cucchiaino di bicarbonato', 'olio per friggere', 'panna acida e marmellata per servire'],
      s: ['Mescola il formaggio con uova, zucchero, vaniglia e scorza di limone.', 'Aggiungi la farina con il bicarbonato fino a ottenere un impasto morbido che non si attacca.', 'Forma ciambelle con il buco e palline per i “cappellini”.', 'Friggile in olio caldo a fuoco medio finché sono dorate da entrambi i lati.', 'Scola i papanași su carta assorbente, poi servili con panna acida e marmellata.'] },
    s5: { t: 'Zacuscă di melanzane', d: 'Crema casalinga romena di melanzane e peperoni arrostiti, da dispensa.',
      i: ['2 kg di melanzane', '2 kg di peperoni rossi kapia', '1 kg di cipolle', '500 ml di passata di pomodoro', '400 ml di olio', '3 foglie di alloro', 'sale e pepe in grani'],
      s: ['Arrostisci melanzane e peperoni sulla piastra o in forno, poi pelali.', 'Trita le melanzane con un coltello di legno e taglia finemente i peperoni.', 'Fai appassire la cipolla tritata nell’olio finché è molto morbida.', 'Aggiungi i peperoni, poi le melanzane, la passata, l’alloro, sale e pepe. Cuoci a fuoco basso mescolando spesso.', 'Versa la zacuscă calda in barattoli sterilizzati, chiudili e lasciali raffreddare avvolti in una coperta.'] },
  },
  fr: {
    s1: { t: 'Sarmale (chou farci)', d: 'Rouleaux de chou roumains, fondants et mijotés longuement, au porc et au riz, comme pour les fêtes.',
      i: ['1 gros chou fermenté', '800 g de porc haché', '100 g de riz', '2 oignons', '1 c. à soupe de concentré de tomate', '200 g de porc fumé', '1 c. à soupe de thym séché', '2 feuilles de laurier', 'sel et poivre selon le goût'],
      s: ['Détache les feuilles de chou, retire la grosse côte centrale et fais-les tremper dans l’eau froide si elles sont trop salées.', 'Fais revenir l’oignon finement haché dans un peu d’huile jusqu’à ce qu’il soit translucide. Ajoute le riz rincé et mélange 2 minutes.', 'Mélange la viande avec l’oignon et le riz refroidis, le concentré de tomate, le thym, le sel et le poivre. Pétris bien.', 'Pose une cuillerée de farce sur chaque feuille, roule bien serré et rentre les extrémités.', 'Dispose dans la cocotte une couche de chou émincé, puis les rouleaux, le porc fumé et le laurier. Couvre d’eau.', 'Laisse mijoter à feu doux, à couvert, au moins 2 h 30. Sers avec de la crème aigre et de la polenta.'] },
    s2: { t: 'Mămăligă au fromage et à la crème', d: 'Polenta roumaine moelleuse au fromage de brebis et à la crème aigre épaisse. Simple et nourrissante.',
      i: ['1 l d’eau', '250 g de semoule de maïs', '1 c. à café de sel', '30 g de beurre', '300 g de fromage de brebis', '200 g de crème aigre'],
      s: ['Porte l’eau salée à ébullition. Quand elle bout, verse la semoule en pluie en remuant sans arrêt.', 'Laisse à feu doux et remue souvent avec un bâton en bois pour éviter les grumeaux.', 'Ajoute le beurre à la fin et mélange jusqu’à ce qu’il fonde.', 'Sers la mămăligă bien chaude, avec du fromage émietté dessus et une belle cuillerée de crème aigre.'] },
    s3: { t: 'Soupe aigre aux boulettes (ciorbă de perișoare)', d: 'Soupe roumaine acidulée avec de tendres boulettes, des légumes et de la livèche fraîche.',
      i: ['500 g de viande hachée', '50 g de riz', '1 œuf', '1 carotte', '1 panais', '1 oignon', '1 poivron', '2 tomates', '500 ml de borș (son fermenté)', '1 bouquet de livèche', 'sel et poivre'],
      s: ['Coupe les légumes en dés et fais-les cuire dans 2,5 l d’eau légèrement salée.', 'Mélange la viande avec le riz, l’œuf, le sel et le poivre. Forme des petites boulettes avec les mains mouillées.', 'Plonge les boulettes une à une dans la soupe, à feu doux, pour qu’elles ne se défassent pas.', 'Ajoute les tomates hachées et le borș bouilli à part. Laisse cuire encore 5 minutes.', 'Éteins le feu, parsème de livèche hachée et rectifie le sel et l’acidité.'] },
    s4: { t: 'Papanași à la confiture', d: 'Beignets frits au fromage blanc, avec crème aigre et confiture de myrtilles.',
      i: ['500 g de fromage blanc frais', '2 œufs', '3 c. à soupe de sucre', '1 sachet de sucre vanillé', 'le zeste d’1 citron', '250 g de farine', '½ c. à café de bicarbonate', 'huile de friture', 'crème aigre et confiture pour servir'],
      s: ['Mélange le fromage avec les œufs, le sucre, la vanille et le zeste de citron.', 'Ajoute la farine mélangée au bicarbonate jusqu’à obtenir une pâte souple qui ne colle pas.', 'Façonne des beignets troués et des petites boules pour les « chapeaux ».', 'Fais-les frire dans l’huile chaude à feu moyen jusqu’à ce qu’ils soient dorés des deux côtés.', 'Égoutte les papanași sur du papier absorbant, puis sers-les avec de la crème aigre et de la confiture.'] },
    s5: { t: 'Zacuscă d’aubergines', d: 'Tartinade roumaine maison d’aubergines et de poivrons grillés, pour le garde-manger.',
      i: ['2 kg d’aubergines', '2 kg de poivrons rouges kapia', '1 kg d’oignons', '500 ml de coulis de tomate', '400 ml d’huile', '3 feuilles de laurier', 'sel et poivre en grains'],
      s: ['Fais griller les aubergines et les poivrons sur la plaque ou au four, puis pèle-les.', 'Hache les aubergines avec un couteau en bois et coupe finement les poivrons.', 'Fais revenir l’oignon haché dans l’huile jusqu’à ce qu’il soit bien fondant.', 'Ajoute les poivrons, puis les aubergines, le coulis, le laurier, le sel et le poivre. Laisse mijoter à feu doux en remuant souvent.', 'Verse la zacuscă chaude dans des bocaux stérilisés, ferme-les et laisse-les refroidir emmaillotés.'] },
  },
  de: {
    s1: { t: 'Sarmale (Kohlrouladen)', d: 'Zarte, lange geschmorte rumänische Kohlrouladen mit Schwein und Reis – wie an Feiertagen.',
      i: ['1 großer Sauerkrautkopf', '800 g Schweinehack', '100 g Reis', '2 Zwiebeln', '1 EL Tomatenmark', '200 g Räucherspeck', '1 EL getrockneter Thymian', '2 Lorbeerblätter', 'Salz und Pfeffer nach Geschmack'],
      s: ['Die Kohlblätter lösen, die dicke Mittelrippe herausschneiden und in kaltem Wasser wässern, wenn sie zu salzig sind.', 'Die fein gehackte Zwiebel in etwas Öl glasig dünsten. Den gewaschenen Reis dazugeben und 2 Minuten rühren.', 'Das Fleisch mit der abgekühlten Zwiebel und dem Reis, Tomatenmark, Thymian, Salz und Pfeffer mischen. Gut durchkneten.', 'Je einen Löffel Füllung auf ein Blatt geben, fest aufrollen und die Enden nach innen stecken.', 'Eine Schicht geschnittenen Kohl in den Topf geben, dann die Rouladen, den Speck und die Lorbeerblätter. Mit Wasser bedecken.', 'Zugedeckt bei schwacher Hitze mindestens 2½ Stunden köcheln. Mit Schmand und Polenta servieren.'] },
    s2: { t: 'Mămăligă mit Käse und Schmand', d: 'Lockere rumänische Polenta mit Schafskäse und dickem Schmand. Einfach und sättigend.',
      i: ['1 l Wasser', '250 g Maisgrieß', '1 TL Salz', '30 g Butter', '300 g Schafskäse', '200 g Schmand'],
      s: ['Das Salzwasser aufkochen. Sobald es sprudelt, den Maisgrieß einrieseln lassen und ständig rühren.', 'Bei schwacher Hitze lassen und oft mit einem Holzstab rühren, damit sich keine Klümpchen bilden.', 'Zum Schluss die Butter unterrühren, bis sie geschmolzen ist.', 'Die Mămăligă heiß servieren, mit zerbröseltem Käse und einem großzügigen Löffel Schmand.'] },
    s3: { t: 'Saure Fleischbällchensuppe (ciorbă de perișoare)', d: 'Säuerliche rumänische Suppe mit zarten Fleischbällchen, Gemüse und frischem Liebstöckel.',
      i: ['500 g Hackfleisch', '50 g Reis', '1 Ei', '1 Karotte', '1 Pastinake', '1 Zwiebel', '1 Paprika', '2 Tomaten', '500 ml Borș (fermentierte Kleie)', '1 Bund Liebstöckel', 'Salz und Pfeffer'],
      s: ['Das Gemüse würfeln und in 2,5 l leicht gesalzenem Wasser kochen.', 'Das Fleisch mit Reis, Ei, Salz und Pfeffer mischen. Mit nassen Händen kleine Bällchen formen.', 'Die Bällchen einzeln bei schwacher Hitze in die Suppe geben, damit sie nicht zerfallen.', 'Die gehackten Tomaten und den separat aufgekochten Borș zugeben. Noch 5 Minuten köcheln.', 'Vom Herd nehmen, gehackten Liebstöckel darüberstreuen und mit Salz und Säure abschmecken.'] },
    s4: { t: 'Papanași mit Konfitüre', d: 'Frittierte Quarkkrapfen mit Schmand und Heidelbeerkonfitüre.',
      i: ['500 g süßer Quark', '2 Eier', '3 EL Zucker', '1 Päckchen Vanillezucker', 'Abrieb von 1 Zitrone', '250 g Mehl', '½ TL Natron', 'Öl zum Frittieren', 'Schmand und Konfitüre zum Servieren'],
      s: ['Den Quark mit Eiern, Zucker, Vanille und Zitronenabrieb verrühren.', 'Das mit Natron vermischte Mehl zugeben, bis ein weicher, nicht klebender Teig entsteht.', 'Ringe mit Loch und kleine Kugeln für die „Mützchen“ formen.', 'Bei mittlerer Hitze in heißem Öl von beiden Seiten goldbraun frittieren.', 'Die Papanași auf Küchenpapier abtropfen lassen und mit Schmand und Konfitüre servieren.'] },
    s5: { t: 'Auberginen-Zacuscă', d: 'Hausgemachter rumänischer Aufstrich aus gerösteten Auberginen und Paprika – für den Vorrat.',
      i: ['2 kg Auberginen', '2 kg rote Kapia-Paprika', '1 kg Zwiebeln', '500 ml passierte Tomaten', '400 ml Öl', '3 Lorbeerblätter', 'Salz und Pfefferkörner'],
      s: ['Auberginen und Paprika auf der Herdplatte oder im Ofen rösten und schälen.', 'Die Auberginen mit einem Holzmesser hacken und die Paprika fein schneiden.', 'Die gehackten Zwiebeln im Öl weich dünsten.', 'Paprika, dann Auberginen, Tomaten, Lorbeer, Salz und Pfeffer zugeben. Bei schwacher Hitze unter häufigem Rühren köcheln.', 'Die heiße Zacuscă in sterilisierte Gläser füllen, verschließen und eingewickelt abkühlen lassen.'] },
  },
};

// ---------- motorul de traducere ----------
let LANG = 'ro';
const I18N = {}, I18N_PAT = {};
LANG_ORDER.forEach((l, k) => {
  if (!k) return;
  const d = I18N[l] = {};
  UI_ROWS.forEach(r => { d[r[0]] = r[k]; });
  I18N_PAT[l] = UI_PATTERNS.map(r => {
    const names = [];
    const re = new RegExp('^' + r[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\{(\d)\\\}/g, (m, n) => { names.push(+n); return '(.+?)'; }) + '$', 's');
    return { re, names, out: r[k] };
  });
});
function t(s) {
  if (LANG === 'ro' || s == null) return s;
  const str = String(s), d = I18N[LANG];
  if (d[str] !== undefined) return d[str];
  for (const p of I18N_PAT[LANG]) {
    const m = str.match(p.re);
    if (m) { const v = []; p.names.forEach((n, i) => { v[n] = m[i + 1]; }); return p.out.replace(/\{(\d)\}/g, (x, n) => t(v[n])); }
  }
  return str;
}
// Traduce textul afișat pe ecran; conținutul scris de utilizator (.nt, câmpuri de text) rămâne neatins.
const SKIP = 'SCRIPT,STYLE,TEXTAREA,INPUT,.nt,[contenteditable]';
function trText(n) {
  const raw = n.nodeValue, s = raw.trim();
  if (!s || n.parentElement?.closest(SKIP)) return;
  if (n.__ro === undefined || (n.__tr !== raw)) n.__ro = s; // ține minte textul original românesc
  const out = t(n.__ro);
  const next = out === n.__ro && LANG !== 'ro' ? raw : raw.replace(s, out);
  if (next !== raw) { n.nodeValue = next; }
  n.__tr = n.nodeValue;
}
function trAttrs(el) {
  if (el.closest?.('.nt')) return;
  for (const a of ['placeholder', 'title']) {
    if (!el.hasAttribute?.(a)) continue;
    const k = '__ro_' + a;
    if (el[k] === undefined || el.getAttribute(a) !== el['__tr_' + a]) el[k] = el.getAttribute(a);
    const v = t(el[k]);
    if (el.getAttribute(a) !== v) el.setAttribute(a, v); // altfel fiecare setAttribute declanșează din nou observatorul
    el['__tr_' + a] = v;
  }
}
function translateTree(root) {
  if (!root) return;
  if (root.nodeType === 3) return trText(root);
  if (root.nodeType !== 1) return;
  trAttrs(root);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  let n; while ((n = w.nextNode())) n.nodeType === 3 ? trText(n) : trAttrs(n);
}
let i18nObs = null;
function startI18n() {
  translateTree(document.body);
  if (i18nObs) return;
  i18nObs = new MutationObserver(ms => {
    if (LANG === 'ro') return;
    for (const m of ms) {
      if (m.type === 'characterData') { if (m.target.nodeValue !== m.target.__tr) trText(m.target); }
      else if (m.type === 'attributes') trAttrs(m.target);
      else m.addedNodes.forEach(translateTree);
    }
  });
  i18nObs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'title'] });
}
function detectLang() {
  for (const l of (navigator.languages || [navigator.language || 'ro'])) {
    const k = String(l).slice(0, 2).toLowerCase();
    if (LANGS[k]) return k;
  }
  return 'en';
}
const locale = () => LANGS[LANG].locale;
