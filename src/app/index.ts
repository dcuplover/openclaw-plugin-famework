import { registry } from "../generated/registry";
import type { OpenClawLikeApi } from "../framework/openclaw/adapter";
import { eagerRegisterCli } from "../framework/openclaw/adapter";
import { bootstrapOpenClawPlugin } from "../framework/openclaw/bootstrap";
import pluginManifest from "./plugin.manifest";
import statusCli from "./clis/status.cli";

// CLI definitions are registered synchronously (before any await) so exclude
// them from the kernel's async registration to avoid Commander duplicates.
const registryWithoutClis = { ...registry, clis: [] as typeof registry.clis };

const openClawPluginEntrypoint = bootstrapOpenClawPlugin(pluginManifest, registryWithoutClis);

const plugin = {
	id: pluginManifest.id,
	name: pluginManifest.name,
	description: pluginManifest.description,
	version: pluginManifest.version,
	configSchema: pluginManifest.configSchema,
	register(api: OpenClawLikeApi) {
		// Start async bootstrap — NOT awaited here so that the api.registerCli
		// calls below execute synchronously before control returns to OpenClaw.
		const runtimePromise = openClawPluginEntrypoint({
			api,
			config: api.pluginConfig as Partial<Record<string, unknown>> | undefined,
		});

		// Register CLIs SYNCHRONOUSLY so they exist before Commander parses args.
		eagerRegisterCli(api, statusCli, runtimePromise);

		runtimePromise.catch((err) => {
			const sink = api.logger ?? api.log;
			sink?.error?.(`[${pluginManifest.id}] Bootstrap failed: ${err}`);
		});

		// Return the promise so callers that DO await register() still get the runtime.
		return runtimePromise;
	},
};

export default plugin;
