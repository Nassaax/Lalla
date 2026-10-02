// Modèles d'emails transactionnels, FR et NL. {marque} est remplacé par le nom de la plateforme.
// Les variables sont échappées avant insertion.
export const MODELES = {
  demande_recue: {
    fr: { sujet: 'Nouvelle demande de location : {titre}', bouton: 'Répondre à la demande',
      corps: ['Bonjour {prenom},', 'Vous avez reçu une demande pour <strong>{titre}</strong>, du {debut} au {fin} (événement le {evenement}).', 'Vous avez <strong>24 heures</strong> pour accepter ou refuser. Sans réponse, la demande sera annulée automatiquement.'] },
    nl: { sujet: 'Nieuwe huuraanvraag : {titre}', bouton: 'Aanvraag beantwoorden',
      corps: ['Dag {prenom},', 'U ontving een aanvraag voor <strong>{titre}</strong>, van {debut} tot {fin} (evenement op {evenement}).', 'U hebt <strong>24 uur</strong> om te aanvaarden of te weigeren. Zonder antwoord wordt de aanvraag automatisch geannuleerd.'] }
  },
  commande_a_payer: {
    fr: { sujet: 'Bonne nouvelle : votre location est acceptée', bouton: 'Finaliser le paiement',
      corps: ['Bonjour {prenom},', 'Toutes vos demandes ont été acceptées. Vous pouvez maintenant régler votre location en une seule fois.', 'Montant : <strong>{montant}</strong>.'] },
    nl: { sujet: 'Goed nieuws: uw huur is aanvaard', bouton: 'Betaling afronden',
      corps: ['Dag {prenom},', 'Al uw aanvragen werden aanvaard. U kunt nu in één keer betalen.', 'Bedrag: <strong>{montant}</strong>.'] }
  },
  demande_refusee: {
    fr: { sujet: 'Une de vos demandes n\'a pas pu être acceptée', bouton: 'Voir mon panier',
      corps: ['Bonjour {prenom},', '<strong>{titre}</strong> n\'est malheureusement pas disponible ({raison}).', 'Vous pouvez régler les pièces acceptées ou tout annuler, sans frais, depuis votre panier.'] },
    nl: { sujet: 'Een van uw aanvragen kon niet worden aanvaard', bouton: 'Mijn winkelmand bekijken',
      corps: ['Dag {prenom},', '<strong>{titre}</strong> is helaas niet beschikbaar ({raison}).', 'U kunt de aanvaarde stukken betalen of alles kosteloos annuleren via uw winkelmand.'] }
  },
  demande_expiree_fournisseuse: {
    fr: { sujet: 'Demande expirée : {titre}', bouton: 'Mon tableau de bord',
      corps: ['Bonjour {prenom},', 'La demande pour <strong>{titre}</strong> a expiré faute de réponse sous 24 heures. Pensez à activer les notifications pour ne rien manquer.'] },
    nl: { sujet: 'Aanvraag verlopen : {titre}', bouton: 'Mijn dashboard',
      corps: ['Dag {prenom},', 'De aanvraag voor <strong>{titre}</strong> is verlopen omdat er binnen 24 uur geen antwoord kwam.'] }
  },
  paiement_confirme: {
    fr: { sujet: 'Paiement confirmé : merci !', bouton: 'Enregistrer ma carte de caution',
      corps: ['Bonjour {prenom},', 'Votre paiement de <strong>{montant}</strong> est confirmé.', 'Dernière étape : enregistrez une carte pour la caution ({caution}). Aucun montant n\'est débité : une simple empreinte est réalisée {jours} jours avant la remise, puis libérée après le retour.'] },
    nl: { sujet: 'Betaling bevestigd : dank u!', bouton: 'Mijn waarborgkaart registreren',
      corps: ['Dag {prenom},', 'Uw betaling van <strong>{montant}</strong> is bevestigd.', 'Laatste stap: registreer een kaart voor de waarborg ({caution}). Er wordt niets afgeschreven: er wordt {jours} dagen voor de overhandiging een voorafgaande autorisatie gedaan, die na de terugbezorging wordt vrijgegeven.'] }
  },
  reservation_payee: {
    fr: { sujet: 'Location confirmée : {titre}', bouton: 'Voir la réservation',
      corps: ['Bonjour {prenom},', 'La location de <strong>{titre}</strong> est payée. Remise prévue le {debut}.', 'Le jour J, faites l\'état des lieux dans l\'application avec la cliente : 4 photos et quelques cases à cocher.'] },
    nl: { sujet: 'Huur bevestigd : {titre}', bouton: 'Reservering bekijken',
      corps: ['Dag {prenom},', 'De huur van <strong>{titre}</strong> is betaald. Overhandiging gepland op {debut}.', 'Doe op de dag zelf de staat van het kledingstuk in de app samen met de klant: 4 foto\'s en enkele vakjes.'] }
  },
  caution_echec: {
    fr: { sujet: 'Action requise : la caution n\'a pas pu être autorisée', bouton: 'Régulariser la caution',
      corps: ['Bonjour {prenom},', 'L\'empreinte de caution de <strong>{montant}</strong> pour la location du {debut} a été refusée par la banque.', 'Sans caution autorisée, la remise ne peut pas avoir lieu. Merci de régulariser dès que possible.'] },
    nl: { sujet: 'Actie vereist: de waarborg kon niet worden geautoriseerd', bouton: 'Waarborg regelen',
      corps: ['Dag {prenom},', 'De waarborgautorisatie van <strong>{montant}</strong> voor de huur van {debut} werd door de bank geweigerd.', 'Zonder geautoriseerde waarborg kan de overhandiging niet plaatsvinden. Gelieve dit zo snel mogelijk te regelen.'] }
  },
  caution_echec_info: {
    fr: { sujet: 'Caution non autorisée : réservation {reference}', bouton: 'Voir la réservation',
      corps: ['Bonjour,', 'L\'empreinte de caution ({montant}) de la réservation {reference} a échoué. La cliente a été prévenue. Ne remettez pas la tenue tant que la caution n\'apparaît pas comme autorisée.'] },
    nl: { sujet: 'Waarborg niet geautoriseerd : reservering {reference}', bouton: 'Reservering bekijken',
      corps: ['Dag,', 'De waarborgautorisatie ({montant}) van reservering {reference} is mislukt. De klant werd verwittigd. Overhandig het kledingstuk niet zolang de waarborg niet als geautoriseerd verschijnt.'] }
  },
  identite_a_reprendre: {
    fr: { sujet: 'Vérification d\'identité à reprendre', bouton: 'Reprendre la vérification',
      corps: ['Bonjour {prenom},', 'Votre vérification d\'identité n\'a pas pu aboutir. Elle est nécessaire pour les locations avec une caution élevée. Cela prend deux minutes.'] },
    nl: { sujet: 'Identiteitsverificatie opnieuw doen', bouton: 'Verificatie hervatten',
      corps: ['Dag {prenom},', 'Uw identiteitsverificatie kon niet worden afgerond. Ze is nodig voor huur met een hoge waarborg. Het duurt twee minuten.'] }
  },
  rappel_remise: {
    fr: { sujet: 'C\'est demain : remise de {titre}', bouton: 'Ouvrir l\'état des lieux',
      corps: ['Bonjour {prenom},', 'La remise de <strong>{titre}</strong> a lieu demain. Prévoyez quelques minutes pour l\'état des lieux dans l\'application.'] },
    nl: { sujet: 'Morgen: overhandiging van {titre}', bouton: 'Staat openen',
      corps: ['Dag {prenom},', 'De overhandiging van <strong>{titre}</strong> is morgen. Voorzie enkele minuten voor de staat van het kledingstuk in de app.'] }
  },
  rappel_retour: {
    fr: { sujet: 'Rappel : retour de {titre} demain', bouton: 'Voir la réservation',
      corps: ['Bonjour {prenom},', 'Le retour de <strong>{titre}</strong> est prévu demain. Merci de rendre la tenue dans l\'état où vous l\'avez reçue, sans la laver : le pressing est pris en charge.'] },
    nl: { sujet: 'Herinnering: terugbezorging van {titre} morgen', bouton: 'Reservering bekijken',
      corps: ['Dag {prenom},', 'De terugbezorging van <strong>{titre}</strong> is morgen gepland. Breng het stuk terug zoals u het ontving, zonder het te wassen: de stomerij is inbegrepen.'] }
  },
  retour_confirme: {
    fr: { sujet: 'Retour confirmé : {titre}', bouton: 'Voir la réservation',
      corps: ['Bonjour {prenom},', 'Le retour de <strong>{titre}</strong> est enregistré.', 'Vous disposez de <strong>{heures} heures</strong> pour signaler un problème avec photos. Sans signalement, la caution sera libérée automatiquement et votre versement suivra.'] },
    nl: { sujet: 'Terugbezorging bevestigd : {titre}', bouton: 'Reservering bekijken',
      corps: ['Dag {prenom},', 'De terugbezorging van <strong>{titre}</strong> is geregistreerd.', 'U hebt <strong>{heures} uur</strong> om een probleem met foto\'s te melden. Zonder melding wordt de waarborg automatisch vrijgegeven en volgt uw uitbetaling.'] }
  },
  litige_ouvert: {
    fr: { sujet: 'Un litige a été ouvert : réservation {reference}', bouton: 'Voir le dossier',
      corps: ['Bonjour,', 'Un litige a été ouvert sur la réservation {reference} : {motif}.', 'Notre équipe examine les photos de remise et de retour et revient vers les deux parties sous 72 heures. La caution reste bloquée pendant l\'examen.'] },
    nl: { sujet: 'Er werd een geschil geopend : reservering {reference}', bouton: 'Dossier bekijken',
      corps: ['Dag,', 'Er werd een geschil geopend voor reservering {reference}: {motif}.', 'Ons team bekijkt de foto\'s van overhandiging en terugbezorging en komt binnen 72 uur bij beide partijen terug. De waarborg blijft geblokkeerd tijdens het onderzoek.'] }
  },
  litige_resolu: {
    fr: { sujet: 'Litige résolu : réservation {reference}', bouton: 'Voir la décision',
      corps: ['Bonjour,', 'Le litige de la réservation {reference} est clôturé.', 'Décision : {decision}', 'Montant retenu sur la caution : {capture}. Montant remboursé : {rembourse}.'] },
    nl: { sujet: 'Geschil opgelost : reservering {reference}', bouton: 'Beslissing bekijken',
      corps: ['Dag,', 'Het geschil van reservering {reference} is afgesloten.', 'Beslissing: {decision}', 'Ingehouden op de waarborg: {capture}. Terugbetaald: {rembourse}.'] }
  },
  versement_effectue: {
    fr: { sujet: 'Versement envoyé : {montant}', bouton: 'Mes revenus',
      corps: ['Bonjour {prenom},', 'Nous venons de vous transférer <strong>{montant}</strong> pour la location de {titre}. Selon votre banque, les fonds arrivent sous 2 à 7 jours ouvrés.'] },
    nl: { sujet: 'Uitbetaling verzonden: {montant}', bouton: 'Mijn inkomsten',
      corps: ['Dag {prenom},', 'We hebben u zonet <strong>{montant}</strong> overgemaakt voor de huur van {titre}. Afhankelijk van uw bank komt het geld binnen 2 tot 7 werkdagen aan.'] }
  },
  caution_liberee: {
    fr: { sujet: 'Votre caution est libérée', bouton: 'Laisser un avis',
      corps: ['Bonjour {prenom},', 'Tout s\'est bien passé : l\'empreinte de {montant} est libérée. Merci d\'avoir porté une pièce de notre communauté.', 'Votre avis aide les autres clientes.'] },
    nl: { sujet: 'Uw waarborg is vrijgegeven', bouton: 'Een review geven',
      corps: ['Dag {prenom},', 'Alles verliep goed: de autorisatie van {montant} is vrijgegeven. Bedankt om een stuk uit onze gemeenschap te dragen.', 'Uw review helpt andere klanten.'] }
  },
  avis_invitation: {
    fr: { sujet: 'Comment s\'est passée la location ?', bouton: 'Laisser un avis',
      corps: ['Bonjour {prenom},', 'La location de <strong>{titre}</strong> est terminée. Votre avis compte : il prend moins d\'une minute.'] },
    nl: { sujet: 'Hoe verliep de huur?', bouton: 'Een review geven',
      corps: ['Dag {prenom},', 'De huur van <strong>{titre}</strong> is afgelopen. Uw mening telt: het duurt minder dan een minuut.'] }
  },
  annulation: {
    fr: { sujet: 'Réservation annulée : {titre}', bouton: 'Voir le détail',
      corps: ['Bonjour {prenom},', 'La réservation de <strong>{titre}</strong> est annulée ({raison}).', 'Remboursement : <strong>{rembourse}</strong>. Il apparaît sur votre compte sous 5 à 10 jours ouvrés.'] },
    nl: { sujet: 'Reservering geannuleerd : {titre}', bouton: 'Details bekijken',
      corps: ['Dag {prenom},', 'De reservering van <strong>{titre}</strong> is geannuleerd ({raison}).', 'Terugbetaling: <strong>{rembourse}</strong>. Die verschijnt binnen 5 tot 10 werkdagen op uw rekening.'] }
  },
  annulation_fournisseuse: {
    fr: { sujet: 'Réservation annulée : {titre}', bouton: 'Mon tableau de bord',
      corps: ['Bonjour {prenom},', 'La réservation de <strong>{titre}</strong> est annulée ({raison}). Les dates sont de nouveau disponibles dans votre calendrier.', '{compensation}'] },
    nl: { sujet: 'Reservering geannuleerd : {titre}', bouton: 'Mijn dashboard',
      corps: ['Dag {prenom},', 'De reservering van <strong>{titre}</strong> is geannuleerd ({raison}). De data zijn opnieuw beschikbaar in uw kalender.', '{compensation}'] }
  },
  annonce_validee: {
    fr: { sujet: 'Votre annonce est en ligne : {titre}', bouton: 'Voir l\'annonce',
      corps: ['Bonjour {prenom},', '<strong>{titre}</strong> a été validée par notre équipe et apparaît désormais dans le catalogue.', 'Astuce : partagez-la sur WhatsApp et Instagram, l\'aperçu est soigné.'] },
    nl: { sujet: 'Uw advertentie staat online: {titre}', bouton: 'Advertentie bekijken',
      corps: ['Dag {prenom},', '<strong>{titre}</strong> werd door ons team goedgekeurd en staat nu in de catalogus.', 'Tip: deel ze op WhatsApp en Instagram, de preview is verzorgd.'] }
  },
  annonce_refusee: {
    fr: { sujet: 'Votre annonce nécessite une modification', bouton: 'Modifier l\'annonce',
      corps: ['Bonjour {prenom},', '<strong>{titre}</strong> n\'a pas pu être validée pour la raison suivante :', '« {motif} »', 'Modifiez-la puis soumettez-la à nouveau : nous la relisons rapidement.'] },
    nl: { sujet: 'Uw advertentie moet worden aangepast', bouton: 'Advertentie aanpassen',
      corps: ['Dag {prenom},', '<strong>{titre}</strong> kon niet worden goedgekeurd om de volgende reden:', '« {motif} »', 'Pas ze aan en dien ze opnieuw in: we bekijken ze snel.'] }
  },
  compte_valide: {
    fr: { sujet: 'Votre compte {marque} est validé', bouton: 'Mon tableau de bord',
      corps: ['Bonjour {prenom},', 'Votre compte est validé. Votre page publique est désormais visible.'] },
    nl: { sujet: 'Uw {marque}-account is goedgekeurd', bouton: 'Mijn dashboard',
      corps: ['Dag {prenom},', 'Uw account is goedgekeurd. Uw publieke pagina is nu zichtbaar.'] }
  },
  lead_nouveau: {
    fr: { sujet: 'Nouvelle demande de devis via {marque}', bouton: 'Voir mes demandes',
      corps: ['Bonjour {partenaire},', '{nom} souhaite un devis.', 'Date : {date} · Ville : {ville}', 'Message : « {message} »', 'Contact : {email} {telephone}'] },
    nl: { sujet: 'Nieuwe offerteaanvraag via {marque}', bouton: 'Mijn aanvragen bekijken',
      corps: ['Dag {partenaire},', '{nom} wenst een offerte.', 'Datum: {date} · Stad: {ville}', 'Bericht: « {message} »', 'Contact: {email} {telephone}'] }
  },
  lead_confirmation: {
    fr: { sujet: 'Votre demande de devis est envoyée', bouton: 'Découvrir d\'autres partenaires',
      corps: ['Bonjour {nom},', 'Votre demande a bien été transmise à {partenaire}, qui vous répondra directement.'] },
    nl: { sujet: 'Uw offerteaanvraag is verzonden', bouton: 'Andere partners ontdekken',
      corps: ['Dag {nom},', 'Uw aanvraag werd doorgestuurd naar {partenaire}, die u rechtstreeks zal antwoorden.'] }
  },
  essayage_demande: {
    fr: { sujet: 'Demande d\'essayage : {titre}', bouton: 'Répondre',
      corps: ['Bonjour {prenom},', 'Une cliente souhaite essayer <strong>{titre}</strong> le {creneau}. Les frais d\'essayage sont déjà réglés.', 'Merci de confirmer ou de proposer un refus sous 24 heures.'] },
    nl: { sujet: 'Pasaanvraag : {titre}', bouton: 'Antwoorden',
      corps: ['Dag {prenom},', 'Een klant wil <strong>{titre}</strong> passen op {creneau}. De paskosten zijn al betaald.', 'Gelieve binnen 24 uur te bevestigen of te weigeren.'] }
  },
  essayage_reponse: {
    fr: { sujet: 'Essayage {statut} : {titre}', bouton: 'Voir mes essayages',
      corps: ['Bonjour {prenom},', 'Votre essayage de <strong>{titre}</strong> le {creneau} est <strong>{statut}</strong>.', '{detail}'] },
    nl: { sujet: 'Passessie {statut} : {titre}', bouton: 'Mijn passessies bekijken',
      corps: ['Dag {prenom},', 'Uw passessie voor <strong>{titre}</strong> op {creneau} is <strong>{statut}</strong>.', '{detail}'] }
  },
  showroom_inscription: {
    fr: { sujet: 'Inscription confirmée : {titre}', bouton: 'Voir les détails',
      corps: ['Bonjour {prenom},', 'Vous êtes inscrite au showroom <strong>{titre}</strong>, le {date}, {lieu}.', 'Les pièces que vous avez sélectionnées seront préparées pour l\'essayage.'] },
    nl: { sujet: 'Inschrijving bevestigd: {titre}', bouton: 'Details bekijken',
      corps: ['Dag {prenom},', 'U bent ingeschreven voor de showroom <strong>{titre}</strong>, op {date}, {lieu}.', 'De stukken die u koos, worden klaargelegd om te passen.'] }
  },
  reservation_instantanee: {
    fr: { sujet: 'Nouvelle réservation instantanée : {titre}', bouton: 'Voir la réservation',
      corps: ['Bonjour {prenom},', 'Une cliente a réservé <strong>{titre}</strong> du {debut} au {fin} (événement le {evenement}). La réservation instantanée est activée sur cette pièce : elle est acceptée automatiquement.', 'Vous serez prévenue dès que le paiement sera effectué.'] },
    nl: { sujet: 'Nieuwe directe reservering: {titre}', bouton: 'Reservering bekijken',
      corps: ['Dag {prenom},', 'Een klant reserveerde <strong>{titre}</strong> van {debut} tot {fin} (evenement op {evenement}). Direct reserveren staat aan voor dit stuk: de reservering wordt automatisch aanvaard.', 'U wordt verwittigd zodra de betaling rond is.'] }
  },
  creneau_propose: {
    fr: { sujet: 'Créneau de remise proposé : {titre}', bouton: 'Répondre',
      corps: ['Bonjour {prenom},', 'Un créneau de remise vous est proposé pour <strong>{titre}</strong> : <strong>{creneau}</strong>.', 'Confirmez-le ou proposez-en un autre depuis votre espace.'] },
    nl: { sujet: 'Voorgesteld tijdstip voor de overhandiging: {titre}', bouton: 'Antwoorden',
      corps: ['Dag {prenom},', 'Er wordt een tijdstip voor de overhandiging voorgesteld voor <strong>{titre}</strong>: <strong>{creneau}</strong>.', 'Bevestig het of stel een ander voor vanuit uw ruimte.'] }
  },
  creneau_confirme: {
    fr: { sujet: 'Créneau de remise confirmé : {titre}', bouton: 'Voir la réservation',
      corps: ['Bonjour {prenom},', 'Le créneau de remise pour <strong>{titre}</strong> est confirmé : <strong>{creneau}</strong>.'] },
    nl: { sujet: 'Tijdstip van overhandiging bevestigd: {titre}', bouton: 'Reservering bekijken',
      corps: ['Dag {prenom},', 'Het tijdstip van overhandiging voor <strong>{titre}</strong> is bevestigd: <strong>{creneau}</strong>.'] }
  },
  admin_alerte: {
    fr: { sujet: '[{marque}] {titre}', bouton: 'Back-office', corps: ['{detail}'] },
    nl: { sujet: '[{marque}] {titre}', bouton: 'Back-office', corps: ['{detail}'] }
  }
};
