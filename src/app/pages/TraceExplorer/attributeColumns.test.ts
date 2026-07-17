import { of } from 'rxjs';
import { DataFrame, DataTransformContext, toDataFrame } from '@grafana/data';
import { attributeColumnsTransform } from './attributeColumns';

const context = {} as DataTransformContext;

function run(frames: DataFrame[], selected: string[]): Promise<DataFrame[]> {
  return new Promise((resolve) => {
    attributeColumnsTransform(() => selected)(context)(of(frames)).subscribe(resolve);
  });
}

const traceFrame = toDataFrame({
  fields: [
    {
      name: 'traceID',
      values: ['aaa', 'bbb', 'ccc'],
      config: { links: [{ title: 'Open trace', url: '/explore' }] },
    },
    { name: 'duration', values: [10, 20, 30] },
  ],
});

// The raw frame's refId is intentionally unset — the backend does not stamp it.
const rawFrame = toDataFrame({
  fields: [
    { name: 'trace_id', values: ['bbb', 'bbb', 'aaa'] },
    { name: 'span_attributes.workspace', values: [null, 'pyrosolv', 'uptick'] },
    { name: 'span_attributes.retries', values: [2, null, 7] },
  ],
});

describe('attributeColumnsTransform', () => {
  it('joins first non-null attribute values by trace id', async () => {
    const [result] = await run([traceFrame, rawFrame], ['span_attributes.workspace']);
    const column = result.fields.find((f) => f.name === 'span_attributes.workspace');
    expect(column?.values).toEqual(['uptick', 'pyrosolv', null]);
  });

  it('keeps numeric attributes numeric', async () => {
    const [result] = await run([traceFrame, rawFrame], ['span_attributes.retries']);
    const column = result.fields.find((f) => f.name === 'span_attributes.retries');
    expect(column?.values).toEqual([7, 2, null]);
  });

  it('drops the raw frame from the output', async () => {
    const result = await run([traceFrame, rawFrame], ['span_attributes.workspace']);
    expect(result).toHaveLength(1);
    expect(result[0].fields.some((f) => f.name === 'trace_id')).toBe(false);
  });

  it('returns only the trace frame when nothing is selected', async () => {
    const result = await run([traceFrame, rawFrame], []);
    expect(result).toHaveLength(1);
    expect(result[0].fields.map((f) => f.name)).toEqual(['traceID', 'duration']);
  });

  it('strips the datasource-provided links from the trace id field', async () => {
    const [result] = await run([traceFrame, rawFrame], []);
    const traceIdField = result.fields.find((f) => f.name === 'traceID');
    expect(traceIdField?.config.links).toEqual([]);
  });
});
