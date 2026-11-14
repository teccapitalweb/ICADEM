// Ciudad ICADEM · banco de preguntas educativas (solo contenido, sin lógica de juego).
// Lo usan los NPC de la ciudad y el servidor, que es quien decide si una respuesta es correcta.
//
// Reglas del banco (las vigila test/ciudad-preguntas.test.cjs):
//   · cada pregunta: id único, categoría, nivel, 3 o 4 opciones, índice de la correcta y explicación;
//   · lo que depende de reglas vigentes lleva `volatile: true`, fuente (`source`) y fecha de revisión
//     (`reviewed`, AAAA-MM). Se revisa cada 6 meses; si una regla cambia, se corrige aquí;
//   · contenido escrito y revisado por personas: no se generan preguntas con IA en tiempo real;
//   · ninguna pregunta pide datos personales al jugador.
// Para agregar preguntas basta con añadir objetos a QUESTIONS (no hay que tocar código).

export const CATEGORIES = Object.freeze({
  cultura: 'Cultura general', mexico: 'México y sus instituciones', matematicas: 'Matemáticas', finanzas: 'Finanzas personales',
  idiomas: 'Idiomas', tecnologia: 'Tecnología', ambiente: 'Medio ambiente', ciencia: 'Ciencia', salud: 'Salud y bienestar', profesiones: 'Profesiones',
  // Mundo vivo (2.0)
  geografia: 'Geografía', historia: 'Historia', animales: 'Animales', lectura: 'Lectura y comprensión', valores: 'Valores', seguridad: 'Seguridad personal', convivencia: 'Convivencia', logica: 'Pensamiento lógico'
});
export const LEVELS = Object.freeze({ infantil: 'Infantil', juvenil: 'Juvenil', general: 'General', profesional: 'Profesional' });

const q = (id, cat, level, text, options, answer, explain, extra = {}) => Object.freeze({ id, cat, level, q: text, options: Object.freeze(options), answer, explain, ...extra });
const REV = '2026-11';

import { VIVO_QUESTIONS } from './questions-vivo.js';
export { BANK_VERSION } from './questions-vivo.js';

