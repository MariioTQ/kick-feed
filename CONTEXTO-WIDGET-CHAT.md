# Encargo: widget de chat para OBS (Kick + Twitch)

Pega primero `CONTEXTO-PROYECTO.md` y luego este documento en el chat nuevo. Ahí está todo lo general: quién soy, cómo trabajamos, las reglas de seguridad y dónde vive cada cosa.

## Qué quiero

Quiero una página nueva del repo, `chat-obs.html`, publicada en GitHub Pages, para ponerla como fuente de navegador en mi OBS. Ese OBS corre en una PC de IRLHosting. La página muestra mi chat de Kick y el de Twitch juntos, con fondo transparente, y sí sale al aire, a diferencia de la guardia.

## Lo más importante: que no gaste

- El widget no debe llamar a mi servidor (Vercel) por cada mensaje, ni preguntarle cada pocos segundos.
- Se conecta directo, igual que ya lo hace `guardia.html`:
  - **Kick:** Pusher, `wss://ws-us2.pusher.com/app/<llave>?protocol=7&client=js&version=8.4.0&flash=false`, suscrito a `chatrooms.6635680.v2`, que es el chatroom de mi canal. El canal es `6692133` y su slug es `mariotq`.
  - **Twitch:** IRC anónimo, `wss://irc-ws.chat.twitch.tv:443`, con `NICK justinfan12345`, `CAP REQ :twitch.tv/tags twitch.tv/commands` y `JOIN #mariotq`.
- La llave de Pusher de Kick a veces cambia. Mi servidor ya la sabe sacar (`rtKeyGet()` en `api/[route].js`). Si hace falta, se puede crear una ruta pública chiquita que solo la regrese, con caché de 1 hora. Sería una sola llamada al cargar el widget, no por mensaje.
- Los emotes de 7TV, BetterTTV y FFZ se cargan una vez al abrir. En `index.html` ya están las funciones `tpLoad`, `tpLoadTw`, `tp7`, `tpB` y `tpF` para copiarlas.

## Lo que ya existe y se puede copiar de `index.html`

- **Emotes de Kick:** vienen como `[emote:ID:nombre]` y la imagen es `https://files.kick.com/emotes/ID/fullsize`.
- **Emotes de Twitch:** vienen en la etiqueta `emotes` del IRC. La imagen es `https://static-cdn.jtvnw.net/emoticons/v2/ID/default/dark/2.0`. Ver la función `frags()` en `guardia.html` y `emotes()` en `index.html`.
- **Emotes de 7TV:** si alguno no carga, se prueba en PNG y luego en GIF antes de dejar el nombre (función `kfEmFb`, v82).
- **Insignias de Kick:** los dibujos están en `KBADGE` y los nombres en `KBNAME`. La de sub sale de los badges de mi canal (`https://kick.com/api/v2/channels/mariotq`, campo `subscriber_badges`).
- **Insignias de Twitch:** la app las pide a `/api/tw?a=badges`, que necesita la clave. Para el widget habría que hacer una versión pública que solo regrese el mapa de imágenes, con caché.
- **Colores de nombre:** los de Kick vienen en `identity.color` y los de Twitch en la etiqueta `color`.
- **Marquitas K/T de plataforma:** función `pfChip`.

## Lo que el widget tiene que respetar (porque sale al aire)

- **Mensajes borrados:** si Kick o Twitch borran un mensaje, debe desaparecer del widget al momento.
  - En Kick: `MessageDeletedEvent`, `UserBannedEvent` y `ChatroomClearEvent`.
  - En Twitch: `CLEARMSG` y `CLEARCHAT`.
- **Antispam:** mi servidor borra el spam, pero tarda unos segundos. El widget debería filtrar igual que la guardia (`spamNorm` y `spamHit`), con la misma lista. Esa lista hoy solo se la da el servidor a la guardia con su token (`/api/chatin?a=cfg`), así que hay que decidir cómo dársela al widget sin exponer nada sensible.
- **Bots y comandos:** esconder los mensajes de los bots (botrix, kickbot, kicklet, blerp, tq_bot_irl, nightbot, streamelements) y los que empiezan con `!`. Que sea configurable.
- **Llaves:** nada de llaves en el link. El widget es público y solo lee.

## Lo que necesito decidir (pregúntamelo al empezar, con opciones)

1. Estilo: burbujas, renglones simples o tarjetas. Que combine con mis diseños Tarjetas, Cristal, Clásico o Grafito.
2. Tamaño de letra, ancho, y si los mensajes nuevos salen arriba o abajo.
3. Si los mensajes se desvanecen después de unos segundos y cuántos se quedan en pantalla.
4. Si muestra las marquitas K/T, las insignias y los emotes grandes cuando el mensaje es puro emote.
5. Si también muestra eventos (subs, Kicks, bits, raids) dentro del chat o solo mensajes.
6. Si quiero un «editor» tipo Alertas Studio para cambiarlo desde el celular, o solo parámetros en el link (por ejemplo `?estilo=burbuja&tam=18&fade=30`).

## Cómo entregarlo

Igual que siempre: el archivo nuevo `chat-obs.html` y, si hiciera falta, los cambios mínimos en `api/[route].js`. Probado con mensajes simulados de Kick y de Twitch. Al final, las instrucciones paso a paso para agregarlo en OBS: tamaño, «Actualizar el navegador cuando la escena se active», y sin CSS personalizado.
