import React, { useState } from 'react';
import { Button, Field, FieldSet } from '@grafana/ui';
import { PluginConfigPageProps, AppPluginMeta, PluginMeta } from '@grafana/data';
import { DataSourcePicker, getBackendSrv, locationService } from '@grafana/runtime';
import { lastValueFrom } from 'rxjs';
import { testIds } from '../testIds';
import { QUICKWIT_DS_TYPE } from '../../constants';
import { TraceExplorerSettings } from '../../utils/utils.datasource';

export interface AppConfigProps extends PluginConfigPageProps<AppPluginMeta<TraceExplorerSettings>> {}

const AppConfig = ({ plugin }: AppConfigProps) => {
  const { enabled, pinned, jsonData } = plugin.meta;
  const [state, setState] = useState<TraceExplorerSettings>({
    tracesDatasourceUid: jsonData?.tracesDatasourceUid,
    logsDatasourceUid: jsonData?.logsDatasourceUid,
  });

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    updatePluginAndReload(plugin.meta.id, {
      enabled,
      pinned,
      jsonData: state,
    });
  };

  return (
    <form onSubmit={onSubmit} data-testid={testIds.appConfig.container}>
      <FieldSet label="Datasources">
        <Field
          label="Traces datasource"
          description="Quickwit datasource pointing at your OTEL traces index (e.g. otel-traces-v0_7)"
        >
          <DataSourcePicker
            width={40}
            inputId="traces-datasource"
            filter={(ds) => ds.type === QUICKWIT_DS_TYPE}
            current={state.tracesDatasourceUid}
            onChange={(ds) => setState({ ...state, tracesDatasourceUid: ds.uid })}
            noDefault
          />
        </Field>
        <Field
          label="Logs datasource"
          description="Quickwit datasource pointing at your OTEL logs index (e.g. otel-logs-v0_7), used for trace log correlation"
        >
          <DataSourcePicker
            width={40}
            inputId="logs-datasource"
            filter={(ds) => ds.type === QUICKWIT_DS_TYPE}
            current={state.logsDatasourceUid}
            onChange={(ds) => setState({ ...state, logsDatasourceUid: ds.uid })}
            noDefault
          />
        </Field>
        <Button type="submit" data-testid={testIds.appConfig.submit}>
          Save settings
        </Button>
      </FieldSet>
    </form>
  );
};

export default AppConfig;

const updatePluginAndReload = async (pluginId: string, data: Partial<PluginMeta<TraceExplorerSettings>>) => {
  try {
    await updatePlugin(pluginId, data);

    // Reloading the page as the changes made here wouldn't be propagated to the actual plugin otherwise.
    // This is not ideal, however unfortunately currently there is no supported way for updating the plugin state.
    locationService.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
};

const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = getBackendSrv().fetch({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });

  const dataResponse = await lastValueFrom(response);

  return dataResponse.data;
};
