/**
 * Per-civilization first-contact dialogue (3 beats). Keys: firstContact.civ.{templateId}.{intro|voice|outro}
 * Template ids match CIV_TEMPLATES / civilizationIdentity.templateId.
 */
export const firstContactCivLocaleEn: Record<string, string> = {
  'firstContact.civ.roman_empire.intro':
    'Dispatches speak of eagle standards, paved ambition, and a senate that turns every rumor into law: the {civName} ({adjective}) have crossed from myth into your sight.',
  'firstContact.civ.roman_empire.voice':
    '{leader} offers measured words — peace as policy, war as accounting — and asks only which ledger you mean to keep with Rome.',
  'firstContact.civ.roman_empire.outro':
    'Their camps and cities now sit on your map like unfinished sentences. Trade, tribute, or trial by arms — the {adjective} story rarely stays quiet.',

  'firstContact.civ.chinese_dynasty.intro':
    'Smoke from kiln-fires, river junks, and brush-strokes of bureaucracy on silk: the {civName} ({adjective}) reveal themselves as a realm that measures eras, not moments.',
  'firstContact.civ.chinese_dynasty.voice':
    '{leader} listens as much as they speak — weighing your borders against grain stores, canals, and the patience of dynasties.',
  'firstContact.civ.chinese_dynasty.outro':
    'You now share a frontier with a power that thinks in centuries. Respect their rhythm, or learn how costly haste can be.',

  'firstContact.civ.greek_city_states.intro':
    'Where marble argues with the sea and every hilltop has an opinion — the {civName} ({adjective}) announce themselves with theater, rhetoric, and fleets.',
  'firstContact.civ.greek_city_states.voice':
    '{leader} frames your meeting as a dialogue for the ages: glory, justice, and insults delivered with exquisite grammar.',
  'firstContact.civ.greek_city_states.outro':
    'Their polis lights now glimmer on your charts. Expect sharp culture, sharper debates, and alliances that pivot on a single speech.',

  'firstContact.civ.egyptian_kingdom.intro':
    'Reeds, gold, and the slow brown thread of the river — the {civName} ({adjective}) rise from the floodplain like a promise the desert cannot break.',
  'firstContact.civ.egyptian_kingdom.voice':
    '{leader} speaks of balance: gifts for friends, curses for fools, and tombs long enough to remember every slight.',
  'firstContact.civ.egyptian_kingdom.outro':
    'The {adjective} crown is visible now. Treat their favor like water — scarce, precious, and capable of carving stone.',

  'firstContact.civ.arabian_caliphate.intro':
    'Caravans, minarets, and ink that travels faster than armies — the {civName} ({adjective}) arrive as faith, science, and commerce braided into one caravan road.',
  'firstContact.civ.arabian_caliphate.voice':
    '{leader} offers hospitality edged with curiosity: your gods, your goods, and the price of your honesty.',
  'firstContact.civ.arabian_caliphate.outro':
    'Their cities glow on your frontier. Trade may flourish here — but respect the laws written in both ledger and prayer.',

  'firstContact.civ.viking_norsemen.intro':
    'Salt-stung prows, rune-scarred shields, and laughter too loud for thin ice — the {civName} ({adjective}) mean you have neighbors who think storms are company.',
  'firstContact.civ.viking_norsemen.voice':
    '{leader} sizes you up like a harbor tide: come as trader or raider, but do not come as prey.',
  'firstContact.civ.viking_norsemen.outro':
    'Their longships now dot your horizon on the map. Coastal wealth will tempt them — guard your shores as carefully as your pride.',

  'firstContact.civ.aztec_empire.intro':
    'Sun-stone calendars, canal cities, and the bright feathers of warriors — the {civName} ({adjective}) step from legend into the blood-warm light of first contact.',
  'firstContact.civ.aztec_empire.voice':
    '{leader} speaks of cosmic dues: tribute, ritual, and the thin line between ally and offering.',
  'firstContact.civ.aztec_empire.outro':
    'Their realm is etched onto your map like a warning in jade. Honor their rites from a distance you can defend.',

  'firstContact.civ.mongol_horde.intro':
    'Horsehair banners, felt cities that vanish at dawn, and horizons that shrink — the {civName} ({adjective}) announce that distance is no longer safety.',
  'firstContact.civ.mongol_horde.voice':
    '{leader} smiles the way a storm smiles at a tent: brief shelter, then motion — always motion.',
  'firstContact.civ.mongol_horde.outro':
    'Their camps move faster than rumor. If you bargain, bargain from walls; if you fight, fight with supply lines in mind.',

  'firstContact.civ.inca_empire.intro':
    'Terraces climbing clouds, knots that keep secrets, and stone that outlasts kings — the {civName} ({adjective}) reveal a highland empire built on patience and potatoes.',
  'firstContact.civ.inca_empire.voice':
    '{leader} speaks softly of balance between peaks: your roads, your stores, and the debt you owe the mountains.',
  'firstContact.civ.inca_empire.outro':
    'Their high roads now thread your map. Trade can climb those heights — arrogance rarely does.',

  'firstContact.civ.persian_empire.intro':
    'Garden geometry, courier relays, and gold poured like sunlight — the {civName} ({adjective}) arrive as empire-as-hospitality, until the knives come out.',
  'firstContact.civ.persian_empire.voice':
    '{leader} offers you a seat beneath the awning: drink first, negotiate second, and remember who pours.',
  'firstContact.civ.persian_empire.outro':
    'Their satrapies glimmer on your charts. Diplomatic language will be exquisite; read the silences twice.',

  'firstContact.civ.babylonian_empire.intro':
    'Clay tablets, star-lore, and codes carved where everyone can see — the {civName} ({adjective}) meet you with laws older than your grudges.',
  'firstContact.civ.babylonian_empire.voice':
    '{leader} weighs your words on scales of precedent: what is written endures; what is whispered evaporates.',
  'firstContact.civ.babylonian_empire.outro':
    'Their cities mark your map like footnotes to history. Break a treaty here, and someone will carve your shame beside your name.',

  'firstContact.civ.japanese_empire.intro':
    'Lacquer, steel discipline, and islands that sharpen the wind — the {civName} ({adjective}) appear as a blade half-drawn: courtesy forward, intent unreadable.',
  'firstContact.civ.japanese_empire.voice':
    '{leader} bows before they strike — a lesson in timing you would be wise to study.',
  'firstContact.civ.japanese_empire.outro':
    'Their banners now edge your known world. Small slights linger long; clarity and respect buy you years.',

  'firstContact.civ.french_empire.intro':
    'Cannons dressed as philosophy, salons that plot revolutions between desserts — the {civName} ({adjective}) stride onto your stage with ambition measured in cannonades.',
  'firstContact.civ.french_empire.voice':
    '{leader} offers glory on installment: reforms today, borders redrawn tomorrow, invoices whenever convenient.',
  'firstContact.civ.french_empire.outro':
    'Their tricolor ambitions stain the map. Treat flattery as strategy, not friendship — unless you enjoy surprises.',

  'firstContact.civ.british_empire.intro':
    'Tea-steam over navy lists, factories coughing coal, and maps drawn in confident ink — the {civName} ({adjective}) arrive carrying both ledger and fleet.',
  'firstContact.civ.british_empire.voice':
    '{leader} speaks of interests, not moods: trade routes, buffer states, and the polite fiction called neutrality.',
  'firstContact.civ.british_empire.outro':
    'Their ports blink on your coastline. Partnership pays — until your independence becomes inconvenient.',

  'firstContact.civ.spanish_empire.intro':
    'Crosses, caravels, and a hunger for horizons — the {civName} ({adjective}) appear with faith in one hand and conquest in the other, often swapping hands mid-sentence.',
  'firstContact.civ.spanish_empire.voice':
    '{leader} blesses your meeting, then asks what you are willing to confess — in gold, souls, or territory.',
  'firstContact.civ.spanish_empire.outro':
    'Their missions and mines now dot your map. Bargain with open eyes: zeal and profit rarely travel alone.',

  'firstContact.civ.ethiopian_kingdom.intro':
    'Highland winds, ancient thrones, and faith worn like armor — the {civName} ({adjective}) emerge as a kingdom that survived empires by refusing to kneel.',
  'firstContact.civ.ethiopian_kingdom.voice':
    '{leader} speaks with quiet steel: independence is not pride, it is practice.',
  'firstContact.civ.ethiopian_kingdom.outro':
    'Their high passes now mark your frontier. Ally in good faith — they remember friends and forgive little.',
};

