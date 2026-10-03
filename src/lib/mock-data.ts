export type CampaignStatus =
  | "Draft"
  | "Recruiting"
  | "Testing"
  | "Completed"
  | "Cancelled";

export type ParticipationStatus =
  | "Waiting access"
  | "Access enabled"
  | "Active"
  | "Completed"
  | "Incompatible"
  | "Abandoned"
  | "Cancelled";

export type Campaign = {
  id: string;
  name: string;
  app: string;
  category: string;
  description: string;
  platform: string;
  countries: string[];
  minVersion: string;
  duration: string;
  target: number;
  covered: number;
  status: CampaignStatus;
  color: string;
  icon: string;
  instructions: string[];
};

export const campaigns: Campaign[] = [
  {
    id: "pocket-garden",
    name: "Pocket Garden: beta 2.4",
    app: "Pocket Garden",
    category: "Lifestyle",
    description:
      "Ayúdanos a probar una nueva forma de planificar tu jardín. Buscamos personas que disfruten cuidar sus plantas y quieran compartir comentarios sobre la experiencia.",
    platform: "Android",
    countries: ["España", "México", "Argentina"],
    minVersion: "Android 12+",
    duration: "14 días",
    target: 24,
    covered: 18,
    status: "Recruiting",
    color: "mint",
    icon: "PG",
    instructions: [
      "Usa la app al menos tres veces durante el periodo de prueba.",
      "Prueba el planificador semanal y añade una planta a tu jardín.",
      "Comparte tus observaciones al final de la prueba.",
    ],
  },
  {
    id: "finch-wallet",
    name: "Finch Wallet: pagos simples",
    app: "Finch Wallet",
    category: "Finanzas",
    description:
      "Estamos afinando una experiencia de finanzas personales más clara. Explora el resumen de gastos y cuéntanos qué mejorarías.",
    platform: "iOS",
    countries: ["España", "Chile"],
    minVersion: "iOS 17+",
    duration: "10 días",
    target: 18,
    covered: 11,
    status: "Recruiting",
    color: "lavender",
    icon: "FW",
    instructions: [
      "Revisa el resumen de gastos de muestra.",
      "Configura una categoría y explora sus opciones.",
      "Deja comentarios sobre la claridad de los textos.",
    ],
  },
  {
    id: "trail-notes",
    name: "Trail Notes: mapas sin conexión",
    app: "Trail Notes",
    category: "Viajes",
    description:
      "Prueba la nueva experiencia para guardar rutas y notas para tu próxima escapada, incluso cuando no tienes conexión.",
    platform: "Android e iOS",
    countries: ["México", "Colombia", "España"],
    minVersion: "Android 11+ / iOS 16+",
    duration: "21 días",
    target: 30,
    covered: 27,
    status: "Testing",
    color: "mint",
    icon: "TN",
    instructions: [
      "Guarda una ruta de ejemplo para consultarla después.",
      "Añade una nota en un punto del recorrido.",
      "Prueba la vista de mapa sin conexión.",
    ],
  },
  {
    id: "luma-learn",
    name: "Luma Learn: repaso diario",
    app: "Luma Learn",
    category: "Educación",
    description:
      "Una app de aprendizaje en pequeñas sesiones. Queremos validar el ritmo de las lecciones y el seguimiento del progreso.",
    platform: "Android",
    countries: ["Argentina", "Uruguay", "México"],
    minVersion: "Android 10+",
    duration: "7 días",
    target: 16,
    covered: 9,
    status: "Recruiting",
    color: "blue",
    icon: "LL",
    instructions: [
      "Completa una sesión corta cada día.",
      "Explora la pantalla de progreso.",
      "Cuéntanos si las sesiones tienen la duración adecuada.",
    ],
  },
];

export const participations: {
  campaignId: string;
  status: ParticipationStatus;
  endDate: string;
}[] = [
  { campaignId: "trail-notes", status: "Active", endDate: "28 oct 2026" },
  {
    campaignId: "pocket-garden",
    status: "Waiting access",
    endDate: "04 nov 2026",
  },
  {
    campaignId: "luma-learn",
    status: "Access enabled",
    endDate: "20 oct 2026",
  },
  { campaignId: "finch-wallet", status: "Completed", endDate: "12 oct 2026" },
  {
    campaignId: "pocket-garden",
    status: "Incompatible",
    endDate: "—",
  },
  { campaignId: "trail-notes", status: "Abandoned", endDate: "—" },
  { campaignId: "luma-learn", status: "Cancelled", endDate: "—" },
];

