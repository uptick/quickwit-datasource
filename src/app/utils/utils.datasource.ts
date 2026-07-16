import { DataSourceInstanceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { QUICKWIT_DS_TYPE } from '../constants';

export type TraceExplorerSettings = {
  tracesDatasourceUid?: string;
  logsDatasourceUid?: string;
};

// Populated from the app plugin meta (jsonData) before any scene activates.
let settings: TraceExplorerSettings = {};

// Session override from the toolbar datasource picker (URL-synced per scene).
let tracesOverrideUid: string | undefined;

export function setTraceExplorerSettings(newSettings?: TraceExplorerSettings) {
  settings = newSettings ?? {};
}

export function setTracesDatasourceOverride(uid: string | undefined) {
  tracesOverrideUid = uid;
}

export function quickwitDatasources(): DataSourceInstanceSettings[] {
  return Object.values(config.datasources).filter((ds) => ds.type === QUICKWIT_DS_TYPE);
}

function findByUid(uid: string | undefined): DataSourceInstanceSettings | undefined {
  return uid ? quickwitDatasources().find((ds) => ds.uid === uid) : undefined;
}

function findByHint(hint: RegExp): DataSourceInstanceSettings | undefined {
  const candidates = quickwitDatasources();
  const index = (ds: DataSourceInstanceSettings) => (ds.jsonData as { index?: string })?.index ?? '';
  return candidates.find((ds) => hint.test(`${ds.name} ${index(ds)}`)) ?? candidates[0];
}

/** Grafana's default datasource, when it is a Quickwit one. */
function grafanaDefaultQuickwit(): DataSourceInstanceSettings | undefined {
  const byFlag = quickwitDatasources().find((ds) => ds.isDefault);
  if (byFlag) {
    return byFlag;
  }
  const byName = config.datasources[config.defaultDatasource];
  return byName?.type === QUICKWIT_DS_TYPE ? byName : undefined;
}

function toRef(ds: DataSourceInstanceSettings | undefined): DataSourceRef | undefined {
  return ds ? { uid: ds.uid, type: ds.type } : undefined;
}

export function getTracesDatasource(): DataSourceRef | undefined {
  // Grafana's default datasource (when it is a Quickwit one) wins over the
  // app-config default, so the app follows whatever "Default" is set on the
  // datasource settings page.
  return toRef(
    findByUid(tracesOverrideUid) ??
      grafanaDefaultQuickwit() ??
      findByUid(settings.tracesDatasourceUid) ??
      findByHint(/trace/i)
  );
}

/**
 * Logs datasource associated with the active traces datasource: the traces
 * datasource's own `logsDatasourceUid` pairing wins, then the app-level
 * default stored in the plugin settings, then a name/index heuristic.
 */
export function getLogsDatasource(): DataSourceRef | undefined {
  const traces = findByUid(getTracesDatasource()?.uid);
  const pairedUid = (traces?.jsonData as { logsDatasourceUid?: string })?.logsDatasourceUid;
  return toRef(findByUid(pairedUid) ?? findByUid(settings.logsDatasourceUid) ?? findByHint(/log/i));
}
