export interface AvatarPreset {
  id: string;
  label: string;
  src: string;
}

export const avatarPresets: AvatarPreset[] = [
  { id: 'boy_1', label: 'ولد ١', src: '/avatars/boy_1.svg' },
  { id: 'boy_2', label: 'ولد ٢', src: '/avatars/boy_2.svg' },
  { id: 'boy_3', label: 'ولد ٣', src: '/avatars/boy_3.svg' },
  { id: 'boy_4', label: 'ولد ٤', src: '/avatars/boy_4.svg' },
  { id: 'girl_1', label: 'بنت ١', src: '/avatars/girl_1.svg' },
  { id: 'girl_2', label: 'بنت ٢', src: '/avatars/girl_2.svg' },
  { id: 'girl_3', label: 'بنت ٣', src: '/avatars/girl_3.svg' },
  { id: 'girl_4', label: 'بنت ٤', src: '/avatars/girl_4.svg' },
];

export const avatarById = new Map(avatarPresets.map((item) => [item.id, item]));