const BASE_QUESTIONS = [
  /* Cultura general */
  q('cul-semana', 'cultura', 'infantil', '¿Cuántos días tiene una semana?', ['5', '7', '10'], 1, 'Una semana tiene 7 días, de lunes a domingo.'),
  q('cul-piano', 'cultura', 'infantil', '¿Qué instrumento musical tiene teclas blancas y negras?', ['Tambor', 'Piano', 'Trompeta'], 1, 'El piano tiene teclas blancas y negras.'),
  q('cul-pacifico', 'cultura', 'juvenil', '¿Cuál es el océano más grande del planeta?', ['Atlántico', 'Índico', 'Pacífico'], 2, 'El océano Pacífico es el más grande y el más profundo.'),
  q('cul-egipto', 'cultura', 'juvenil', '¿En qué continente está Egipto?', ['África', 'Asia', 'Europa'], 0, 'Egipto está en el noreste de África.'),
  q('cul-vangogh', 'cultura', 'general', '¿Quién pintó «La noche estrellada»?', ['Frida Kahlo', 'Vincent van Gogh', 'Pablo Picasso'], 1, 'La pintó Vincent van Gogh en 1889.'),
  q('cul-quijote', 'cultura', 'general', '¿Quién escribió «Don Quijote de la Mancha»?', ['Miguel de Cervantes', 'Gabriel García Márquez', 'Octavio Paz'], 0, 'Lo escribió Miguel de Cervantes; la primera parte se publicó en 1605.'),
  q('cul-futbol', 'cultura', 'general', '¿Cuántos jugadores tiene en la cancha cada equipo de fútbol soccer?', ['9', '11', '7'], 1, 'Cada equipo juega con 11 personas, incluido el portero.'),

  /* México y sus instituciones */
  q('mex-capital', 'mexico', 'infantil', '¿Cuál es la capital de México?', ['Guadalajara', 'Monterrey', 'Ciudad de México'], 2, 'La capital del país es la Ciudad de México.'),
  q('mex-escudo', 'mexico', 'infantil', '¿Qué ave aparece en el escudo nacional de México?', ['Águila', 'Colibrí', 'Guacamaya'], 0, 'El escudo muestra un águila sobre un nopal devorando una serpiente.'),
  q('mex-1810', 'mexico', 'juvenil', '¿En qué año inició la lucha por la Independencia de México?', ['1910', '1810', '1821'], 1, 'Inició en 1810; la Independencia se consumó en 1821.'),
  q('mex-20nov', 'mexico', 'juvenil', '¿Qué se conmemora el 20 de noviembre en México?', ['La Batalla de Puebla', 'El inicio de la Revolución Mexicana', 'La Independencia'], 1, 'El 20 de noviembre de 1910 inició la Revolución Mexicana.'),
  q('mex-sat', 'mexico', 'general', '¿Qué es el SAT?', ['Sistema de Administración Tecnológica', 'Servicio de Administración Tributaria', 'Secretaría de Asuntos Turísticos'], 1, 'El SAT es el Servicio de Administración Tributaria: recauda los impuestos federales.', { source: 'sat.gob.mx', reviewed: REV }),
  q('mex-curp', 'mexico', 'general', '¿Qué significa CURP?', ['Clave Única de Registro de Población', 'Certificado Único de Residencia Particular', 'Clave Universal de Registro Personal'], 0, 'CURP es la Clave Única de Registro de Población; la asigna RENAPO.', { source: 'gob.mx/curp', reviewed: REV }),
  q('mex-banxico', 'mexico', 'general', '¿Qué institución emite los billetes en México?', ['El SAT', 'El Banco de México', 'La Secretaría de Economía'], 1, 'El Banco de México (Banxico) emite los billetes y las monedas.', { source: 'banxico.org.mx', reviewed: REV }),
  q('mex-ine', 'mexico', 'general', '¿Qué es el INE?', ['Instituto Nacional Electoral', 'Instituto Nacional de Economía', 'Instituto Nacional de Estadística'], 0, 'El INE es el Instituto Nacional Electoral. La estadística nacional la produce el INEGI.', { source: 'ine.mx', reviewed: REV }),
  q('mex-inegi', 'mexico', 'general', '¿Qué institución levanta el Censo de Población y Vivienda?', ['El IMSS', 'La SEP', 'El INEGI'], 2, 'El INEGI (Instituto Nacional de Estadística y Geografía) levanta el censo.', { source: 'inegi.org.mx', reviewed: REV }),
  q('mex-rfc', 'mexico', 'profesional', '¿Qué significa RFC?', ['Registro Federal de Contribuyentes', 'Registro Fiscal de Cuentas', 'Reglamento Federal de Comercio'], 0, 'El RFC es el Registro Federal de Contribuyentes que administra el SAT.', { source: 'sat.gob.mx', reviewed: REV }),
  q('mex-imss', 'mexico', 'profesional', '¿Qué institución da seguridad social a la mayoría de quienes trabajan en el sector privado?', ['El ISSSTE', 'El IMSS', 'El INFONAVIT'], 1, 'El IMSS cubre a los trabajadores del sector privado; el ISSSTE, a los del gobierno federal.', { source: 'imss.gob.mx', reviewed: REV, volatile: true }),

  /* Matemáticas */
  q('mat-7mas5', 'matematicas', 'infantil', '¿Cuánto es 7 + 5?', ['11', '12', '13'], 1, '7 + 5 = 12.'),
  q('mat-9menos4', 'matematicas', 'infantil', '¿Cuánto es 9 − 4?', ['5', '4', '6'], 0, '9 − 4 = 5.'),
  q('mat-hexagono', 'matematicas', 'infantil', '¿Cuántos lados tiene un hexágono?', ['5', '6', '8'], 1, 'Un hexágono tiene 6 lados, como las celdas de un panal.'),
  q('mat-6x7', 'matematicas', 'juvenil', '¿Cuánto es 6 × 7?', ['42', '36', '48'], 0, '6 × 7 = 42.'),
  q('mat-144', 'matematicas', 'juvenil', '¿Cuánto es 144 ÷ 12?', ['14', '11', '12'], 2, '144 ÷ 12 = 12.'),
  q('mat-25de80', 'matematicas', 'juvenil', '¿Cuánto es el 25 % de 80?', ['20', '25', '40'], 0, 'El 25 % es la cuarta parte: 80 ÷ 4 = 20.'),
  q('mat-triangulo', 'matematicas', 'general', '¿Cuántos grados suman los ángulos internos de un triángulo?', ['90°', '180°', '360°'], 1, 'Siempre suman 180°.'),
  q('mat-primo', 'matematicas', 'general', '¿Cuál es el siguiente número primo después de 7?', ['9', '11', '13'], 1, '9 no es primo (3 × 3); el siguiente primo es 11.'),
  q('mat-10y10', 'matematicas', 'profesional', 'Un precio de $200 sube 10 % y después baja 10 %. ¿En cuánto queda?', ['$200', '$198', '$202'], 1, 'Sube a $220; el 10 % de 220 es 22, así que queda en $198.'),

  /* Finanzas personales */
  q('fin-ahorro4', 'finanzas', 'infantil', 'Si ahorras $10 cada semana, ¿cuánto tendrás en 4 semanas?', ['$14', '$40', '$100'], 1, '$10 × 4 semanas = $40.'),
  q('fin-presupuesto', 'finanzas', 'juvenil', '¿Qué es un presupuesto?', ['Un plan de ingresos y gastos', 'Un tipo de tarjeta', 'Un impuesto'], 0, 'Un presupuesto planea cuánto entra y en qué se gasta.'),
  q('fin-compuesto', 'finanzas', 'general', '¿Qué es el interés compuesto?', ['El que solo cobra el banco', 'El que también se calcula sobre los intereses acumulados', 'Un interés que nunca cambia'], 1, 'Los intereses se suman al capital y generan nuevos intereses.'),
  q('fin-emergencia', 'finanzas', 'general', '¿Para qué sirve un fondo de emergencia?', ['Para compras por impulso', 'Para cubrir gastos imprevistos', 'Para pagar la tarjeta cada mes'], 1, 'Cubre imprevistos (salud, reparaciones) sin endeudarte.'),
  q('fin-cat', 'finanzas', 'general', 'En un crédito, ¿qué significa CAT?', ['Costo Anual Total', 'Cargo Automático por Transferencia', 'Cuota Anual de Tarjeta'], 0, 'El CAT reúne intereses y comisiones en un porcentaje anual para comparar créditos.', { source: 'condusef.gob.mx', reviewed: REV }),
  q('fin-condusef', 'finanzas', 'general', '¿Qué institución orienta y defiende a los usuarios de servicios financieros en México?', ['PROFECO', 'CONDUSEF', 'CNBV'], 1, 'La CONDUSEF atiende quejas y orienta a usuarios de bancos, aseguradoras y otras financieras.', { source: 'condusef.gob.mx', reviewed: REV }),
  q('fin-iva', 'finanzas', 'general', '¿Cuál es la tasa general del IVA en México (fuera de la región fronteriza)?', ['10 %', '16 %', '21 %'], 1, 'La tasa general es 16 % (Ley del IVA, art. 1). En la región fronteriza hay un estímulo que puede reducirla.', { source: 'Ley del Impuesto al Valor Agregado, art. 1', reviewed: REV, volatile: true }),
  q('fin-minimo', 'finanzas', 'profesional', 'Pagar solo el mínimo de una tarjeta de crédito normalmente…', ['Liquida la deuda más rápido', 'Alarga la deuda y aumenta los intereses pagados', 'Elimina los intereses'], 1, 'Con el pago mínimo casi todo se va a intereses y la deuda tarda mucho más en pagarse.', { source: 'banxico.org.mx', reviewed: REV }),

  /* Idiomas */
  q('idi-dog', 'idiomas', 'infantil', '¿Cómo se dice «perro» en inglés?', ['Cat', 'Dog', 'Bird'], 1, '«Perro» en inglés es «dog».'),
  q('idi-apple', 'idiomas', 'infantil', '¿Qué significa «apple»?', ['Manzana', 'Naranja', 'Uva'], 0, '«Apple» significa manzana.'),
  q('idi-thanks', 'idiomas', 'juvenil', '¿Qué significa «thank you»?', ['Por favor', 'Gracias', 'De nada'], 1, '«Thank you» significa gracias; «you\'re welcome» es de nada.'),
  q('idi-library', 'idiomas', 'juvenil', '¿Cómo se dice «biblioteca» en inglés?', ['Bookstore', 'Library', 'Laboratory'], 1, '«Library» es biblioteca; «bookstore» es librería (donde se venden libros).'),
  q('idi-children', 'idiomas', 'juvenil', '¿Cuál es el plural de «child» en inglés?', ['Childs', 'Children', 'Childes'], 1, 'Es un plural irregular: child → children.'),
  q('idi-bonjour', 'idiomas', 'general', '«Bonjour» es un saludo en…', ['Francés', 'Italiano', 'Portugués'], 0, '«Bonjour» significa buenos días en francés.'),
  q('idi-obrigado', 'idiomas', 'general', '«Obrigado» significa «gracias» en…', ['Italiano', 'Portugués', 'Francés'], 1, 'En portugués se dice «obrigado» (o «obrigada»).'),
  q('idi-embarrassed', 'idiomas', 'general', '¿Qué significa «embarrassed» en inglés?', ['Embarazada', 'Avergonzado', 'Enojado'], 1, 'Es un «falso amigo»: significa avergonzado. Embarazada es «pregnant».'),

  /* Tecnología */
  q('tec-teclado', 'tecnologia', 'infantil', '¿Con qué parte de la computadora escribes letras?', ['Monitor', 'Teclado', 'Bocina'], 1, 'Las letras se escriben con el teclado.'),
  q('tec-www', 'tecnologia', 'juvenil', '¿Qué significa «www» en una dirección web?', ['World Wide Web', 'Web With Windows', 'World Web Wireless'], 0, 'WWW significa World Wide Web.'),
  q('tec-navegador', 'tecnologia', 'juvenil', '¿Qué es un navegador?', ['Un cable de red', 'Un programa para visitar páginas web', 'Un tipo de virus'], 1, 'Chrome, Firefox, Safari y Edge son navegadores.'),
  q('tec-password', 'tecnologia', 'general', '¿Cómo debe ser una contraseña segura?', ['Tu fecha de nacimiento', 'Larga, con letras, números y símbolos, distinta en cada sitio', 'La misma en todos tus sitios'], 1, 'Una contraseña larga y única por sitio protege tus cuentas.'),
  q('tec-phishing', 'tecnologia', 'general', '¿Qué es el «phishing»?', ['Un antivirus', 'Un engaño para robar datos haciéndose pasar por alguien confiable', 'Pesca deportiva en línea'], 1, 'Desconfía de mensajes urgentes que piden contraseñas o datos bancarios.'),
  q('tec-2fa', 'tecnologia', 'profesional', '¿Qué es la autenticación de dos factores?', ['Verificar tu identidad con dos elementos distintos, como contraseña y código', 'Usar dos contraseñas iguales', 'Iniciar sesión en dos equipos'], 0, 'Combina algo que sabes (contraseña) con algo que tienes (código en tu teléfono).'),

  /* Medio ambiente */
  q('amb-botella', 'ambiente', 'infantil', 'Una botella de plástico limpia es un residuo…', ['Orgánico', 'Reciclable', 'Peligroso'], 1, 'El plástico limpio se puede reciclar.'),
  q('amb-cascara', 'ambiente', 'infantil', 'Las cáscaras de fruta son residuos…', ['Orgánicos', 'Reciclables', 'Peligrosos'], 0, 'Son orgánicos: con ellos se puede hacer composta.'),
  q('amb-co2', 'ambiente', 'juvenil', '¿Qué gas toman las plantas del aire para hacer la fotosíntesis?', ['Oxígeno', 'Dióxido de carbono', 'Nitrógeno'], 1, 'Toman dióxido de carbono y liberan oxígeno.'),
  q('amb-llave', 'ambiente', 'juvenil', 'Cerrar la llave mientras te lavas los dientes sirve para…', ['Ahorrar agua', 'Que el agua salga más caliente', 'Limpiar la tubería'], 0, 'Se pueden ahorrar varios litros de agua cada vez.'),
  q('amb-solar', 'ambiente', 'general', '¿Cuál de estas es una fuente de energía renovable?', ['Carbón', 'Solar', 'Gas natural'], 1, 'La energía solar se renueva; el carbón y el gas son combustibles fósiles.'),
  q('amb-pilas', 'ambiente', 'general', '¿Qué se debe hacer con las pilas usadas?', ['Tirarlas a la basura común', 'Llevarlas a un centro de acopio', 'Enterrarlas'], 1, 'Contienen metales que contaminan el suelo y el agua.'),

  /* Ciencia */
  q('cie-marte', 'ciencia', 'infantil', '¿Qué planeta es conocido como «el planeta rojo»?', ['Venus', 'Marte', 'Júpiter'], 1, 'Marte se ve rojizo por el óxido de hierro de su suelo.'),
  q('cie-arana', 'ciencia', 'infantil', '¿Cuántas patas tiene una araña?', ['6', '8', '10'], 1, 'Las arañas tienen 8 patas; los insectos tienen 6.'),
  q('cie-h2o', 'ciencia', 'juvenil', '¿Cuál es la fórmula química del agua?', ['CO₂', 'H₂O', 'O₂'], 1, 'Dos átomos de hidrógeno y uno de oxígeno: H₂O.'),
  q('cie-corazon', 'ciencia', 'juvenil', '¿Qué órgano bombea la sangre por el cuerpo?', ['El pulmón', 'El corazón', 'El hígado'], 1, 'El corazón bombea la sangre.'),
  q('cie-botanica', 'ciencia', 'general', '¿Qué estudia la botánica?', ['Las plantas', 'Los animales', 'Las rocas'], 0, 'La botánica estudia las plantas; la zoología, los animales.'),
  q('cie-hervir', 'ciencia', 'general', '¿A qué temperatura hierve el agua al nivel del mar?', ['90 °C', '100 °C', '120 °C'], 1, 'Hierve a 100 °C; en lugares altos hierve a menos temperatura.'),
  q('cie-jupiter', 'ciencia', 'general', '¿Cuál es el planeta más grande del sistema solar?', ['Saturno', 'Júpiter', 'Neptuno'], 1, 'Júpiter es el más grande.'),

  /* Salud y bienestar */
  q('sal-agua', 'salud', 'infantil', '¿Qué bebida es la mejor para hidratarte?', ['Refresco', 'Agua natural', 'Bebida energética'], 1, 'El agua natural hidrata sin azúcar.'),
  q('sal-manos', 'salud', 'infantil', '¿Cuánto tiempo conviene tallarse las manos con jabón?', ['2 segundos', 'Al menos 20 segundos', '5 minutos'], 1, 'Tallar al menos 20 segundos, entre los dedos y bajo las uñas.', { source: 'Centros para el Control y la Prevención de Enfermedades (CDC)', reviewed: REV }),
  q('sal-dormir', 'salud', 'juvenil', 'Dormir bien ayuda a…', ['Concentrarte y recuperar energía', 'Necesitar más azúcar', 'Nada en especial'], 0, 'El sueño ayuda a la memoria, la concentración y el ánimo.'),
  q('sal-frijol', 'salud', 'juvenil', '¿Qué aportan principalmente los frijoles y las lentejas?', ['Proteína vegetal y fibra', 'Azúcar refinada', 'Grasa trans'], 0, 'Las leguminosas son fuente de proteína vegetal y fibra.'),
  q('sal-911', 'salud', 'general', 'En México, ¿a qué número llamas en una emergencia?', ['066', '911', '060'], 1, 'El 911 es el número único de emergencias en todo el país.', { source: 'gob.mx/911', reviewed: REV, volatile: true }),
  q('sal-quemadura', 'salud', 'general', 'Ante una quemadura leve, lo recomendado es…', ['Poner pasta dental', 'Enfriarla con agua corriente fresca', 'Poner hielo directamente'], 1, 'Agua corriente fresca por varios minutos; el hielo y los remedios caseros pueden dañar la piel.'),

  /* Profesiones */
  q('pro-veterinaria', 'profesiones', 'infantil', '¿Quién cuida la salud de los animales?', ['El arquitecto', 'La veterinaria', 'El contador'], 1, 'Las y los médicos veterinarios cuidan la salud animal.'),
  q('pro-bombero', 'profesiones', 'infantil', '¿Quién apaga los incendios?', ['El bombero', 'El cartero', 'La panadera'], 0, 'Los bomberos atienden incendios y rescates.'),
  q('pro-arquitecta', 'profesiones', 'juvenil', '¿Quién diseña edificios y espacios?', ['La agrónoma', 'La arquitecta', 'El abogado'], 1, 'La arquitectura diseña edificios y espacios.'),
  q('pro-agronomo', 'profesiones', 'juvenil', 'Un agrónomo trabaja principalmente con…', ['Leyes', 'Cultivos y suelos', 'Edificios'], 1, 'La agronomía estudia cultivos, suelos y producción agrícola.'),
  q('pro-contador', 'profesiones', 'general', '¿Qué profesional lleva la contabilidad y las declaraciones de impuestos?', ['El contador', 'El chef', 'El enfermero'], 0, 'La contaduría registra operaciones y prepara declaraciones.'),
  q('pro-juez', 'profesiones', 'general', 'En un juicio, ¿quién dicta la sentencia?', ['El testigo', 'El juez', 'El abogado de una parte'], 1, 'El juez resuelve con base en lo que quedó probado.'),
  q('pro-auditor', 'profesiones', 'profesional', '¿Qué hace un auditor?', ['Revisa que registros y procesos sean correctos y cumplan las normas', 'Vende productos', 'Diseña logotipos'], 0, 'La auditoría verifica registros, controles y cumplimiento.')
];
export const QUESTIONS = Object.freeze([...BASE_QUESTIONS, ...VIVO_QUESTIONS]);

export const questionById = id => QUESTIONS.find(x => x.id === id) || null;

/** Niveles que corresponden a cada tipo de perfil. */
export const LEVELS_FOR = Object.freeze({ adulto: ['juvenil', 'general', 'profesional'], infantil: ['infantil', 'juvenil'] });
