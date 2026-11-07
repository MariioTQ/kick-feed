# CLAUDE.md · Kick Feed de MarioTQ

Este archivo es la memoria del proyecto para Claude Code. Léelo completo antes de tocar algo. Los otros chats donde se hizo la app (hasta la v82) ya no existen: aquí está todo lo que hace falta para seguir como si fuera el mismo chat.

## Quién soy y cómo hablarme

Soy Mario (MariioTQ, cuenta `mariotq` en Kick y Twitch). Soy streamer IRL y no soy programador, así que no sé código.

- Háblame solo en español sencillo y dame pasos claros. Explica sin tecnicismos y sin pegarme código, salvo que te lo pida.
- Los resúmenes van en prosa (párrafos), no en viñetas.
- Pido varios cambios juntos del mismo tema. Prefiero una sola entrega cuando todo está listo y probado.
- No gastes de más: no reescribas archivos completos, edita solo lo necesario, y no corras todas las pruebas si solo cambiaste una parte (corre las de esa parte más las de la versión anterior).
- Al final de cada entrega dime en prosa qué cambió, qué tengo que hacer yo (si hay algo) y 2 o 3 ideas nuevas numeradas, siguiendo la lista de abajo.

## Qué es la app

Es mi propio sistema para streams en Kick y Twitch (a veces multistream), al estilo de IRL Plus Chat y StreamBuddy. La uso en el celular, dentro de IRL Plus Chat como «browser source», y en el navegador. Tiene:

- **Feed de eventos:** subs, regaladas, Kicks, bits, raids, follows, recompensas, encuestas, predicciones, Hype Train y anuncios.
- **Chat:** Kick y Twitch juntos, con emotes de 7TV, BTTV y FFZ, y lector de voz.
- **Atajos:** control de OBS y mensajes al chat.
- **Reglas automáticas:** «cuando pase X, haz Y».
- **Comandos para mods.**
- **Alertas propias:** Alertas Studio y su player.
- **Meta de subs:** letrero para OBS.
- **BRB:** clips cuando se cae la señal.
- **Antispam.**
- **Aviso en Telegram** cuando prendo.
- **Guardia del chat:** vive en mi OBS.

## Dónde vive cada cosa

- **Repo:** `MariioTQ/kick-feed` (público). Las páginas salen por GitHub Pages en `https://mariiotq.github.io/kick-feed/`.
- **Servidor:** Vercel, proyecto `kick-feed-mariotq`, equipo «TQ» (slug `tq19`), plan Hobby gratis. Dominio: `https://kick-feed-mariotq.vercel.app`. Vercel publica solo con cada cambio en `main`.
- **Base de datos:** Upstash Redis, Pay as You Go ($0.20 por cada 100 mil comandos, sin gratis). Cada comando cuesta, así que hay que cuidarlos.
- **Tiempo real:** Ably, plan gratis (6M mensajes y 200 conexiones). Hoy usamos alrededor del 3 %.
- **OBS:** 24/7 en una PC Windows en la nube de IRLHosting, con NOALBS. El servidor le habla por OBS WebSocket; la dirección y la contraseña van cifradas en la base (`obs`).
- **Streamer.bot:** está en esa misma PC, pero lo quiero dejar porque su conexión con Kick se cae seguido (tengo que cerrar y volver a iniciar sesión de Kick en Streamer.bot) y si no me doy cuenta, deja de funcionar. Ver «Decisiones».

## Cómo se trabaja ahora (Claude Code)

1. Trabaja en una rama. Antes de subir a `main`, corre las pruebas de lo que cambiaste (ver `pruebas/LEEME.md`). **Cuando todo pase, súbelo a `main` tú solo, sin preguntarme** (decidido por mí el 6 nov 2026): al subir, Vercel y GitHub Pages publican al momento. Después explícame en prosa qué hiciste.
2. Con cada versión nueva, sube `VERSION` en `index.html` (por ejemplo `'83 · 10 nov 2026'`). Si cambias `guardia.html`, sube también `VER` en `guardia.html` y `GUARD_VER` en `api/[route].js` al mismo número: con eso el servidor actualiza sola la guardia en OBS.
3. **Cuidado con el nombre:** el archivo del servidor se llama `api/[route].js`, con corchetes. Si se renombra o pierde los corchetes, todo el servidor se cae (ya pasó dos veces cuando yo subía a mano por la web de GitHub).
4. Los comentarios del código van en español, con la versión: `// v82: …`. Así se ve cuándo cambió cada cosa.
5. Para revisar si todo está bien en producción: en la app, ⚙ → Servidor y diagnóstico → «Revisar todo» (`/api/health`).

## Reglas de seguridad (no se negocian)

