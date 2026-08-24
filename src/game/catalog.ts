import type { CharacterDefinition, CharacterId } from './types';

export const characterCatalog: Readonly<Record<CharacterId, CharacterDefinition>> = {
  base: {
    id: 'base',
    name: '기본 한별',
    assetPath: '/assets/character/jang-han-byeol-base.png',
    playLabel: '한별이를 탭해 별가루 받기',
  },
  pogo: {
    id: 'pogo',
    name: '스카이콩콩 한별',
    assetPath: '/assets/character/jang-han-byeol-pogo-stick.png',
    playLabel: '새우와 마늘 피하기',
  },
  udon: {
    id: 'udon',
    name: '튀김우동 한별',
    assetPath: '/assets/character/jang-han-byeol-tempura-udon.png',
    playLabel: '튀김우동 만들기',
  },
};

export const eggCharacterIds: readonly CharacterId[] = ['base', 'pogo', 'udon'];