export const myApps = [
  {
    name: "Pocket Garden",
    description: "Un espacio sencillo para planificar y cuidar tus plantas.",
    platform: "Android",
    campaigns: 2,
    status: "Activa",
    color: "peach",
    icon: "PG",
  },
  {
    name: "Finch Wallet",
    description: "Finanzas personales con una experiencia más clara.",
    platform: "iOS",
    campaigns: 1,
    status: "Activa",
    color: "lavender",
    icon: "FW",
  },
  {
    name: "Trail Notes",
    description: "Guarda rutas y notas para tu próxima escapada.",
    platform: "Android e iOS",
    campaigns: 2,
    status: "Activa",
    color: "peach",
    icon: "TN",
  },
  {
    name: "Luma Learn",
    description: "Aprende con sesiones cortas y un progreso claro.",
    platform: "Android",
    campaigns: 1,
    status: "Archivada",
    color: "blue",
    icon: "LL",
  },
];

export const myCampaigns = [
  {
    name: "Pocket Garden: beta 2.4",
    app: "Pocket Garden",
    platform: "Android",
    duration: "14 días",
    status: "Recruiting" as CampaignStatus,
    target: 24,
    covered: 18,
    id: "pocket-garden",
    color: "mint",
    icon: "PG",
  },
  {
    name: "Finch Wallet: pagos simples",
    app: "Finch Wallet",
    platform: "iOS",
    duration: "10 días",
    status: "Recruiting" as CampaignStatus,
    target: 18,
    covered: 11,
    id: "finch-wallet",
    color: "lavender",
    icon: "FW",
  },
  {
    name: "Trail Notes: mapas sin conexión",
    app: "Trail Notes",
    platform: "Android e iOS",
    duration: "21 días",
    status: "Testing" as CampaignStatus,
    target: 30,
    covered: 27,
    id: "trail-notes",
    color: "peach",
    icon: "TN",
  },
  {
    name: "Luma Learn: repaso diario",
    app: "Luma Learn",
    platform: "Android",
    duration: "7 días",
    status: "Completed" as CampaignStatus,
    target: 16,
    covered: 16,
    id: "luma-learn",
    color: "blue",
    icon: "LL",
  },
  {
    name: "Northstar: próxima versión",
    app: "Northstar",
    platform: "iOS",
    duration: "14 días",
    status: "Draft" as CampaignStatus,
    target: 12,
    covered: 0,
    id: "northstar-draft",
    color: "lavender",
    icon: "N",
  },
  {
    name: "Trail Notes: rutas de invierno",
    app: "Trail Notes",
    platform: "Android e iOS",
    duration: "21 días",
    status: "Cancelled" as CampaignStatus,
    target: 20,
    covered: 6,
    id: "trail-notes-cancelled",
    color: "peach",
    icon: "TN",
  },
];

export const testers = [
  {
    initials: "SL",
    name: "Sofía López",
    email: "sofia.lopez@example.test",
    country: "España",
    device: "iPhone 15 · iOS 18",
    status: "Access enabled" as ParticipationStatus,
    date: "17 oct 2026",
  },
  {
    initials: "MR",
    name: "Mateo Ruiz",
    email: "mateo.ruiz@example.test",
    country: "México",
    device: "Pixel 8 · Android 15",
    status: "Waiting access" as ParticipationStatus,
    date: "16 oct 2026",
  },
  {
    initials: "VC",
    name: "Valentina Cruz",
    email: "valentina.cruz@example.test",
    country: "Chile",
    device: "iPhone 14 · iOS 17",
    status: "Active" as ParticipationStatus,
    date: "15 oct 2026",
  },
  {
    initials: "EG",
    name: "Emilio García",
    email: "emilio.garcia@example.test",
    country: "España",
    device: "iPhone 13 · iOS 17",
    status: "Completed" as ParticipationStatus,
    date: "14 oct 2026",
  },
];
