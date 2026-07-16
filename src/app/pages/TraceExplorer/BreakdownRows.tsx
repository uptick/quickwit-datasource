import React from 'react';
import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import {
  SceneComponentProps,
  SceneFlexLayout,
  SceneObject,
  SceneObjectBase,
  SceneObjectState,
} from '@grafana/scenes';
import { Button, FilterInput, useStyles2 } from '@grafana/ui';

const BATCH_SIZE = 20;

export interface BreakdownRowsState extends SceneObjectState {
  /** Attribute being broken down (for the helper text). */
  attribute: string;
  values: string[];
  /** True when the value list was truncated to the fetch cap. */
  capped: boolean;
  /** Client-side search over the value list. */
  search: string;
  visibleCount: number;
  /** Column layout whose children are the per-value rows (keeps scene-graph parenting). */
  list: SceneFlexLayout;
}

/**
 * One full-width row of panels per breakdown value, each with a header naming
 * the value and a button to add it to the query filter. At most 20 rows render
 * initially; scrolling to the bottom loads 20 more (infinite scroll), and the
 * search box narrows the value list for high-cardinality attributes.
 */
export class BreakdownRows extends SceneObjectBase<BreakdownRowsState> {
  static Component = BreakdownRowsRenderer;

  /** Builds the panels row for one value. Assigned by the scene. */
  public buildRow?: (value: string) => SceneFlexLayout;
  /** Adds the value as a query filter. Assigned by the scene. */
  public onAddFilter?: (value: string) => void;

  public constructor() {
    super({
      attribute: '',
      values: [],
      capped: false,
      search: '',
      visibleCount: 0,
      list: new SceneFlexLayout({ direction: 'column', children: [] }),
    });
  }

  public filteredValues(): string[] {
    const search = this.state.search.trim().toLowerCase();
    return search ? this.state.values.filter((v) => v.toLowerCase().includes(search)) : this.state.values;
  }

  /** Replaces the value list and rebuilds all rows (new attribute or filter). */
  public setValues(attribute: string, values: string[], capped = false) {
    this.setState({ attribute, values, capped, search: '' });
    this.showFirstBatch();
  }

  public onSearch = (search: string) => {
    this.setState({ search });
    this.showFirstBatch();
  };

  /** Rebuilds the currently visible rows (e.g. after the query changed). */
  public rebuild() {
    const visible = this.filteredValues().slice(0, this.state.visibleCount);
    this.state.list.setState({ children: visible.map((value) => this.buildRow!(value)) });
  }

  public loadMore = () => {
    const filtered = this.filteredValues();
    const { visibleCount, list } = this.state;
    if (visibleCount >= filtered.length) {
      return;
    }
    const nextCount = Math.min(filtered.length, visibleCount + BATCH_SIZE);
    const appended = filtered.slice(visibleCount, nextCount).map((value) => this.buildRow!(value));
    this.setState({ visibleCount: nextCount });
    list.setState({ children: [...list.state.children, ...appended] });
  };

  private showFirstBatch() {
    const filtered = this.filteredValues();
    const visibleCount = Math.min(filtered.length, BATCH_SIZE);
    this.setState({ visibleCount });
    this.state.list.setState({ children: filtered.slice(0, visibleCount).map((value) => this.buildRow!(value)) });
  }
}

function BreakdownRowsRenderer({ model }: SceneComponentProps<BreakdownRows>) {
  const { attribute, values, capped, search, visibleCount, list } = model.useState();
  const { children } = list.useState();
  const styles = useStyles2(getStyles);
  const sentinelRef = React.useRef<HTMLDivElement>(null);

  // Rebuilding rows is expensive (panels + queries), so the search input is
  // debounced: it only applies 500ms after typing stops.
  const [draft, setDraft] = React.useState(search);
  const [prevSearch, setPrevSearch] = React.useState(search);
  if (prevSearch !== search) {
    setPrevSearch(search);
    setDraft(search);
  }
  const debounceRef = React.useRef<ReturnType<typeof setTimeout>>();
  const onSearchChange = (value: string) => {
    setDraft(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => model.onSearch(value), 500);
  };
  React.useEffect(() => () => clearTimeout(debounceRef.current), []);

  const searchTerm = search.trim().toLowerCase();
  const filtered = searchTerm ? values.filter((v) => v.toLowerCase().includes(searchTerm)) : values;

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        model.loadMore();
      }
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [model]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.headerRow}>
        <div className={styles.helper}>
          Each row shows span rate, errors and p90 duration for one value of{' '}
          <code>{attribute || 'the selected attribute'}</code>, most active first. Use <em>Filter</em> to narrow the
          query to that value.
        </div>
        <div className={styles.search}>
          <FilterInput placeholder="Search values…" value={draft} onChange={onSearchChange} />
        </div>
      </div>
      {children.map((row, index) => {
        const value = filtered[index] ?? '';
        const body = row as SceneObject;
        return (
          <section key={`${attribute}-${value}`} className={styles.row}>
            <div className={styles.rowHeader}>
              <span className={styles.rowTitle} title={value}>
                {value}
              </span>
              <Button
                size="sm"
                variant="secondary"
                icon="plus"
                tooltip={`Filter the query to ${attribute}:"${value}"`}
                onClick={() => model.onAddFilter?.(value)}
              >
                Filter
              </Button>
            </div>
            <div className={styles.rowBody}>
              <body.Component model={body} />
            </div>
          </section>
        );
      })}
      <div ref={sentinelRef} />
      <div className={styles.footer}>
        {filtered.length === 0
          ? search
            ? 'No values match the search.'
            : 'No values found for this attribute in the current time range.'
          : `Showing ${visibleCount} of ${filtered.length} values${
              visibleCount < filtered.length ? ' — scroll for more' : ''
            }${capped && !search ? ` (list capped at ${values.length}; search or refine the query to find others)` : ''}`}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    display: flex;
    flex-direction: column;
    width: 100%;
  `,
  headerRow: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(2)};
    padding: ${theme.spacing(0.5, 0, 1)};
  `,
  helper: css`
    flex: 1;
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};

    code {
      font-size: ${theme.typography.bodySmall.fontSize};
    }
  `,
  search: css`
    flex: 0 0 240px;
  `,
  row: css`
    padding: ${theme.spacing(1, 0, 2)};
    border-top: 1px solid ${theme.colors.border.medium};
  `,
  rowHeader: css`
    display: flex;
    align-items: center;
    gap: ${theme.spacing(1)};
    padding-bottom: ${theme.spacing(1)};
  `,
  rowTitle: css`
    font-family: ${theme.typography.fontFamilyMonospace};
    font-size: ${theme.typography.h5.fontSize};
    font-weight: ${theme.typography.fontWeightMedium};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,
  rowBody: css`
    min-height: 170px;
  `,
  footer: css`
    color: ${theme.colors.text.secondary};
    font-size: ${theme.typography.bodySmall.fontSize};
    padding: ${theme.spacing(1, 0)};
    border-top: 1px solid ${theme.colors.border.medium};
  `,
});
