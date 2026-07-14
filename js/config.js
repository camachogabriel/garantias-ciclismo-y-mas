// Configuración de Supabase — proyecto: Garantias Ciclismo y Mas
const SUPABASE_URL = 'https://cejgurbaweucfpuzvdpw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_qXqEI0bVkwXtH8eqByoPqQ_9dVp8KTI';

const ESTADOS = {
  en_revision:        { label: 'En revisión',        color: '#f59e0b' },
  aprobada:           { label: 'Aprobada',            color: '#3b82f6' },
  enviada:            { label: 'Enviada',             color: '#8b5cf6' },
  recibida:           { label: 'Recibida',            color: '#06b6d4' },
  lista_para_entrega: { label: 'Lista para entrega',  color: '#22c55e' },
  rechazada:          { label: 'Rechazada',           color: '#ef4444' },
};

const MARCAS = ['Favero', 'Sigeyi', 'XOSS', '4iiii'];
