import { describe, expect, it } from 'vitest'
import { linkParts, shortLink } from './LinkedText'

describe('links in free text', () => {
  it('names GitHub pull requests and issues by repository and number', () => {
    expect(shortLink('https://github.com/RoboticImagingAI/roboimg/pull/582')).toBe('roboimg#582')
    expect(shortLink('https://github.com/acme/web/issues/7#issuecomment-1')).toBe('web#7')
  })

  it('shortens other links to host and path', () => {
    expect(shortLink('https://www.example.com/')).toBe('example.com')
    expect(shortLink('https://docs.example.com/a/very/long/path/that/keeps/going/on')).toBe('docs.example.com/a/very/long/path/that/…')
  })

  it('finds links inside text, leaving the punctuation after them', () => {
    expect(linkParts('Review https://github.com/acme/web/pull/12, please.')).toEqual([
      { text: 'Review ' },
      { text: 'web#12', href: 'https://github.com/acme/web/pull/12' },
      { text: ', please.' },
    ])
    expect(linkParts('no links here')).toEqual([{ text: 'no links here' }])
  })
})
