//go:build mage
// +build mage

package main

import (
	// mage:import
	build "github.com/grafana/grafana-plugin-sdk-go/build"
)

func init() {
	// The Go backend belongs to the nested datasource plugin, not the
	// top-level app: read its plugin.json for the executable name and emit
	// the binaries (and go_plugin_build_manifest) next to it.
	_ = build.SetBeforeBuildCallback(func(cfg build.Config) (build.Config, error) {
		cfg.PluginJSONPath = "src/datasources/quickwit"
		cfg.OutputBinaryPath = "dist/datasources/quickwit"
		return cfg, nil
	})
}

// Default configures the default target.
var Default = build.BuildAll
