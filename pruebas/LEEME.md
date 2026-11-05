# Pruebas

Sirven para revisar que nada se rompió antes de subir cambios. No se publican en Vercel (ver `.vercelignore` en la raíz).

## Cómo correrlas

1. `cd pruebas`
2. `npm install`
3. `npx playwright install chromium`
4. `node correr.js` (o `node correr.js servidor`, `node correr.js app`, `node correr.js app v82`)

Si ya tienes un Chromium instalado, puedes usarlo con `CHROMIUM=/ruta/al/chromium`.

## Qué hay

- `servidor/`: prueban `api/[route].js`, `api/alertas.js` y `api/brb.js`. Simulan Kick, Twitch, Ably, Telegram y Upstash (una base falsa en el puerto 7701). No usan internet ni llaves reales.
- `app/`: abren `index.html`, `guardia.html`, `alertas-player.html`, `subgoal.html` y `brb-player.html` en Chromium, con el servidor simulado.

Cada archivo es de una versión (por ejemplo `harness30.js` y `v82b.js` son de la v82). Cuando cambia algo a propósito, se actualiza lo que espera la prueba vieja, y cada versión nueva lleva su propia prueba nueva.
