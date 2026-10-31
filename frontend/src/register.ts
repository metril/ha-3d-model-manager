export function defineOnce(tag: string, ctor: CustomElementConstructor): void {
  if (!customElements.get(tag)) customElements.define(tag, ctor);
}

interface CardInfo { type: string; name: string; description: string; preview?: boolean }

export function registerCard(info: CardInfo): void {
  const w = window as unknown as { customCards?: Array<CardInfo & { documentationURL?: string }> };
  w.customCards = w.customCards ?? [];
  if (w.customCards.some((c) => c.type === info.type)) return;
  w.customCards.push({ ...info, documentationURL: "https://github.com/metril/ha-3d-model-manager-integration#cards" });
}
