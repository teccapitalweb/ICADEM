// Ciudad ICADEM 2.0 · seis juegos educativos de «Mundo vivo» con semilla (módulo puro).
// El cliente y el servidor generan la misma partida con la semilla; el servidor reproduce la bitácora
// y calcula el puntaje. Contenido escrito y revisado por personas (versión del banco: VIVO_BANK).
//
// Cada partida es una lista de tareas de elección. Cada opción vale 2 (la mejor), 1 (aceptable) o 0
// (no conviene) y trae su explicación: en convivencia y emociones casi nunca hay una sola respuesta.
//   retry: la tarea se repite hasta elegir una opción de valor 2 (cada intento fallido resta 10).
// Bitácora: [{ t: índiceDeTarea, c: índiceDeOpción }] en orden.
import { rng } from './activities.js';

export const VIVO_BANK = '2026-11 · v1';
const shuffle = (list, r) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const O = (text, value, feedback) => ({ text, value, feedback });

/* ---------------- Héroes de la ciudad: ayudar con respeto y con seguridad ---------------- */
const HEROES = [
  { title: 'Un visitante perdido', text: 'Un señor que no conoces te pregunta cómo llegar al Hospital ICADEM.', options: [
    O('Le señalo el camino o se lo muestro en el mapa desde donde estoy', 2, 'Ayudas sin ponerte en riesgo: das la dirección sin irte con alguien que no conoces.'),
    O('Le pido a un adulto o a un guardia cercano que lo oriente', 2, 'Muy bien: un adulto responsable puede acompañarlo si hace falta.'),
    O('Me voy con él hasta el hospital aunque no lo conozca', 0, 'Nunca te vayas con una persona desconocida, aunque parezca amable. Ayuda desde donde estás.'),
    O('Lo ignoro', 0, 'Puedes ayudar con algo tan sencillo como señalar el camino.')] },
  { title: 'Una cartera en la banca', text: 'Encuentras una cartera olvidada en una banca de la plaza.', options: [
    O('La entrego a un policía, a un guardia o a un adulto encargado', 2, 'Así llega a su dueño por un camino seguro.'),
    O('Si veo quién la dejó, le llamo para devolvérsela', 2, 'Ser honesto y amable: justo lo que hace una persona de confianza.'),
    O('Me quedo con el dinero y tiro la cartera', 0, 'Lo que no es tuyo se devuelve. Quedarse con lo ajeno daña a otra persona.'),
    O('La dejo ahí, no es asunto mío', 1, 'No hiciste daño, pero podías ayudar a que volviera con su dueño.')] },
  { title: 'Bolsas pesadas', text: 'Una señora carga muchas bolsas y se le dificulta abrir la puerta del súper.', options: [
    O('Le pregunto: «¿Le ayudo a abrir la puerta o con una bolsa?»', 2, 'Preguntar primero respeta su decisión y su espacio.'),
    O('Le abro la puerta', 2, 'Un gesto pequeño que ayuda mucho.'),
    O('Le quito las bolsas sin preguntar', 0, 'Con buena intención, pero sin preguntar puede asustarse o incomodarse.'),
    O('Me río porque se le cayó una manzana', 0, 'Burlarse lastima. Mejor ofrece ayuda.')] },
  { title: 'Un niño perdido', text: 'Un niño pequeño llora porque no encuentra a su mamá.', options: [
    O('Aviso a un adulto responsable (guardia, policía o encargado) y me quedo a la vista', 2, 'Los adultos responsables saben cómo localizar a su familia, y tú sigues en un lugar seguro.'),
    O('Le hablo con calma para que no tenga miedo mientras llega un adulto', 2, 'Tu calma le ayuda mucho; un adulto debe hacerse cargo de buscar a su mamá.'),
    O('Me lo llevo a buscarla por toda la ciudad', 0, 'Si se alejan, es más difícil que su mamá los encuentre y tú también te expones.'),
    O('Sigo caminando', 0, 'Un niño perdido necesita ayuda: avisa a un adulto.')] },
  { title: 'Un botón alto', text: 'Una persona en silla de ruedas no alcanza el botón del semáforo peatonal.', options: [
    O('Le pregunto si quiere que yo lo presione', 2, 'Preguntar respeta su autonomía: ella decide qué ayuda necesita.'),
    O('Empujo su silla para cruzarla rápido', 0, 'Nunca muevas la silla de alguien sin su permiso: es parte de su espacio personal.'),
    O('Presiono el botón y espero con ella a que cambie la luz si así lo quiere', 2, 'Ayudas y acompañas sin imponerte.'),
    O('Le digo que espere a que pase alguien más', 0, 'Tú puedes ayudar en ese momento.')] },
  { title: 'Basura en el piso', text: 'Ves que alguien tira una envoltura al piso en el parque.', options: [
    O('Si es seguro, la recojo y la tiro en el bote', 2, 'Cuidar el lugar de todos es un buen ejemplo.'),
    O('Le digo con amabilidad dónde está el bote más cercano', 2, 'Hablar con respeto suele funcionar mejor que regañar.'),
    O('Le grito para que todos lo vean', 0, 'Exhibir a alguien genera conflicto. La amabilidad convence más.'),
    O('Tiro mi basura ahí también', 0, 'El parque es de todos: la basura va en su lugar.')] },
  { title: 'El teléfono del abuelo', text: 'Un señor mayor no sabe cómo hacer una videollamada y te pide ayuda.', options: [
    O('Le explico paso a paso, sin pedirle contraseñas ni datos', 2, 'Ayudas con paciencia y cuidando su información.'),
    O('Le pido su contraseña para hacerlo más rápido', 0, 'Las contraseñas y NIP no se piden ni se comparten, ni siquiera para ayudar.'),
    O('Le sugiero pedirle ayuda a un familiar o al encargado del lugar', 1, 'Es una opción segura, aunque tú también podías explicarle con calma.'),
    O('Me burlo porque no sabe', 0, 'Todos aprendemos a nuestro ritmo. La paciencia es una forma de respeto.')] },
  { title: 'Una caída en bicicleta', text: 'Una niña se cae de la bici y se raspa la rodilla.', options: [
    O('Le pregunto si está bien y aviso a un adulto', 2, 'Primero ver cómo está; un adulto puede limpiar la herida.'),
    O('La grabo con mi teléfono para subirlo', 0, 'Grabar a alguien que se lastimó no ayuda y puede avergonzarla.'),
    O('Le acerco su bici y la acompaño mientras llega un adulto', 2, 'Acompañar también es ayudar.'),
    O('Me alejo', 0, 'Un poco de ayuda puede hacer la diferencia.')] }
];

