/* ============================================================
   Base de conocimiento — Programa de Equivalencias Integrales (PEI)
   Facultad de Ciencias Jurídicas y Justicia · UPANA 2026
   Todos los montos en Quetzales (Q).
   ============================================================ */

const KB = {
  proposito:
    "El PEI facilita que estudiantes de otras universidades se incorporen a la Facultad de Ciencias Jurídicas y Justicia de UPANA, para obtener el grado de Licenciado en Ciencias Jurídicas y de la Justicia, con los títulos de Abogado y Notario.",

  requisitos: [
    "Pensum cerrado de Ciencias Jurídicas y Sociales, o bien certificación de cursos aprobados con al menos el 86% del plan de estudios, más el pensum de origen.",
    "Copia del DPI.",
    "Se revisa la afinidad de contenido de los cursos aprobados contra el pensum de UPANA."
  ],

  duracion: {
    total: "18 meses en total, organizados en 3 fases de 6 meses cada una.",
    fases: {
      "fase i": "Primer ciclo con clases y evaluaciones escritas: Derecho Civil I a V, Penal y Procesal Penal, Constitucional y Procesal Constitucional, Ética y Tesis I. Segundo ciclo con evaluaciones orales.",
      "fase ii": "Primer ciclo escrito: Procesal Civil y Mercantil, Administrativo y Procesal Administrativo, Laboral y Procesal Laboral, Tesis II. Segundo ciclo con evaluaciones orales.",
      "fase iii": "Primer ciclo escrito: Mercantil, Tributario, Notarial y Tesis III. Segundo ciclo con evaluaciones orales."
    }
  },

  academico: {
    asistencia: "Se exige un mínimo de 80% de asistencia.",
    nota: "La nota mínima aprobatoria es de 70 sobre 100 puntos.",
    recuperacion: "Si el estudiante reprueba un curso, tiene derecho a recuperación."
  },

  papeleria: [
    "Cierre de pensum y certificación original",
    "Plan de estudios (pensum) sellado",
    "Copia autenticada del DPI",
    "Foto digital a color, tamaño cédula",
    "Certificación de nacimiento",
    "Declaración jurada",
    "Fotostática del título de diversificado, tamaño 5x7 pulgadas",
    "Carencia de antecedentes penales y policíacos"
  ],

  sedes: {
    virtual: ["Central (Spazio, zona 15)", "Naranjo", "Álamos", "Antigua Guatemala / Chimaltenango", "Cobán", "Zacapa", "Petén", "Mazatenango"],
    hibrida: ["Naranjo", "Jutiapa", "Huehuetenango", "Retalhuleu", "Quetzaltenango", "San Marcos", "Coatepeque", "Sololá"]
  },

  horarios: "Jueves y viernes de 18:00 a 20:00 horas, y los sábados de 7:00 a 17:00 horas.",

  inversion: {
    carne: 100,
    inscripcionPorFase: 550,
    inscripcionTotal: 1650,
    convalidacion: 750,
    escritos: {
      "fase i": { monto: 1625, cursos: 5, cuotas: 4 },
      "fase ii": { monto: 1300, cursos: 4, cuotas: 4 },
      "fase iii": { monto: 975, cursos: 3, cuotas: 4 }
    },
    orales: 2400,
    egreso: 5000,
    egresoCuotas: 4,
    investidura: 6000
  }
};

/* Utilidad: formatea un número como quetzales, ej. 1625 -> "Q1,625.00" */
function fmtQ(n){
  return "Q" + Number(n).toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ============================================================
   Perfiles del "Posible Cliente / Estudiante Interesado" (Modo B)
   Cada perfil trae una apertura y una cola de dudas concretas.
   ============================================================ */
const CLIENT_PROFILES = [
  {
    id: "apresurado",
    label: "El apresurado",
    nombre: "Kevin Marroquín",
    iniciales: "KM",
    apertura: "Buenas, mire, ando bien apurado, entre reuniones. Solo dígame de una vez: ¿cuánto dura el programa y cuánto tendría que pagar al mes?",
    dudas: [
      "Ok, va. ¿Y aparte de la mensualidad hay que pagar inscripción o algo más al inicio?",
      "Entendido. ¿Y con quién me comunico ya para apartar mi cupo, para no perder tiempo?"
    ],
    cierre: "Perfecto, licenciado(a), se agradece. Ahí ando pendiente de sus correos, que tenga buena tarde."
  },
  {
    id: "dudoso",
    label: "El dudoso con créditos incompletos",
    nombre: "Marta Xocop",
    iniciales: "MX",
    apertura: "Buenas tardes, disculpe la molestia... fíjese que yo estudié Derecho en otra universidad pero me quedé a medias, no cerré el pensum. ¿Ustedes reciben con el 85 o el 86 por ciento de cursos aprobados?",
    dudas: [
      "Ah, mire, qué bueno. ¿Y mi pensum de la otra universidad cómo me lo revisan, licenciado(a), me lo van a homologar todo?",
      "Va pues. ¿Y aparte de esa certificación y el pensum, qué otro documento necesito para aplicar?"
    ],
    cierre: "Muchas gracias por la explicación, licenciado(a), la verdad me deja más tranquila. Voy a reunir mis papeles."
  },
  {
    id: "profesional",
    label: "El profesional ocupado",
    nombre: "Ing. Byron Coy",
    iniciales: "BC",
    apertura: "Buenas, mire, yo trabajo tiempo completo y ando por Quetzaltenango. ¿Tienen la modalidad virtual y en qué días son las clases?",
    dudas: [
      "Ok, ¿y esa modalidad virtual también la manejan para el área de Cobán, o allá solo es presencial?",
      "Perfecto. Y los sábados, ¿hasta qué hora son las clases? Es que ando con otros compromisos."
    ],
    cierre: "Ah vaya, perfecto, eso me acomoda bien. Se agradece la información, licenciado(a)."
  }
];

const REACTIONS = [
  "Ah vaya, perfecto.",
  "Mire, qué bien, no sabía.",
  "Fíjese que no tenía ni idea.",
  "Ok, va, entiendo.",
  "Ajá, muy bien, gracias por aclararme eso."
];