- El repo es público. Nunca pongas llaves, tokens, contraseñas, IPs ni links con `?key=` en el código, en commits, en este archivo ni en mensajes.
- Las llaves van solo en las variables de Vercel:
  - `KICK_CLIENT_ID`, `KICK_CLIENT_SECRET`
  - `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`
  - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
  - `KV_REST_API_URL`, `KV_REST_API_TOKEN` (o las `UPSTASH_*`)
  - `ABLY_API_KEY`
  - Opcionales: `KICK_CHANNEL`, `KICK_CHATROOM`, `KICK_CHANNEL_ID`, `TWITCH_CHANNEL`, `TWITCH_LOGIN`.
- **La clave de mis celulares** (`?key=` en el link de la app, `feedkey` en la base) es para todo lo que cambia cosas: OBS, chat, título, alertas, reglas y la lista de eventos. Los links que la traen no se enseñan en stream.
- **Lo público, sin clave,** es solo lo que necesitan OBS e IRL Plus Chat: el player de alertas, el letrero (solo totales), la voz de las alertas (con límites), el permiso de Ably de solo escuchar (`/api/rt`) y el ping de Ably.
- **La guardia** usa otro token (`chatw:tok`, `?w=` en su link), que se puede regenerar desde la app.
- Con Kick y Twitch se usan solo las APIs oficiales con OAuth. Nunca la sesión de mi cuenta de kick.com ni APIs internas (ver «Decisiones»).

## Archivos

**Raíz (GitHub Pages):**

- `index.html`: la app, un solo archivo de unas 9,700 líneas con todo el CSS y el JS. Está hecha a mano, sin framework. Tiene diseños Tarjetas, Cristal, Clásico y Grafito (este lo agregó otra IA en la v81).
- `rt.js`: cliente de Ably compartido (`KFRT.start({api, on, state, log})`).
  - Carga el SDK 2.29.0 de jsdelivr, con unpkg de respaldo.
  - Antes de dejar de preguntar al servidor, confirma con un «ping» por Ably que de verdad le llegan los avisos.
  - Si algo falla, se rearma solo y vuelve a preguntar como antes.
- `guardia.html`: la guardia del chat. Es una fuente de navegador escondida en OBS, en su escena «Guardia del chat», que nunca sale al aire.
  - Lee Kick por Pusher (`chatrooms.6635680.v2` y `channel.6692133`) y Twitch por IRC anónimo.
  - Ve las raids, recompensas y resubs compartidas de Kick, y la escena de OBS (`window.obsstudio`).
  - Manda todo a `/api/chatin` en tandas: cada ~20 s, al momento si es un comando de mod o spam, y cada 55 s el «sigo viva».
  - Mientras funciona, el servidor apaga los webhooks de chat de Kick y Twitch (eran una llamada a Vercel por mensaje). Si se cae, los vuelve a prender.
  - Desde la v82 también es el puente opcional a Streamer.bot (`ws://127.0.0.1:8080`, `?sb=0` lo apaga).
- `alertas.html`: Alertas Studio. `alertas-player.html`: el player (OBS e IRL Plus Chat). `alertas-comun.js`: código compartido de las alertas y la voz.
- `subgoal.html`: letrero de la meta (`?estilo=anillo|barra|bloques`, `?pf=tw`, `?meta=10`).
- `brb.html`: BRB Studio. `brb-player.html`: el player de clips en OBS.
- `chat-obs.html`: widget de chat Kick + Twitch para OBS (sí sale al aire). Lee directo de Pusher e IRC como la guardia; al servidor solo le pide una vez `/api/chatobs`. Opciones por el link (`?tam=`, `?fade=`, `?max=`, `?prueba=1`…).

**`api/` (funciones de Vercel):**

- `[route].js`: casi todo el servidor (~3,200 líneas). Rutas por `req.query.route`:
  - `webhook` (Kick), `twhook` (Twitch EventSub)
  - `events`, `list`, `channel`, `categories`
  - `mod` (moderar en Kick), `chat` (escribir)
  - `obs`, `rules`, `modcmd`, `moments`, `goal`, `viewers`, `chatters`, `prefs`, `spam`
  - `chatin` (guardia), `chatobs` (widget de chat, público), `health`, `rt` (Ably), `realtime`
  - `rewards` (v84: recompensas y canjes; v88: `vipgive` / `vipoff` desde la hoja del usuario), `kick` (v84: permisos de tu cuenta de Kick; v88: anuncios con `a=ads|adstart|adenroll`)
  - `key` (v88: «Cambiar mi clave» desde la app, solo POST con la clave actual)
  - `tw` (todo lo de Twitch con `?a=`: status, now, send, mod, chan, cats, poll, pred, ads, badges, clips…)
  - `login` / `callback` (Kick OAuth con PKCE), `twlogin` / `twcallback`, `status`, `debug` (con clave)
