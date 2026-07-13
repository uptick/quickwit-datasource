import { concatenate, LuceneQuery } from './lucene';

describe('concatenate', () => {
  it('space-joins when no operator is given (Quickwit default-AND)', () => {
    expect(concatenate('service:x', 'level:error')).toBe('service:x level:error');
  });

  it('parenthesizes both sides when an operator is given', () => {
    // A bare `${query} AND ${filter}` would let Tantivy bind the AND only to
    // its adjacent clauses, making the leading space-separated terms optional.
    // Parenthesizing keeps both sides mandatory.
    expect(concatenate('service:x level:error', 'method:POST', 'AND')).toBe(
      '(service:x level:error) AND (method:POST)'
    );
  });

  it('returns the other side untouched when one side is empty', () => {
    expect(concatenate('service:x', '', 'AND')).toBe('service:x');
    expect(concatenate('', 'method:POST', 'AND')).toBe('method:POST');
    expect(concatenate('   ', 'method:POST', 'AND')).toBe('method:POST');
  });
});

describe('LuceneQuery.addFilter', () => {
  it('keeps existing multi-term queries mandatory when appending a filter', () => {
    const result = LuceneQuery.parse('service:x level:error').addFilter('method', 'POST').toString();
    expect(result).toBe('(service:x level:error) AND (method:"POST")');
  });
});
