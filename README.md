Как запустить?

1. Установить NodeJS
2. Скачать проект
3. npm install -g eas-cli #качаем утилиту для компиляции
4. https://expo.dev/services регаемся тут
5. eas login Входим в свой аккаунт с сайты выше
5.1 Так же нужны android sdk и ndk, можно просто поставить android studio 
5.2 eas build -p android --profile development --local #в корне проекта (папка где лежит App.tsx) собираем apk для отладки и молитесь, чтобы он не падал
   или
6. eas build -p android --profile development  #собрать в облаке, но очередь может занимать до часа
7. установить собранный apk
8. npx expo start #Запускаем сервер и сканируем qr в приложении на телефоне
