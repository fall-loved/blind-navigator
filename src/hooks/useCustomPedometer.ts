import { useEffect, useRef } from 'react';
import { Accelerometer } from 'expo-sensors';

export const useCustomPedometer = (isActive: boolean, onStep: () => void) => {
    const savedCallback = useRef(onStep);
    const lastStepTime = useRef(0);

    useEffect(() => {
        savedCallback.current = onStep;
    }, [onStep]);

    useEffect(() => {
        if (!isActive) return;

        Accelerometer.setUpdateInterval(100);

        const subscription = Accelerometer.addListener(({ x, y, z }) => {
            const magnitude = Math.sqrt(x * x + y * y + z * z);
            const now = Date.now();

            if (magnitude > 1.15 && now - lastStepTime.current > 400) {
                savedCallback.current();
                lastStepTime.current = now;
            }
        });

        return () => subscription.remove();
    }, [isActive]);
};