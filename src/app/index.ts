import { registry } from "../generated/registry";
import type { OpenClawLikeApi } from "../framework/openclaw/adapter";
import { bootstrapOpenClawPlugin } from "../framework/openclaw/bootstrap";
import pluginManifest from "./plugin.manifest";

const openClawPluginEntrypoint = bootstrapOpenClawPlugin(pluginManifest, registry);

const plugin = {
	id: pluginManifest.id,
	name: pluginManifest.name,
	description: pluginManifest.description,
	version: pluginManifest.version,
	configSchema: pluginManifest.configSchema,
	async register(api: OpenClawLikeApi) {
		return openClawPluginEntrypoint({
			api,
			config: api.pluginConfig as Partial<Record<string, unknown>> | undefined,
		});
	},
};

export default plugin;
