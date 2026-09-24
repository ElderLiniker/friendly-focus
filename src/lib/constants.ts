// Opções compartilhadas entre cliente e servidor. Adicionar novas opções aqui
// basta para aparecerem na interface (ex.: novas durações).

export const CREATION_FORMATS = [
  { id: "video_tiktok_shop", label: "Vídeo para TikTok Shop" },
  { id: "ugc", label: "Criativo UGC" },
  { id: "influencer", label: "Influencer apresentando produto" },
  { id: "product_image", label: "Imagem do produto" },
  { id: "script", label: "Roteiro" },
  { id: "full", label: "Criativo completo" },
] as const;

export const OBJECTIVES = [
  { id: "vender", label: "Vender" },
  { id: "curiosidade", label: "Gerar curiosidade" },
  { id: "viralizar", label: "Viralizar" },
  { id: "demonstrar", label: "Demonstrar produto" },
  { id: "review", label: "Review" },
  { id: "ugc", label: "UGC" },
  { id: "organico", label: "Conteúdo orgânico" },
  { id: "oferta", label: "Oferta" },
] as const;

export const VIDEO_STYLES = [
  "UGC", "Influencer", "Review", "Demonstração", "POV", "Storytelling", "Humor",
  "Anúncio direto", "Problema → solução", "Unboxing", "Comparação", "Conteúdo orgânico",
] as const;

export const TONES = ["Natural", "Animado", "Confiante", "Divertido", "Íntimo/conversa", "Profissional"] as const;

export const DURATIONS = [8, 10, 15, 20, 30] as const;
export const SCENE_COUNTS = [1, 2, 3, 4, 5, 6] as const;
export const MAX_PROMPT_CHARS = 900;

export const DESTINATIONS = [
  { id: "flow", label: "Google Flow / YouTube Create (≈900 caracteres)" },
  { id: "generic", label: "Outra ferramenta de vídeo" },
] as const;

export const IMAGE_KINDS = [
  { id: "holding", label: "Influencer segurando produto", needsInfluencer: true },
  { id: "using", label: "Influencer usando produto", needsInfluencer: true },
  { id: "scene", label: "Produto em cenário", needsInfluencer: false },
  { id: "lifestyle", label: "Lifestyle", needsInfluencer: false },
  { id: "ugc", label: "UGC", needsInfluencer: false },
  { id: "ad", label: "Foto para anúncio", needsInfluencer: false },
  { id: "cover", label: "Foto para capa", needsInfluencer: false },
  { id: "demo", label: "Demonstração do produto", needsInfluencer: false },
] as const;

export const INFLUENCER_OPTIONS = {
  gender: ["Feminino", "Masculino"],
  age: ["Jovem", "Adulto", "Maduro"],
  style: ["UGC", "Influencer", "Criador de conteúdo", "Profissional", "Lifestyle", "Casual"],
  niche: ["Beleza", "Moda", "Fitness", "Casa", "Tecnologia", "Alimentação", "Produtos diversos", "Outros"],
} as const;

export const PROGRESS_STEPS = [
  "Analisando produto...",
  "Definindo estratégia...",
  "Gerando roteiro...",
  "Preparando cenas...",
  "Finalizando criativo...",
];

export type ProductAnalysis = {
  name: string;
  category: string;
  summary: string;
  features: string[];
  benefits: string[];
  audience: string;
  confirmed: string[];
  unknown: string[];
  visual_identity: string;
  sufficient: boolean;
};

export type ProjectSettings = {
  format?: string;
  objective?: string;
  duration?: number;
  sceneCount?: number;
  style?: string; // "auto" = IA escolhe
  tone?: string;
  destination?: "flow" | "generic";
  hookCategory?: string;
};

export type Strategy = { objective: string; style: string; approach: string; rationale: string };
export type Hook = { category: string; text: string; template?: string };
export type Script = {
  hook: string;
  development: string;
  demonstration: string;
  benefit: string;
  cta: string;
};
export type Scene = {
  index: number;
  duration: number;
  action: string;
  narration: string;
  prompt: string;
};
