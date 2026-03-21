export async function hashAnswer(questionId: number, optionIndex: number, salt: string): Promise<string> {
  const input = `${questionId}${optionIndex}${salt}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function checkAnswer(
  questionId: number, 
  selectedIndex: number, 
  salt: string, 
  expectedHash: string
): Promise<boolean> {
  const computed = await hashAnswer(questionId, selectedIndex, salt);
  return computed === expectedHash;
}

export async function decryptExplanation(
  questionId: number,
  correctIndex: number,
  salt: string,
  encrypted: { iv: string; ciphertext: string }
): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const keyInput = `${questionId}${correctIndex}${salt}`;
    const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(keyInput));
    const key = await crypto.subtle.importKey('raw', keyMaterial, 'AES-GCM', false, ['decrypt']);
    
    const iv = new Uint8Array(encrypted.iv.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    const ciphertext = new Uint8Array(encrypted.ciphertext.match(/.{2}/g)!.map(b => parseInt(b, 16)));
    
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
  } catch {
    return 'Unable to decrypt explanation.';
  }
}
