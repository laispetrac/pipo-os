// @vitest-environment node
import { documentLabel } from '@/constants/pipodesk/domain'

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
