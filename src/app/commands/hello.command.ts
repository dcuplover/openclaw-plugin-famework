import { defineCommand } from "../../framework/core/definition";

export default defineCommand({
  kind: "command",
  name: "hello",
  description: "Reply hello",
  acceptsArgs: true,
  requireAuth: true,
  handler(commandContext, _context) {
    const sender = commandContext.senderId ?? "unknown-sender";
    const channel = commandContext.channel ?? "unknown-channel";
    const suffix = commandContext.args ? ` ${commandContext.args}` : "";

    return { text: `hello${suffix} from ${sender} via ${channel}` };
  },
});
