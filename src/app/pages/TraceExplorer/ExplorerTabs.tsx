import React from 'react';
import { SceneComponentProps, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { locationService } from '@grafana/runtime';
import { RadioButtonGroup } from '@grafana/ui';
import { PLUGIN_BASE_URL, ROUTES } from '../../constants';

export type ExplorerTab = 'explorer' | 'breakdown' | 'trace';

export interface ExplorerTabsState extends SceneObjectState {
  active: ExplorerTab;
}

const TABS: Array<{ label: string; value: ExplorerTab }> = [
  { label: 'Span explorer', value: 'explorer' },
  { label: 'Breakdown', value: 'breakdown' },
  { label: 'Trace viewer', value: 'trace' },
];

const TAB_ROUTES: Record<ExplorerTab, string> = {
  explorer: ROUTES.Explorer,
  breakdown: ROUTES.Breakdown,
  trace: ROUTES.Trace,
};

/**
 * Compact page switcher rendered inline with the time picker (the pages use a
 * custom layout without the standard page header/tabs to save vertical space).
 * Navigation keeps the current URL query params so time range and filters carry over.
 */
export class ExplorerTabs extends SceneObjectBase<ExplorerTabsState> {
  static Component = ExplorerTabsRenderer;

  public onChangeTab = (tab: ExplorerTab) => {
    if (tab === this.state.active) {
      return;
    }
    locationService.push({ pathname: `${PLUGIN_BASE_URL}/${TAB_ROUTES[tab]}`, search: window.location.search });
  };
}

function ExplorerTabsRenderer({ model }: SceneComponentProps<ExplorerTabs>) {
  const { active } = model.useState();
  return <RadioButtonGroup options={TABS} value={active} onChange={model.onChangeTab} />;
}
