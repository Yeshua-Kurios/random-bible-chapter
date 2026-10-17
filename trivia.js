// Bible Trivia fact bank. Every card is a mini-lesson: the explanation
// (`why`) is always shown, whether or not the question was answered right.
//
// Card shape:
//   id      stable, unique — spaced-repetition progress is keyed on it, so
//           never rename or reuse an id.
//   tier    1 (warm-up) .. 5 (deep cut). Difficulty adapts to how you do.
//   cat     category label shown on the card.
//   q       the question.
//   answer  the correct answer.
//   wrong   exactly three plausible wrong answers.
//   why     the teaching text.
//   ref     optional scripture reference.
//   src     the extrabiblical text/inscription/excavation that corroborates it
//           (shown as "Evidence"). Required for prophecy cards.
//
// More cards live in trivia-*.js; each appends to TRIVIA_CARDS.
const TRIVIA_CARDS = [
  // --- Tier 1: warm-up
  {
    id: "shibboleth", tier: 1, cat: "Hebrew", ref: "Judges 12:5-6",
    q: "At the Jordan fords, the Gileadites tested fleeing Ephraimites by making them say which word?",
    answer: "Shibboleth",
    wrong: ["Hallelujah", "Selah", "Maranatha"],
    why: "Ephraimites couldn't pronounce the “sh” sound and said “sibboleth,” which gave them away; 42,000 fell that day. The word entered English meaning a test that reveals who belongs and who doesn't.",
  },
  {
    id: "pharaoh-great-house", tier: 1, cat: "Ancient Near East",
    q: "The Egyptian word behind “Pharaoh” (per-aa) originally meant what?",
    answer: "Great house",
    wrong: ["Son of the Sun", "Lord of Two Lands", "Living god"],
    why: "Per-aa meant the royal palace. Only from the New Kingdom (c. 1500s BCE) did it become a way of referring to the king himself, much as we say “the White House” or “the Crown.”",
  },
  {
    id: "talitha-koum-aramaic", tier: 1, cat: "Aramaic", ref: "Mark 5:41",
    q: "“Talitha koum” (“Little girl, get up”) preserves the actual words of Jesus in which language?",
    answer: "Aramaic",
    wrong: ["Hebrew", "Greek", "Latin"],
    why: "Aramaic was the everyday language of first-century Galilee. Mark keeps a few of Jesus' Aramaic phrases untranslated: talitha koum, ephphatha (Mark 7:34), abba, and “Eloi, Eloi, lama sabachthani.”",
  },
  {
    id: "maher-shalal-hash-baz", tier: 1, cat: "Hebrew", ref: "Isaiah 8:1-4",
    q: "Which is the longest personal name in the Hebrew Bible?",
    answer: "Maher-shalal-hash-baz",
    wrong: ["Chushan-rishathaim", "Zerubbabel", "Tiglath-pileser"],
    why: "Isaiah gave this name to his son. It means roughly “the spoil speeds, the plunder hastens” — a walking prophecy that Assyria would soon plunder Damascus and Samaria, before the boy could say “Mama.”",
  },
  {
    id: "psalm-119-stanzas", tier: 1, cat: "Hebrew", ref: "Psalm 119",
    q: "Psalm 119 is an acrostic with how many stanzas, each of 8 verses?",
    answer: "22 — one for each Hebrew letter",
    wrong: ["24 — one for each Greek letter", "26 — one for each English letter", "12 — one for each tribe"],
    why: "22 letters × 8 verses = 176 verses, making it the longest chapter in the Bible. Every line in a stanza begins with the same Hebrew letter, in alphabetical order.",
  },

  // --- Tier 2
  {
    id: "moses-egyptian-name", tier: 2, cat: "Ancient Near East", ref: "Exodus 2:10",
    q: "Where does the name “Moses” most likely come from linguistically?",
    answer: "Egyptian mose, “born of / child”",
    wrong: ["Akkadian musa, “to rescue”", "Sumerian mus, “serpent”", "Aramaic mosha, “shepherd”"],
    why: "Mose appears in Egyptian names like Thutmose (“born of Thoth”) and Ramesses (“born of Ra”). The Bible gives a Hebrew wordplay instead — “I drew him out” (mashah) — so the name carries both an Egyptian origin and a Hebrew pun.",
  },
  {
    id: "selah-habakkuk", tier: 2, cat: "Hebrew", ref: "Habakkuk 3",
    q: "“Selah” appears 71 times in the Psalms. In which other book does it appear?",
    answer: "Habakkuk",
    wrong: ["Isaiah", "Job", "Lamentations"],
    why: "Selah shows up three times in Habakkuk 3, which is itself labelled a prayer set to music. Nobody knows its exact meaning; it is probably a musical direction such as a pause, an interlude, or a lifting of voices.",
  },
  {
    id: "septuagint-72", tier: 2, cat: "Texts",
    q: "According to the Letter of Aristeas, how many scholars translated the Torah into Greek (the Septuagint)?",
    answer: "72",
    wrong: ["70", "12", "120"],
    why: "The tradition says six elders from each of the twelve tribes were brought to Alexandria under Ptolemy II in the 3rd century BCE. The name “Septuagint” (LXX) rounds the number to 70.",
  },
  {
    id: "jericho-tower", tier: 2, cat: "Archaeology",
    q: "About how old is the stone tower excavated at Tell es-Sultan (ancient Jericho)?",
    answer: "About 10,000 years old (c. 8000 BCE)",
    wrong: ["About 3,400 years old (Joshua's time)", "About 2,000 years old", "About 6,000 years old"],
    why: "Jericho's round stone tower, about 8.5 metres high, dates to the Pre-Pottery Neolithic period — among the oldest monumental structures ever found, thousands of years before any possible date for Joshua's conquest.",
  },
  {
    id: "hammurabi-susa", tier: 2, cat: "Ancient Near East", ref: "Exodus 21",
    q: "In 1901–02 the stele of Hammurabi's law code was unearthed at which city?",
    answer: "Susa",
    wrong: ["Babylon", "Nineveh", "Ur"],
    why: "Hammurabi set it up in Babylon around 1754 BCE, but an Elamite king carried it off to Susa as war loot centuries later. Its roughly 282 laws include “eye for an eye” penalties that parallel Exodus 21, though Israel's laws differ in important ways. It now sits in the Louvre.",
  },
  {
    id: "merneptah-stele", tier: 2, cat: "Archaeology",
    q: "Which Egyptian monument (c. 1208 BCE) contains the earliest known mention of “Israel” outside the Bible?",
    answer: "The Merneptah Stele",
    wrong: ["The Rosetta Stone", "The Narmer Palette", "The Palermo Stone"],
    why: "Pharaoh Merneptah boasts, “Israel is laid waste, his seed is no more.” Israel is written with the sign for a people rather than a city-state — evidence of a recognizable group in Canaan by then. Flinders Petrie found it at Thebes in 1896.",
  },
  {
    id: "cyrus-cylinder", tier: 2, cat: "Archaeology", ref: "Ezra 1:1-4",
    q: "The Cyrus Cylinder records Cyrus letting deported peoples do what, paralleling Ezra 1?",
    answer: "Return home and rebuild their sanctuaries",
    wrong: ["Take a census of their homelands", "Pay no tribute for seventy years", "Choose their own governors"],
    why: "It describes sending the gods' images back to their cities and letting displaced people return. It never mentions Jerusalem or the Jews by name, but it shows the policy Ezra describes was typical of Cyrus.",
  },
  {
    id: "tel-dan-stele", tier: 2, cat: "Archaeology",
    q: "The Tel Dan inscription (found 1993) is famous as the earliest outside mention of what?",
    answer: "The “House of David”",
    wrong: ["The name Yahweh", "Solomon's Temple", "The Exodus"],
    why: "This 9th-century BCE Aramaic inscription, probably set up by an Aramean king, boasts of defeating a king of Israel and a “king of the House of David” (bytdwd) — outside confirmation that David's dynasty was known as a real ruling house.",
  },
  {
    id: "maranatha", tier: 2, cat: "Aramaic", ref: "1 Corinthians 16:22",
    q: "“Maranatha” in Paul's Greek letter to Corinth is what?",
    answer: "An untranslated Aramaic phrase meaning “Our Lord, come!”",
    wrong: ["A Hebrew greeting meaning “peace be with you”", "A Greek hymn title", "A Latin creed"],
    why: "It can be read marana tha (“Our Lord, come!”) or maran atha (“Our Lord has come”). Greek-speaking Corinthians were using an Aramaic prayer, which shows how early it came from the Aramaic-speaking church.",
  },
  {
    id: "dss-great-isaiah", tier: 2, cat: "Texts",
    q: "The Great Isaiah Scroll from Qumran is roughly how much older than the oldest complete medieval Hebrew Bibles?",
    answer: "About 1,000 years",
    wrong: ["About 100 years", "About 300 years", "About 2,500 years"],
    why: "It dates to c. 125 BCE, while the Aleppo and Leningrad Codices are from about 930–1008 CE. The scroll is over seven metres long, and its text is remarkably close to the medieval one.",
  },

  // --- Tier 3
  {
    id: "tevah-two-uses", tier: 3, cat: "Hebrew", ref: "Exodus 2:3",
    q: "The Hebrew word for Noah's “ark” (tevah) is used for one other object in the Bible. Which?",
    answer: "The basket baby Moses was placed in",
    wrong: ["The chest holding the Ten Commandments", "Solomon's throne", "The altar of incense"],
    why: "Tevah is used only for Noah's vessel and Moses' papyrus basket — two rescues through water. The Ark of the Covenant is a different word, aron.",
  },
  {
    id: "tohu-bohu-jeremiah", tier: 3, cat: "Hebrew", ref: "Jeremiah 4:23",
    q: "Genesis 1:2's “formless and void” (tohu wabohu) is deliberately echoed in a vision of creation undone by which prophet?",
    answer: "Jeremiah",
    wrong: ["Ezekiel", "Joel", "Amos"],
    why: "Jeremiah sees the earth “formless and void” with no light in the heavens (Jer 4:23). The word bohu appears in just three places in the entire Bible: Genesis 1:2, Jeremiah 4:23, and Isaiah 34:11.",
  },
  {
    id: "gopher-wood-hapax", tier: 3, cat: "Hebrew", ref: "Genesis 6:14",
    q: "How many times does the Hebrew word gopher (“gopher wood”) appear in the Bible?",
    answer: "Once",
    wrong: ["Twice", "Seven times", "Forty times"],
    why: "It is a hapax legomenon — a word used only once — so nobody is sure what it means. Cypress is a common guess, but translators often just transliterate it.",
  },
  {
    id: "mene-tekel-weights", tier: 3, cat: "Aramaic", ref: "Daniel 5:25-28",
    q: "The words on Belshazzar's wall (mene, tekel, parsin) are probably what?",
    answer: "Units of weight and money: mina, shekel, half-mina",
    wrong: ["Names of three Babylonian kings who ruled in turn", "Names of three gods of the Chaldean pantheon", "Three months of the Babylonian calendar year"],
    why: "The writing reads like an inventory: a mina, a shekel, half-minas. Daniel turns each into a wordplay: numbered, weighed, divided — and parsin also puns on “Persians,” the people about to take Babylon.",
  },
  {
    id: "gilgamesh-flood-birds", tier: 3, cat: "Ancient Near East",
    q: "In Tablet XI of the Epic of Gilgamesh, the flood hero Utnapishtim sends out which three birds?",
    answer: "A dove, a swallow, and a raven",
    wrong: ["A dove, an eagle, and a hawk", "A raven, a crane, and an ibis", "Two doves and a sparrow"],
    why: "The tablet was found in Ashurbanipal's library at Nineveh and its flood story caused a sensation in 1872, when George Smith announced it. It resembles Genesis in some details, but older Mesopotamian flood stories such as Atrahasis exist too, and the theology differs sharply.",
  },
  {
    id: "siloam-inscription", tier: 3, cat: "Archaeology", ref: "2 Kings 20:20",
    q: "The Siloam Inscription (found 1880) in Hezekiah's Tunnel describes what?",
    answer: "Two teams digging toward each other and meeting",
    wrong: ["Hezekiah's tribute payment to the king of Assyria", "A list of the kings who had ruled Judah", "A treaty of alliance between Judah and Egypt"],
    why: "The tunnel is about 533 metres (1,750 ft) long and winds in an S-curve to bring water from the Gihon Spring inside the city walls. The inscription says the crews heard each other's picks and finally broke through.",
  },
  {
    id: "sennacherib-bird-in-cage", tier: 3, cat: "Archaeology", ref: "2 Kings 18-19",
    q: "Sennacherib's Prism says he shut Hezekiah up in Jerusalem like what?",
    answer: "A bird in a cage",
    wrong: ["A lion in a pit", "A fox in its den", "A lamb in a pen"],
    why: "He boasts of capturing 46 walled cities but, tellingly, doesn't claim to have taken Jerusalem — consistent with the Bible's account. Both sources agree on 30 talents of gold in tribute (the silver figures differ).",
  },
  {
    id: "lachish-reliefs", tier: 3, cat: "Archaeology",
    q: "Where did Sennacherib put carved wall reliefs showing his siege of Lachish (701 BCE)?",
    answer: "His palace at Nineveh",
    wrong: ["The temple at Karnak", "The Ishtar Gate in Babylon", "The palace at Persepolis"],
    why: "The Southwest Palace reliefs show the siege ramp, battering rams, and Judean captives — the best illustrated account of an ancient siege, and strong support for Lachish's fall. They are now in the British Museum.",
  },
  {
    id: "pilate-stone-prefect", tier: 3, cat: "Archaeology",
    q: "What title does the Caesarea inscription (found 1961) give Pontius Pilate?",
    answer: "Prefect of Judea",
    wrong: ["Procurator of Judea", "Governor-General of Syria", "Tetrarch of Judea"],
    why: "The stone reads Praefectus Iudaeae. Later writers like Tacitus called him “procurator,” a title that came into use after his time — so the stone corrects the later terminology.",
  },
  {
    id: "ketef-hinnom", tier: 3, cat: "Archaeology", ref: "Numbers 6:24-26",
    q: "The tiny silver scrolls from Ketef Hinnom (7th–6th century BCE) contain what text?",
    answer: "The Priestly Blessing (“The Lord bless you and keep you”)",
    wrong: ["The Ten Commandments (“You shall have no other gods”)", "The Shema (“Hear, O Israel”)", "Psalm 23 (“The Lord is my shepherd”)"],
    why: "Found in a burial cave in 1979, they are the earliest known quotation of biblical text — about 400 years before the Dead Sea Scrolls — and include the divine name YHWH. The thin silver had to be unrolled with great care.",
  },
  {
    id: "theopneustos-hapax", tier: 3, cat: "Greek", ref: "2 Timothy 3:16",
    q: "How many times does the Greek word theopneustos (“God-breathed”) appear in the New Testament?",
    answer: "Once",
    wrong: ["Three times", "Seven times", "Twelve times"],
    why: "It occurs only in 2 Timothy 3:16 and is very rare in Greek generally. The word emphasizes that Scripture comes from God's breath rather than from human ingenuity.",
  },
  {
    id: "raca-aramaic-insult", tier: 3, cat: "Aramaic", ref: "Matthew 5:22",
    q: "When Jesus warns against calling a brother “Raca,” what is raca?",
    answer: "An Aramaic insult, probably meaning “empty-head”",
    wrong: ["A Greek oath sworn by the temple altar", "A Hebrew curse formula used by priests", "A Latin slur used for conquered peoples"],
    why: "Matthew leaves the Aramaic insult untranslated. It is probably from reqa, “empty.” Jesus' point is that contempt and anger belong in the same category as murder.",
  },
  {
    id: "caiaphas-ossuary", tier: 3, cat: "Archaeology",
    q: "A Jerusalem burial box inscribed “Yehosef bar Qayafa” is widely thought to belong to whom?",
    answer: "The high priest who presided at Jesus' trial",
    wrong: ["Herod's chief steward in Jerusalem", "Nicodemus, the Pharisee who visited Jesus", "Annas, Caiaphas' father-in-law and predecessor"],
    why: "Found in 1990 in the Peace Forest, it matches Josephus, who calls the high priest “Joseph, called Caiaphas.” Most scholars accept the identification, though a few debate it.",
  },
  {
    id: "sargon-khorsabad", tier: 3, cat: "Archaeology", ref: "Isaiah 20:1",
    q: "Sargon II is named only once in the Bible. Critics doubted him until what was discovered?",
    answer: "His palace at Khorsabad (1843)",
    wrong: ["The Rosetta Stone, found in Egypt (1799)", "The Cyrus Cylinder, found at Babylon (1879)", "The Lachish ostraca, found at Tell ed-Duweir (1935)"],
    why: "Paul-Émile Botta uncovered Sargon's palace in 1843, with annals describing his conquest of Samaria (722/721 BCE). A king named once in the Bible turned out to be one of the best-documented Assyrian rulers.",
  },
  {
    id: "hittites-hattusa", tier: 3, cat: "Archaeology", ref: "Genesis 23",
    q: "Excavations in 1906 at Boğazköy (ancient Hattusa) revealed whose empire, which many scholars had doubted the Bible's Hittites could be linked to?",
    answer: "The Hittites, in Anatolia",
    wrong: ["The Philistines, in Crete", "The Hurrians, in Egypt", "The Amorites, in Arabia"],
    why: "Hugo Winckler found thousands of clay tablets from the Hittite capital. The Anatolian empire (c. 1650–1180 BCE) is well-attested, though the “sons of Heth” in Abraham's day may be a smaller, related group in Canaan.",
  },
  {
    id: "shishak-karnak", tier: 3, cat: "Archaeology", ref: "1 Kings 14:25",
    q: "At Karnak, Pharaoh Shoshenq I's list of conquered towns (c. 925 BCE) matches which biblical king of Egypt?",
    answer: "Shishak",
    wrong: ["Necho", "Tirhakah", "So"],
    why: "1 Kings 14:25 says Shishak attacked Jerusalem in Rehoboam's fifth year. The “Bubastite Portal” lists dozens of towns in Judah and Israel that Shoshenq claims to have raided.",
  },
  {
    id: "mesha-stele-omri", tier: 3, cat: "Archaeology", ref: "2 Kings 3",
    q: "The Mesha Stele (Moabite Stone, found 1868) says which Israelite king oppressed Moab?",
    answer: "Omri",
    wrong: ["David", "Jeroboam", "Ahaz"],
    why: "King Mesha of Moab says Omri “oppressed Moab many days,” until Mesha won independence. The stone also mentions Chemosh, Nebo, and “the vessels of YHWH” — the same conflict as 2 Kings 3 from the other side.",
  },
  {
    id: "black-obelisk-jehu", tier: 3, cat: "Archaeology", ref: "2 Kings 9-10",
    q: "On the Black Obelisk of Shalmaneser III, which Israelite king is shown paying tribute?",
    answer: "Jehu",
    wrong: ["Ahab", "Hezekiah", "Menahem"],
    why: "It's the only known contemporary picture of an Israelite king (or his envoy) from 841 BCE. The caption calls him “Jehu, son of Omri,” though Jehu wasn't actually Omri's son — Assyrians used “house of Omri” as a name for Israel.",
  },
  {
    id: "jehoiachin-rations", tier: 3, cat: "Archaeology", ref: "2 Kings 25:27-30",
    q: "Babylonian tablets list oil rations for “Yaukin, king of Yahud.” Who was he?",
    answer: "Jehoiachin of Judah",
    wrong: ["Zedekiah of Judah", "Hezekiah of Judah", "Manasseh of Judah"],
    why: "These palace records from about 592 BCE show Jehoiachin was still treated as a king in exile, matching the Bible's closing scene where he eats at the Babylonian king's table (2 Kings 25:27–30).",
  },

  // --- Tier 4
  {
    id: "belshazzar-coregent", tier: 4, cat: "Ancient Near East", ref: "Daniel 5:16",
    q: "What do Babylonian records show that explains Belshazzar offering Daniel “third ruler in the kingdom”?",
    answer: "He co-ruled while his father Nabonidus lived in Tayma",
    wrong: ["Three Persian satraps divided Babylon's rule", "Babylon had three joint kings at the time", "He was Nebuchadnezzar's son by a Persian wife"],
    why: "Nabonidus spent about ten years at Tayma while Belshazzar commanded in Babylon. That makes Belshazzar second in rule, so “third” is the highest position he could offer — a detail Greek historians didn't preserve.",
  },
  {
    id: "tehom-tiamat", tier: 4, cat: "Ancient Near East", ref: "Genesis 1:2",
    q: "The Hebrew tehom (“the deep,” Gen 1:2) is linguistically related to the name of which Babylonian figure?",
    answer: "Tiamat",
    wrong: ["Marduk", "Apsu", "Kingu"],
    why: "Tiamat is the salt-water goddess in Enuma Elish whom Marduk kills to make the world. Tehom is a cognate word, but Genesis has no battle — the deep is simply water God commands, which many see as a quiet polemic against Babylonian myth.",
  },
  {
    id: "arrabon-semitic", tier: 4, cat: "Greek", ref: "2 Corinthians 1:22",
    q: "Paul calls the Spirit an arrabōn (“down payment”). Where does this Greek word come from?",
    answer: "A Semitic word for a pledge (Hebrew ʿerabon)",
    wrong: ["A Latin word for a marriage gift (arra)", "Egyptian merchants' slang for a deposit", "A Persian term from royal tax law"],
    why: "ʿErabon is the pledge Judah left with Tamar — his seal, cord, and staff (Gen 38:17–20). Greek borrowed it for a deposit that guarantees the full payment; Modern Greek arravona now means an engagement ring.",
  },
  {
    id: "nero-666-616", tier: 4, cat: "Greek", ref: "Revelation 13:18",
    q: "Some early manuscripts read 616 instead of 666. A leading explanation is what?",
    answer: "Hebrew spellings of “Nero Caesar” with or without a final nun",
    wrong: ["Roman numeral miscounting by tired scribes copying Greek", "A deliberate change ordered by the Roman censors", "Spelling differences in the Latin name of Jerusalem"],
    why: "Nero Caesar spelled in Hebrew letters (nrwn qsr) adds to 666; dropping the final nun, as the Latin form does, gives 616. The 616 reading appears in Papyrus 115, a 3rd/4th-century manuscript.",
  },
  {
    id: "gezer-calendar", tier: 4, cat: "Archaeology",
    q: "The Gezer Calendar (10th century BCE) is a small limestone tablet in early Hebrew script. What does it list?",
    answer: "The agricultural seasons of the year",
    wrong: ["The kings of Israel, in order", "Temple tax rates, month by month", "A legal code on property and debt"],
    why: "It names periods like olive harvest, planting grain, and harvesting flax, in one of the oldest examples of Hebrew writing. It may be a schoolboy's exercise rather than an official record.",
  },
  {
    id: "kurkh-ahab-chariots", tier: 4, cat: "Archaeology",
    q: "Shalmaneser III's Kurkh Monolith says Ahab of Israel contributed what to the Battle of Qarqar (853 BCE)?",
    answer: "2,000 chariots and 10,000 soldiers",
    wrong: ["200 ships and 5,000 sailors", "500 elephants", "12,000 horsemen only"],
    why: "Ahab brought the largest chariot force in the coalition against Assyria — an event the biblical books never mention. It shows Israel was a major regional power, not the minor player Kings' summary might suggest.",
  },
  {
    id: "babylonian-chronicle-597", tier: 4, cat: "Archaeology", ref: "2 Kings 24:10-12",
    q: "The Babylonian Chronicle dates Nebuchadnezzar's capture of Jerusalem to “2 Adar.” In which year BCE?",
    answer: "597",
    wrong: ["586", "605", "722"],
    why: "2 Adar is 16 March 597 BCE, when Jehoiachin was taken to Babylon. The more famous 586 BCE is the later destruction of the city and temple under Zedekiah.",
  },
  {
    id: "amarna-abdi-heba", tier: 4, cat: "Ancient Near East",
    q: "In Amarna Letter EA 287, which city's king says his throne comes not from his parents but from “the strong arm of the king”?",
    answer: "Jerusalem",
    wrong: ["Megiddo", "Shechem", "Hazor"],
    why: "Abdi-Heba of Urusalim wrote to Pharaoh in the 14th century BCE, complaining about the Habiru. The letters show Canaan as a patchwork of city-states under Egyptian rule centuries before Israel's kings.",
  },
  {
    id: "ugarit-alphabet-30", tier: 4, cat: "Ancient Near East",
    q: "How many signs does the Ugaritic cuneiform alphabet have?",
    answer: "30",
    wrong: ["22", "24", "36"],
    why: "A farmer's plow struck a tomb at Ras Shamra in 1928, exposing the lost city of Ugarit. Its tablets, written in a wedge-shaped alphabet, were deciphered in months and gave us Canaanite religion and poetry closely related to biblical Hebrew.",
  },
  {
    id: "gallio-delphi", tier: 4, cat: "Archaeology", ref: "Acts 18:12",
    q: "Which inscription helps anchor Paul's timeline by dating Gallio's term as proconsul of Achaia to about AD 51–52?",
    answer: "A letter of Emperor Claudius found at Delphi",
    wrong: ["The Pilate Stone, found at Caesarea", "The Erastus pavement, found at Corinth", "The Res Gestae of Augustus, at Ankara"],
    why: "Acts 18 has Paul brought before Gallio in Corinth. The Delphi inscription gives the timing, which is one of the few firm dates in New Testament chronology.",
  },
  {
    id: "politarchs-thessalonica", tier: 4, cat: "Archaeology", ref: "Acts 17:6",
    q: "Luke calls Thessalonica's magistrates “politarchs,” a title missing from classical literature. How was it later confirmed?",
    answer: "Inscriptions naming politarchs, one at Thessalonica's Vardar Gate",
    wrong: ["A papyrus from Egypt listing the city's local magistrates", "A passage in Strabo's Geography about Macedonian cities", "A decree of the Roman Senate about Thessalonica's status"],
    why: "Dozens of inscriptions from Macedonia use the title, mostly from the Roman period. Luke's unusual term turned out to be exactly right for that region.",
  },

  // --- Tier 5
  {
    id: "epiousios-hapax", tier: 5, cat: "Greek", ref: "Matthew 6:11",
    q: "What is notable about epiousios, translated “daily” in “Give us this day our daily bread”?",
    answer: "No certain use of it is known outside the Lord's Prayer",
    wrong: ["It is a Latin word that Greek borrowed late", "Only Paul uses it anywhere else in his letters", "It unambiguously means “tomorrow's”"],
    why: "The early scholar Origen thought the evangelists coined it. Because no sure example exists elsewhere, its meaning — “daily,” “needed for today,” or “for the coming day” — is still debated.",
  },
  {
    id: "erastus-corinth", tier: 5, cat: "Archaeology", ref: "Romans 16:23",
    q: "A Corinth pavement reads that Erastus laid it at his own expense in return for his office. Which NT person is he often linked to?",
    answer: "Erastus, the city treasurer",
    wrong: ["Gaius, Paul's host", "Stephanas", "Crispus, the synagogue ruler"],
    why: "Romans 16:23 greets “Erastus, the city's director of public works,” and the inscription names an Erastus who held a similar post. The identification is plausible but debated since the name was common.",
  },
  {
    id: "pim-weight", tier: 5, cat: "Hebrew", ref: "1 Samuel 13:21",
    q: "What is a pim (1 Sam 13:21), a word that appears only once in the Bible?",
    answer: "A weight of about two-thirds of a shekel",
    wrong: ["A length of two-thirds of a cubit", "A coin worth a day's wages", "A measure of grain"],
    why: "Translators used to guess at it. Then inscribed weights marked pym — roughly 7.6 grams, about two-thirds of a shekel — turned up in Judean digs, confirming the meaning. The verse gives the price Israelites paid Philistine smiths to sharpen their tools.",
  },
  {
    id: "leviathan-lotan", tier: 5, cat: "Ancient Near East", ref: "Isaiah 27:1",
    q: "Isaiah 27:1 nearly quotes a Canaanite myth about a seven-headed sea serpent. What was its name in Ugaritic?",
    answer: "Lotan",
    wrong: ["Yam", "Mot", "Tannin"],
    why: "The Baal Cycle (c. 1200 BCE) calls Lotan “the fleeing serpent, the twisting serpent, the mighty one with seven heads.” Isaiah uses the same words for Leviathan — and says the Lord will punish him, treating the myth as a poetic image rather than a rival god.",
  },
  {
    id: "elephantine-sanballat-sons", tier: 5, cat: "Archaeology", ref: "Nehemiah 2:10",
    q: "A 407 BCE letter from the Jewish colony at Elephantine, Egypt, was copied to whose sons in Samaria?",
    answer: "Sanballat's",
    wrong: ["Tobiah's", "Geshem's", "Zerubbabel's"],
    why: "The Jews at Elephantine had a temple to “Yahu” that Egyptian priests destroyed, and appealed to the governor of Judah and to Sanballat's sons. Sanballat is Nehemiah's opponent in the Bible, so the letter independently confirms the name and the family's power.",
  },
  {
    id: "lachish-letter-azekah", tier: 5, cat: "Archaeology", ref: "Jeremiah 34:7",
    q: "Lachish Ostracon IV (c. 588 BCE) says the writer can no longer see the signals of which city?",
    answer: "Azekah",
    wrong: ["Hebron", "Ekron", "Gath"],
    why: "“We are watching for the signals of Lachish... for we cannot see Azekah.” Jeremiah 34:7 names Lachish and Azekah as the last fortified cities holding out against Babylon, and the letter reads like a snapshot of that final stand.",
  },
];