- `alertas.js`: alertas y voz (`?a=cfg|f|fdel|fire|poll|save|skip|test|tts|up|object`).
- `brb.js`: el BRB.
- `_rt.js`: publicar en Ably. El guion bajo es para que Vercel no lo convierta en ruta. **v88: dos canales.** `kf` es el público (los letreros de OBS lo escuchan sin clave): `goal`, `al`, `alcfg`, `brb`, `ping` y solo los `ev` que necesitan los letreros (`EV_PUB`: sub, resub, gift, kicks, bits, raid, follow, reward, live). `kfp` es el privado (solo con tu clave, `/api/rt?key=`): todos los `ev` y `tw`, `sync`, `obs`, `rw` (v84: canjes pendientes) y `kad` (v88: anuncio de Kick). `rt.js` recibe `key` y escucha los dos; la app no repite eventos porque los filtra por id.

**`pruebas/`:** las pruebas automáticas (ver su `LEEME.md`). No se publican en Vercel (`.vercelignore`).

## Cómo está armado el ahorro (no romperlo)

- Los webhooks de Kick y Twitch llegan aunque la app esté cerrada. El servidor publica cada evento una vez en Ably. Los celulares, alertas, letrero y BRB solo preguntan de respaldo: cada 60 s en vivo y cada 5 min sin stream.
- La guardia manda el chat en tandas y el chat se guarda en tandas (`chatKeep` / `chatFlush`, un ZADD cada ~20 s).
- Con cada mensaje casi no se toca la base: el antispam corre en memoria, y los comandos, el plan y las reglas solo consultan la base cuando hace falta.
- Cachés en memoria por instancia (por ejemplo `RLC`, `MCC`, `SBUP`, `CWT`). En Vercel puede haber varias instancias a la vez, así que lo que no debe pasar dos veces se asegura con `SET … NX EX` en Redis.
- `later(p)` usa `waitUntil` de Vercel: contesta rápido y lo demás sigue en segundo plano. En las pruebas locales no hay `waitUntil`, así que se espera.
- Uso aproximado: Vercel ~20 % del plan gratis, Upstash centavos al mes, Ably ~3 %.

## Llaves importantes de Redis

- **Cuentas:**
  - `tok`: token de Kick, se renueva solo.
  - `tw:tok` y `tw:bot`: Twitch (mi cuenta y el bot `tq_bot_irl`).
  - `feedkey`: la clave de mis celulares.
- **Eventos y chat:**
  - `ev`: zset de eventos del feed.
  - `chat`: zset con los últimos 500 mensajes.
  - `chatters`: set de quién ya ha escrito.
  - `live`, `session`, `tw:live`, `tw:session`: si estoy en vivo.
- **Configuración:**
  - `rules` y `rulelog`: reglas.
  - `modcmds` y `cmdlog`: comandos; adentro van los comandos que trae la app, en `bi.mom` y `bi.plan`.
  - `spam` y `spamlog`: antispam.
  - `al:cfg`, `alq`, `alf:*`: alertas, la fila y su huella anti doble.
  - `obs`: conexión cifrada. `obs:sc`: última escena, para las reglas de escena.
- **Guardia:**
  - `chatw:tok`, `chatw:hb` (el «sigo viva», con `sb.up`), `chatw:hooks`.
- **v81 y v82:**
  - `vipx`: zset `tw:<id>:<login>` o `kick:<user>`, con la fecha en que se acaba el VIP.
  - `sbq`: fila para Streamer.bot.
  - `ca:<pf>:<víctima>`: contra ataque pendiente.
  - `emo:<pf>`: hasta cuándo dura el modo solo emotes.
  - `plan` y `plancd:*`: el plan del día.
- **v87:**
  - `vipq:<llave de vipx>`: ese VIP lo quitaste tú a mano («Quitar ya»): no se anuncia «se terminó tu VIP».
  - `toprot`: `{ users:[…], mods:true }`, a quién no le cae la recompensa de timeout (además de los protegidos de cada regla).
  - `ttsbl`: lista negra del TTS por recompensa (nombres en minúsculas).
- **v88:**
  - `k:ads`: cómo están tus anuncios de Kick (guardado 60 s; 15 s si hay uno corriendo; 5 min si falta el permiso).
  - `feedkeyAt`: cuándo se hizo tu clave actual.

## Recompensas y canjes (v84, cómo están hechas)

