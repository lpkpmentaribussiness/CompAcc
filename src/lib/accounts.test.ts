import { describe, expect, it } from 'vitest'
import { normalBalanceForCategory, validateAccountInput } from './accounts'

describe('account management rules', () => {
  it('menentukan normal balance berdasarkan kategori', () => {
    expect(normalBalanceForCategory('asset')).toBe('debit')
    expect(normalBalanceForCategory('expense')).toBe('debit')
    expect(normalBalanceForCategory('liability')).toBe('credit')
    expect(normalBalanceForCategory('equity')).toBe('credit')
    expect(normalBalanceForCategory('revenue')).toBe('credit')
  })

  it('menerima format kode akun yang didukung', () => {
    expect(() => validateAccountInput('5110-OPS_1', 'Beban Operasional')).not.toThrow()
  })

  it('menolak kode akun yang tidak valid', () => {
    expect(() => validateAccountInput('51 10', 'Beban Operasional')).toThrow('Kode akun')
    expect(() => validateAccountInput('5110/OPS', 'Beban Operasional')).toThrow('Kode akun')
  })

  it('menolak nama akun kosong atau terlalu panjang', () => {
    expect(() => validateAccountInput('5110', '  ')).toThrow('Nama akun wajib')
    expect(() => validateAccountInput('5110', 'A'.repeat(121))).toThrow('maksimal 120')
  })
})
