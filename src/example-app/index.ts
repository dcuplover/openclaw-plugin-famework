import { registry } from "../generated/registry";
import { bootstrapOpenClawPlugin } from "../framework/openclaw/bootstrap";
import pluginManifest from "./plugin.manifest";

const openClawPluginEntrypoint = bootstrapOpenClawPlugin(pluginManifest, registry);

export default openClawPluginEntrypoint;