/* ---------------- Rescate responsable (revisado con KidsHealth/Nemours y guías de Cruz Roja) ---------------- */
const RESCUE_CASES = [
  { title: 'Alguien se desvanece en la plaza', intro: 'Un señor se desvanece cerca de la fuente y queda en el suelo.', place: 'en la plaza' },
  { title: 'Una caída en el parque', intro: 'Un joven cae de las barras del parque y no se mueve.', place: 'en el parque' }
];
const RESCUE_STEPS = [
  { title: '1 · Antes de acercarte', text: '¿Qué es lo primero que haces?', options: [
    O('Miro que el lugar sea seguro para mí (que no haya coches, cables o peligros)', 2, 'Primero tu seguridad: si tú también te lastimas, ya serían dos personas que necesitan ayuda.'),
    O('Corro hacia él sin mirar alrededor', 0, 'Correr sin mirar puede ponerte en peligro. Revisa primero el lugar.'),
    O('Lo levanto de inmediato', 0, 'Levantar o mover a alguien puede empeorar una lesión. Primero revisa que el lugar sea seguro.')] },
  { title: '2 · ¿Responde?', text: '¿Cómo sabes si la persona responde?', options: [
    O('Le hablo fuerte y toco suavemente su hombro', 2, 'Así compruebas si está consciente sin lastimarla.'),
    O('La sacudo con fuerza', 0, 'Sacudir a alguien puede lastimarlo, sobre todo si tiene un golpe en el cuello o la espalda.'),
    O('Le echo agua en la cara', 0, 'El agua no ayuda y puede causar que se ahogue. Háblale y toca su hombro.')] },
  { title: '3 · No responde', text: 'La persona no responde. ¿Qué haces?', options: [
    O('Pido ayuda: llamo al 911 o le pido a un adulto que llame', 2, 'Pedir ayuda es lo más importante. El operador del 911 te dirá qué hacer.'),
    O('Espero a que despierte solo', 0, 'Esperar sin pedir ayuda puede ser peligroso. Llama al 911 o pide a un adulto que llame.'),
    O('Me voy a buscar a su familia', 0, 'Si te vas, nadie pide ayuda ni se queda con ella. Primero el 911.')] },
  { title: '4 · Mientras llega la ayuda', text: '¿Mueves a la persona?', options: [
    O('No la muevo, salvo que haya un peligro (fuego, tráfico)', 2, 'Si se lastimó el cuello o la columna, moverla puede empeorar la lesión.'),
    O('La siento para que esté más cómoda', 0, 'No la muevas: podría tener una lesión que no se ve.'),
    O('La pongo de pie', 0, 'Una persona inconsciente no debe ponerse de pie. Espera a los paramédicos.')] },
  { title: '5 · Comida y bebida', text: 'Alguien sugiere darle algo de tomar.', options: [
    O('No le doy nada de comer ni de beber (salvo que lo indique el operador del 911)', 2, 'Una persona inconsciente o lastimada puede atragantarse.'),
    O('Le doy un poco de refresco', 0, 'Podría atragantarse. No se da nada de comer ni beber.'),
    O('Le doy un dulce para que se recupere', 0, 'Podría atragantarse. Espera indicaciones del 911.')] },
  { title: '6 · Llegan los paramédicos', text: 'Llega la ambulancia.', options: [
    O('Me quedo en un lugar seguro, cuento lo que vi y sigo sus indicaciones', 2, 'Tu información les ayuda a atenderla mejor.'),
    O('Me voy sin decir nada', 1, 'Ya llegó ayuda, pero lo que viste puede ser útil para los paramédicos.'),
    O('Me acerco a tomar fotos', 0, 'Las fotos estorban y no respetan a la persona. Deja trabajar a los paramédicos.')] }
];

