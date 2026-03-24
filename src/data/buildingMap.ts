import { BuildingMap } from '@/types.ts';

export const defaultBuildingMap: BuildingMap = {
    'fire_door': {
        id: 'fire_door', name: 'Противопожарная дверь', floor: 2,
        aliases: ['дверь', 'противопожарная', 'выход на лестницу', 'лестница'],
        description: 'Вы у противопожарной двери около лестницы ЛК2.',
        edges: [
            // Коридор теперь 90 (Восток)
            { to: 'corridor_start', instruction: 'Пройдите через дверь в коридор.', distance: 1.3, bearing: 90, side: 'прямо' }
        ]
    },
    'corridor_start': {
        id: 'corridor_start', name: 'Начало коридора (у кухни)', floor: 2,
        aliases: ['начало коридора', 'коридор у кухни'],
        description: 'Вы в начале коридора.',
        edges: [
            // Возврат к двери: 270 (Запад)
            { to: 'fire_door', instruction: 'Вернитесь к противопожарной двери.', distance: 1.3, bearing: 270, side: 'прямо' },

            // Вход в комнаты: 180 (Юг). Двери СПРАВА по ходу движения (если идем на 90).
            { to: 'room_34', instruction: 'Поверните к санузлу.', distance: 1.3, bearing: 180, side: 'справа' },
            { to: 'room_32', instruction: 'Поверните к кухне.', distance: 1.3, bearing: 180, side: 'справа' },

            // Идем дальше по коридору: 90 (Восток)
            { to: 'corridor_end', instruction: 'Идите прямо по длинному коридору.', distance: 13.0, bearing: 90, side: 'прямо' }
        ]
    },
    'room_34': {
        id: 'room_34', name: 'Санузел (34)', floor: 2,
        aliases: ['34', 'санузел', 'туалет'],
        description: 'Вы у санузла.',
        edges: [
            // Возврат в коридор: 0 (Север)
            { to: 'corridor_start', instruction: 'Выйдите в коридор.', distance: 1.3, bearing: 0 }
        ]
    },
    'room_32': {
        id: 'room_32', name: 'Кухня (32)', floor: 2,
        aliases: ['32', 'кухня'],
        description: 'Вы у кухни.',
        edges: [{ to: 'corridor_start', instruction: 'Выйдите в коридор.', distance: 1.3, bearing: 0 }]
    },
    'corridor_end': {
        id: 'corridor_end', name: 'Конец коридора (у 27)', floor: 2,
        aliases: ['конец коридора', 'дальний коридор'],
        description: 'Вы в конце коридора левого крыла.',
        edges: [
            // Возврат по длинному коридору: 270 (Запад)
            { to: 'corridor_start', instruction: 'Идите обратно по длинному коридору.', distance: 13.0, bearing: 270, side: 'прямо' },

            // Дверь 27-й: 0 (Север). Дверь СЛЕВА по ходу движения.
            { to: 'room_27', instruction: 'Подойдите к двери комнаты 27.', distance: 1.3, bearing: 0, side: 'слева' }
        ]
    },
    'room_27': {
        id: 'room_27', name: 'Комната 27', floor: 2,
        aliases: ['27', 'комната 27', 'комната 213'],
        description: 'Вы у дальней комнаты 27.',
        edges: [
            // Из комнаты в коридор: 180 (Юг)
            { to: 'corridor_end', instruction: 'Выйдите в коридор.', distance: 1.3, bearing: 180 }
        ]
    }
};