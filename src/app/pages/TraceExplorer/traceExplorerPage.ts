import { PageLayoutType } from '@grafana/data';
import { SceneAppPage, SceneTimeRange } from '@grafana/scenes';
import { ROUTES } from '../../constants';
import { prefixRoute } from '../../utils/utils.routing';
import { breakdownScene } from './breakdownScene';
import { spanExplorerScene } from './spanExplorerScene';
import { traceViewerScene } from './traceViewerScene';

// All pages use a custom layout (no page header) — the scenes render their own
// compact toolbar with the page switcher inline with the time picker.
export const traceViewerPage = new SceneAppPage({
  title: 'Trace viewer',
  layout: PageLayoutType.Custom,
  $timeRange: new SceneTimeRange({ from: 'now-15m', to: 'now' }),
  url: prefixRoute(ROUTES.Trace),
  routePath: ROUTES.Trace,
  getScene: traceViewerScene,
});

export const breakdownPage = new SceneAppPage({
  title: 'Breakdown',
  layout: PageLayoutType.Custom,
  $timeRange: new SceneTimeRange({ from: 'now-15m', to: 'now' }),
  url: prefixRoute(ROUTES.Breakdown),
  routePath: ROUTES.Breakdown,
  getScene: breakdownScene,
});

export const spanExplorerPage = new SceneAppPage({
  title: 'Span explorer',
  layout: PageLayoutType.Custom,
  $timeRange: new SceneTimeRange({ from: 'now-15m', to: 'now' }),
  url: prefixRoute(ROUTES.Explorer),
  routePath: ROUTES.Explorer,
  getScene: spanExplorerScene,
});
