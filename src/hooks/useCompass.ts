import { useState, useEffect } from 'react';
import { Magnetometer } from 'expo-sensors';

export const useCompass = () => {
    const [heading, setHeading] = useState(0);

    useEffect(() => {
        Magnetometer.setUpdateInterval(500);
        const subscription = Magnetometer.addListener((data) => {
            let mathAngle = Math.atan2(data.y, data.x) * (180 / Math.PI);

            let compassHeading = Math.round((90 - mathAngle + 360) % 360);

            setHeading(compassHeading);
        });
        return () => subscription.remove();
    }, []);

    return heading;
};