export const firstContactCivLocaleRu: Record<string, string> = {
  'firstContact.civ.roman_empire.intro':
    'В донесениях — орловые штандарты, мощёные дороги и сенат, превращающий слухи в законы: {civName} ({adjective}) выходят из мифа в поле вашего зрения.',
  'firstContact.civ.roman_empire.voice':
    '{leader} говорит размеренно: мир как политика, война как счёт — и спрашивает, какую книгу расходов вы ведёте с Римом.',
  'firstContact.civ.roman_empire.outro':
    'Их лагеря и города на карте — как недосказанные фразы. Торговля, дань или испытание мечом — {adjective} история редко замирает.',

  'firstContact.civ.chinese_dynasty.intro':
    'Дым печей, речные джонки и бюрократия, выведенная кистью на шёлке: {civName} ({adjective}) — держава, меряющая эпохи, а не мгновения.',
  'firstContact.civ.chinese_dynasty.voice':
    '{leader} слушает не меньше, чем говорит — взвешивая ваши границы против амбаров, каналов и терпения династий.',
  'firstContact.civ.chinese_dynasty.outro':
    'Теперь вы соседствуете с силой, мыслящей столетиями. Уважайте их ритм — или узнайте цену поспешности.',

  'firstContact.civ.greek_city_states.intro':
    'Где мрамор спорит с морем, а на каждом холме — своё мнение: {civName} ({adjective}) объявляют о себе театром, риторикой и флотами.',
  'firstContact.civ.greek_city_states.voice':
    '{leader} оформляет встречу как диалог на века: слава, справедливость и оскорбления с безупречной грамматикой.',
  'firstContact.civ.greek_city_states.outro':
    'Огни их полисов мерцают на ваших картах. Ждите острой культуры, острых дебатов и союзов, что ломаются от одной речи.',

  'firstContact.civ.egyptian_kingdom.intro':
    'Тростник, золото и медленная нить реки: {civName} ({adjective}) поднимаются с поймы, как обетовование, которое пустыня не может разрушить.',
  'firstContact.civ.egyptian_kingdom.voice':
    '{leader} говорит о равновесии: дары друзьям, проклятия глупцам и гробницы, где помнят каждую обиду.',
  'firstContact.civ.egyptian_kingdom.outro':
    '{adjective} венец теперь виден. Цените их расположение как воду — редкую, драгоценную и способную высечь камень.',

  'firstContact.civ.arabian_caliphate.intro':
    'Караваны, минареты и чернила, бегущие быстрее армий: {civName} ({adjective}) — вера, наука и торговля, сплетённые в одну дорогу.',
  'firstContact.civ.arabian_caliphate.voice':
    '{leader} дарит гостеприимство, остриённое любопытством: ваши боги, ваши товары и цена вашей честности.',
  'firstContact.civ.arabian_caliphate.outro':
    'Их города горят на границе. Торговля здесь может цвести — но уважайте законы и устава, и молитвы.',

  'firstContact.civ.viking_norsemen.intro':
    'Солёные носы ладий, щиты с рунами и смех слишком громкий для тонкого льда: {civName} ({adjective}) — соседи, для которых шторм — компания.',
  'firstContact.civ.viking_norsemen.voice':
    '{leader} оценивает вас как прилив в гавани: приди торговцем или налётчиком — только не добычей.',
  'firstContact.civ.viking_norsemen.outro':
    'Их драккары теперь на горизонте карты. Береговое богатство манит их — берегите берега так же, как честь.',

  'firstContact.civ.aztec_empire.intro':
    'Камни календаря, города на каналах и перья воинов: {civName} ({adjective}) выходят из мифа в зной первого контакта.',
  'firstContact.civ.aztec_empire.voice':
    '{leader} говорит о долге перед солнцем: дань, обряд и тонкая грань между союзником и даром богам.',
  'firstContact.civ.aztec_empire.outro':
    'Их царство на карте — как предупреждение в нефрите. Уважайте их обряды с дистанции, которую можете защитить.',

  'firstContact.civ.mongol_horde.intro':
    'Конские хвосты на штандартах, войлочные города на рассвете и сжимающийся горизонт: {civName} ({adjective}) — дистанция больше не укрытие.',
  'firstContact.civ.mongol_horde.voice':
    '{leader} улыбается, как шторм палатке: ненадолго приют — потом движение, всегда движение.',
  'firstContact.civ.mongol_horde.outro':
    'Их стан движется быстрее слухов. Если торгуете — из-за стен; если воюете — думайте об обозах.',

  'firstContact.civ.inca_empire.intro':
    'Террасы к облакам, узлы-письмена и камень, переживающий королей: {civName} ({adjective}) — высогорная империя терпения и картофеля.',
  'firstContact.civ.inca_empire.voice':
    '{leader} тихо говорит о равновесии между вершинами: ваши пути, запасы и долг, который вы должны горам.',
  'firstContact.civ.inca_empire.outro':
    'Их высокие дороги теперь на карте. Торговля может подняться туда — гордыня редко.',

  'firstContact.civ.persian_empire.intro':
    'Сады-геометрия, курьеры и золото, льющееся как свет: {civName} ({adjective}) — империя-гостеприимство, пока не блеснут ножи.',
  'firstContact.civ.persian_empire.voice':
    '{leader} сажает вас под навесом: сначала пейте, потом торгуйте — и помните, кто наливает.',
  'firstContact.civ.persian_empire.outro':
    'Их сатрапии мерцают на картах. Дипломатическая речь будет изящна — перечитывайте паузы дважды.',

  'firstContact.civ.babylonian_empire.intro':
    'Глиняные таблички, звёздные знания и законы, высеченные для всех: {civName} ({adjective}) встречают вас правом старше ваших обид.',
  'firstContact.civ.babylonian_empire.voice':
    '{leader} взвешивает слова на весах прецедента: записанное остаётся; шёпот испаряется.',
  'firstContact.civ.babylonian_empire.outro':
    'Их города на карте — как сноски к истории. Сорвите договор — и кто-то высечет позор рядом с вашим именем.',

  'firstContact.civ.japanese_empire.intro':
    'Лак, стальная дисциплина и острова, что затачивают ветер: {civName} ({adjective}) — клинок наполовину вынут: вежливость впереди, замысел нечитаем.',
  'firstContact.civ.japanese_empire.voice':
    '{leader} кланяется раньше, чем бьёт — урок времени, который стоит выучить.',
  'firstContact.civ.japanese_empire.outro':
    'Их знамёна теперь на краю известного мира. Мелкие обиды живут долго; ясность и уважение покупают годы.',

  'firstContact.civ.french_empire.intro':
    'Пушки в философской обёртке, салоны, где революции чертят между десертами: {civName} ({adjective}) выходят на сцену с амбицией в саженях ядра.',
  'firstContact.civ.french_empire.voice':
    '{leader} предлагает славу в рассрочку: реформы сегодня, границы завтра, счета — когда удобно.',
  'firstContact.civ.french_empire.outro':
    'Их триколорные амбиции пятнают карту. Лесть — стратегия, не дружба, если не любите сюрпризы.',

  'firstContact.civ.british_empire.intro':
    'Пар над списками флота, фабрики и карты уверенной чертой: {civName} ({adjective}) приходят с бухгалтерией и эскадрой.',
  'firstContact.civ.british_empire.voice':
    '{leader} говорит об интересах, а не настроениях: пути, буферы и вежливая выдумка под названием нейтралитет.',
  'firstContact.civ.british_empire.outro':
    'Их порты мигают на побережье. Партнёрство окупается — пока ваша независимость не станет неудобной.',

  'firstContact.civ.spanish_empire.intro':
    'Кресты, каравеллы и жажда горизонтов: {civName} ({adjective}) — вера в одной руке, завоевание в другой, часто меняя руки на полуслове.',
  'firstContact.civ.spanish_empire.voice':
    '{leader} благословляет встречу и спрашивает, что вы готовы исповедать — в золоте, душах или землях.',
  'firstContact.civ.spanish_empire.outro':
    'Их миссии и рудники на карте. Торгуйте с открытыми глазами: рвение и выгода редко ходят поодиночке.',

  'firstContact.civ.ethiopian_kingdom.intro':
    'Ветер нагорий, древние троны и вера как броня: {civName} ({adjective}) — царство, пережившее империи, отказавшись преклониться.',
  'firstContact.civ.ethiopian_kingdom.voice':
    '{leader} говорит тихой сталью: независимость — не гордость, а привычка.',
  'firstContact.civ.ethiopian_kingdom.outro':
    'Их высокие перевалы теперь на границе. Союз заключайте честно — они помнят друзей и мало прощают.',
};
