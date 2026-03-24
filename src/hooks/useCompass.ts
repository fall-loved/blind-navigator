import { useState, useEffect } from 'react';
import { Magnetometer } from 'expo-sensors';

export const useCompass = () => {
    const [heading, setHeading] = useState(0);

    useEffect(() => {
        Magnetometer.setUpdateInterval(500);
        const subscription = Magnetometer.addListener((data) => {
            // Истинный математический угол
            let mathAngle = Math.atan2(data.y, data.x) * (180 / Math.PI);

            // Конвертация в географический компас (0 - Север, 90 - Восток, 180 - Юг, 270 - Запад)
            let compassHeading = Math.round((90 - mathAngle + 360) % 360);

            setHeading(compassHeading);
        });
        return () => subscription.remove();
    }, []);

    return heading;
};