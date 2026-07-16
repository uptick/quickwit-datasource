import React from 'react';
import {
  EmbeddedScene,
  PanelBuilders,
  SceneControlsSpacer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
} from '@grafana/scenes';
import { getLogsDatasource, getTracesDatasource } from '../../utils/utils.datasource';
import { DatasourceControl } from './DatasourceControl';
import { ExplorerTabs } from './ExplorerTabs';
import { LogsFilter, LogsFilterControls } from './SpanFilter';
import { SpanLogsLink } from './SpanLogsLink';
import { TraceHeader } from './TraceHeader';
import { TraceIdBar } from './TraceIdBar';
import { zoomOutHotkeyBehavior } from './zoomOutBehavior';
import { traceLogsQuery, traceLookupQuery } from './queries';

// Approximate vertical chrome above the waterfall/logs row (top nav, toolbar,
// trace ID bar, trace header, paddings) — the row fills the rest of the viewport.
const CHROME_HEIGHT_PX = 240;

export function traceViewerScene() {
  const traceRunner = new SceneQueryRunner({
    datasource: getTracesDatasource(),
    queries: [traceLookupQuery('')],
  });
  const logsRunner = new SceneQueryRunner({
    datasource: getLogsDatasource(),
    queries: [traceLogsQuery('')],
  });

  const traceIdBar = new TraceIdBar({ traceId: '' });
  const logsFilter = new LogsFilter({ spanId: '', text: '' });
  const dsControl = new DatasourceControl();

  const applyQueries = () => {
    const { traceId } = traceIdBar.state;
    const { spanId, text } = logsFilter.state;
    traceRunner.setState({ datasource: getTracesDatasource(), queries: [traceLookupQuery(traceId)] });
    logsRunner.setState({ datasource: getLogsDatasource(), queries: [traceLogsQuery(traceId, spanId, text)] });
    traceRunner.runQueries();
    logsRunner.runQueries();
  };

  traceIdBar.addActivationHandler(() => {
    // The URL may have populated the trace ID before activation (deep link).
    if (traceIdBar.state.traceId) {
      applyQueries();
    }
    const sub = traceIdBar.subscribeToState((newState, prevState) => {
      if (newState.traceId !== prevState.traceId) {
        // A new trace invalidates the log filters.
        logsFilter.clear();
        applyQueries();
      }
    });
    return () => sub.unsubscribe();
  });

  logsFilter.addActivationHandler(() => {
    const sub = logsFilter.subscribeToState((newState, prevState) => {
      if (newState.spanId !== prevState.spanId || newState.text !== prevState.text) {
        logsRunner.setState({
          queries: [traceLogsQuery(traceIdBar.state.traceId, newState.spanId, newState.text)],
        });
        logsRunner.runQueries();
      }
    });
    return () => sub.unsubscribe();
  });

  dsControl.addActivationHandler(() => {
    const sub = dsControl.subscribeToState(() => applyQueries());
    return () => sub.unsubscribe();
  });

  const traceHeader = new TraceHeader({ $data: traceRunner });

  const waterfallPanel = PanelBuilders.traces()
    .setTitle('Waterfall')
    .setDescription('Click a span’s log icon to filter the trace logs to that span.')
    .setData(traceRunner)
    .build();

  // Clicking a span's "Logs for span" icon filters the in-app logs panel.
  const spanLogsLink = new SpanLogsLink({ panel: waterfallPanel });
  spanLogsLink.onSelectSpan = (spanId) => logsFilter.onChangeSpan(spanId);

  const logsPanel = PanelBuilders.logs()
    .setTitle('Trace logs')
    .setDescription(
      'Log lines sharing this trace ID, interleaved by time. Click a line for its fields; scroll to load more.'
    )
    .setData(logsRunner)
    .setHeaderActions(<LogsFilterControls controller={logsFilter} />)
    .setOption('showTime', true)
    .setOption('wrapLogMessage', true)
    .setOption('enableLogDetails', true)
    .setOption('enableInfiniteScrolling' as never, true as never)
    .build();

  return new EmbeddedScene({
    $behaviors: [zoomOutHotkeyBehavior],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({ ySizing: 'content', body: traceIdBar }),
        new SceneFlexItem({ ySizing: 'content', body: traceHeader }),
        new SceneFlexLayout({
          direction: 'row',
          minHeight: `calc(100vh - ${CHROME_HEIGHT_PX}px)`,
          children: [
            new SceneFlexItem({ body: spanLogsLink }),
            new SceneFlexItem({ width: '42%', body: logsPanel }),
          ],
        }),
      ],
    }),
    controls: [
      new ExplorerTabs({ active: 'trace' }),
      dsControl,
      logsFilter,
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({ isOnCanvas: true }),
    ],
  });
}
