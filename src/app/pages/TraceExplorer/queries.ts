import { DataQuery } from '@grafana/schema';
import { SPAN_DURATION_FIELD, SPAN_ERROR_QUERY } from '../../constants';

// Query shapes understood by the Quickwit datasource backend (Elasticsearch-style).
export interface QuickwitQuery extends DataQuery {
  query: string;
  alias?: string;
  metrics: Array<{ id: string; type: string; settings?: Record<string, unknown>; field?: string }>;
  bucketAggs: Array<{ id: string; type: string; field?: string; settings?: Record<string, unknown> }>;
}

export interface ExplorerFilter {
  query: string;
  durationMin: string;
  durationMax: string;
  errorsOnly: boolean;
  rootOnly: boolean;
}

export const DEFAULT_FILTER: ExplorerFilter = {
  query: '',
  durationMin: '',
  durationMax: '',
  errorsOnly: false,
  rootOnly: false,
};

// Root spans have no parent_span_id indexed.
const ROOT_SPAN_QUERY = 'NOT parent_span_id:*';

// Combines the user's Lucene query with the duration range and quick filters.
export function buildLuceneQuery({ query, durationMin, durationMax, errorsOnly, rootOnly }: ExplorerFilter): string {
  const parts: string[] = [];
  const trimmed = query.trim();
  if (trimmed && trimmed !== '*') {
    parts.push(`(${trimmed})`);
  }
  if (durationMin.trim() || durationMax.trim()) {
    parts.push(`${SPAN_DURATION_FIELD}:[${durationMin.trim() || '0'} TO ${durationMax.trim() || '*'}]`);
  }
  if (errorsOnly) {
    parts.push(SPAN_ERROR_QUERY);
  }
  if (rootOnly) {
    parts.push(ROOT_SPAN_QUERY);
  }
  return parts.join(' AND ') || '*';
}

// Exponential duration buckets (milliseconds, ×4 per row). Each becomes one
// count-over-time query; the series alias is the bucket's upper bound so the
// heatmap panel reads the set as "time series buckets" with a log-scale y axis.
export const HEATMAP_BUCKET_UPPER_MS = [1, 4, 16, 64, 256, 1024, 4096, 16384, 65536];
export const HEATMAP_BUCKET_LOWER_MS = [0, 1, 4, 16, 64, 256, 1024, 4096, 16384];

const HEATMAP_DURATION_BUCKETS: Array<{ le: string; range: string }> = [
  { le: '1', range: '[0 TO 0]' },
  { le: '4', range: '[1 TO 3]' },
  { le: '16', range: '[4 TO 15]' },
  { le: '64', range: '[16 TO 63]' },
  { le: '256', range: '[64 TO 255]' },
  { le: '1024', range: '[256 TO 1023]' },
  { le: '4096', range: '[1024 TO 4095]' },
  { le: '16384', range: '[4096 TO 16383]' },
  { le: '65536', range: '[16384 TO *]' },
];

export function heatmapQueries(lucene: string): QuickwitQuery[] {
  return HEATMAP_DURATION_BUCKETS.map(({ le, range }, index) => {
    const rangeQuery = `${SPAN_DURATION_FIELD}:${range}`;
    return {
      refId: `heat${index}`,
      query: lucene === '*' ? rangeQuery : `${lucene} AND ${rangeQuery}`,
      alias: le,
      metrics: [{ id: '1', type: 'count' }],
      bucketAggs: [{ id: '2', type: 'date_histogram', settings: { interval: 'auto', min_doc_count: '0' } }],
    };
  });
}

export function spanRateQuery(lucene: string): QuickwitQuery {
  return {
    refId: 'spanrate',
    query: lucene,
    alias: 'spans',
    metrics: [{ id: '1', type: 'count' }],
    bucketAggs: [{ id: '2', type: 'date_histogram', settings: { interval: 'auto', min_doc_count: '0' } }],
  };
}

export function errorRateQuery(lucene: string): QuickwitQuery {
  const query = lucene === '*' ? SPAN_ERROR_QUERY : `${lucene} AND ${SPAN_ERROR_QUERY}`;
  return { ...spanRateQuery(query), refId: 'errorrate', query, alias: 'errors' };
}

/** Server-side ordering of trace summaries, applied before the result limit. */
export type TraceSearchSort = 'duration' | 'errors' | 'spans';

export function traceSearchQuery(lucene: string, sort?: TraceSearchSort): QuickwitQuery {
  return {
    refId: 'traces',
    query: lucene,
    metrics: [{ id: '1', type: 'trace_search', settings: { limit: '200', ...(sort ? { sort } : {}) } }],
    bucketAggs: [],
  };
}

// Raw span documents used to join extra attribute columns onto the trace table.
export function rawSpansQuery(lucene: string): QuickwitQuery {
  return {
    refId: 'rawspans',
    query: lucene,
    metrics: [{ id: '1', type: 'raw_data', settings: { size: '500' } }],
    bucketAggs: [],
  };
}

/** Lucene term matching one value of an attribute, e.g. `service_name:"frontend"`. */
export function attributeTerm(attribute: string, value: string): string {
  const escaped = value.replace(/(["\\])/g, '\\$1');
  return `${attribute}:"${escaped}"`;
}

/** Scopes a base Lucene query to one value of a breakdown attribute. */
export function valueLucene(lucene: string, attribute: string, value: string): string {
  const term = attributeTerm(attribute, value);
  return lucene === '*' ? term : `${lucene} AND ${term}`;
}

export function durationPercentilesQuery(lucene: string, percents: string[]): QuickwitQuery {
  return {
    refId: 'duration',
    query: lucene,
    // The alias names each series after its percentile, e.g. "p95.0".
    alias: '{{metric}}',
    metrics: [{ id: '1', type: 'percentiles', field: SPAN_DURATION_FIELD, settings: { percents } }],
    bucketAggs: [{ id: '2', type: 'date_histogram', settings: { interval: 'auto', min_doc_count: '0' } }],
  };
}

/** Series name the backend produces for a percentile, e.g. '99.9' → "p99.9". */
export function percentileSeriesName(percent: string): string {
  return `p${Number(percent).toFixed(1)}`;
}


export function traceLookupQuery(traceId: string): QuickwitQuery {
  return {
    refId: 'trace',
    query: traceId ? `trace_id:${traceId.trim()}` : 'trace_id:__none__',
    metrics: [{ id: '1', type: 'traces', settings: { limit: '10000' } }],
    bucketAggs: [],
  };
}

export function traceLogsQuery(traceId: string, spanId?: string, text?: string): QuickwitQuery {
  const parts = [traceId ? `trace_id:${traceId.trim()}` : 'trace_id:__none__'];
  if (spanId) {
    parts.push(`span_id:${spanId.trim()}`);
  }
  if (text?.trim()) {
    parts.push(`(${text.trim()})`);
  }
  return {
    refId: 'logs',
    query: parts.join(' AND '),
    metrics: [{ id: '1', type: 'logs', settings: { limit: '500', sortDirection: 'asc' } }],
    bucketAggs: [],
  };
}
