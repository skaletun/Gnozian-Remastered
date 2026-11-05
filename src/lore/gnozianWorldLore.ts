/**
 * Canon-lite world framing for Gnozian (strategy layer remains abstract).
 * Shown once per browser via world intro cutscene unless skipped.
 */

export type LoreChapter = { id: string; titleRu: string; titleEn: string; bodyRu: string; bodyEn: string };

export const GNOZIAN_WORLD_LORE: LoreChapter[] = [
  {
    id: 'epoch',
    titleRu: 'Эпоха раскола',
    titleEn: 'The Sundered Age',
    bodyRu:
      'После «Тихого обвала» небесные дороги погасли, а океаны поднялись на три локтя. Империи не исчезли — они сплющились до горизонта: каждая держава видит лишь свой клинок тумана и слышит чужие сигнальные огни как далёкий шёпот.',
    bodyEn:
      'After the Quiet Collapse, sky-ways went dark and the seas rose three hand-spans. Empires did not vanish—they flattened to the horizon: every power sees only its own fog-blade and hears rival beacon-fires as a distant murmur.',
  },
  {
    id: 'gnozian',
    titleRu: 'Кто такие гнозиане',
    titleEn: 'Who the Gnozians are',
    bodyRu:
      'Гнозиане — не раса и не культ, а уклад: тех, кто считает мир измеримым, но не исчерпаемым. Их города растут из камня и привычки; их наука пахнет чернилами и железом; их вера — это договор с неизвестным, подписанный ежедневным трудом.',
    bodyEn:
      'The Gnozians are neither a species nor a cult but a disposition: those who treat the world as measurable yet inexhaustible. Their cities grow from stone and habit; their science smells of ink and iron; their faith is a contract with the unknown, signed anew by daily labor.',
  },
  {
    id: 'hex',
    titleRu: 'Шестиугольная правда',
    titleEn: 'The hex truth',
    bodyRu:
      'Карта здесь — не украшение, а аргумент: шесть соседей, шесть путей, шесть рисков. Граница между «моим» и «чужим» — не линия на пергаменте, а видимость: туман войны скрывает не только врага, но и собственную жадность.',
    bodyEn:
      'The map is not ornament but argument: six neighbors, six routes, six risks. The line between mine and theirs is not ink on parchment but sight: the fog of war hides not only the foe but your own appetite.',
  },
  {
    id: 'player',
    titleRu: 'Ваша роль',
    titleEn: 'Your role',
    bodyRu:
      'Вы ведёте цивилизацию через столетия сжатых в ходы: исследование, дипломатия, чудеса и катастрофы — всё это нити одного гобелена. Победа — не наказание слабым, а точка, где ваш уклад становится историей мира.',
    bodyEn:
      'You steer a civilization across centuries folded into turns: research, diplomacy, wonders, and disasters are threads in one tapestry. Victory is not punishment for the weak but the moment your way of life becomes the world’s story.',
  },
];
