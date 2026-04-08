import CryptoJS from 'crypto-js'

/**
 * Criptografia AES usando crypto-js.
 * Utilizado para contornar o erro de "SubtleCrypto", que exige contexto seguro (HTTPS).
 */
const ENC_PREFIX = 'ENC:v2:'
const PBKDF2_ITERATIONS = 1000

/** Derives an AES-GCM CryptoKey from a passphrase + salt via PBKDF2 */
function deriveKey(passphrase, salt) {
  return CryptoJS.PBKDF2(passphrase, salt, {
    keySize: 256 / 32,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256
  })
}

/** Returns true if the string was encrypted by this module */
export function isEncrypted(text) {
  return typeof text === 'string' && (text.startsWith('ENC:v1:') || text.startsWith('ENC:v2:'))
}

/** Encrypt plaintext */
export async function encryptText(plaintext, passphrase, salt) {
  if (!plaintext || !passphrase) return plaintext ?? ''
  
  const key = deriveKey(passphrase, String(salt))
  const iv = CryptoJS.lib.WordArray.random(16)
  
  const encrypted = CryptoJS.AES.encrypt(plaintext, key, { iv: iv })
  
  const ivB64 = CryptoJS.enc.Base64.stringify(iv)
  const ctB64 = encrypted.ciphertext.toString(CryptoJS.enc.Base64)
  
  return `${ENC_PREFIX}${ivB64}:${ctB64}`
}

/** Decrypt plaintext. Returns original string if not encrypted. */
export async function decryptText(ciphertext, passphrase, salt) {
  if (!isEncrypted(ciphertext) || !passphrase) return ciphertext ?? ''
  try {
    const colonIdx1 = ciphertext.indexOf(':', 4) // past "ENC:"
    const prefix = ciphertext.slice(0, colonIdx1 + 1)
    
    const rest = ciphertext.slice(colonIdx1 + 1)
    const colonIdx2 = rest.indexOf(':')
    const ivB64 = rest.slice(0, colonIdx2)
    const ctB64 = rest.slice(colonIdx2 + 1)

    const key = deriveKey(passphrase, String(salt))
    const iv = CryptoJS.enc.Base64.parse(ivB64)
    
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(ctB64)
    })
    
    const decrypted = CryptoJS.AES.decrypt(cipherParams, key, { iv: iv })
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8)
    
    if (!plaintext) {
       return '⚠️ [Erro ao descriptografar — chave incorreta?]'
    }
    
    return plaintext
  } catch (error) {
    return '⚠️ [Erro ao descriptografar — chave incorreta?]'
  }
}

/** Decrypt an array of notes in parallel */
export async function decryptNotes(notes, passphrase, salt) {
  return Promise.all(
    notes.map(async (n) => ({
      ...n,
      title:   await decryptText(n.title,   passphrase, salt),
      content: await decryptText(n.content, passphrase, salt),
    }))
  )
}

/** Encrypt both title + content of a note object */
export async function encryptNote(note, passphrase, salt) {
  const [title, content] = await Promise.all([
    encryptText(note.title,   passphrase, salt),
    encryptText(note.content, passphrase, salt),
  ])
  return { ...note, title, content }
}

/** localStorage key for a given userId */
export function localStorageKey(userId) {
  return `uan_enc_${userId}`
}
