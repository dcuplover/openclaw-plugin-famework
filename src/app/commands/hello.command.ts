import { defineCommand } from "../../framework/core/definition";

export default defineCommand({
  kind: "command",
  name: "hello",
  description: "Reply hello",
  handler(_args, _context) {
    return { text: "hello" };
  },
});
