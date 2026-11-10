// Regenerates agent-workspace/contracts/run-output.schema.json from packages/data-contracts.
import { writeFileSync } from "node:fs";
import { toJSONSchema } from "zod";
import { RunOutput } from "../packages/data-contracts/index.ts";
writeFileSync("agent-workspace/contracts/run-output.schema.json", JSON.stringify(toJSONSchema(RunOutput, { unrepresentable: "any" }), null, 2) + "\n");
console.log("wrote agent-workspace/contracts/run-output.schema.json");