- ⚙ → En vivo → 🎯 Recompensas (`index.html`, página `rwm`). Ruta `/api/rewards` (con clave): `list`, `pend`, `save`, `del`, `res` (✓/✕) y `copy` («Pasar esta recompensa a la app»).
- Solo APIs oficiales: Kick `/public/v1/channels/rewards…` y Twitch `/helix/channel_points/custom_rewards…`. Solo se cambian (y se aceptan o rechazan sus canjes) las que creó la app; las demás salen con 🔒. «Pasar a la app» crea una igual, apagada y con «(app)» en el nombre.
- Canjes pendientes: llegan por los avisos oficiales (Kick `channel.reward.redemption.updated`, nuevo en `EVENTS`, `SUBS_VER` 5; Twitch `…redemption.add` con `status: unfulfilled` y `…redemption.update`, `TW_SUBS_VER` 2). Salen en el feed con ✓ / ✕ (Kick como evento `rwpend`; Twitch en la misma línea del canje con `pend`), en la barra (🎯, `pRwp`, se puede mover o mandar a ⋯) y en Ajustes. Se quitan solos si se resuelven en Kick o en Twitch.
- El aviso de canjes de Kick también corre tus reglas «Canjean una recompensa» (misma huella `rf:` que la guardia y la app: una sola vez).
- Redis: `rwmine` (ids de las que creó la app), `rwp` (zset de pendientes, máx. 100, los de más de 3 días no salen), `rwpAt` (cuándo cambió; sale en `/api/events` como `rwa`). Ably: mensaje `rw`.
- v84 también arregló `rwRefund` de Kick: Kick manda en `data` la lista de los que NO pudo (antes decía «Te devolví tus puntos» aunque no se hubieran devuelto).

## Encuestas, predicciones y anuncios (v88)

- Ya no hay 🟣 en la barra. La página «📊 Encuestas y anuncios» (panel `twm`, `openTwPage`) está en ⚙ → Recompensas y encuestas, en el 📺 de la barra y como paso de atajo.
- **Anuncios de Kick (API oficial, permisos `ads:read ads:write`):** `GET /public/v1/ads/ad-break-status`, `POST /public/v1/ads/ad-break` (`break_duration_seconds` de 7 a 90 y un `id` uuid), `POST /public/v1/ads/enroll` (solo fuera de vivo). Funciones `kickAds`, `kickAdStart`, `kickAdEnroll`, errores en español en `KAD_ERR`. Kick no avisa por webhook: `/api/events` trae `kad` solo con tu clave y en vivo en Kick (de `k:ads`, o le pregunta a Kick si no hay nada guardado). Al lanzar uno se avisa por Ably (`kad`).
- En la app: `KAD`, `kAdLeft`, `kadSet`, `adNow`. La ventanita del anuncio (`adStrip`) y el 📺 de la barra sirven para Kick y Twitch («Anuncio en Kick» / «Anuncio en Twitch»). El de Kick sale aunque no uses Twitch.
- **Encuestas y predicciones:** solo Twitch. Kick no las tiene en su API oficial (ver «Decisiones»).
- **Pasos de atajo (solo atajos, no reglas ni comandos):** `polls` (abrir la página), `poll` (`text`, `ops` «Tacos, Pizza», `dur`), `pred` (`text`, `r1`, `r2`, `win`), `ad` (`pf` auto/kick/tw/both, `sec`; en Kick máximo 90 s; pide otro toque por defecto).

## Reglas automáticas (cómo están hechas)

- Viven en el servidor: `cleanRule`, `ruleHit`, `ruleVars`, `fillVars`, `ruleExec` y `rulesOn`. Los pasos de OBS se hacen por una sola conexión; los mensajes al chat los manda mi cuenta (o el bot en Twitch).
- **Eventos:**
  - `sub`, `resub`, `gift`, `kicks`, `follow`, `live`, `off`
  - `cat`, `catoff`, `reward`, `host`
  - `bits`, `hype`, `adstart` (solo Twitch)
  - `scene` (v82: «OBS cambia a una escena», lo detecta la guardia)
