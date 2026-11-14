// Ciudad ICADEM · reglas de XP de los retos rápidos y minijuegos (módulo puro).
// Las aplica el servidor (que guarda el perfil); el cliente solo las usa sin conexión o para
// mostrar cuánto falta. Nunca tocan créditos: los retos y minijuegos solo dan XP del juego.

export const QUIZ_XP = 10;
export const QUIZ_DAILY = 10;           // retos con XP por día
export const QUIZ_REPEAT_DAYS = 7;      // la misma pregunta vuelve a dar XP después de 7 días
export const ACTIVITY_DAILY_XP = 60;    // tope diario de XP por minijuego
export const ACTIVITY_FIRST_BONUS = 20; // bono único al completar un minijuego por primera vez

/** Día de juego (hora del centro de México, UTC−6) como AAAA-MM-DD. */
export const dayKey = ms => new Date(ms - 6 * 3600000).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function emptyPlay() { return { day: '', quizToday: 0, quizCorrect: 0, quizSeen: {}, act: {} }; }

/** Normaliza lo guardado (perfiles anteriores no tienen `play`). */
/**
 * XP de una misión profesional aprobada: la primera vez, la XP completa; después, la XP de práctica
 * (repeatXp) una sola vez al día por misión. `repeatDay` se guarda en el registro de la misión.
 * Así repetir sigue valiendo la pena, pero la XP no crece sin límite. Nunca toca créditos.
 */
export function missionXp(reward, firstPass, record, now = Date.now()) {
  if (firstPass) return { xp: Number(reward && reward.xp) || 0, repeatDay: null };
  const today = dayKey(now);
  if (record && record.repeatDay === today) return { xp: 0, repeatDay: today };
  return { xp: Number(reward && reward.repeatXp) || 0, repeatDay: today };
}

/** Los minijuegos que dan XP (seis originales y tres del Distrito del Saber). Cualquier otro nombre se descarta al leer el progreso. */
export const PLAY_GAMES = Object.freeze(['memoria', 'matematicas', 'idiomas', 'clasificacion', 'carrera', 'tesoro', 'laboratorio', 'escape', 'laberinto',
  'manzanas', 'heroes', 'rescate', 'guardianes', 'veterinarios', 'mercado', 'agua', 'emociones', 'expedicion']);   // Mundo vivo (2.0)

export function cleanPlay(play) {
  const p = play && typeof play === 'object' ? play : {};
  const act = p.act && typeof p.act === 'object' ? JSON.parse(JSON.stringify(p.act)) : {};
  for (const id of Object.keys(act)) if (!PLAY_GAMES.includes(id)) delete act[id];
  return { day: typeof p.day === 'string' ? p.day : '', quizToday: Number(p.quizToday) || 0, quizCorrect: Number(p.quizCorrect) || 0,
    quizSeen: p.quizSeen && typeof p.quizSeen === 'object' ? { ...p.quizSeen } : {}, act };
}

function rollDay(play, today) {
  if (play.day === today) return;
  play.day = today; play.quizToday = 0;
  for (const a of Object.values(play.act)) a.dayXp = 0;
  for (const [id, d] of Object.entries(play.quizSeen)) if (daysBetween(d, today) >= QUIZ_REPEAT_DAYS) delete play.quizSeen[id];
}

/** Resultado de un reto de NPC. Modifica `play` y devuelve la XP ganada y por qué. */
export function rewardQuiz(play, questionId, correct, now) {
  const today = dayKey(now); rollDay(play, today);
  if (!correct) return { xp: 0, why: 'incorrecta' };
  play.quizCorrect++;
  if (play.quizSeen[questionId]) return { xp: 0, why: 'repetida' };
  if (play.quizToday >= QUIZ_DAILY) return { xp: 0, why: 'tope-diario' };
  play.quizSeen[questionId] = today; play.quizToday++;
  return { xp: QUIZ_XP, why: 'ok' };
}

/** Resultado de un minijuego validado (puntaje 0–100). */
export function rewardActivity(play, activityId, score, now) {
  const today = dayKey(now); rollDay(play, today);
  const a = play.act[activityId] || (play.act[activityId] = { best: 0, plays: 0, dayXp: 0, done: false });
  a.plays++; a.best = Math.max(a.best, score);
  let xp = Math.min(Math.round(score * 0.3), Math.max(0, ACTIVITY_DAILY_XP - a.dayXp));
  a.dayXp += xp;
  let bonus = 0;
  if (!a.done && score >= 50) { a.done = true; bonus = ACTIVITY_FIRST_BONUS; }
  return { xp: xp + bonus, bonus, capped: xp < Math.round(score * 0.3) };
}

/** Logros educativos que se derivan del progreso de juego. */
export function playAchievements(play) {
  const p = cleanPlay(play), a = id => p.act[id] || { best: 0, done: false }, list = [];
  if (p.quizCorrect >= 10) list.push('mente-curiosa');
  if (a('idiomas').best >= 80) list.push('poliglota');
  if (a('memoria').best >= 90) list.push('memoria-de-oro');
  if (a('matematicas').best >= 90) list.push('calculadora-humana');
  if (a('clasificacion').best >= 80) list.push('gran-clasificador');
  if (a('carrera').done) list.push('atleta-icadem');
  if (a('tesoro').done) list.push('cazatesoros');
  if (a('laboratorio').best >= 80) list.push('cientifico');
  if (a('escape').done) list.push('escapista');
  if (a('laberinto').done) list.push('laberintista');
  // Mundo vivo (2.0)
  if (a('manzanas').done && a('heroes').best >= 80) list.push('buen-vecino');
  if (a('rescate').best >= 90) list.push('rescatista-responsable');
  if (a('guardianes').done && a('agua').best >= 80) list.push('guardian-del-planeta');
  if (a('veterinarios').best >= 80) list.push('amigo-de-los-animales');
  if (a('mercado').best >= 90) list.push('comerciante-justo');
  if (a('emociones').best >= 80) list.push('corazon-empatico');
  if (a('expedicion').done) list.push('expedicionario');
  return list;
}
