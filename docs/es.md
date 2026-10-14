# PRONOTE para Gladys

Esta integración trae **PRONOTE**, el software de vida escolar de la mayoría de los
centros franceses, a Gladys: notas, deberes, horario, ausencias y mensajes no leídos
de un alumno — o de cada hijo de una cuenta de padres.

Lee PRONOTE como lo hace la app PRONOTE, cada pocos minutos, y publica lo que
encuentra como dispositivos de Gladys, disparadores de escenas y widgets del panel.

> PRONOTE e Index Éducation no participan en esta integración. Usa la biblioteca
> libre [pawnote](https://github.com/LiterateInk/Pawnote.js) para comunicarse con
> PRONOTE.

## Requisitos

- Gladys **5.1 o posterior**.
- Una cuenta PRONOTE de **alumno** o de **padres** (las cuentas de profesor no son
  compatibles).
- La dirección de su espacio PRONOTE, tal como la muestra su navegador, por ejemplo
  `https://0123456a.index-education.net/pronote/`.

## Configuración

En Gladys, abra **Integraciones → PRONOTE → Configuración**.

| Campo                            | Qué poner                                                                                             |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Dirección de PRONOTE             | La dirección del espacio PRONOTE. El final (`eleve.html`, `parent.html`) no es necesario.             |
| Tipo de cuenta                   | **Alumno** para una cuenta de alumno, **Padres** para una cuenta de padres (un dispositivo por hijo). |
| Usuario / Contraseña             | Su usuario y su contraseña de PRONOTE.                                                                |
| Intervalo de actualización (min) | Frecuencia de lectura de PRONOTE. Bastan 15 minutos; el servidor lo comparte todo el centro.          |
| Horizonte de deberes             | Cuántos días por adelantado se cuentan y listan los deberes pendientes (7 por defecto).               |
| Zona horaria del centro          | `Europe/Paris` por defecto. Ultramar: `Indian/Reunion`, `America/Martinique`, `Pacific/Noumea`…       |
| Registros detallados             | Actívelo para entender un problema y desactívelo después.                                             |

Guarde y pulse **Probar la conexión**: indica quién ha iniciado sesión y qué se ha
encontrado para cada alumno.

Tras el primer inicio de sesión, PRONOTE entrega a la integración un **token de
sesión** que sustituye a la contraseña en los siguientes inicios, como hace la app
móvil PRONOTE. Se guarda en el almacenamiento propio de la integración.

### Cuentas que inician sesión mediante un ENT

Si accede a PRONOTE a través del ENT de su región (Mon Bureau Numérique, ENT77,
Skolengo…), no tiene contraseña de PRONOTE. Use un **código QR**:

1. En PRONOTE, en un ordenador, abra el menú junto a su nombre y elija **Código QR
   para la app móvil**. Elija un código de 4 cifras.
2. Escanee el código QR con la cámara del teléfono (no con la app PRONOTE): el
   teléfono muestra un texto que empieza por `{"jeton"`. Cópielo.
3. En Gladys, pulse **Iniciar sesión con un código QR**, pegue el texto e indique el
   código de 4 cifras. Dese prisa: el código QR solo es válido unos minutos.

Deje vacíos los campos dirección, usuario y contraseña, o indique solo la
dirección. La sesión se guarda después igual que tras un inicio con contraseña.

## Dispositivos

Pulse **Descubrir** (o espere a la primera lectura) para ver los dispositivos y
créelos.

**Un dispositivo por alumno**:

| Función                          | Valor                                                                           |
| -------------------------------- | ------------------------------------------------------------------------------- |
| Overall average                  | La media general del periodo en curso, sobre 20 (si el centro la muestra).      |
| Homework to do                   | Los deberes aún no hechos, dentro del horizonte de deberes.                     |
| Homework for the next school day | Los deberes aún no hechos para el próximo día de clase.                         |
| Absences (period)                | Las ausencias del periodo en curso.                                             |
| Delays (period)                  | Los retrasos del periodo en curso.                                              |
| Next lesson                      | Texto, p. ej. `14:00 MATHEMATIQUES (B12)` (con la fecha si no es hoy).          |
| Next school day start            | Texto, p. ej. `08:00`: la primera clase que se imparte el próximo día de clase. |
| Last grade                       | Texto, p. ej. `MATHEMATIQUES 15/20 (12/10)`.                                    |

Los nombres de las funciones están en inglés al crearlas; puede renombrarlas en
Gladys.

**Un dispositivo para la cuenta**: el número de **mensajes no leídos**.

Los dispositivos son de solo lectura: no se modifica nada en PRONOTE.

## Escenas

### Disparadores

| Disparador                            | Cuándo                                             | Variables                                                                                                                              |
| ------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Se publica una nueva nota             | Ha aparecido una nota desde la lectura anterior.   | nombre del alumno, asignatura, nota, sobre, nota sobre 20, nota tal como se escribe, coeficiente, media de la clase, comentario, fecha |
| Se ponen nuevos deberes               | Han aparecido o cambiado deberes.                  | nombre del alumno, asignatura, descripción, fecha de entrega                                                                           |
| Se cancela una clase                  | Una clase de los próximos días queda cancelada.    | nombre del alumno, asignatura, fecha, hora de inicio, hora de fin, estado en PRONOTE                                                   |
| Se registra una ausencia o un retraso | El centro ha registrado una ausencia o un retraso. | nombre del alumno, tipo (`absence` / `delay`), fecha, justificado (`yes` / `no`), minutos de retraso, motivo                           |

Cada disparador puede limitarse a un alumno. La primera lectura tras la instalación
solo memoriza lo que ya existe: no se anuncia nada de las notas de las semanas
pasadas.

### Acciones

- **Leer PRONOTE ahora**: actualiza dispositivos y widgets de inmediato. Las
  novedades encontradas las anuncian los disparadores en la siguiente lectura
  programada.
- **Obtener el día de un alumno**: para hoy, mañana o el próximo día de clase, da
  el número de clases, el inicio de la primera, el fin de la última, las
  asignaturas canceladas y los deberes pendientes como una lista lista para leer en
  voz alta.

Ejemplo: _cada día laborable a las 07:00 → Obtener el día de un alumno (próximo día
de clase) → Decir «Primera clase a las {{first_lesson}}. Deberes:
{{homework_text}}»_.

## Widgets

- **Alumno PRONOTE**: media, deberes pendientes, ausencias, próxima clase, próximo
  día de clase, última nota, mensajes no leídos y la lista de deberes. Un botón
  **Actualizar** lee PRONOTE al momento.
- **Horario PRONOTE**: las clases de hoy, mañana o el próximo día de clase, con las
  clases canceladas y los exámenes señalados.

Ambos muestran la última lectura: abrir un panel nunca consulta PRONOTE.

## Botones de la pantalla de configuración

- **Probar la conexión**: lee PRONOTE y dice lo que encontró, o por qué no.
- **Iniciar sesión con un código QR**: ver más arriba.
- **Olvidar la sesión guardada**: borra el token de sesión guardado (para cambiar de
  cuenta, o tras cambiar la contraseña en otro lugar).

## Solución de problemas

| Mensaje                                    | Qué hacer                                                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| PRONOTE rechazó el usuario o la contraseña | Compruébelos en la web de PRONOTE. La lectura se pausa hasta que guarde la configuración o pruebe la conexión.        |
| PRONOTE pide configurar la seguridad       | Inicie sesión una vez en la app o la web de PRONOTE para terminarla (nueva contraseña, PIN) y luego use el código QR. |
| La dirección IP fue suspendida             | Demasiados intentos fallidos: espere (normalmente una hora) antes de volver a intentarlo.                             |
| El servidor no responde                    | Compruebe la dirección. Un servidor ocupado se vuelve a intentar en la siguiente lectura.                             |

Active **Registros detallados** para ver cada paso en los registros de la
integración. Las contraseñas y los tokens nunca se registran.

## Limitaciones conocidas

- **Cuentas de padres con varios hijos**: el horario se lee para cada hijo, pero
  para las notas, los deberes y las ausencias PRONOTE puede responder por el hijo
  que selecciona por defecto. Si dos hijos muestran las mismas notas, use mejor la
  cuenta de alumno de cada hijo.
- Las **cuentas de profesor** no son compatibles.
- PRONOTE no tiene notificaciones: las novedades se encuentran en cada lectura, así
  que una nota nueva aparece dentro del intervalo de actualización.

## Sus datos

La contraseña se queda en la configuración secreta de Gladys. El token de sesión
se guarda en el almacenamiento privado de la integración; notas, deberes y horario
solo se guardan en memoria y se publican en su Gladys. No se envía nada a ningún
otro lugar.