- **Plataforma:** cada regla tiene `pf`: `'kick'`, `'tw'` o vacío (las dos). Las de escena mandan el mensaje a donde esté en vivo (`'both'`, `'kick'`, `'tw'` o `'none'`).
- **Pasos:** los de los atajos (`CMD_STEPS`), más los extras de `RULE_XSTEPS`. Solo con recompensa: `vip`, `to` (timeout a quien escriban, con protegidos y contra ataque), `ca`, `hl` (destacar) y `rtts` (v87: 🔊 TTS, lee su mensaje en tu OBS por el player de alertas; `who:1` = «Fulano dice:»). En cualquier regla: `emo` (solo emotes) y `sb` (acción de Streamer.bot). Los ejecuta el objeto `XSTEP`. **Ojo:** `tts` (sin r) es otro paso, el del lector de voz del celular en los Atajos.
- **Escena (v87):** la regla tiene `to` (a qué chat va el mensaje): vacío = donde estés en vivo, `kick`, `tw` o `both`. Cuenta como en vivo si Kick o Twitch lo dicen o si OBS está transmitiendo (`on` de la guardia). El nombre se compara sin mayúsculas, espacios ni emojis («Offline» = «OFFLINE 📵»). Si no se manda el mensaje, el evento del feed trae `note` con el porqué. En la app, la opción sale aunque Twitch esté apagado en ese celular.
- **Timeout (v87):** además de los protegidos de cada regla, `toprot` (⚙ → Recompensas): tu lista y, si `mods` está prendido, cualquiera con insignia de mod en el chat reciente o en la lista de Comandos para mods (`isModName`). Si canjean contra un protegido, se le devuelven los puntos.
- **TTS por recompensa (v87):** el paso `rtts` manda a la fila de alertas (`alq` + Ably `al`) un aviso `k:'tts'` que el player lee con la voz y el filtro de Alertas (`ttsPlay`). Si quien canjea está en `ttsbl`: no suena, se le devuelven los puntos y en el chat: «@nombre por ahora no puedes usar el TTS por mal uso». Se agrega a la lista negra en ⚙ → Recompensas o tocando su nombre en el chat.
- **Variables:** `{nombre} {cantidad} {meses} {recompensa} {mensaje} {categoria} {titulo} {plataforma} {escena}`. `{mensaje}` (lo que escribe la gente) nunca se repite en el chat, salvo con `hl`, que quita links y comandos.
- **▶ Probar** (`action:'test'`) hace lo de OBS de verdad, pero no manda nada al chat ni silencia a nadie.

## Decisiones tomadas (no volver a discutirlas sin razón nueva)

- **Sesión de Kick («modo Kick.bot») — decidido por mí en la v82, hecho en la v85.** La API oficial de Kick no tiene VIP ni modos del chat; como Kick.bot, mi servidor usa la sesión de MI cuenta de kick.com. Yo la decidí y la pego yo; no la vuelvas a discutir ni a quitar.
  - **Probado desde Vercel (v85):** kick.com sí le contesta a Vercel si NO te haces pasar por navegador. Con un `User-Agent` de Chrome, Cloudflare bloquea («Request blocked by security policy»). Con el de `fetch` normal, `GET /api/v2/channels/mariotq` da 200 y la API interna contesta 401 sin sesión (o sea, no hay bloqueo).
  - **Dónde vive:** ⚙ → Plataformas → «🔐 Sesión de Kick». Ruta `/api/kweb` (con clave): `status`, `set` (prueba la sesión y, si Kick la reconoce, la guarda), `test`, `del`. Se guarda cifrada con `obsSeal` en `kick:web`; su estado en `kick:webst` (`ok:false` = vencida). Nunca regresa al celular ni sale en logs. `kwNorm` acepta el valor tal cual sale de la cookie (con `%7C`) y quita «Bearer».
  - **Funciones del servidor:** `kwCall(method, path, body)` (base `https://kick.com`, `Authorization: Bearer`), `kwOn()`, `kwCheck()` (valida con `GET` a la lista de VIP), `kwWatch()` (la guardia la dispara: revisa cada hora, `KW_WATCH_MS`), `kwDead()` (avisa UNA vez en el feed con el evento `kweb`; no por Telegram, porque ese grupo es público).
  - **Qué hace con ella:** VIP (`vipGive`/`vipSweep`: `POST`/`DELETE /api/internal/v1/channels/{slug}/community/vips`; si ya era VIP a mano no se le pone fecha); solo emotes (`PUT /api/v2/channels/{slug}/chatroom` con `emotes_mode`); devolver puntos (`/api/v2/channels/{slug}/redemptions/reject` con `redemption_ids`); recompensas de Kick que no creó la app (cambiar, borrar, aceptar y rechazar sus canjes: si la API oficial dice 403 o `NOT_OWNED`, se reintenta con la sesión) y en la lista todas salen sin candado.
  - **Sin sesión o vencida:** todo vuelve a lo de antes (VIP y solo emotes de Kick por Streamer.bot con el puente de la guardia, si existe).
  - **Encuestas y predicciones de Kick (v89):** ruta `/api/kpoll` (con clave): `now`, `poll`, `pollEnd`, `pred`, `lock`, `win`, `cancel`. Direcciones: `GET/POST/DELETE /api/v2/channels/{slug}/polls` (crear: `title`, `options` de 2 a 6, `duration` en segundos de [30,120,180,240,300], `result_display_duration`), `GET …/predictions/latest`, `POST …/predictions` (`title`, `outcomes` 2, `duration` en segundos), `PATCH …/predictions/{id}` con `state` `LOCKED`, `RESOLVED` + `winning_outcome_id` o `CANCELLED`. Probado desde Vercel: sin sesión contestan 401, sin bloqueo. La UI está en ⚙ → Encuestas y anuncios (`kpHtml`/`kpBind`/`kpLoad`). Pruebas: `harness36.js` y `v89.js`.
  - Otras direcciones que sirven con la sesión (todavía sin usar): OG y moderadores (`…/community/ogs`, `…/community/moderators`), modos `subscribers_mode`, `slow_mode` + `message_interval`, `followers_mode` + `following_min_duration`. Kick.bot es AGPL-3.0: solo se tomaron las direcciones, no su código.
