const uuidBits = 128;
const alphabet =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const alphabetBits = Math.floor(Math.log2(alphabet.length));
const uuidLen = Math.ceil(uuidBits / alphabetBits);

/** Generate a random identifier with a compact URL-safe encoding */
export function uuid() {
  let str = '';
  for (let i = 0; i < uuidLen; i++) {
    str += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return str;
}