/* ---------------- Veterinarios por un día: cuidado responsable (sin procedimientos clínicos) ---------------- */
const VET_ANIMALS = [
  { breed: 'mestizo-canela', name: 'Toby', species: 'perro', food: [O('Croquetas para perro', 2, 'Su alimento balanceado tiene lo que necesita.'), O('Chocolate', 0, 'El chocolate es tóxico para los perros.'), O('Uvas', 0, 'Las uvas y pasas pueden dañar sus riñones.'), O('Restos con cebolla', 0, 'La cebolla es tóxica para perros y gatos.')],
    clean: [O('Recoger sus heces y lavar su plato', 2, 'Un espacio limpio previene infecciones.'), O('Bañarlo con detergente', 0, 'El detergente irrita su piel; los baños se dan con productos para perros y no muy seguido.'), O('Dejar todo como está', 0, 'La suciedad acumulada causa enfermedades.')] },
  { breed: 'atigrado', name: 'Mishi', species: 'gato', food: [O('Alimento para gato', 2, 'Los gatos necesitan nutrientes propios de su especie.'), O('Un plato de leche', 0, 'Muchos gatos adultos no digieren bien la leche.'), O('Croquetas para perro', 1, 'No le hará daño una vez, pero no cubre lo que un gato necesita.'), O('Restos con cebolla', 0, 'La cebolla es tóxica para perros y gatos.')],
    clean: [O('Limpiar su arenero', 2, 'Los gatos cuidan mucho su higiene y prefieren un arenero limpio.'), O('Rociarle perfume', 0, 'Los perfumes irritan su nariz y su piel.'), O('Cambiar la arena una vez al año', 0, 'El arenero se limpia a diario y la arena se cambia con frecuencia.')] },
  { breed: 'perico', name: 'Kiwi', species: 'ave', food: [O('Mezcla de semillas con fruta y verdura', 2, 'Una dieta variada mantiene sana a un ave.'), O('Aguacate', 0, 'El aguacate es tóxico para las aves.'), O('Pan con sal', 0, 'La sal y los alimentos procesados le hacen daño.'), O('Solo semillas de girasol', 1, 'Le gustan, pero solas no son una dieta completa.')],
    clean: [O('Limpiar la jaula y cambiar el papel del fondo', 2, 'La jaula limpia evita enfermedades respiratorias.'), O('Usar un aerosol fuerte cerca de él', 0, 'Los aerosoles dañan sus pulmones, que son muy sensibles.'), O('Mojarlo con la manguera', 0, 'Puede asustarse y enfriarse. Las aves se bañan solas en un recipiente con agua.')] }
];
const VET_SIGNS = [
  { text: 'Toby duerme una siesta después de jugar en el parque.', vet: false }, { text: 'Mishi no ha comido desde ayer y vomitó dos veces.', vet: true },
  { text: 'Kiwi se acicala las plumas con el pico.', vet: false }, { text: 'Toby cojea y se queja al apoyar una pata.', vet: true },
  { text: 'Mishi se estira y ronronea al despertar.', vet: false }, { text: 'Kiwi respira con la boca abierta y está esponjado en el fondo de la jaula.', vet: true }
];