- **Streamer.bot:** quiero dejar de usarlo. Cuando funcione la sesión de Kick, el VIP y solo emotes de Kick pasan a la app (en `vipGive` y `XSTEP.emo`, en lugar de `sbJob`). El puente de la v82 (guardia → Streamer.bot) se puede quitar después; mientras no esté conectado, no gasta.
- **Devolver puntos / aceptar y rechazar canjes con la API oficial:** tanto Kick (`NOT_OWNED`) como Twitch solo dejan manejar los canjes de recompensas creadas por la misma app (el mismo client id). En Kick se resuelve con la sesión (arriba). En Twitch, las que creé en el panel o con Streamer.bot no se pueden; las nuevas hay que crearlas desde la app.
- **Encuestas y predicciones de Kick (v88):** la API oficial de Kick no las tiene. Hacerlas con la sesión de kick.com y direcciones internas no se hizo (Claude Code no construye esa parte). Si Kick las abre en su API oficial, se agregan en la página «📊 Encuestas y anuncios».
- **7TV:** la app busca mis emotes con mi id de usuario de Kick (`kick_user_id`; en 7TV mi conexión de Kick es `6786072`) y con el room-id de Twitch (`135201683`). Las imágenes son `https://cdn.7tv.app/emote/<id>/1x.webp`, y si fallan se prueba en `.png` y luego en `.gif` (`kfEmFb`). En la v82 reporté recuadros blancos, pero no se pudo reproducir: el CDN contestó bien.

## Pendiente (empieza por aquí)

1. ~~**Botón para volver a conectar Kick**~~ **hecho en v84.** ⚙ → Plataformas → Kick dice qué permisos faltan (`/api/kick`, compara `SCOPES` con `tok.scope`) y abre `/api/login`. «Revisar todo» también avisa (`kscope`).
2. ~~**Sesión de Kick («modo Kick.bot»)**~~ **hecho en v85** (lo hizo el chat de Cowork, no Claude Code). Ver «Sesión de Kick (v85)» en «Decisiones».
3. **Sección «🎯 Recompensas»** — **hecha en v84 con las APIs oficiales** (ver «Recompensas y canjes» abajo). Lo de la sesión de Kick no se hizo. Lo que se pidió: En Kick conviene usar la sesión (punto 2) para poder manejar todas, no solo las de la app. La idea:
   - **Lista de Kick y Twitch** (ya existe `rewardsList()` en `/api/rules?a=rewards`). Con crear, editar (título, costo, descripción, color, pide texto, se acepta solo o queda pendiente), pausar, prender y apagar, y borrar.
   - **Kick:** `GET/POST /public/v1/channels/rewards`, `PATCH/DELETE /public/v1/channels/rewards/{id}`. Campos: `title` (máx 50), `cost`, `description` (máx 200), `is_enabled`, `is_paused`, `is_user_input_required`, `should_redemptions_skip_request_queue`, `background_color`.
   - **Twitch:** `GET/POST/PATCH/DELETE /helix/channel_points/custom_rewards`. Solo se pueden editar las que creó esta app (`only_manageable_rewards=true`); las otras se ven, pero con candado.
   - **Canjes pendientes:**
     - Kick: `GET /public/v1/channels/rewards/redemptions?status=pending&reward_id=…`, y `POST …/redemptions/accept` o `…/redemptions/reject` con `{ids:[…]}` (de 1 a 25). La respuesta trae `data` y `failed` (con la razón `NOT_PENDING`, `NOT_FOUND` o `NOT_OWNED`).
     - Twitch: `GET /helix/channel_points/custom_rewards/redemptions?reward_id=…&status=UNFULFILLED`, y `PATCH` con `status: FULFILLED` o `CANCELED`.
   - **Aviso de pendientes:** que un canje pendiente salga en el feed con botones ✓ Aceptar / ✕ Rechazar y un contador en la barra, y que se quite cuando se resuelva (también si lo resuelvo en Kick o en Twitch).
     - Twitch ya trae `status` en `channel.channel_points_custom_reward_redemption.add` (`unfulfilled` = pendiente), y existe `…redemption.update`.
     - En Kick, la guardia ve `RewardRedeemedEvent` por Pusher. Hay que revisar en la documentación oficial si ya existe un webhook de canjes (`channel.reward.redemption.updated`) para tenerlo con la app cerrada.
   - **Pasar mis recompensas viejas:** botón «Pasar esta recompensa a la app», que crea una igual desde la app (y así ya se puede aceptar, rechazar y devolver puntos) y me dice que borre la vieja en el panel.
