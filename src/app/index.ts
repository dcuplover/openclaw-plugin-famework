import { registry } from "../generated/registry";
import type { OpenClawLikeApi } from "../framework/openclaw/adapter";
import { bootstrapOpenClawPlugin } from "../framework/openclaw/bootstrap";
import { appCliCommands, registerAppCli } from "./cli";
import pluginManifest from "./plugin.manifest";

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

		let runtime: Awaited<typeof runtimePromise> | null = null;
		const ensureRuntime = async () => {
			if (runtime) {
				return runtime;
			}
			runtime = await runtimePromise;
			return runtime;
		};

		// Register CLIs SYNCHRONOUSLY so they exist before Commander parses args.
		api.registerCli(
			({ program, logger }) => {
				registerAppCli({ program, ensureRuntime, logger });
			},
			{ commands: appCliCommands }
		);

		runtimePromise.catch((err) => {
			const sink = api.logger ?? api.log;
			sink?.error?.(`[${pluginManifest.id}] Bootstrap failed: ${err}`);
		});

		// Return the promise so callers that DO await register() still get the runtime.
		return runtimePromise;
	},
};

export default plugin;
