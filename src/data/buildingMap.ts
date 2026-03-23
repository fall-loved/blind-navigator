import { BuildingMap } from '@/types.ts';

// ==========================================
// 1. БАЗОВЫЕ УЗЛЫ (Вход, Фойе, Лестницы)
// ==========================================
const baseMap: BuildingMap = {
    'street': { id: 'street', name: 'Улица', floor: 0, description: 'Улица', edges: [] },
    'entrance': {
        id: 'entrance', name: 'Главный вход', floor: 1,
        gps: { lat: 55.1764, lng: 30.2241 },
        description: 'Вы у входа.',
        edges: [{ to: 'lobby_1', instruction: 'Пройдите прямо в фойе к лестнице.' }]
    },
    'lobby_1': {
        id: 'lobby_1', name: 'Фойе 1 этажа', floor: 1,
        description: 'Вы в главном фойе 1 этажа.',
        edges: [
            { to: 'entrance', instruction: 'Идите на выход из здания.' },
            { to: 'stairs_1', instruction: 'Подойдите к центральной лестнице.' }
        ]
    },
    'stairs_1': {
        id: 'stairs_1', name: 'Лестница 1 этаж', floor: 1,
        description: 'Вы у лестницы 1 этажа.',
        edges: [
            { to: 'lobby_1', instruction: 'Вернитесь в фойе.' },
            { to: 'stairs_2', instruction: 'Поднимитесь на 2 этаж.' }
        ]
    },
    'stairs_2': {
        id: 'stairs_2', name: 'Лестница 2 этаж', floor: 2,
        description: 'Вы на лестничной площадке 2 этажа.',
        edges: [
            { to: 'stairs_1', instruction: 'Спуститесь на 1 этаж.' },
            { to: 'stairs_3', instruction: 'Поднимитесь на 3 этаж.' }
        ]
    },
    'stairs_3': {
        id: 'stairs_3', name: 'Лестница 3 этаж', floor: 3,
        description: 'Вы на лестничной площадке 3 этажа.',
        edges: [
            { to: 'stairs_2', instruction: 'Спуститесь на 2 этаж.' }
        ]
    },
};

// ==========================================
// 2. ГЕНЕРАТОР КРЫЛЬЕВ
// ==========================================
type SegmentDef = { segmentId: string; name: string; rooms: number[] };

function buildWing(floor: number, startNodeId: string, segments: SegmentDef[]): BuildingMap {
    const map: BuildingMap = {};
    let prevNodeId = startNodeId;

    segments.forEach((seg, index) => {
        // Создаем сегмент коридора
        map[seg.segmentId] = {
            id: seg.segmentId,
            name: seg.name,
            floor: floor as 1 | 2 | 3,
            description: `Вы в коридоре: ${seg.name}.`,
            edges: []
        };

        // Привязываем путь назад
        map[seg.segmentId].edges!.push({ to: prevNodeId, instruction: 'Идите обратно по коридору.' });

        // Привязываем путь вперед (от старта или от прошлого сегмента)
        if (index === 0) {
            baseMap[startNodeId].edges!.push({ to: seg.segmentId, instruction: `Пройдите в ${seg.name}.` });
        } else {
            map[prevNodeId].edges!.push({ to: seg.segmentId, instruction: 'Идите дальше по коридору в следующую часть.' });
        }

        // Создаем кабинеты для этого сегмента
        seg.rooms.forEach(roomNum => {
            const roomId = `room_${roomNum}`;
            map[roomId] = {
                id: roomId,
                name: `Аудитория ${roomNum}`,
                floor: floor as 1 | 2 | 3,
                description: `Вы у аудитории ${roomNum}.`,
                edges: [{ to: seg.segmentId, instruction: 'Выйдите в коридор.' }]
            };

            // Добавляем дверь в коридор
            map[seg.segmentId].edges!.push({ to: roomId, instruction: `Аудитория ${roomNum} находится здесь.` });
        });

        prevNodeId = seg.segmentId;
    });

    return map;
}

// ==========================================
// 3. РАСПРЕДЕЛЕНИЕ АУДИТОРИЙ ПО СЕГМЕНТАМ
// ==========================================

// --- 1 ЭТАЖ (101-136) ---
const floor1LeftWing = buildWing(1, 'lobby_1', [
    { segmentId: 'c1_l1', name: 'Начало левого крыла (1 этаж)', rooms: [101, 102, 103, 104, 105, 106] },
    { segmentId: 'c1_l2', name: 'Середина левого крыла (1 этаж)', rooms: [107, 108, 109, 110, 111, 112] },
    { segmentId: 'c1_l3', name: 'Конец левого крыла (1 этаж)', rooms: [113, 114, 115, 116, 117, 118] }
]);

const floor1RightWing = buildWing(1, 'lobby_1', [
    { segmentId: 'c1_r1', name: 'Начало правого крыла (1 этаж)', rooms: [119, 120, 121, 122, 123, 124] },
    { segmentId: 'c1_r2', name: 'Середина правого крыла (1 этаж)', rooms: [125, 126, 127, 128, 129, 130] },
    { segmentId: 'c1_r3', name: 'Конец правого крыла (1 этаж)', rooms: [131, 132, 133, 134, 135, 136] }
]);

// --- 2 ЭТАЖ (200-206) ---
// Т-образная секция, компактное распределение у лестницы
const floor2Center = buildWing(2, 'stairs_2', [
    { segmentId: 'c2_c1', name: 'Центральный коридор (2 этаж)', rooms: [200, 201, 202, 203] },
    { segmentId: 'c2_c2', name: 'Боковое крыло (2 этаж)', rooms: [204, 205, 206] }
]);

// --- 3 ЭТАЖ (301-341) ---
const floor3LeftWing = buildWing(3, 'stairs_3', [
    { segmentId: 'c3_l1', name: 'Начало левого крыла (3 этаж)', rooms: [301, 302, 303, 304, 305] },
    { segmentId: 'c3_l2', name: 'Середина левого крыла (3 этаж)', rooms: [306, 307, 308, 309, 310] },
    { segmentId: 'c3_l3', name: 'Дальняя часть левого крыла (3 этаж)', rooms: [311, 312, 313, 314, 315] },
    { segmentId: 'c3_l4', name: 'Конец левого крыла (3 этаж)', rooms: [316, 317, 318, 319, 320] }
]);

const floor3RightWing = buildWing(3, 'stairs_3', [
    { segmentId: 'c3_r1', name: 'Начало правого крыла (3 этаж)', rooms: [321, 322, 323, 324, 325] },
    { segmentId: 'c3_r2', name: 'Середина правого крыла (3 этаж)', rooms: [326, 327, 328, 329, 330] },
    { segmentId: 'c3_r3', name: 'Дальняя часть правого крыла (3 этаж)', rooms: [331, 332, 333, 334, 335] },
    { segmentId: 'c3_r4', name: 'Конец правого крыла (3 этаж)', rooms: [336, 337, 338, 339, 340, 341] }
]);

// ==========================================
// 4. ИТОГОВЫЙ ЭКСПОРТ
// ==========================================
export const buildingMap: BuildingMap = {
    ...baseMap,
    ...floor1LeftWing,
    ...floor1RightWing,
    ...floor2Center,
    ...floor3LeftWing,
    ...floor3RightWing,
};