4. ~~**Widget de chat para OBS** (`chat-obs.html`)~~ **hecho.** Está en `main`: `chat-obs.html` + la ruta pública `/api/chatobs` (llave del chat de Kick e insignias de Twitch, con caché de 1 h). El encargo original quedó en `CONTEXTO-WIDGET-CHAT.md`. El editor (Chat Studio, `chat-studio.html`) está en la rama `claude/obs-chat-widget-uwi08w`, todavía sin subir a `main`.
5. Cuando funcione la sesión de Kick, quitar de la app los textos que mencionan Streamer.bot como necesario. Las acciones que tenía allá y ya están en la app: timeout y contra ataque, solo emotes (Twitch), destaca mi mensaje, aviso al cambiar a la escena Offline, plan.

## Ideas numeradas (seguir la numeración)

- 103: hecha (la guardia).
- 107: comandos para todo el chat atendidos por la guardia (empezó con `!plan`).
- 108: medidor de actividad del chat.
- 109: aviso por Telegram si OBS deja de transmitir.
- 110: página propia de donaciones (los tips de Kick hoy se ven solo por los mensajes de Botrix, con la app abierta).
- 111: hecha en v82 (reglas por escena).
- 112: resumen del stream por Telegram.
- 113: instalar la app como app de pantalla completa.
- 114: hecha en parte en v82 (timeout, contra ataque, destacar, solo emotes).
- 115: lista de VIP temporales en la app (días que quedan, quitar antes).
- 116: aviso en Telegram cuando se acaba un VIP Rey.
- 117: hecha (widget de chat para OBS, `chat-obs.html`).
- 118: hecha en v84 (la app crea sus recompensas y maneja sus canjes).
- 115: hecha en v87 (lista de VIP temporales).
- 136–138: ver la entrega de la v88 (siguen en el chat).

## Historial corto

- **v73–v76:** BRB Studio, Twitch completo (multistream, encuestas, predicciones, anuncios, Hype Train), insignias y emotes como en cada plataforma, diseños, alertas propias, meta de subs.
- **v77–v79:** ahorro (Ably, fallas de Upstash), guardia del chat, «Revisar todo».
- **v80:** escena de OBS por la guardia, raids y recompensas de Kick con la app cerrada, arreglos de seguridad (debug, TTS y lista con clave).
- **v81:** Atajos ya no se mueve solo, flechas de la barra, alertas de resubs compartidas (Kick), 👑 VIP por días en Twitch.
- **v82:**
  - Recompensas reales de Kick y Twitch en el editor de reglas; antes «Dónde» no se guardaba al editar una regla.
  - Pasos nuevos: timeout, contra ataque, solo emotes, destacar y Streamer.bot.
  - Evento de escena y `!plan`.
  - Flechas del 2.º renglón de la barra.
  - Respaldo de 7TV.
  - Puente a Streamer.bot.
