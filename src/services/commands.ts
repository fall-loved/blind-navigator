import { CommandResult } from '@/types.ts';
import { buildingMap } from '@/data/buildingMap.ts';

const textToNumbers = (text: string): string => {
    return text
        .replace(/триста/g, '300').replace(/двести/g, '200').replace(/сто/g, '100')
        .replace(/одиннадцать/g, '11').replace(/двенадцать/g, '12').replace(/восемнадцать/g, '18')
        // ... здесь можно добавить больше замен, если STT будет ошибаться ...
        .replace(/\s+/g, ' '); // убираем лишние пробелы
};

export const parseCommand = (transcript: string): CommandResult => {
    const normalizedText = textToNumbers(transcript.toLowerCase());

    // 1. Отмена
    if (normalizedText.includes('отмена') || normalizedText.includes('стоп')) {
        return { action: 'CANCEL' };
    }

    // 2. Информация
    if (normalizedText.includes('где я') || normalizedText.includes('вокруг')) {
        return { action: 'INFO' };
    }

    // 3. Улица / Выход
    if (normalizedText.includes('выход') || normalizedText.includes('улица')) {
        return { action: 'NAVIGATE', targetId: 'entrance' };
    }

    // 4. УМНЫЙ ПОИСК АУДИТОРИЙ (Regex)
    // Ищет любую последовательность из трех цифр, начинающуюся на 1, 2 или 3 (этажи)
    const roomMatch = normalizedText.match(/(?:в|кабинет|аудитория)?\s*([1-3]\d{2})/);
    if (roomMatch) {
        const roomNumber = roomMatch[1]; // Например, "318"
        const targetRoomId = `room_${roomNumber}`;

        // Проверяем, существует ли такой кабинет в нашем графе
        if (buildingMap[targetRoomId]) {
            return { action: 'NAVIGATE', targetId: targetRoomId };
        } else {
            // Кабинет не найден на карте
            return { action: 'UNKNOWN' };
        }
    }

    // 5. Ручная привязка (для тестов или сбоя PDR)
    const floorMatch = normalizedText.match(/я на ([1-3]) этаже/);
    if (floorMatch) {
        const floor = floorMatch[1];
        return { action: 'SET_LOCATION', targetId: `stairs_${floor}` };
    }
    if (normalizedText.includes('у входа')) {
        return { action: 'SET_LOCATION', targetId: 'entrance' };
    }

    return { action: 'UNKNOWN' };
};