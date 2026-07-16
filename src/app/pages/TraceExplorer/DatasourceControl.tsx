import React from 'react';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { DataSourcePicker } from '@grafana/runtime';
import { QUICKWIT_DS_TYPE } from '../../constants';
import { getTracesDatasource, setTracesDatasourceOverride } from '../../utils/utils.datasource';

export interface DatasourceControlState extends SceneObjectState {
  uid?: string;
}

/**
 * Toolbar picker for the traces datasource (Quickwit datasources only),
 * synced to the `ds` URL parameter. The logs datasource follows the selected
 * traces datasource's `logsDatasourceUid` pairing (or the app defaults stored
 * server-side in the plugin settings). Scenes subscribe to this object to
 * repoint their query runners.
 */
export class DatasourceControl extends SceneObjectBase<DatasourceControlState> {
  static Component = DatasourceControlRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['ds'] });

  public constructor(state: DatasourceControlState = {}) {
    super(state);
    setTracesDatasourceOverride(state.uid);
  }

  public getUrlState() {
    return { ds: this.state.uid || undefined };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (typeof values.ds === 'string' && values.ds !== this.state.uid) {
      this.onChange(values.ds);
    }
  }

  public onChange = (uid: string) => {
    setTracesDatasourceOverride(uid);
    this.setState({ uid });
  };
}

function DatasourceControlRenderer({ model }: SceneComponentProps<DatasourceControl>) {
  const { uid } = model.useState();
  return (
    <div title="Traces datasource">
      <DataSourcePicker
        width={24}
        inputId="qw-traces-datasource"
        filter={(ds) => ds.type === QUICKWIT_DS_TYPE}
        current={uid ?? getTracesDatasource()?.uid}
        onChange={(ds) => model.onChange(ds.uid)}
        noDefault
      />
    </div>
  );
}
