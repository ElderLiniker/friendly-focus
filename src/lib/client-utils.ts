/** Lê um arquivo de imagem, reduz para no máx. 1600px e retorna data URL JPEG/PNG. */
export async function fileToDataUrl(file: File, max = 1600): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Imagem inválida. Use PNG, JPG ou WEBP.");
  }
  if (file.size > 15 * 1024 * 1024) throw new Error("Imagem muito grande (máx. 15 MB).");
  const src = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(new Error("Não foi possível ler a imagem."));
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("Imagem inválida ou corrompida."));
    i.src = src;
  });
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.88);
}

export function errMsg(e: unknown) {
  if (e instanceof Error) return e.message;
  return "Algo deu errado. Tente novamente.";
}
