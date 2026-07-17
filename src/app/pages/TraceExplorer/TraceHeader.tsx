import React from 'react';
import { css } from '@emotion/css';
import { DataFrame, GrafanaTheme2 } from '@grafana/data';
import { sceneGraph, SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { useStyles2 } from '@grafana/ui';

export interface TraceHeaderState extends SceneObjectState {}

interface TraceSummary {
  traceId: string;
  rootSpan: string;
  durationMs: number;
  spanCount: number;
  errorCount: number;
  services: string[];
  start: Date | undefined;
}

/**
 * Summary strip above the waterfall: trace ID, root span, duration, span and
 * error counts, services and start time — computed from the trace query data.
 */
export class TraceHeader extends SceneObjectBase<TraceHeaderState> {
  static Component = TraceHeaderRenderer;
}

function fieldValues<T>(frame: DataFrame, name: string): T[] {
  const field = frame.fields.find((f) => f.name === name);
  return field ? (field.values as unknown as T[]) : [];
}

function summarize(frame: DataFrame): TraceSummary | undefined {
  if (frame.length === 0) {
    return undefined;
  }
  const traceIds = fieldValues<string>(frame, 'traceID');
  const parents = fieldValues<string | undefined>(frame, 'parentSpanID');
  const names = fieldValues<string>(frame, 'operationName');
  const services = fieldValues<string>(frame, 'serviceName');
  const startTimes = fieldValues<number>(frame, 'startTime');
  const durations = fieldValues<number>(frame, 'duration');
  const statusCodes = fieldValues<number>(frame, 'statusCode');

  let rootIndex = 0;
  let minStart = Infinity;
  let maxEnd = -Infinity;
  let errorCount = 0;
  const serviceSet = new Set<string>();

  for (let i = 0; i < frame.length; i++) {
    if (!parents[i]) {
      rootIndex = i;
    }
    const start = startTimes[i] ?? 0;
    minStart = Math.min(minStart, start);
    maxEnd = Math.max(maxEnd, start + (durations[i] ?? 0));
    if (statusCodes[i] === 2) {
      errorCount++;
    }
    if (services[i]) {
      serviceSet.add(services[i]);
    }
  }

  return {
    traceId: traceIds[rootIndex] ?? '',
    rootSpan: names[rootIndex] ?? '',
    durationMs: maxEnd > minStart ? maxEnd - minStart : 0,
    spanCount: frame.length,
    errorCount,
    services: Array.from(serviceSet).sort(),
    start: Number.isFinite(minStart) ? new Date(minStart) : undefined,
  };
}

function formatDuration(ms: number): string {
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(2)} s`;
  }
  if (ms >= 1) {
    return `${ms.toFixed(ms < 10 ? 1 : 0)} ms`;
  }
  return `${(ms * 1000).toFixed(0)} µs`;
}

function TraceHeaderRenderer({ model }: SceneComponentProps<TraceHeader>) {
  const styles = useStyles2(getStyles);
  const { data } = sceneGraph.getData(model).useState();

  const frame = data?.series.find((s) => s.fields.some((f) => f.name === 'spanID'));
  const summary = frame ? summarize(frame) : undefined;

  if (!summary) {
    return <div className={styles.empty}>Enter a trace ID to inspect its spans and logs.</div>;
  }

  const stats: Array<[string, React.ReactNode]> = [
    ['Root', <span key="root" className={styles.mono}>{summary.rootSpan}</span>],
    ['Duration', <strong key="duration">{formatDuration(summary.durationMs)}</strong>],
    ['Spans', summary.spanCount],
    [
      'Errors',
      <span key="errors" className={summary.errorCount > 0 ? styles.error : undefined}>
        {summary.errorCount}
      </span>,
    ],
    ['Services', summary.services.join(' · ')],
    ['Start', summary.start ? summary.start.toISOString().replace('T', ' ').replace('Z', '') : '—'],
  ];

  return (
    <div className={styles.wrapper}>
      {stats.map(([label, value]) => (
        <div key={label} className={styles.stat}>
          <div className={styles.label}>{label}</div>
          <div className={styles.value}>{value}</div>
        </div>
      ))}
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    gap: ${theme.spacing(4)};
    flex-wrap: wrap;
    padding: ${theme.spacing(1, 0)};
  `,
  stat: css`
    min-width: 0;
  `,
  label: css`
    font-size: ${theme.typography.bodySmall.fontSize};
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${theme.colors.text.secondary};
  `,
  value: css`
    font-size: ${theme.typography.body.fontSize};
    margin-top: ${theme.spacing(0.25)};
  `,
  mono: css`
    font-family: ${theme.typography.fontFamilyMonospace};
  `,
  error: css`
    color: ${theme.colors.error.text};
    font-weight: ${theme.typography.fontWeightBold};
  `,
  empty: css`
    color: ${theme.colors.text.secondary};
    padding: ${theme.spacing(1, 0)};
  `,
});
