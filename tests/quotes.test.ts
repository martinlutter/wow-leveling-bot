import { quotes, randomQuote } from '../src/quotes';

describe('quotes', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('has a text and a source for every quote', () => {
    for (const quote of quotes) {
      expect(quote.text).not.toBe('');
      expect(quote.source).not.toBe('');
    }
  });

  it('picks a quote across the whole list', () => {
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.9999);

    expect(randomQuote()).toBe(quotes[0]);
    expect(randomQuote()).toBe(quotes[quotes.length - 1]);
  });
});
