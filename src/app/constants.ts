import pluginJson from '../plugin.json';

export const PLUGIN_BASE_URL = `/a/${pluginJson.id}`;

export enum ROUTES {
  Explorer = 'explorer',
  Breakdown = 'explorer/breakdown',
  Trace = 'explorer/trace',
}

export const QUICKWIT_DS_TYPE = 'quickwit-quickwit-datasource';

// Field names of Quickwit's OTEL traces index (otel-traces-v0_*).
export const SPAN_DURATION_FIELD = 'span_duration_millis';
export const SPAN_ERROR_QUERY = 'span_status.code:error';