/* ---------------- Mercado justo: cuentas, cambio y honestidad ---------------- */
const PRODUCTS = [['naranja', 'naranjas', 4], ['pan', 'panes', 6], ['jitomate', 'jitomates', 5], ['plátano', 'plátanos', 3], ['elote', 'elotes', 12], ['aguacate', 'aguacates', 15], ['bolsa de frijol', 'bolsas de frijol', 28]];
const HONESTY = [
  { title: 'Te pagaron de más', text: 'Una clienta te da $100 creyendo que es un billete de $50 por una compra de $35.', options: [O('Le aviso y le devuelvo lo que corresponde', 2, 'La honestidad genera confianza: tus clientes regresarán.'), O('Me quedo callado: fue su error', 0, 'Quedarse con dinero ajeno no es justo, aunque el error sea de otra persona.'), O('Le devuelvo solo un poco', 0, 'Lo justo es devolver todo lo que corresponde.')] },
  { title: 'Te equivocaste en el cambio', text: 'Te das cuenta de que le diste $5 de menos a un cliente que ya se va.', options: [O('Le llamo, me disculpo y le doy lo que faltaba', 2, 'Reconocer un error y corregirlo es parte de un comercio justo.'), O('No digo nada, no se dio cuenta', 0, 'Aunque no lo note, sigue siendo su dinero.'), O('Le culpo por no contar bien', 0, 'El error fue tuyo: lo correcto es corregirlo con respeto.')] },
  { title: 'Un cliente molesto', text: 'Un señor reclama de mal modo porque una naranja venía golpeada.', options: [O('Le escucho con calma y le cambio la naranja', 2, 'Escuchar y resolver tranquiliza a cualquiera.'), O('Le contesto de mal modo también', 0, 'Responder igual solo hace más grande el problema.'), O('Le digo que no es mi culpa y no hago nada', 0, 'Aunque no sea tu culpa, puedes ofrecer una solución.')] }
];

