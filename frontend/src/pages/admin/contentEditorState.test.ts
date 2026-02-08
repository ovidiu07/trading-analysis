import { buildTranslationsPayload, createDefaultTranslations, updateLocalizedField } from './contentEditorState'

describe('contentEditorState helpers', () => {
  it('preserves locale values when switching tabs and editing another locale', () => {
    const initial = createDefaultTranslations()
    const withEnglish = updateLocalizedField(initial, 'en', { title: 'English title', body: 'English body' })
    const withRomanian = updateLocalizedField(withEnglish, 'ro', { title: 'Titlu', body: 'Corp' })

    expect(withRomanian.en.title).toBe('English title')
    expect(withRomanian.en.body).toBe('English body')
    expect(withRomanian.ro.title).toBe('Titlu')
    expect(withRomanian.ro.body).toBe('Corp')
  })

  it('builds payload with translations object', () => {
    const translations = createDefaultTranslations()
    const withEn = updateLocalizedField(translations, 'en', {
      title: 'Liquidity Playbook',
      summary: 'Summary',
      body: '## Body'
    })
    const withBoth = updateLocalizedField(withEn, 'ro', {
      title: 'Ghid lichiditate',
      summary: 'Rezumat',
      body: '## Corp'
    })

    expect(buildTranslationsPayload(withBoth)).toEqual({
      en: {
        title: 'Liquidity Playbook',
        summary: 'Summary',
        body: '## Body'
      },
      ro: {
        title: 'Ghid lichiditate',
        summary: 'Rezumat',
        body: '## Corp'
      }
    })
  })
})
