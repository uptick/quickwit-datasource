import React from 'react';
import {
  SceneObjectBase,
  SceneObjectState,
  SceneObjectUrlSyncConfig,
  SceneObjectUrlValues,
} from '@grafana/scenes';
import { FilterPill, Tooltip } from '@grafana/ui';
import { TraceSearchSort } from './queries';

export interface TableSortState extends SceneObjectState {
  sort?: 'slowest';
}

/** Server-side trace_search sort for the pill, or undefined for most recent. */
export function serverSortFor(sort: TableSortState['sort']): TraceSearchSort | undefined {
  return sort === 'slowest' ? 'duration' : undefined;
}

/**
 * "Slowest" toggle for the traces table: when active, the trace search scans
 * the slowest spans of the window server-side (sort_by=-span_duration_millis)
 * and orders traces by duration. Off by default (most recent first).
 * Synced to the `sort` URL parameter.
 */
export class TableSort extends SceneObjectBase<TableSortState> {
  static Component = TableSortRenderer;

  protected _urlSync = new SceneObjectUrlSyncConfig(this, { keys: ['sort'] });

  public getUrlState() {
    return { sort: this.state.sort };
  }

  public updateFromUrl(values: SceneObjectUrlValues) {
    if (values.sort !== undefined) {
      const sort = values.sort === 'slowest' ? 'slowest' : undefined;
      if (sort !== this.state.sort) {
        this.setState({ sort });
      }
    }
  }

  public onToggle = () => {
    this.setState({ sort: this.state.sort === 'slowest' ? undefined : 'slowest' });
  };
}

function TableSortRenderer({ model }: { model: TableSort }) {
  const { sort } = model.useState();
  return (
    <Tooltip content="Order traces by duration (server-side); off = most recent first">
      <span>
        <FilterPill label="Slowest" selected={sort === 'slowest'} onClick={model.onToggle} />
      </span>
    </Tooltip>
  );
}
