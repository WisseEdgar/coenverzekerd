export type ClientType = 'private' | 'business' | undefined;

const PRIVATE_MD = `
## Vragenlijst 1 – Particuliere klant (intake)

A. Persoonlijke gegevens
1. Wat is uw volledige naam, geboortedatum en BSN?
2. Wat is uw woonadres en correspondentieadres (indien anders)?
3. Wat is uw burgerlijke staat en hoeveel personen telt uw huishouden (volwassenen/kinderen)?
4. Wat is uw (mobiele) telefoonnummer en e‑mailadres?

B. Beroep & inkomen
5. Wat is uw huidige beroep/functie en sinds wanneer oefent u deze uit?
6. Werkt u in loondienst, als zelfstandige of in een andere vorm (bijv. zzp, dga)?
7. Wat is uw bruto- en netto jaarinkomen, inclusief eventuele neveninkomsten?
8. Verwacht u binnen 3 jaar een wezenlijke verandering in uw inkomenssituatie (bv. pensioen, carrièreswitch)?

C. Woning & inboedel
9. Bent u eigenaar of huurder van de woning?
10. Bij eigendom: wat is de herbouwwaarde, het bouwjaar en het type constructie?
11. Wat is de hypotheekverstrekker en het openstaande hypotheekbedrag?
12. Heeft uw woning bijgebouwen (garage, schuur, zonnepanelen, laadpaal e.d.)?
13. Heeft u een recente taxatie of inventarislijst van de inboedel?

D. Voertuigen & mobiliteit
14. Welke voertuigen bezit of gebruikt u (auto, motor, scooter, e‑bike, boot, camper e.d.)?
15. Voor auto/motor: bouwjaar, cataloguswaarde, kilometrage per jaar en hoofdzakelijk gebruik (privé/zakelijk/woon‑werk)?
16. Wie zijn de regelmatige bestuurders en wat is hun schadeverleden (schadevrije jaren)?

E. Persoon & aansprakelijkheid
17. Heeft u een particuliere aansprakelijkheidsverzekering (AVP) en welke limieten gelden?
18. Zijn er huisdieren of bijzondere hobby’s (bijv. dronevliegen, jachtsport) die extra risico’s meebrengen?

F. Gezondheid & inkomensbescherming
19. Heeft u een arbeidsongeschiktheids- of ongevallenverzekering?
20. Lijdt u aan chronische aandoeningen of zijn er recente medische behandelingen geweest die relevant kunnen zijn?
21. Hoe lang kunt u financieel rondkomen bij langdurige ziekte of arbeidsongeschiktheid?

G. Reizen & recreatie
22. Hoe vaak en naar welke regio’s reist u gemiddeld per jaar?
23. Wenst u een doorlopend of kortlopend reis- en annuleringsproduct?
24. Heeft u kostbare hobby- of sportuitrusting die u meeneemt op reis?

H. Financiële verplichtingen & vermogensopbouw
25. Heeft u leningen, kredieten of leasecontracten?
26. Heeft u beleggingsrekeningen, lijfrenten of pensioenen buiten de collectieve regeling van uw werkgever?
27. Heeft u een testament of levenstestament?

I. Bestaande verzekeringen & claims
28. Welke verzekeringen heeft u momenteel lopen (maatschappij, polisnummer, dekking, premie)?
29. Heeft u in de afgelopen 5 jaar schades geclaimd of afgewezen claims gehad? Zo ja, wat waren de oorzaken en bedragen?

J. Doelen & risicobereidheid
30. Wat vindt u het belangrijkst: volledige zekerheid, een goede prijs‑kwaliteitverhouding of vooral lage premie?
31. Zijn er specifieke zorgen of gebeurtenissen die u nu extra wilt afdekken?
`;