/* ---------------- Amigos del agua ---------------- */
const WATER = [
  { title: 'Lavarse los dientes', text: '¿Qué conviene hacer con la llave mientras te cepillas?', options: [O('Cerrarla y usar un vaso con agua para enjuagar', 2, 'Así se ahorran varios litros cada vez.'), O('Dejarla abierta todo el tiempo', 0, 'El agua que corre sin usarse se desperdicia.'), O('Abrirla y cerrarla a cada rato', 1, 'Ayuda, pero un vaso para enjuagar ahorra todavía más.')] },
  { title: 'Hora de regar', text: '¿Cuándo conviene regar las plantas del parque?', options: [O('Temprano en la mañana o al atardecer', 2, 'Con menos sol, se evapora menos agua y la planta aprovecha más.'), O('Al mediodía, con el sol fuerte', 0, 'Con el calor mucha agua se evapora antes de llegar a las raíces.'), O('Da igual la hora', 0, 'La hora sí importa por la evaporación.')] },
  { title: 'Una fuga', text: 'Escuchas un goteo constante en el baño aunque todas las llaves están cerradas.', options: [O('Aviso a un adulto para que revise la fuga', 2, 'Las fugas pequeñas desperdician muchísima agua al día; hay que repararlas pronto.'), O('No pasa nada, son solo gotas', 0, 'Gota a gota se pierden muchos litros al día.'), O('Pongo una cubeta para siempre', 1, 'Aprovechas el agua, pero la fuga sigue. Hay que repararla.')] },
  { title: 'Aguas frescas para cuatro', text: 'Vas a preparar 4 vasos de agua de jamaica de 250 ml. ¿Cuánta agua usas?', options: [O('1 litro', 2, '4 × 250 ml = 1000 ml = 1 litro: justo lo que se necesita.'), O('3 litros', 0, 'Sobraría mucha agua de jamaica que podría desperdiciarse.'), O('Medio litro', 0, 'No alcanzaría para los cuatro vasos.')] },
  { title: 'El coche sucio', text: '¿Cómo conviene lavar un coche?', options: [O('Con cubeta y trapo', 2, 'Con cubeta se usa mucha menos agua que con manguera.'), O('Con la manguera abierta todo el tiempo', 0, 'La manguera abierta desperdicia muchísima agua.'), O('No lavarlo nunca', 1, 'Ahorras agua, pero se puede lavar con cubeta de vez en cuando.')] },
  { title: 'Acertijo de la llave', text: 'Si una llave gotea y llena una taza de 250 ml cada hora, ¿cuánta agua se pierde en un día?', options: [O('6 litros', 2, '24 horas × 250 ml = 6000 ml = 6 litros, solo de una llave.'), O('250 mililitros', 0, 'Eso es en una hora; en un día son 24 horas.'), O('24 litros', 0, 'Serían 24 tazas de 250 ml: 6 litros.')] }
];

/* ---------------- Aventura de las emociones ---------------- */
const STORIES = [
  { title: 'Un compañero triste', text: 'Leo está sentado solo en el recreo y se ve triste.', options: [O('Me acerco y le pregunto si quiere platicar o jugar', 2, 'Ofrecer compañía sin presionar le da la opción de abrirse.'), O('Le pregunto si quiere que avise a un maestro', 2, 'Si algo serio le pasa, un adulto de confianza puede ayudar.'), O('Le digo «ya no estés triste»', 1, 'Tu intención es buena, pero las emociones no se apagan por orden: mejor escucha.'), O('Hago como que no lo vi', 0, 'A veces un pequeño gesto cambia el día de alguien.')] },
  { title: 'Dos amigos discuten', text: 'Ana y Toño discuten porque los dos querían el mismo balón.', options: [O('Les propongo turnos o jugar juntos', 2, 'Buscar una solución en la que ganen los dos ayuda a resolver.'), O('Les pido que cada uno cuente lo que siente sin gritar', 2, 'Escucharse con calma es el primer paso para arreglarlo.'), O('Tomo partido por mi mejor amigo', 0, 'Elegir un bando suele hacer más grande el conflicto.'), O('Les quito el balón a los dos', 1, 'Detiene la pelea, pero no les ayuda a resolverla.')] },
  { title: 'Alguien queda fuera', text: 'En el juego del parque, Sofi pide jugar y el grupo le dice que no.', options: [O('La invito a jugar conmigo', 2, 'Incluir a alguien es un gran acto de amistad.'), O('Le propongo al grupo que entre en el siguiente turno', 2, 'Hablar con el grupo con respeto puede cambiar la regla.'), O('Me río con el grupo', 0, 'Reírse de alguien excluido duele el doble.'), O('No digo nada', 1, 'No la lastimaste, pero podías ayudar a incluirla.')] },
  { title: 'Algo importante se perdió', text: 'Paco perdió la medalla que le regaló su abuela y está muy angustiado.', options: [O('Le ayudo a buscar repasando dónde estuvo', 2, 'Acompañar con algo concreto ayuda a calmar la angustia.'), O('Le digo que entiendo que es importante para él', 2, 'Reconocer lo que siente le ayuda a sentirse comprendido.'), O('Le digo que es solo una medalla', 0, 'Para él vale mucho. Minimizar lo que siente lo hace sentir peor.'), O('Le sugiero avisar a un adulto que pueda ayudar', 1, 'Buena idea, sobre todo si no aparece; también puedes acompañarlo.')] },
  { title: 'Nervios antes de presentar', text: 'Mañana te toca presentar frente al grupo y estás muy nervioso.', options: [O('Respiro despacio y practico con alguien de confianza', 2, 'Respirar y practicar ayudan a que los nervios bajen.'), O('Le digo a mi maestra o a mi familia cómo me siento', 2, 'Hablar de lo que sientes es valiente y te ayuda a prepararte.'), O('Me digo que voy a salir mal', 0, 'Pensar así aumenta los nervios. Recuerda lo que sí sabes.'), O('Finjo estar enfermo para no ir', 0, 'Evitarlo no hace que el miedo desaparezca; prepararte sí ayuda.')] },
  { title: 'Una broma pesada', text: 'En el chat del grupo están burlándose de una foto de Mariana.', options: [O('No sigo la broma y le digo al grupo que eso lastima', 2, 'Poner un límite con respeto protege a quien están molestando.'), O('Le aviso a un adulto de confianza', 2, 'Cuando la burla sigue, un adulto puede detenerla.'), O('Le doy «me gusta» para no quedar mal', 0, 'Participar, aunque sea con un «me gusta», alimenta la burla.'), O('Le escribo a Mariana para saber cómo está', 2, 'Hacerle saber que no está sola importa mucho.')] }
];

