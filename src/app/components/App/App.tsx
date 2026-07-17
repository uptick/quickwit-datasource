import React from 'react';
import { css } from '@emotion/css';
import { SceneApp, useSceneApp } from '@grafana/scenes';
import { AppRootProps, GrafanaTheme2 } from '@grafana/data';
import { Alert, useStyles2 } from '@grafana/ui';
import { PluginPropsContext } from '../../utils/utils.plugin';
import {
  quickwitDatasources,
  setTraceExplorerSettings,
  TraceExplorerSettings,
} from '../../utils/utils.datasource';
import { breakdownPage, spanExplorerPage, traceViewerPage } from '../../pages/TraceExplorer/traceExplorerPage';

function getSceneApp() {
  return new SceneApp({
    pages: [traceViewerPage, breakdownPage, spanExplorerPage],
    urlSyncOptions: {
      updateUrlOnInit: true,
      createBrowserHistorySteps: true,
    },
  });
}

function AppWithScenes() {
  const scene = useSceneApp(getSceneApp);
  const styles = useStyles2(getStyles);

  if (quickwitDatasources().length === 0) {
    return (
      <Alert title="No Quickwit datasource found" severity="warning">
        The trace explorer queries Quickwit datasources. Add one (pointing at your OTEL traces index, e.g.{' '}
        <code>otel-traces-v0_7</code>) and configure it in the app settings.
      </Alert>
    );
  }

  // The pages use PageLayoutType.Custom (no standard page header), so provide
  // the content padding the standard layout would normally add.
  return (
    <div className={styles.wrapper}>
      <scene.Component model={scene} />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    height: 100%;
    padding: ${theme.spacing(2)};
  `,
});

function App(props: AppRootProps<TraceExplorerSettings>) {
  // Make the configured datasource UIDs available to scene construction.
  setTraceExplorerSettings(props.meta.jsonData ?? undefined);

  return (
    <PluginPropsContext.Provider value={props}>
      <AppWithScenes />
    </PluginPropsContext.Provider>
  );
}

export default App;
