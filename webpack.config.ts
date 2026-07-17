import ReplaceInFileWebpackPlugin from 'replace-in-file-webpack-plugin';
import type { Configuration } from 'webpack';

import { getPackageJson } from './.config/webpack/utils';
import grafanaConfig from './.config/webpack/webpack.config';

/**
 * Extends the scaffolded config: the base ReplaceInFileWebpackPlugin only
 * templates dist/plugin.json, so add the same %VERSION%/%TODAY%/%PLUGIN_ID%
 * replacement for the nested datasource plugin manifest.
 */
const config = async (env: Record<string, unknown>): Promise<Configuration> => {
  const baseConfig = await grafanaConfig(env);

  baseConfig.plugins = baseConfig.plugins ?? [];
  baseConfig.plugins.push(
    new ReplaceInFileWebpackPlugin([
      {
        dir: 'dist/datasources/quickwit',
        files: ['plugin.json'],
        rules: [
          { search: /\%VERSION\%/g, replace: getPackageJson().version },
          { search: /\%TODAY\%/g, replace: new Date().toISOString().substring(0, 10) },
          { search: /\%PLUGIN_ID\%/g, replace: 'quickwit-quickwit-datasource' },
        ],
      },
    ])
  );

  return baseConfig;
};

export default config;
