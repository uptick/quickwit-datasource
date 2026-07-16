import React from 'react';
import { dateTime } from '@grafana/data';
import {
  EmbeddedScene,
  PanelBuilders,
  SceneControlsSpacer,
  SceneCSSGridItem,
  SceneCSSGridLayout,
  SceneDataTransformer,
  SceneFlexItem,
  SceneFlexLayout,
  SceneQueryRunner,
  SceneRefreshPicker,
  SceneTimePicker,
  sceneGraph,
} from '@grafana/scenes';
import { PLUGIN_BASE_URL, ROUTES } from '../../constants';
import { getTracesDatasource } from '../../utils/utils.datasource';
import { attributeColumnsTransform } from './attributeColumns';
import { AttributesSidebar } from './AttributesSidebar';
import { DatasourceControl } from './DatasourceControl';
import { ExplorerQueryBar, filterOf } from './ExplorerQueryBar';
import { ExplorerTabs } from './ExplorerTabs';
import { FocusRadio, MetricFocus, MetricKey, METRIC_KEYS } from './MetricFocus';
import { HeatmapSelect, HeatmapSelection } from './HeatmapSelect';
import { serverSortFor, TableSort } from './TableSortPills';
import { TracePeekDrawer } from './TracePeekDrawer';
import { zoomOutHotkeyBehavior } from './zoomOutBehavior';
import {
  buildLuceneQuery,
  errorRateQuery,
  heatmapQueries,
  rawSpansQuery,
  spanRateQuery,
  traceSearchQuery,
  DEFAULT_FILTER,
  HEATMAP_BUCKET_LOWER_MS,
  HEATMAP_BUCKET_UPPER_MS,
} from './queries';

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function spanExplorerScene() {
  const datasource = getTracesDatasource();
  const initialLucene = buildLuceneQuery(DEFAULT_FILTER);

  const heatmapRunner = new SceneQueryRunner({
    datasource,
    queries: heatmapQueries(initialLucene),
    maxDataPoints: 120,
  });
  const spanRateRunner = new SceneQueryRunner({
    datasource,
    queries: [spanRateQuery(initialLucene)],
    maxDataPoints: 80,
  });
  const errorRateRunner = new SceneQueryRunner({
    datasource,
    queries: [errorRateQuery(initialLucene)],
    maxDataPoints: 80,
  });
  const traceSearchRunner = new SceneQueryRunner({ datasource, queries: [traceSearchQuery(initialLucene)] });

  const tableSort = new TableSort({});
  const queryBar = new ExplorerQueryBar({ ...DEFAULT_FILTER, trailing: tableSort });
  const attributesSidebar = new AttributesSidebar({ selected: [] });
  const dsControl = new DatasourceControl();
  const tracePeek = new TracePeekDrawer();

  const allRunners = [heatmapRunner, spanRateRunner, errorRateRunner, traceSearchRunner];

  // Trace search carries the server-side ordering and a companion raw-spans
  // query when attribute columns are selected.
  const traceSearchQueries = (lucene: string) => {
    const search = traceSearchQuery(lucene, serverSortFor(tableSort.state.sort));
    return attributesSidebar.state.selected.length > 0 ? [search, rawSpansQuery(lucene)] : [search];
  };

  const applyQueries = () => {
    const lucene = buildLuceneQuery(filterOf(queryBar.state));
    heatmapRunner.setState({ queries: heatmapQueries(lucene) });
    spanRateRunner.setState({ queries: [spanRateQuery(lucene)] });
    errorRateRunner.setState({ queries: [errorRateQuery(lucene)] });
    traceSearchRunner.setState({ queries: traceSearchQueries(lucene) });
    allRunners.filter((runner) => runner.isActive).forEach((runner) => runner.runQueries());
  };

  // Rebuild every query when the filter bar changes (Run button, chips, URL restore).
  queryBar.addActivationHandler(() => {
    if (buildLuceneQuery(filterOf(queryBar.state)) !== initialLucene) {
      applyQueries();
    }
    const sub = queryBar.subscribeToState((newState, prevState) => {
      if (buildLuceneQuery(filterOf(newState)) !== buildLuceneQuery(filterOf(prevState))) {
        applyQueries();
      }
    });
    return () => sub.unsubscribe();
  });

  // Re-run the trace search when attribute columns change (adds/removes the raw-spans query).
  attributesSidebar.addActivationHandler(() => {
    const applyColumns = () => {
      traceSearchRunner.setState({ queries: traceSearchQueries(buildLuceneQuery(filterOf(queryBar.state))) });
      traceSearchRunner.runQueries();
    };
    if (attributesSidebar.state.selected.length > 0) {
      applyColumns();
    }
    const sub = attributesSidebar.subscribeToState((newState, prevState) => {
      if (newState.selected.join(',') !== prevState.selected.join(',')) {
        applyColumns();
      }
    });
    return () => sub.unsubscribe();
  });

  // Repoint every runner when the datasource picker changes.
  dsControl.addActivationHandler(() => {
    const sub = dsControl.subscribeToState(() => {
      const ref = getTracesDatasource();
      allRunners.forEach((runner) => {
        runner.setState({ datasource: ref });
        if (runner.isActive) {
          runner.runQueries();
        }
      });
      tracePeek.refreshDatasource();
      queryBar.forceRender();
      attributesSidebar.forceRender();
    });
    return () => sub.unsubscribe();
  });

  const metricFocus = new MetricFocus({ metric: 'duration' });

  const heatmapPanel = PanelBuilders.heatmap()
    .setTitle('Duration')
    .setDescription(
      'Span count by duration over time. Drag a rectangle to filter: width narrows the time range, height sets the duration filter.'
    )
    .setData(heatmapRunner)
    .setHeaderActions(<FocusRadio controller={metricFocus} metric="duration" />)
    .setOption('calculate', false)
    .setOption('yAxis', { unit: 'ms', decimals: 0 } as never)
    .setOption('cellGap', 1)
    .setOption('color', { scheme: 'Blues', steps: 24 } as never)
    .setOption('legend', { show: false } as never)
    .build();

  const spanRatePanel = PanelBuilders.timeseries()
    .setTitle('Span rate')
    .setData(spanRateRunner)
    .setHeaderActions(<FocusRadio controller={metricFocus} metric="spans" />)
    .setCustomFieldConfig('drawStyle', 'bars' as never)
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setColor({ mode: 'fixed', fixedColor: 'green' })
    .setOption('legend', { showLegend: false } as never)
    .build();

  const errorRatePanel = PanelBuilders.timeseries()
    .setTitle('Error rate')
    .setData(errorRateRunner)
    .setHeaderActions(<FocusRadio controller={metricFocus} metric="errors" />)
    .setCustomFieldConfig('drawStyle', 'bars' as never)
    .setCustomFieldConfig('fillOpacity', 100)
    .setCustomFieldConfig('lineWidth', 0)
    .setColor({ mode: 'fixed', fixedColor: 'red' })
    .setOption('legend', { showLegend: false } as never)
    .build();

  // Drag-to-filter overlay on the heatmap: x = time range, y = span duration.
  const heatmapSelect = new HeatmapSelect({ panel: heatmapPanel });
  heatmapSelect.onSelect = (selection: HeatmapSelection) => {
    if (!selection.durationOnly) {
      const timeRange = sceneGraph.getTimeRange(heatmapSelect);
      const { from, to } = timeRange.state.value;
      const span = to.valueOf() - from.valueOf();
      const newFrom = dateTime(from.valueOf() + selection.fx0 * span);
      const newTo = dateTime(from.valueOf() + selection.fx1 * span);
      timeRange.onTimeRangeChange({ from: newFrom, to: newTo, raw: { from: newFrom, to: newTo } });
    }
    if (!selection.timeOnly) {
      const bucketCount = HEATMAP_BUCKET_UPPER_MS.length;
      // Rows render top-down from the largest bucket to the smallest.
      const topRow = clamp(Math.floor(selection.fyTop * bucketCount), 0, bucketCount - 1);
      const bottomRow = clamp(Math.ceil(selection.fyBottom * bucketCount) - 1, 0, bucketCount - 1);
      const upperIndex = bucketCount - 1 - topRow;
      const lowerIndex = bucketCount - 1 - bottomRow;
      const durationMax = upperIndex >= bucketCount - 1 ? '' : String(HEATMAP_BUCKET_UPPER_MS[upperIndex]);
      const durationMin = lowerIndex <= 0 ? '' : String(HEATMAP_BUCKET_LOWER_MS[lowerIndex]);
      queryBar.onApply({ ...filterOf(queryBar.state), durationMin, durationMax });
    }
  };

  // Focused metric renders large on the left (2/3), the other two stack beside it.
  const gridItems: Record<MetricKey, SceneCSSGridItem> = {
    duration: new SceneCSSGridItem({ body: heatmapSelect }),
    spans: new SceneCSSGridItem({ body: spanRatePanel }),
    errors: new SceneCSSGridItem({ body: errorRatePanel }),
  };

  const applyFocus = (metric: MetricKey) => {
    const side = METRIC_KEYS.filter((key) => key !== metric);
    gridItems[metric].setState({ gridColumn: '1', gridRow: `1 / span ${side.length}` });
    side.forEach((key, index) => {
      gridItems[key].setState({ gridColumn: '2', gridRow: `${index + 1}` });
    });
  };
  applyFocus(metricFocus.state.metric);

  metricFocus.addActivationHandler(() => {
    applyFocus(metricFocus.state.metric);
    const sub = metricFocus.subscribeToState((newState) => applyFocus(newState.metric));
    return () => sub.unsubscribe();
  });

  const metricsGrid = new SceneCSSGridLayout({
    templateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
    templateRows: `repeat(${METRIC_KEYS.length - 1}, minmax(0, 1fr))`,
    rowGap: 1,
    columnGap: 1,
    children: METRIC_KEYS.map((key) => gridItems[key]),
  });

  const traceSearchData = new SceneDataTransformer({
    $data: traceSearchRunner,
    transformations: [attributeColumnsTransform(() => attributesSidebar.state.selected)],
  });

  const tracesPanel = PanelBuilders.table()
    .setTitle('Traces')
    .setDescription(
      'Trace summaries matching the current filters, most recent first (or slowest first with the Slowest pill, applied server-side). Click a trace ID to open the trace viewer. Extra columns come from the attributes sidebar.'
    )
    .setData(traceSearchData)
    .setOverrides((builder) =>
      builder.matchFieldsWithName('traceID').overrideLinks([
        {
          title: 'Open in trace viewer',
          url: `${PLUGIN_BASE_URL}/${ROUTES.Trace}\${__url.params:exclude:traceId,query,durationMin,durationMax,peek,peekTab}&traceId=\${__value.text}`,
        },
        {
          title: 'Peek trace',
          url: `${PLUGIN_BASE_URL}/${ROUTES.Explorer}\${__url.params:exclude:peek,peekTab}&peek=\${__value.text}`,
        },
        {
          title: 'Peek logs',
          url: `${PLUGIN_BASE_URL}/${ROUTES.Explorer}\${__url.params:exclude:peek,peekTab}&peek=\${__value.text}&peekTab=logs`,
        },
      ])
    )
    .build();

  // The sort pills re-run the trace search with server-side ordering
  // (URL restore included).
  tableSort.addActivationHandler(() => {
    const apply = () => {
      traceSearchRunner.setState({ queries: traceSearchQueries(buildLuceneQuery(filterOf(queryBar.state))) });
      traceSearchRunner.runQueries();
    };
    if (tableSort.state.sort) {
      apply();
    }
    const sub = tableSort.subscribeToState((newState, prevState) => {
      if (newState.sort !== prevState.sort) {
        apply();
      }
    });
    return () => sub.unsubscribe();
  });

  return new EmbeddedScene({
    $behaviors: [zoomOutHotkeyBehavior],
    body: new SceneFlexLayout({
      direction: 'column',
      children: [
        new SceneFlexItem({ ySizing: 'content', body: queryBar }),
        new SceneFlexItem({ height: 280, body: metricsGrid }),
        new SceneFlexLayout({
          direction: 'row',
          children: [
            new SceneFlexItem({ width: 340, body: attributesSidebar }),
            new SceneFlexItem({ minHeight: 320, body: tracesPanel }),
          ],
        }),
      ],
    }),
    controls: [
      new ExplorerTabs({ active: 'explorer' }),
      dsControl,
      metricFocus,
      tracePeek,
      new SceneControlsSpacer(),
      new SceneTimePicker({ isOnCanvas: true }),
      new SceneRefreshPicker({ isOnCanvas: true }),
    ],
  });
}
