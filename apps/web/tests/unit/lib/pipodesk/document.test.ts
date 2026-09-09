// @vitest-environment node
import { documentKey, documentLabel } from '@/lib/pipodesk/document'

describe('documentLabel', () => {
  it('should name the documents the EI asks for, in both spellings of the proof of address', () => {
    expect(documentLabel('rg')).toBe('RG')
    expect(documentLabel('cpf')).toBe('CPF')
    expect(documentLabel('comprovante-residencia')).toBe('Comprovante de residência')
    expect(documentLabel('comprovante_residencia')).toBe('Comprovante de residência')
  })

  it('should capitalise an unknown key instead of hiding it', () => {
    expect(documentLabel('certidao')).toBe('Certidao')
  })
})

describe('documentKey', () => {
  /** The pendency key and the file's kind are two EI spellings of the same
   *  document — and they differ by a word, not only by separator and accent.
   *  Matching them through the label let copy steer the comparison. */
  it('should resolve every EI spelling to the one key that names the document', () => {
    expect(documentKey('comprovante-residencia')).toBe('comprovante-residencia')
    expect(documentKey('comprovante_residencia')).toBe('comprovante-residencia')
    expect(documentKey('Comprovante de residência')).toBe('comprovante-residencia')
    expect(documentKey('rg')).toBe('rg')
    expect(documentKey('RG')).toBe('rg')
  })

  it('should keep documents that are not the same apart', () => {
    expect(documentKey('rg')).not.toBe(documentKey('CPF'))
  })

  it('should give an unknown spelling a key of its own, never a label', () => {
    expect(documentKey('Certidão de nascimento')).toBe('certidaodenascimento')
  })
})