/* ---------------- motor común ---------------- */
function choiceGame(id, title, levels, build) {
  return {
    id, title, levels, bank: VIVO_BANK,
    build(seed, level) { const r = rng(seed), content = build(r, level); content.tasks.forEach(t => { t.options = shuffle(t.options, r); }); return content; },
    play(content, log) {
      if (!Array.isArray(log) || log.length > 80) return { valid: false };
      let task = 0, points = 0, wrong = 0;
      for (const e of log) {
        if (!e || e.t !== task || !Number.isInteger(e.c)) return { valid: false };
        const t = content.tasks[task], o = t && t.options[e.c]; if (!o) return { valid: false };
        if (t.retry && o.value < 2) { wrong++; continue; }
        points += o.value; task++;
      }
      if (task !== content.tasks.length) return { valid: false };
      const max = content.tasks.length * 2;
      return { valid: true, score: Math.max(30, Math.round(100 * points / max) - wrong * 10), wrong };
    }
  };
}

export const VIVO_ACTIVITIES = Object.freeze({
  heroes: choiceGame('heroes', 'Héroes de la ciudad', ['normal'], r => ({ tasks: shuffle(HEROES, r).slice(0, 5).map(s => ({ ...s, options: [...s.options] })) })),
  rescate: choiceGame('rescate', 'Rescate responsable', ['normal'], r => { const c = RESCUE_CASES[Math.floor(r() * RESCUE_CASES.length)]; return { case: c, source: 'Basado en recomendaciones para niños de KidsHealth (Nemours) y guías de primeros auxilios de Cruz Roja. No sustituye un curso de primeros auxilios.', tasks: RESCUE_STEPS.map(s => ({ ...s, retry: true, options: [...s.options] })) }; }),
  veterinarios: choiceGame('veterinarios', 'Veterinarios por un día', ['normal'], r => {
    const animals = shuffle(VET_ANIMALS, r).slice(0, 2), signs = shuffle(VET_SIGNS, r).slice(0, 3), tasks = [];
    for (const a of animals) {
      tasks.push({ title: `${a.name} tiene hambre`, text: `¿Qué le das de comer a ${a.name}?`, breed: a.breed, options: [...a.food] });
      tasks.push({ title: `Agua para ${a.name}`, text: `¿Cómo le das agua a ${a.name}?`, breed: a.breed, options: [O('Agua limpia y fresca en su recipiente, todos los días', 2, 'El agua fresca siempre disponible es básica para su salud.'), O('El agua que quedó de ayer', 0, 'El agua vieja junta bacterias. Cámbiala diario.'), O('Refresco', 0, 'Las mascotas solo toman agua.')] });
      tasks.push({ title: `El espacio de ${a.name}`, text: `¿Cómo limpias el espacio de ${a.name}?`, breed: a.breed, options: [...a.clean] });
    }
    for (const s of signs) tasks.push({ title: '¿Necesita veterinario?', text: s.text, options: s.vet ? [O('Avisar a un adulto para llevarlo al veterinario', 2, 'Ese signo indica que algo no está bien: necesita atención profesional.'), O('Esperar a ver si se le pasa solo', 0, 'Con esos signos conviene ir pronto al veterinario.'), O('Darle una medicina de personas', 0, 'Nunca le des medicinas de personas: pueden ser tóxicas. Solo el veterinario receta.')] : [O('Es normal: lo dejo tranquilo', 2, 'Es un comportamiento habitual de un animal sano.'), O('Llevarlo de urgencia al veterinario', 0, 'No es necesario: es un comportamiento normal.'), O('Despertarlo o interrumpirlo', 0, 'Déjalo descansar o hacer lo suyo.')] });
    return { tasks };
  }),
  mercado: choiceGame('mercado', 'Mercado justo', ['basico', 'avanzado'], (r, level) => {
    const tasks = [], adv = level === 'avanzado';
    for (let k = 0; k < 3; k++) {
      const items = shuffle(PRODUCTS, r).slice(0, adv ? 3 : 2).map(([one, many, price]) => ({ one, many, price, qty: 1 + Math.floor(r() * (adv ? 5 : 3)) }));
      const total = items.reduce((s, i) => s + i.price * i.qty, 0), paid = [20, 50, 100, 200].find(b => b >= total + 1) || 500;
      const list = items.map(i => `${i.qty} ${i.qty === 1 ? i.one : i.many} ($${i.price} c/u)`).join(', ');
      const near = d => [...new Set([d, d + 5, Math.max(1, d - 5), d + 10, Math.max(1, d - 2)])].slice(0, 4);
      tasks.push({ title: `Cliente ${k + 1}: ¿cuánto es?`, text: `Te piden ${list}. ¿Cuánto cobras?`, options: near(total).map(v => O('$' + v, v === total ? 2 : 0, v === total ? 'Bien sumado: ' + items.map(i => `${i.qty}×$${i.price}`).join(' + ') + ` = $${total}.` : `Revisa: ${items.map(i => `${i.qty}×$${i.price}`).join(' + ')} = $${total}.`)) });
      tasks.push({ title: `Cliente ${k + 1}: el cambio`, text: `Te paga con un billete de $${paid} una cuenta de $${total}. ¿Cuánto cambio le das?`, options: near(paid - total).map(v => O('$' + v, v === paid - total ? 2 : 0, `$${paid} − $${total} = $${paid - total}.`)) });
    }
    tasks.push({ title: 'Trato con respeto', text: 'Llega una clienta. ¿Cómo la recibes?', options: [O('«¡Buenas tardes! ¿Qué le doy?»', 2, 'Un saludo amable hace que el cliente se sienta bien recibido.'), O('«¿Qué quiere?» sin mirarla', 0, 'Mirar y saludar con amabilidad es parte de un buen servicio.'), O('La hago esperar mientras juego en el celular', 0, 'Atender a tiempo es una forma de respeto.')] });
    const honest = shuffle(HONESTY, r)[0]; tasks.push({ ...honest, options: [...honest.options] });
    return { tasks };
  }),
  agua: choiceGame('agua', 'Amigos del agua', ['normal'], r => ({ tasks: shuffle(WATER, r).slice(0, 5).map(s => ({ ...s, options: [...s.options] })) })),
  emociones: choiceGame('emociones', 'Aventura de las emociones', ['normal'], r => ({ tasks: shuffle(STORIES, r).slice(0, 4).map(s => ({ ...s, options: [...s.options] })) }))
});