- **v83:** widget de chat para OBS (`chat-obs.html`) y su editor Chat Studio (`chat-studio.html`, ⚙ → Chat → «Chat para OBS»).
- **v84:** botón para volver a conectar Kick (con permisos que faltan), sección 🎯 Recompensas (Kick y Twitch, APIs oficiales), canjes pendientes con ✓ / ✕ en el feed y 🎯 en la barra, aviso oficial de canjes de Kick, arreglo de «devolver puntos» en Kick.
- **v85:** 🔐 sesión de Kick («modo Kick.bot»): VIP y solo emotes en Kick sin Streamer.bot, todas las recompensas y canjes de Kick, vigilancia de la sesión. Pruebas `harness33.js` y `v85.js`.
- **v86:** 🔐 seguridad. Arreglado el hueco por el que un link con otro `?api=` se robaba la clave 🔑 (ver «Seguridad» abajo) en `index.html`, `chat-studio.html`, `brb.html` y la guardia. En `index.html` la clave ya no se queda en la barra de direcciones. Prueba `v86seg.js`. (Nota: al subir la v85 por la web de GitHub se borró sin querer casi toda la carpeta `pruebas/`; se recuperó del historial.)
- **v88:** 👑 dar y quitar VIP tocando a alguien en el chat (Kick y Twitch); 📺 anuncios de Kick (ver cuántos te quedan, lanzar, inscribirte, la ventanita y el 📺 de la barra); el 🟣 de la barra se fue: página «📊 Encuestas y anuncios» en ⚙ y como atajo (encuesta, predicción, anuncio); Ajustes reacomodados (Conexiones, En vivo, Recompensas y encuestas, Automático, Chat…); 🔐 seguridad: canal privado de Ably, CORS solo para tus páginas, freno a quien prueba claves y «Cambiar mi clave» desde la app. Pruebas `harness35.js` y `v88.js`.
- **v89:** 📊🔮 encuestas y predicciones de Kick con la sesión de Kick (crear, ver cómo van, terminar, cerrar apuestas, elegir ganador, cancelar). Lo hizo el chat de Cowork.
- **v90** (chat de Cowork): 📊 en la barra de abajo de Atajos (abre Encuestas y anuncios); el ➤ de enviar va adentro del cuadro de texto (`#chatBox2`); la voz de las alertas: si la del celular no arranca en 2.5 s (Android dentro de IRL Plus Chat), usa la del servidor (`ttsDecirCel`); **resubs de Kick:** la guardia toma la resub COMPARTIDA (celebración en el chat, `metadata.celebration` tipo sub/renew, con `total_months` y su mensaje) y manda `resub:{user,months,msg,cel:1}`; el servidor (`kickResubIn`) toca la alerta CON el mensaje; si Kick ya avisó la renovación en los últimos 15 min, solo lee el mensaje (item `k:'tts'`, candado `alfm:`); candado `alfu:<user>` 120 s para que no suene doble (también en `alertas.js?a=fire`). Pruebas: `harness37.js`, `v90g.js`.
- **v87:** regla de escena arreglada (elige a qué chat va el mensaje aunque Twitch esté apagado en el celular, cuenta como en vivo si OBS transmite, y el feed dice por qué no salió); 👑 lista de VIP temporales con «Quitar ya»; 🛡 protegidos del timeout (tu lista y tus mods) con devolución de puntos; 🔊 TTS por recompensa con lista negra; ⌨️ el teclado ya no tapa la barra para escribir (IRL Plus Chat). Pruebas `harness34.js` y `v87.js`.

## Seguridad (lo que no se debe romper)

- **La clave 🔑 solo se le manda a TU servidor.** `index.html`, `chat-studio.html`, `brb.html` y `guardia.html` leen `?api=` de la URL. Si no es tu servidor, un link como `?api=https://malo` te robaría la clave (o el token `?w=` de la guardia) y con eso controlarían tu canal. Por eso cada una tiene `apiHostOk()`: solo confía en `kick-feed-mariotq.vercel.app`, en los previews `kick-feed-mariotq-…-tq19.vercel.app` y en el mismo dominio de la página. Si el `?api=` es otro, se ignora (usa el servidor de siempre) y NO se carga la clave. **No quites este candado ni le agregues hosts con comodín.** `alertas-comun.js` tiene el servidor fijo (no lee `?api=`), por eso Alertas Studio no lo necesita.
- La clave no se enseña en stream: sale de la barra de direcciones (`history.replaceState`) en todas las páginas que la reciben.
- Si crees que se te filtró la clave, hazte una nueva: **v88:** ⚙ → Servidor y diagnóstico → 🔑 «Cambiar mi clave» (dos toques; el celular se queda con la nueva y te da el link para el otro celular y para IRL Plus Chat). También sirve abrir `https://kick-feed-mariotq.vercel.app/api/login?nueva=1` y autorizar. La anterior deja de servir (en otras instancias del servidor, a más tardar en 1 min).
- **v88 · CORS:** las rutas solo le contestan al navegador si la página es tuya (`ORIG_OK`: `mariiotq.github.io`, `kick-feed-mariotq.vercel.app` y tus previews `kick-feed-mariotq-…-tq19.vercel.app`), con `Vary: Origin`. Lo mismo en `alertas.js` y `brb.js`. No le agregues hosts con comodín. (Que los POST vayan como `text/plain` está bien: la clave va en el cuerpo y CORS ya no deja leer la respuesta a otras páginas.)
- **v88 · freno de claves:** `checkKey` cuenta, por conexión (IP), las claves equivocadas DISTINTAS: con 20 en 10 min esa conexión ya no entra ni con la buena un rato. Un celular con tu clave vieja repite siempre la misma y no frena a nadie. Lo público sin clave nunca se frena. Está en los tres archivos del servidor (`REQCTX`, `BADK`, `keyFail`, `keyBlocked`) y es en memoria por instancia.
- **v88 · Ably privado:** sin clave, `/api/rt` solo da permiso de escuchar `kf` (lo que ven tus letreros en pantalla). El chat, la moderación, los canjes, Twitch, OBS y tus ajustes van por `kfp`, que pide tu clave. Si agregas un mensaje nuevo que no necesiten los letreros, ponlo en `PRIV` de `_rt.js`.