const BUSINESS_MD = `
## Vragenlijst 2 – Zakelijke klant (intake)

A. Basisgegevens onderneming
1. Juridische naam, handelsnaam, KVK‑nummer en btw‑nummer?
2. Rechtsvorm (eenmanszaak, bv, vof, nv, stichting, coöperatie e.d.)?
3. Hoofdvestigingsadres en eventuele nevenlocaties of buitenlandse vestigingen?
4. Contactpersoon voor verzekeringszaken (naam, functie, telefoon, e‑mail)?
5. Oprichtingsjaar en kernactiviteiten (korte omschrijving van producten/diensten)?

B. Financiële kerncijfers
6. Jaaromzet, brutomarge en nettoresultaat over de laatste 3 boekjaren?
7. Balans­totaal en belangrijkste activa (gebouwen, inventaris, voorraden, vorderingen)?
8. Verwacht u in de komende 12–24 maanden majeure investeringen of groei?

C. Personeel & arbeidsomstandigheden
9. Aantal vaste medewerkers, flex/uitzendkrachten en zzp’ers; functiegroepen en risicovolle taken?
10. Beschikt u over een RI&E (Risico‑Inventarisatie & Evaluatie) en een up‑to‑date preventieplan?
11. Welke verzuimbegeleiding en arbodienst gebruikt u?
12. Zijn er bijzondere cao‑ of pensioenverplichtingen?

D. Bedrijfslocaties & gebouwen
13. Eigendom of huur van bedrijfspanden; bouwjaar, oppervlak, alarmsystemen, brand-/inbraakbeveiliging?
14. Opslag van gevaarlijke stoffen, batterijen of gasflessen?
15. Zijn er kritieke processen die afhankelijk zijn van één locatie (single point of failure)?

E. Inventaris, machines & bedrijfsmiddelen
16. Soort, aantal en nieuwwaarde van machines/gereedschappen; onderhoudsregime?
17. Heeft u kostbare of unieke bedrijfsmiddelen die periodiek elders (op locatie klant) worden gebruikt?
18. Maakt u gebruik van huur‑ of leaseapparatuur, en zo ja onder welke contractvoorwaarden?

F. Wagenpark & transport
19. Aantal bedrijfsauto’s, vrachtwagens, bestelbusjes, heftrucks; km/uur‑gebruik en bestuurders?
20. Eigen goederenvervoer, koeriersdiensten of vervoer onder CMR‑condities?

G. IT‑ en cyberrisico’s
21. Kernsystemen, cloud‑diensten en bedrijfskritische software?
22. Heeft u een ISMS of andere informatiebeveiligingscertificering (ISO 27001, NEN 7510 e.d.)?
23. Is er een back‑up en business‑continuity‑plan?
24. Zijn er incidenten geweest (datalekken, ransomware, phishing)?

H. Contractuele & juridische aspecten
25. Met welke typen contracten werkt u (leveringsvoorwaarden, SLA’s, NDA’s)?
26. Krijgt u boeteclausules of ‘hold harmless’ bepalingen opgelegd door opdrachtgevers?
27. Exporteert u goederen of diensten buiten de EU of naar sanctielanden?

I. Klanten, leveranciers & ketenafhankelijkheden
28. Grootste klanten (> 10% omzet) en afhankelijkheid daarvan?
29. Kritieke leveranciers of toeleveranciers op wie de continuïteit rust?
30. Heeft u contingency‑afspraken of alternatieve leveranciers?

J. Bestaande verzekeringen & schadehistorie
31. Overzicht lopende polissen (AVB, beroeps-/bestuurders­aansprakelijkheid, gebouwen, inventaris, bedrijfsschade, machinebreuk, transport, cyber, verzuim, WIA‑excedent, WEGAM/WSV, etc.) met limieten en premies.
32. Schadefrequentie en ‑omvang van de afgelopen 5 jaar (inclusief afgewezen claims).

K. Risicobeheersing & preventie
33. Welke preventieve maatregelen zijn reeds genomen (brandseparatie, sprinklers, screening personeel, ISO‑certificeringen)?
34. Heeft u een bedrijfscontinuïteits‑ of calamiteitenplan?

L. Toekomstplannen & risicobereidheid
35. Wat zijn de strategische doelen voor de komende 3–5 jaar (uitbreiding, overnames, internationalisatie)?
36. In welke mate bent u bereid eigen risico (retentie) te dragen om premie te verlagen?
37. Zijn er specifieke risico’s waarvoor u zich zorgen maakt of die opdrachtgevers eisen?
`;

export function getPreflightQuestionnaire(type: ClientType, contextNote?: string) {
  const header = contextNote ? `${contextNote}\n\n` : '';
  if (type === 'private') return header + PRIVATE_MD;
  if (type === 'business') return header + BUSINESS_MD;
  // Fallback: toon zakelijke lijst als indicatie, vraag om klanttype te bevestigen
  const intro = `Ik mis nog essentiële informatie. Is dit een particuliere of zakelijke klant? Kies het juiste type en beantwoord de bijbehorende vragen.`;
  return `${intro}\n\n${BUSINESS_MD}`;
}
