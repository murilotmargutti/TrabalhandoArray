// Paletas dos temas de ilha.
//
// Na Fase 0 elas servem para dois propósitos: validar como as cores realmente
// aparecem no painel da TV (que satura bem mais que um monitor de PC) e provar
// que trocar tema em tempo real é barato.
//
// Ordem dos tipos de bloco (índice = valor do voxel):
//   0 ar, 1 grama, 2 terra, 3 pedra, 4 areia, 5 água, 6 tronco, 7 folhas
export const BLOCK = {
  AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, SAND: 4, WATER: 5, LOG: 6, LEAVES: 7,
};

export const BLOCK_COUNT = 8;

export const THEMES = [
  {
    name: 'Cerejeira',
    sky: [0.98, 0.85, 0.90],
    fog: [0.99, 0.90, 0.93],
    colors: {
      1: [0.98, 0.68, 0.80], // "grama" de pétalas
      2: [0.62, 0.44, 0.42],
      3: [0.72, 0.68, 0.76],
      4: [0.99, 0.93, 0.85],
      5: [0.62, 0.82, 0.95],
      6: [0.55, 0.38, 0.40],
      7: [0.99, 0.74, 0.86],
    },
  },
  {
    name: 'Praia',
    sky: [0.60, 0.85, 0.97],
    fog: [0.80, 0.93, 0.98],
    colors: {
      1: [0.55, 0.83, 0.52],
      2: [0.70, 0.55, 0.38],
      3: [0.78, 0.76, 0.72],
      4: [0.98, 0.92, 0.72],
      5: [0.35, 0.78, 0.90],
      6: [0.60, 0.44, 0.28],
      7: [0.42, 0.74, 0.45],
    },
  },
  {
    name: 'Nuvem',
    sky: [0.72, 0.80, 0.98],
    fog: [0.88, 0.92, 1.00],
    colors: {
      1: [0.90, 0.93, 1.00],
      2: [0.76, 0.80, 0.92],
      3: [0.66, 0.72, 0.88],
      4: [0.97, 0.97, 1.00],
      5: [0.70, 0.86, 0.99],
      6: [0.72, 0.70, 0.86],
      7: [0.83, 0.88, 1.00],
    },
  },
  {
    name: 'Floresta Mágica',
    sky: [0.36, 0.30, 0.58],
    fog: [0.52, 0.44, 0.72],
    colors: {
      1: [0.38, 0.72, 0.60],
      2: [0.36, 0.28, 0.40],
      3: [0.46, 0.40, 0.60],
      4: [0.80, 0.74, 0.62],
      5: [0.48, 0.60, 0.95],
      6: [0.40, 0.30, 0.46],
      7: [0.60, 0.44, 0.86],
    },
  },
  {
    name: 'Doceria',
    sky: [1.00, 0.90, 0.72],
    fog: [1.00, 0.94, 0.82],
    colors: {
      1: [0.98, 0.55, 0.62],
      2: [0.68, 0.42, 0.30],
      3: [0.96, 0.88, 0.80],
      4: [0.99, 0.85, 0.55],
      5: [0.72, 0.90, 0.92],
      6: [0.58, 0.36, 0.26],
      7: [0.99, 0.72, 0.80],
    },
  },
];
